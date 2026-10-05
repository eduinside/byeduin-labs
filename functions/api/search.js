/**
 * Cloudflare Pages Function: 에듀서치 — 교육청 매뉴얼·지침 질의응답 (2026-09-27, GitHub md 연동 대체)
 * - 원본(HWP·HWPX·PDF)을 scripts/manual-ingest.mjs가 D1(manual_*)에 적재해 둔다.
 * - 검색: D1 FTS5(한글 바이그램, bm25) → 상위 조각 + 같은 문서 이웃 조각으로 문맥 확장 → LLM 답변 1회
 * - LLM: _ai.js generateContent(Timely → Gemini 폴백)
 * - 남용 방지: IP당 분 10회·하루 100회(edumaps-dge atlas ask.js와 같은 Cache API 방식)
 *
 * 요청: POST { query, history?, docs?: [docId], type?: 'search'|'summarize'|'question', documentPath?: docId }
 * 응답: { answer, sources: [{ n, doc, title, page, path }] }
 */

import { generateContent } from './_ai.js';
import { toMatchQuery } from './_manual-text.js';
import { checkOrigin, rateLimit, readJson, json } from './_guard.js';

const TOP_K = 6;             // bm25 상위 조각 수
const EXPAND = 3;            // 상위 몇 개에 이웃(앞뒤) 조각을 붙일지
const MAX_CONTEXT = 16000;   // 답변 컨텍스트 글자 상한
const MAX_SUMMARY = 24000;   // 문서 요약 입력 상한
const ANSWER_TIMELY_MODEL = 'google/gemini-2.5-flash';
const ANSWER_GEMINI_MODEL = 'gemini-flash-latest';


// ── 출처 검사·속도 제한 ───────────────────────────────
// _guard.js 공용 가드(호스트·Origin 검사 + Cache API 카운터). 한도는 _guard.js LIMITS.search
// (IP당 분 10회·하루 100회 — 이전과 같음 + 사이트 전체 하루 상한).
const MAX_BODY = 256 * 1024; // 대화 맥락(history)까지 포함한 요청 본문 상한

// ── 검색 ─────────────────────────────────────────────
async function retrieve(db, text, docIds) {
  const match = toMatchQuery(text);
  if (!match) return [];
  const filter = docIds.length ? ` AND c.doc_id IN (${docIds.map(() => '?').join(',')})` : '';
  const { results: hits } = await db.prepare(
    `SELECT c.id, c.doc_id, c.seq FROM manual_fts JOIN manual_chunks c ON c.id = manual_fts.rowid
     WHERE manual_fts MATCH ?${filter} ORDER BY bm25(manual_fts) LIMIT ${TOP_K}`
  ).bind(match, ...docIds).all();
  if (!hits.length) return [];

  // 상위 조각의 앞뒤 조각을 함께 가져온다(표가 앞 절 설명과 떨어져 있는 경우가 많음)
  const want = new Map(); // "doc|seq" → 순위
  hits.forEach((h, i) => {
    want.set(`${h.doc_id}|${h.seq}`, i);
    if (i < EXPAND) for (const d of [-1, 1]) {
      const k = `${h.doc_id}|${h.seq + d}`;
      if (!want.has(k)) want.set(k, i + 0.5);
    }
  });
  const pairs = [...want.keys()].map(k => k.split('|'));
  const { results: rows } = await db.prepare(
    `SELECT c.doc_id, c.seq, c.path, c.page_from, c.page_to, c.text, d.title FROM manual_chunks c
     JOIN manual_docs d ON d.id = c.doc_id
     WHERE ${pairs.map(() => '(c.doc_id = ? AND c.seq = ?)').join(' OR ')}`
  ).bind(...pairs.flatMap(([d, s]) => [d, Number(s)])).all();

  // 순위순으로 자르고, 같은 문서의 연속 조각은 원문 순서대로 묶는다
  const ranked = rows.map(r => ({ ...r, rank: want.get(`${r.doc_id}|${r.seq}`) })).sort((a, b) => a.rank - b.rank);
  const picked = [];
  let size = 0;
  for (const r of ranked) {
    if (size + r.text.length > MAX_CONTEXT && picked.length) break;
    picked.push(r); size += r.text.length;
  }
  picked.sort((a, b) => a.doc_id.localeCompare(b.doc_id) || a.seq - b.seq);
  const groups = [];
  for (const r of picked) {
    const g = groups[groups.length - 1];
    if (g && g.doc_id === r.doc_id && g.seqTo + 1 === r.seq) {
      g.seqTo = r.seq; g.page_to = r.page_to ?? g.page_to; g.text += '\n\n' + r.text; g.rank = Math.min(g.rank, r.rank);
    } else groups.push({ ...r, seqTo: r.seq });
  }
  return groups.sort((a, b) => a.rank - b.rank);
}

const pageLabel = g => g.page_from ? (g.page_to && g.page_to !== g.page_from ? `${g.page_from}~${g.page_to}쪽` : `${g.page_from}쪽`) : '';
const toSource = (g, i) => ({ n: i + 1, doc: g.doc_id, title: g.title, page: g.page_from ?? null, pageLabel: pageLabel(g), path: g.path || '' });

// 이전 대화 맥락(후속 질문 해석용)
function formatHistory(history) {
  if (!Array.isArray(history) || !history.length) return '';
  return '\n[이전 대화]\n' + history.slice(-6).map(m =>
    `${m.role === 'user' ? '사용자' : 'AI'}: ${String(m.content || '').slice(0, 500)}`).join('\n') + '\n';
}
// 후속 질문("그럼 중학교는?")도 검색되게 직전 사용자 질문을 검색어에 보탠다
function searchText(query, history) {
  const prev = Array.isArray(history) ? [...history].reverse().find(m => m.role === 'user') : null;
  return prev ? `${query} ${String(prev.content || '').slice(0, 200)}` : query;
}

const SYSTEM = '당신은 대구광역시교육청 매뉴얼·지침 안내 도우미입니다. 제공된 근거 자료 안에서만 답하고, 근거가 없으면 모른다고 말합니다.';
const NOT_FOUND = '제공된 매뉴얼에서 관련 내용을 찾을 수 없습니다.';

async function answer({ query, history, groups, env, request }) {
  const context = groups.map((g, i) =>
    `[${i + 1}] ${g.title}${g.path ? ` · ${g.path}` : ''}${pageLabel(g) ? ` · ${pageLabel(g)}` : ''}\n${g.text}`
  ).join('\n\n---\n\n');
  const prompt = `아래 근거 자료만 사용해 질문에 답하십시오.${formatHistory(history)}
규칙:
- 근거 자료에 있는 내용만 쓰고, 문장 끝에 근거 번호를 [1], [2]처럼 붙이십시오.
- 금액·인원·기한·조항 번호는 근거에 적힌 그대로 옮기십시오.
- 첫 줄에 어느 문서 기준인지 밝히십시오(예: "2026학년도 현장체험학습 매뉴얼 기준").
- 질문의 표현과 딱 맞지 않더라도 근거에 관련 기준·절차가 있으면 그것을 안내하십시오(표 안의 기준도 확인하십시오).
- 근거 자료에 관련 내용이 전혀 없을 때만 "${NOT_FOUND}"라고만 답하십시오.
- 한국어 마크다운으로 간결하게 쓰십시오. 표가 필요하면 마크다운 표를 쓰십시오.

[근거 자료]
${context}

[질문]
${query}`;
  return generateContent({
    systemPrompt: SYSTEM, userMessage: prompt, env, temperature: 0.2,
    timelyModel: ANSWER_TIMELY_MODEL, geminiModel: ANSWER_GEMINI_MODEL, request,
  });
}

async function summarize({ docId, query, env, request }) {
  const db = env.BYEDUIN_DB;
  const doc = await db.prepare('SELECT id, title FROM manual_docs WHERE id = ?').bind(docId).first();
  if (!doc) return json({ error: '문서를 찾을 수 없습니다.' }, 404);
  const { results } = await db.prepare('SELECT path, text FROM manual_chunks WHERE doc_id = ? ORDER BY seq').bind(docId).all();
  // 긴 지침은 전체를 넣을 수 없으므로 절마다 앞부분만 고르게 담는다
  const per = Math.max(200, Math.floor(MAX_SUMMARY / Math.max(1, results.length)));
  const body = results.map(r => `${r.path ? `[${r.path}] ` : ''}${r.text.slice(0, per)}`).join('\n\n').slice(0, MAX_SUMMARY);
  const extra = query && query !== '문서를 분석하고 요약해 주세요.' ? `\n특히 다음 내용을 중심으로: ${query}` : '';
  const text = await generateContent({
    systemPrompt: SYSTEM,
    userMessage: `다음은 「${doc.title}」의 본문입니다. 교직원이 업무에 바로 쓸 수 있게 핵심을 장별로 요약하십시오(10~15줄, 마크다운).${extra}\n\n${body}`,
    env, temperature: 0.3, timelyModel: ANSWER_TIMELY_MODEL, geminiModel: ANSWER_GEMINI_MODEL, request,
  });
  return json({ answer: text, sources: [{ n: 1, doc: doc.id, title: doc.title, page: null, pageLabel: '', path: '' }] });
}

export async function onRequestPost({ request, env }) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  if (!env.BYEDUIN_DB) return json({ error: '문서 저장소가 설정되지 않았습니다.' }, 500);

  const body = await readJson(request, MAX_BODY);
  if (body instanceof Response) return body;
  const query = String(body.query || '').trim().slice(0, 1000);
  const { type = 'search' } = body;
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const documentPath = body.documentPath ? String(body.documentPath).slice(0, 100) : '';
  if (!query) return json({ error: '질문을 입력해 주세요.' }, 400);

  const limited = await rateLimit(request, 'search');
  if (limited) return limited;

  try {
    if (type === 'summarize' && documentPath) return await summarize({ docId: documentPath, query, env, request });

    const docIds = type === 'question' && documentPath ? [String(documentPath)]
      : Array.isArray(body.docs) ? body.docs.slice(0, 20).map(d => String(d).slice(0, 100)) : [];
    const groups = await retrieve(env.BYEDUIN_DB, searchText(query, history), docIds);
    if (!groups.length) return json({ answer: NOT_FOUND, sources: [] });

    const text = await answer({ query, history, groups, env, request });
    // 답변에 실제로 인용된 번호만 출처로 보여 준다(없으면 전부)
    // 모델이 [1], [2, 6], [1][3] 등 여러 형태로 쓴다
    const cited = new Set([...text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap(m => m[1].split(',').map(Number)));
    const sources = text.includes(NOT_FOUND) ? []
      : groups.map(toSource).filter(s => !cited.size || cited.has(s.n));
    return json({ answer: text, sources });
  } catch (err) {
    console.error('❌ [search]', err.message);
    return json({ error: err.status === 429 ? '요청이 몰리고 있어요. 잠시 후 다시 시도해 주세요.' : 'AI 답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }, err.status === 429 ? 429 : 502);
  }
}
