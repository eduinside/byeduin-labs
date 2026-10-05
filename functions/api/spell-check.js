// POST /api/spell-check  { text } → { original, corrected, changed, errors }
// 맞춤법 검사기 화면과 Google Apps Script(UrlFetchApp, 화면의 "Apps Script" 예시)에서 부른다.
//   Apps Script는 Origin·Referer를 보내지 않으므로 둘 다 없는 요청은 통과시키고(allowNoOrigin),
//   다른 사이트의 브라우저 요청(Origin이 다른 출처)만 막는다. 실제 방어선은 횟수 한도다.
// 한도: LIMITS['spell-check'] + AI 텍스트 한도.
import { generateContent } from './_ai.js';
import { guard, json, readJson, errorResponse } from './_guard.js';

const TEXT_MAX = 3000;
const BODY_MAX = 32 * 1024;

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

  if (request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const blocked = await guard(request, 'spell-check', { allowNoOrigin: true });
  if (blocked) return blocked;

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'text 필드가 필요합니다.' }, 400);
  if (text.length > TEXT_MAX) return json({ error: '텍스트는 3000자 이하로 입력해주세요.' }, 400);

  let raw;
  try {
    raw = await generateContent({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: text,
      env,
      temperature: 0.2,
      request,
    });
  } catch (e) {
    console.error('[spell-check] 오류:', e.message);
    return errorResponse(e, '맞춤법 검사 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const result = JSON.parse(jsonMatch[0]);
    return json({
      original: text,
      corrected: result.corrected ?? text,
      changed: result.changed ?? (result.errors?.length > 0),
      errors: result.errors ?? [],
    });
  } catch (e) {
    console.error('[spell-check] 응답 파싱 실패:', raw.slice(0, 120));
    return json({ error: '검사 결과를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
  }
}
