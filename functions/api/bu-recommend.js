// POST /api/bu-recommend
// { q: string, episodes: [{id, title, titleKo, desc, descKo, level}] }
// → { ids: string[] }
// 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['bu-recommend'] + AI 텍스트 한도.
import { generateContent } from './_ai.js';
import { guard, json, readJson, str, errorResponse } from './_guard.js';

const Q_MAX = 200;          // 검색어 글자 수
const EPISODES_MAX = 300;   // 에피소드 수
const BODY_MAX = 1024 * 1024; // 클라이언트가 설명 전문을 함께 보내므로 넉넉히(1MB)

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'POST') return json({ error: '허용되지 않은 방식입니다.' }, 405);

  const blocked = await guard(request, 'bu-recommend');
  if (blocked) return blocked;

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;

  const q = str(body.q, Q_MAX);
  const episodes = (Array.isArray(body.episodes) ? body.episodes.slice(0, EPISODES_MAX) : [])
    .filter(e => e && typeof e === 'object' && typeof e.id === 'string' && e.id)
    .map(e => ({
      id: e.id.slice(0, 40),
      level: str(String(e.level ?? ''), 10),
      title: str(e.title, 200),
      titleKo: str(e.titleKo, 200),
      desc: str(e.desc, 80),
      descKo: str(e.descKo, 80),
    }));
  if (!q) return json({ error: '검색어(q)가 필요합니다' }, 400);
  if (!episodes.length) return json({ error: '에피소드 목록이 비어 있습니다' }, 400);

  const systemPrompt = [
    '너는 Blocks Universe(넘버블록스·알파블록스·컬러블록스·원더블록스) 에피소드 추천 전문가야.',
    '사용자 질의(한글 또는 영문)를 분석해서, 제공된 에피소드 목록에서 가장 관련 있는 에피소드 ID를 최대 12개 골라줘.',
    '반드시 JSON 배열 형식 ["id1","id2",...] 로만 응답하고, 다른 텍스트는 절대 포함하지 마.',
    'id는 반드시 목록에 있는 것만 사용해.',
  ].join('\n');

  const epLines = episodes.map(e =>
    `${e.id} | Lv${e.level || '?'} | ${e.titleKo || e.title} / ${e.title} | ${e.descKo || e.desc}`
  ).join('\n');

  const userMessage = `질의: "${q}"\n\n에피소드 목록:\n${epLines}`;

  let text;
  try {
    text = await generateContent({ systemPrompt, userMessage, env, temperature: 0.3, request });
  } catch (e) {
    console.error('[bu-recommend]', e && e.message);
    return errorResponse(e, 'AI 추천을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  let ids;
  try {
    const match = text.match(/\[[\s\S]*?\]/);
    ids = JSON.parse(match ? match[0] : text);
    if (!Array.isArray(ids)) throw new Error('not array');
  } catch {
    console.error('[bu-recommend] 응답 파싱 실패:', text.slice(0, 120));
    return json({ error: 'AI 응답을 읽지 못했어요. 다시 시도해 주세요.' }, 502);
  }

  const validSet = new Set(episodes.map(e => e.id));
  ids = ids.filter(id => typeof id === 'string' && validSet.has(id)).slice(0, 12);

  return json({ ids });
}
