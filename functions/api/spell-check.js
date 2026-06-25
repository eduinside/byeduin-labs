import { generateContent } from './_ai.js';

const SYSTEM_PROMPT = `당신은 한국어 맞춤법·문법 교정 전문가입니다.
입력된 텍스트를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 쓰지 마세요.

{
  "corrected": "교정된 전체 텍스트",
  "changed": true,
  "errors": [
    { "original": "틀린 표현", "corrected": "맞는 표현", "reason": "간단한 이유" }
  ]
}

오류가 없으면 "changed": false, "errors": [] 로 응답하세요.
맞춤법(띄어쓰기, 된소리, 외래어 표기 포함), 문법, 어색한 표현을 모두 잡아주세요.`;

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const text = (body.text || '').trim();
  if (!text) return json({ error: 'text 필드가 필요합니다.' }, 400);
  if (text.length > 3000) return json({ error: '텍스트는 3000자 이하로 입력해주세요.' }, 400);

  try {
    const raw = await generateContent({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: text,
      env,
      temperature: 0.2,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 응답에서 JSON을 추출할 수 없습니다.');
    const result = JSON.parse(jsonMatch[0]);

    return json({
      original: text,
      corrected: result.corrected ?? text,
      changed: result.changed ?? (result.errors?.length > 0),
      errors: result.errors ?? [],
    });
  } catch (e) {
    console.error('[spell-check] 오류:', e.message);
    return json({ error: e.message || 'AI 처리 중 오류가 발생했습니다.' }, 502);
  }
}
