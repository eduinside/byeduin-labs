/**
 * Netlify Function: 교육문서 RAG 검색 & 문서 요약/질문
 * - GitHub 공개 리포에서 MD 파일을 fetch하여 Gemini 2.0 Flash Lite로 검색
 * - GEMINI_API_KEY, EDU_DOCS_REPO 환경 변수 필요
 * - GITHUB_TOKEN 환경 변수 선택 (없으면 비인증 60req/h)
 */

// 문서 요약/질문 전용 함수
async function handleDocumentRequest(type, docPath, question, geminiApiKey) {
  try {
    console.log(`📄 [${type}] Fetching document: ${docPath}`);

    const REPO = process.env.EDU_DOCS_REPO || 'eduinside/byeduin-edu-docs';
    const rawUrl = `https://raw.githubusercontent.com/${REPO}/main/${docPath}`;

    const docRes = await fetch(rawUrl);
    if (!docRes.ok) {
      console.error('❌ [doc-request] Document not found:', docPath);
      return { statusCode: 404, body: JSON.stringify({ error: `문서를 찾을 수 없습니다: ${docPath}` }) };
    }

    const content = await docRes.text();
    // 토큰 절약: 문서 크기 제한 (6000자)
    const truncated = content.length > 6000
      ? content.slice(0, 6000) + '\n...(이하 생략)'
      : content;

    // 프롬프트 구성
    let prompt;
    if (type === 'summarize') {
      prompt = `다음 문서를 간단히 요약해 주세요 (5~10줄):\n\n${truncated}`;
    } else {
      prompt = `다음 문서를 읽고 질문에 답해주세요:\n\n문서:\n${truncated}\n\n질문: ${question}`;
    }

    console.log('🤖 [doc-request] Calling Gemini API...');
    console.log('📄 [doc-request] Prompt size:', prompt.length, 'chars');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
        })
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('❌ [doc-request] Gemini API failed:', err?.substring?.(0, 200));
      return { statusCode: 502, body: JSON.stringify({ error: 'AI 응답 생성 실패' }) };
    }

    const geminiData = await geminiRes.json();
    const answer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성하지 못했습니다.';

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

exports.handler = async (event) => {
  console.log('🔍 [search] Request received:', { query: event.body?.substring?.(0, 100) });

  if (event.httpMethod !== 'POST') {
    console.error('❌ [search] Invalid method:', event.httpMethod);
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    console.error('❌ [search] JSON parse failed:', err.message);
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { query, categories, type = 'search', documentPath } = body;
  console.log('📝 [search] Request type:', type, { query: query?.substring?.(0, 50), documentPath });

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    console.error('❌ [search] Invalid query');
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const REPO = process.env.EDU_DOCS_REPO || 'eduinside/byeduin-edu-docs';
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  console.log('🔧 [search] Config:', { REPO, hasGeminiKey: !!GEMINI_API_KEY, hasGithubToken: !!GITHUB_TOKEN });

  if (!GEMINI_API_KEY) {
    console.error('❌ [search] GEMINI_API_KEY not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: missing GEMINI_API_KEY' }) };
  }

  // 문서 요약/질문 요청 처리
  if ((type === 'summarize' || type === 'question') && documentPath) {
    console.log(`📄 [handler] Delegating to handleDocumentRequest: ${type}`);
    const result = await handleDocumentRequest(type, documentPath, query, GEMINI_API_KEY);
    return result;
  }

  // 일반 검색 처리
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
      return { statusCode: 502, body: `Failed to fetch document tree (HTTP ${treeRes.status})` };
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
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: '해당 카테고리에 문서가 없습니다.', sources: [] }),
      };
    }

    // 최대 10개 파일로 제한 (타임아웃 방지)
    const targetFiles = files.slice(0, 10);
    console.log('🎯 [search] Target files to fetch:', targetFiles.length);

    // 2. MD 파일 내용 병렬 fetch
    const rawBase = `https://raw.githubusercontent.com/${REPO}/main`;
    console.log('⬇️ [search] Fetching file contents...');
    const fetchResults = await Promise.allSettled(
      targetFiles.map(f =>
        fetch(`${rawBase}/${f.path}`)
          .then(r => r.ok ? r.text() : null)
          .then(text => text ? { path: f.path, text } : null)
      )
    );

    const contents = fetchResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    const failedCount = fetchResults.filter(r => r.status === 'rejected' || !r.value).length;
    console.log('✅ [search] Files fetched successfully:', contents.length, 'Failed:', failedCount);

    if (contents.length === 0) {
      console.error('❌ [search] No content could be fetched');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: '문서를 불러오지 못했습니다.', sources: [] }),
      };
    }

    // 3. Gemini 프롬프트 구성 (토큰 절약: 파일당 최대 4000자)
    const MAX_CHARS_PER_FILE = 4000;
    const context = contents
      .map(f => {
        const truncated = f.text.length > MAX_CHARS_PER_FILE
          ? f.text.slice(0, MAX_CHARS_PER_FILE) + '\n...(이하 생략)'
          : f.text;
        return `## [출처: ${f.path}]\n${truncated}`;
      })
      .join('\n\n---\n\n');

    const prompt = `당신은 교육 행정 전문가입니다. 아래 교육 문서들을 참고하여 질문에 정확하게 답하십시오.

규칙:
- 반드시 제공된 문서 내용에 근거하여 답변하십시오.
- 답변 마지막에 인용한 출처 파일명을 "**출처:** 파일명" 형식으로 명시하십시오.
- 문서에서 관련 내용을 찾을 수 없으면 "제공된 문서에서 관련 내용을 찾을 수 없습니다."라고 답하십시오.
- 답변은 명확하고 간결하게 작성하십시오.

교육 문서:
${context}

질문: ${query.trim()}`;

    console.log('🤖 [search] Calling Gemini API...');
    console.log('📄 [search] Prompt size:', prompt.length, 'chars');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    console.log('📊 [search] Gemini response:', { status: geminiRes.status, ok: geminiRes.ok });

    if (!geminiRes.ok) {
      const geminiErr = await geminiRes.text();
      console.error('❌ [search] Gemini API failed:', { status: geminiRes.status, error: geminiErr?.substring?.(0, 300) });
      return { statusCode: 502, body: `Gemini API request failed (HTTP ${geminiRes.status}): ${geminiErr?.substring?.(0, 100)}` };
    }

    const geminiData = await geminiRes.json();
    console.log('✅ [search] Gemini response received, parsing...');
    const answer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';

    // 답변에서 실제 사용한 출처 파일명 추출 (**출처: filename 형식)
    const sourcesMatch = answer.match(/\*\*출처:\*\*\s*(.+?)(?:\n|$)/g);
    const usedSourceSet = new Set();
    if (sourcesMatch) {
      sourcesMatch.forEach(match => {
        const filenames = match.replace(/\*\*출처:\*\*\s*/, '').trim().split(',').map(s => s.trim());
        filenames.forEach(fn => usedSourceSet.add(fn));
      });
    }

    // 실제 사용한 파일만 sources에 포함
    const sources = contents
      .filter(f => usedSourceSet.size === 0 || usedSourceSet.has(f.path.split('/').pop().replace(/\.md$/, '')))
      .map(f => f.path);

    // 모든 파일을 사용했는지 확인 (사용한 파일 수 = 제공한 파일 수)
    const allProvided = usedSourceSet.size === 0 || sources.length === contents.length;

    console.log('🎉 [search] Search completed successfully', { usedSources: Array.from(usedSourceSet), allProvided });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, sources, allProvided }),
    };
  } catch (err) {
    console.error('❌ [search] Unhandled error:', err.message, err.stack);
    return { statusCode: 502, body: `Server error: ${err.message}` };
  }
};
