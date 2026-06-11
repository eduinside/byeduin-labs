// POST /api/bu-translate
// { text: string }  (영어 에피소드 설명, 최대 2000자)
// → { ko: string }  (한국어 번역)
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const cors = { 'Access-Control-Allow-Origin': '*' };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON 파싱 실패' }, 400); }

  const text = (body.text || '').trim().slice(0, 2000);
  if (!text) return json({ error: 'text 필요' }, 400);

  const { generateContent } = await import('./_ai.js');

  const systemPrompt = [
    'BBC 어린이 교육 애니메이션(Numberblocks·Alphablocks·Colourblocks·Wonderblocks) 에피소드 설명을 영어에서 한국어로 번역해.',
    '대상은 유아~초등 저학년 어린이와 학부모야. 쉽고 자연스러운 문체를 사용해.',
    '번역문만 출력하고 다른 설명이나 접두사는 절대 포함하지 마.',
  ].join(' ');

  let ko;
  try {
    ko = await generateContent({ systemPrompt, userMessage: text, env, temperature: 0.3 });
  } catch (e) {
    return json({ error: e.message }, 502);
  }

  return json({ ko: ko.trim() });
}
