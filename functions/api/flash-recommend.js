// POST /api/flash-recommend  { subject } → { recommendation }
// 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['flash-recommend'] + AI 텍스트 한도.
import { generateContent } from './_ai.js';
import { guard, json, readJson, errorResponse } from './_guard.js';

const SUBJECT_MAX = 200;
const BODY_MAX = 4 * 1024;

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const blocked = await guard(ctx.request, 'flash-recommend');
  if (blocked) return blocked;

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject || subject.length > SUBJECT_MAX) {
    return json({ error: '입력값(subject)이 올바르지 않습니다.' }, 400);
  }

  const systemPrompt = [
    '너는 플래시카드(학습 낱말 카드) 제작 보조원이다.',
    '사용자가 제공한 주제(단어 덱 이름)에 관한 10개의 핵심 키워드/단어/개념 쌍(앞면과 뒷면)을 생성한다.',
    '각 개념 쌍은 학습하기에 유익하고 핵심적인 내용이어야 한다.',
    '출력 형식 규칙:',
    '1) 출력은 오직 각 줄마다 `앞면 내용 :: 뒷면 내용` 형식으로만 작성해야 한다.',
    '2) 추가 설명, 제목, 마크다운 코드 블록(예: ```), 번호 매기기 등은 절대 포함하지 말 것.',
    '3) 정확히 10개의 줄(10개의 개념 쌍)을 생성할 것.',
    '4) 언어: 사용자가 입력한 언어(보통 한국어 또는 영어)의 컨텍스트에 맞춰 자연스럽게 제공하되, 역사/용어 등 개념 설명은 한국어로 하라.',
    '예시:',
    'photosynthesis :: 식물이 빛 에너지를 이용해 이산화탄소와 물로부터 유기물을 합성하는 과정',
    'mitosis :: 모세포와 유전적으로 동일한 두 개의 딸세포가 생성되는 세포 분열 과정'
  ].join('\n');

  const userMessage = `주제(덱 이름): ${subject}\n이 주제에 맞는 10개의 학습용 단어/개념 쌍을 생성해줘.`;

  try {
    let text = await generateContent({
      systemPrompt,
      userMessage,
      env: ctx.env,
      temperature: 0.8,
      request: ctx.request
    });

    // 마크다운 백틱 코드 블록이나 앞뒤 공백 제거
    text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();

    return json({ recommendation: text });
  } catch (e) {
    console.error('flash-recommend error:', e?.message);
    return errorResponse(e, '추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
