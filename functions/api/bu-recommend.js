// POST /api/bu-recommend
// { q: string, episodes: [{id, title, titleKo, desc, descKo, level}] }
// → { ids: string[] }
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const cors = { 'Access-Control-Allow-Origin': '*' };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON 파싱 실패' }, 400); }

  const q = (body.q || '').trim();
  const episodes = Array.isArray(body.episodes) ? body.episodes.slice(0, 300) : [];
  if (!q) return json({ error: '검색어(q)가 필요합니다' }, 400);
  if (!episodes.length) return json({ error: '에피소드 목록이 비어 있습니다' }, 400);

  const { generateContent } = await import('./_ai.js');

  const systemPrompt = [
    '너는 Blocks Universe(넘버블록스·알파블록스·컬러블록스·원더블록스) 에피소드 추천 전문가야.',
    '사용자 질의(한글 또는 영문)를 분석해서, 제공된 에피소드 목록에서 가장 관련 있는 에피소드 ID를 최대 12개 골라줘.',
    '반드시 JSON 배열 형식 ["id1","id2",...] 로만 응답하고, 다른 텍스트는 절대 포함하지 마.',
    'id는 반드시 목록에 있는 것만 사용해.',
  ].join('\n');

  const epLines = episodes.map(e =>
    `${e.id} | Lv${e.level || '?'} | ${e.titleKo || e.title} / ${e.title} | ${(e.descKo || e.desc || '').slice(0, 80)}`
  ).join('\n');

  const userMessage = `질의: "${q}"\n\n에피소드 목록:\n${epLines}`;

  let text;
  try {
    text = await generateContent({ systemPrompt, userMessage, env, temperature: 0.3 });
  } catch (e) {
    return json({ error: e.message }, 502);
  }

  let ids;
  try {
    const match = text.match(/\[[\s\S]*?\]/);
    ids = JSON.parse(match ? match[0] : text);
    if (!Array.isArray(ids)) throw new Error('not array');
  } catch {
    return json({ error: `LLM 응답 파싱 실패: ${text.slice(0, 120)}` }, 502);
  }

  const validSet = new Set(episodes.map(e => e.id));
  ids = ids.filter(id => typeof id === 'string' && validSet.has(id)).slice(0, 12);

  return json({ ids });
}
