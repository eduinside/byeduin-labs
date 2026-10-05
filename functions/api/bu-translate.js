// POST /api/bu-translate
// { text: string }  (영어 에피소드 설명, 최대 2000자)
// → { ko: string }  (한국어 번역)
// 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['bu-translate'] + AI 텍스트 한도.
import { generateContent } from './_ai.js';
import { guard, json, readJson, str, errorResponse } from './_guard.js';

const TEXT_MAX = 2000;
const BODY_MAX = 16 * 1024;

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'POST') return json({ error: '허용되지 않은 방식입니다.' }, 405);

  const blocked = await guard(request, 'bu-translate');
  if (blocked) return blocked;

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;

  const text = str(body.text, TEXT_MAX);
  if (!text) return json({ error: '번역할 내용이 없습니다.' }, 400);

  const systemPrompt = [
    'BBC 어린이 교육 애니메이션(Numberblocks·Alphablocks·Colourblocks·Wonderblocks) 에피소드 설명을 영어에서 한국어로 번역해.',
    '대상은 유아~초등 저학년 어린이와 학부모야. 쉽고 자연스러운 문체를 사용해.',
    '번역문만 출력하고 다른 설명이나 접두사는 절대 포함하지 마.',
  ].join(' ');

  let ko;
  try {
    ko = await generateContent({ systemPrompt, userMessage: text, env, temperature: 0.3, request });
  } catch (e) {
    console.error('[bu-translate]', e && e.message);
    return errorResponse(e, '번역하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  return json({ ko: ko.trim() });
}
