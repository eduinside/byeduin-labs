/**
 * Cloudflare Pages Function: 교육문서 RAG 검색 & 문서 요약/질문
 * - GitHub 공개 리포에서 MD 파일을 fetch하여 검색/답변
 * - 검색 흐름(2단계 라우터):
 *     1) 후보 문서 본문 fetch → 제목/소제목 카탈로그 생성
 *     2) 카탈로그 기반으로 관련 문서 선별(LLM, lite) → 선택 문서 전체 본문으로 최종 답변(LLM, flash)
 * - GEMINI_API_KEY / TIMELY_API_KEY, EDU_DOCS_REPO 환경 변수 필요
 * - GITHUB_TOKEN 환경 변수 선택 (없으면 비인증 60req/h)
 */

import { generateContent } from './_ai.js';

// ── 튜닝 상수 ─────────────────────────────────────────────
const MAX_FETCH        = 30;     // 카탈로그 생성을 위해 본문을 가져올 최대 후보 수
const MAX_SELECT       = 5;      // 최종 답변에 사용할 최대 문서 수
const MAX_CHARS_PER_DOC = 12000; // 선택 문서 1개당 답변 컨텍스트 상한(기존 4000 → 대폭 완화)
const MAX_DOC_QA_CHARS = 24000;  // 단일 문서 요약/질문 시 본문 상한(기존 6000 → 완화)
const ANSWER_TIMELY_MODEL = 'google/gemini-2.5-flash'; // 최종 답변은 lite→flash로 승격
const ANSWER_GEMINI_MODEL = 'gemini-flash-latest';

// ── 유틸 ─────────────────────────────────────────────────
// LLM이 코드블록/잡설을 섞어 내도 JSON만 안전하게 추출
function tolerantJsonParse(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return null; }
}

// 문서 본문에서 제목(H1)·소제목(H2~H4)·미리보기 추출 → 라우터용 카탈로그 엔트리
function buildCatalogEntry(path, text) {
  const lines = text.split('\n');
  let title = '';
  const headings = [];
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)/);
    if (h1 && !title) { title = h1[1].trim(); continue; }
    const h = line.match(/^#{2,4}\s+(.+)/);
    if (h) headings.push(h[1].trim());
  }
  if (!title) title = path.split('/').pop().replace(/\.md$/, '');
  const preview = text.replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { path, title, headings: headings.slice(0, 25), preview };
}

// 경로/파일명 기반 가벼운 어휘 점수(임베딩 없는 사전 컷·폴백용)
function lexicalScore(query, path) {
  const tokens = query.toLowerCase().split(/[^0-9a-z가-힣]+/i).filter(t => t.length >= 2);
  const target = path.toLowerCase();
  let score = 0;
  for (const t of tokens) if (target.includes(t)) score += 1;
  return score;
}

// 이전 대화 맥락을 프롬프트에 주입(후속 질문 해석용)
function formatHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const recent = history.slice(-6).map(m => {
    const role = (m.role === 'ai' || m.role === 'assistant') ? 'AI' : '사용자';
    const content = String(m.content || '').slice(0, 500);
    return `${role}: ${content}`;
  }).join('\n');
  return `\n\n[이전 대화]\n${recent}\n`;
}

// ── 문서 요약/질문 전용 함수 ────────────────────────────────
async function handleDocumentRequest(type, docPath, question, env, REPO) {
  try {
    console.log(`📄 [${type}] Fetching document: ${docPath}`);

    const rawUrl = `https://raw.githubusercontent.com/${REPO}/main/${docPath}`;

    const docRes = await fetch(rawUrl);
    if (!docRes.ok) {
      console.error('❌ [doc-request] Document not found:', docPath);
      return { statusCode: 404, body: JSON.stringify({ error: `문서를 찾을 수 없습니다: ${docPath}` }) };
    }

    const content = await docRes.text();
    // 본문 상한 완화(긴 문서 뒷부분 답변 손실 방지)
    const truncated = content.length > MAX_DOC_QA_CHARS
      ? content.slice(0, MAX_DOC_QA_CHARS) + '\n...(이하 생략)'
      : content;

    // 프롬프트 구성
    let prompt;
    if (type === 'summarize') {
      prompt = `다음 문서를 간단히 요약해 주세요 (5~10줄):\n\n${truncated}`;
    } else {
      prompt = `다음 문서를 읽고 질문에 답해주세요:\n\n문서:\n${truncated}\n\n질문: ${question}`;
    }

    console.log('🤖 [doc-request] Calling AI API...');
    console.log('📄 [doc-request] Prompt size:', prompt.length, 'chars');

    const answer = await generateContent({
      systemPrompt: '당신은 문서를 요약하거나 문서 내용에 기반해 질문에 성실히 답변해주는 AI 조수입니다.',
      userMessage: prompt,
      env,
      temperature: 0.3,
      // 단일 문서 분석은 품질이 중요 → flash로 승격
      timelyModel: ANSWER_TIMELY_MODEL,
      geminiModel: ANSWER_GEMINI_MODEL
    });

    console.log('✅ [doc-request] Completed successfully');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, sources: [docPath] })
    };
  } catch (err) {
    console.error('❌ [doc-request] Unhandled error:', err.message, err.stack);
    return { statusCode: 502, body: JSON.stringify({ error: `서버 오류: ${err.message}` }) };
  }
}

export async function onRequest(ctx) {
  let body;
  try {
    const rawBody = await ctx.request.text();
    console.log('🔍 [search] Request received:', { query: rawBody?.substring?.(0, 100) });

    body = JSON.parse(rawBody);
  } catch (err) {
    console.error('❌ [search] JSON parse failed:', err.message);
    return new Response('Invalid JSON', { status: 400 });
  }

  if (ctx.request.method !== 'POST') {
    console.error('❌ [search] Invalid method:', ctx.request.method);
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { query, categories, type = 'search', documentPath, history } = body;
  console.log('📝 [search] Request type:', type, { query: query?.substring?.(0, 50), documentPath, historyLen: history?.length });

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    console.error('❌ [search] Invalid query');
    return new Response(
      JSON.stringify({ error: 'Missing query' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const REPO = ctx.env.EDU_DOCS_REPO || 'eduinside/byeduin-edu-docs';
  const GITHUB_TOKEN = ctx.env.GITHUB_TOKEN;

  console.log('🔧 [search] Config:', { REPO, hasGithubToken: !!GITHUB_TOKEN });

  // 문서 요약/질문 요청 처리
  if ((type === 'summarize' || type === 'question') && documentPath) {
    console.log(`📄 [handler] Delegating to handleDocumentRequest: ${type}`);
    const result = await handleDocumentRequest(type, documentPath, query, ctx.env, REPO);
    return new Response(result.body, { status: result.statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  // ── 일반 검색 처리 (2단계 라우터) ──────────────────────────
  try {
    // 1. GitHub API로 파일 트리 조회
    console.log('📥 [search] Fetching GitHub tree...');
    const treeHeaders = { 'User-Agent': 'byeduin-edu-search' };
    if (GITHUB_TOKEN) treeHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;

    const treeRes = await fetch(
      `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`,
      { headers: treeHeaders }
    );

    console.log('📊 [search] GitHub tree response:', { status: treeRes.status, ok: treeRes.ok });

    if (!treeRes.ok) {
      const treeErr = await treeRes.text();
      console.error('❌ [search] GitHub API failed:', { status: treeRes.status, error: treeErr?.substring?.(0, 200) });
      return new Response(`Failed to fetch document tree (HTTP ${treeRes.status})`, { status: 502 });
    }

    const treeData = await treeRes.json();
    // MD 파일만, 폴더 안에 있는 파일만 (루트 레벨 readme.md 등 제외)
    let files = (treeData.tree || [])
      .filter(f => f.type === 'blob' && f.path.endsWith('.md') && f.path.includes('/'));

    console.log('📂 [search] Total MD files found:', files.length);

    // 카테고리 필터 (배열이 비어있으면 전체)
    if (Array.isArray(categories) && categories.length > 0) {
      files = files.filter(f =>
        categories.some(cat => f.path.startsWith(cat + '/') || f.path.startsWith(cat))
      );
      console.log('🏷️ [search] After category filter:', files.length);
    }

    if (files.length === 0) {
      console.warn('⚠️ [search] No files found after filtering');
      return new Response(
        JSON.stringify({ answer: '해당 카테고리에 문서가 없습니다.', sources: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 2. 후보 제한: 코퍼스가 클 때만 경로 기반 어휘 점수로 사전 컷(임베딩 없는 환경의 비용/타임아웃 방어)
    let candidates = files;
    if (candidates.length > MAX_FETCH) {
      candidates = [...files]
        .map(f => ({ f, s: lexicalScore(query, f.path) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, MAX_FETCH)
        .map(x => x.f);
      console.log('✂️ [search] Pre-filtered candidates (lexical):', candidates.length);
    }

    // 3. 후보 본문 병렬 fetch
    const rawBase = `https://raw.githubusercontent.com/${REPO}/main`;
    console.log('⬇️ [search] Fetching candidate contents...', candidates.length);
    const fetchResults = await Promise.allSettled(
      candidates.map(f =>
        fetch(`${rawBase}/${f.path}`)
          .then(r => r.ok ? r.text() : null)
          .then(text => text ? { path: f.path, text } : null)
      )
    );

    const fetched = fetchResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    console.log('✅ [search] Candidates fetched:', fetched.length, 'Failed:', candidates.length - fetched.length);

    if (fetched.length === 0) {
      console.error('❌ [search] No content could be fetched');
      return new Response(
        JSON.stringify({ answer: '문서를 불러오지 못했습니다.', sources: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const byPath = new Map(fetched.map(f => [f.path, f.text]));

    // 4. 관련 문서 선별 — 문서가 적으면 전부 사용, 많으면 카탈로그 기반 LLM 라우팅
    let selectedPaths;
    if (fetched.length <= MAX_SELECT) {
      selectedPaths = fetched.map(f => f.path);
      console.log('🎯 [search] Few docs → use all:', selectedPaths.length);
    } else {
      const catalog = fetched.map(f => buildCatalogEntry(f.path, f.text));
      const catalogText = catalog.map((c, i) =>
        `${i + 1}. ${c.path}\n   제목: ${c.title}\n   소제목: ${c.headings.join(' / ') || '(없음)'}\n   미리보기: ${c.preview}`
      ).join('\n\n');

      const selectorPrompt = `다음은 교육 문서 목록입니다. 사용자의 질문(이전 대화 맥락 포함)에 답하는 데 가장 관련 있는 문서를 최대 ${MAX_SELECT}개 고르세요.${formatHistory(history)}
[문서 목록]
${catalogText}

[현재 질문]
${query.trim()}

반드시 아래 JSON 형식으로만 답하세요(코드블록·설명 금지). 경로는 목록의 경로를 글자 그대로 복사하세요:
{"paths": ["정확한/경로1.md", "정확한/경로2.md"]}`;

      console.log('🧭 [search] Selector LLM over catalog:', catalog.length, 'docs');
      let selectorRaw = '';
      try {
        selectorRaw = await generateContent({
          systemPrompt: '당신은 문서 검색 라우터입니다. 질문과 가장 관련 있는 문서 경로만 JSON으로 반환합니다.',
          userMessage: selectorPrompt,
          env: ctx.env,
          temperature: 0
          // 선별 단계는 비용 절감을 위해 기본(flash-lite) 유지
        });
      } catch (e) {
        console.warn('⚠️ [search] Selector LLM failed, will fall back to lexical:', e.message);
      }

      const parsed = tolerantJsonParse(selectorRaw);
      const valid = new Set(fetched.map(f => f.path));
      selectedPaths = (Array.isArray(parsed?.paths) ? parsed.paths : [])
        .filter(p => valid.has(p))
        .slice(0, MAX_SELECT);

      // 폴백: 라우터 실패/빈 결과면 경로 어휘 점수 상위로
      if (selectedPaths.length === 0) {
        selectedPaths = [...fetched]
          .map(f => ({ p: f.path, s: lexicalScore(query, f.path) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, MAX_SELECT)
          .map(x => x.p);
        console.log('↩️ [search] Selector fallback (lexical):', selectedPaths);
      } else {
        console.log('🎯 [search] Selected docs:', selectedPaths);
      }
    }

    // 5. 선택 문서 전체 본문으로 최종 답변 컨텍스트 구성(완화된 상한)
    const context = selectedPaths.map(p => {
      const text = byPath.get(p) || '';
      const truncated = text.length > MAX_CHARS_PER_DOC
        ? text.slice(0, MAX_CHARS_PER_DOC) + '\n...(이하 생략)'
        : text;
      return `## [출처: ${p}]\n${truncated}`;
    }).join('\n\n---\n\n');

    const prompt = `당신은 교육 행정 전문가입니다. 아래 교육 문서들을 근거로 질문에 정확하게 답하십시오.${formatHistory(history)}
규칙:
- 반드시 제공된 문서 내용에 근거하여 답변하십시오.
- 이전 대화가 있으면 맥락을 고려해 후속 질문을 해석하십시오.
- 문서에서 관련 내용을 찾을 수 없으면 "제공된 문서에서 관련 내용을 찾을 수 없습니다."라고 답하십시오.
- 답변은 한국어 마크다운으로 명확하고 간결하게 작성하십시오.
- 출처 파일명을 본문에 따로 나열할 필요는 없습니다(시스템이 참조 문서를 표시합니다).

교육 문서:
${context}

[현재 질문]
${query.trim()}`;

    console.log('🤖 [search] Calling answer LLM...');
    console.log('📄 [search] Prompt size:', prompt.length, 'chars');

    const answer = await generateContent({
      systemPrompt: '당신은 교육 행정 전문가입니다. 제공된 문서 내용에만 기반하여 질문에 답해야 합니다.',
      userMessage: prompt,
      env: ctx.env,
      temperature: 0.2,
      timelyModel: ANSWER_TIMELY_MODEL,
      geminiModel: ANSWER_GEMINI_MODEL
    });

    // 참조 문서 = 라우터가 선별한 문서(취약한 정규식 추출 폐기 → 안정적)
    // 단, 답변이 "근거 없음"이면 (폴백으로 고른 무관한 문서가 칩으로 노출되지 않도록) 숨김
    const sources = /관련 내용을 찾을 수 없습니다/.test(answer) ? [] : selectedPaths;

    console.log('🎉 [search] Search completed successfully', { selected: selectedPaths.length });
    return new Response(
      JSON.stringify({ answer, sources, allProvided: false }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    console.error('❌ [search] Unhandled error:', err.message, err.stack);
    return new Response(`Server error: ${err.message}`, { status: 502 });
  }
}
