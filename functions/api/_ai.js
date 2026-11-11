import { rateLimit } from './_guard.js';

// AI 호출 공용 모듈 — Gemini API 직접 호출 하나로 처리한다(2026-11 Timely 1차 경로 제거, docs/gemini-migration-plan.md).
// 새 AI 엔드포인트도 fetch를 따로 쓰지 말고 generateContent / generateImage만 쓴다.

// ── 요청 제한 ─────────────────────────────────────────
// 텍스트와 그림을 따로 센다(_guard.js LIMITS의 'ai-text' / 'ai-image').
// Cache API 카운터라 isolate가 바뀌어도 유지되고, 사이트 전체 하루 상한으로 요금을 지킨다.
async function enforceAiLimit(request, kind) {
  if (!request) return;
  const blocked = await rateLimit(request, kind === 'image' ? 'ai-image' : 'ai-text');
  if (!blocked) return;
  let msg = '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  try { msg = (await blocked.json()).error || msg; } catch {}
  throw aiError(msg, 429);
}

// 사용자에게 그대로 보여도 되는 오류(expose). 외부 API 원문은 로그에만 남긴다.
function aiError(message, status = 502) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

// 외부 AI 오류 상태 → 사용자용 문구(원문 메시지는 로그에만)
function upstreamError(status) {
  if (status === 429) return aiError('AI 요청이 몰리고 있어요. 잠시 후 다시 시도해 주세요.', 429);
  return aiError('AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.', 502);
}

const TEXT_TIMEOUT_MS = 30000;   // 텍스트 생성 1회 타임아웃
const IMAGE_TIMEOUT_MS = 60000;  // 그림 생성 1회 타임아웃
const RETRY_DELAY_MS = 500;
const RETRY_STATUS = new Set([429, 500, 503]);

// byeduin 전체 텍스트 모델(운영자 결정 2026-11-12, B안: 전부 flash-lite). 사진 입력(images)도 이 모델로 처리한다.
export const DEFAULT_TEXT_MODEL = 'gemini-flash-lite-latest';
// 그림: 3.1 flash-lite-image(운영자 결정 2026-11-12, 낮은 모델 허용). JPEG 1024px 약 1MB·약 4초로
// 2.5-flash-image(PNG 약 2.3MB·약 7.5초)보다 작고 빠르고 싸다. 512px는 이 모델에서 지원 안 함(400).
// 결과는 JPEG라 화면은 data URL 형식을 base64 앞부분으로 고른다(/9j/ = JPEG).
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const BLOCKED_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY']);

// Gemini generateContent 호출. 키는 URL 대신 헤더로 보낸다(로그에 키가 섞이지 않게).
// 429·500·503은 잠깐 쉬고 1회 재시도한다. 타임아웃은 대기 시간이 두 배가 되므로 재시도하지 않는다.
async function callGemini(model, payload, key, timeoutMs, slowMessage) {
  const doFetch = () => fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  let res;
  try {
    res = await doFetch();
    if (RETRY_STATUS.has(res.status)) {
      console.warn(`[AI] Gemini ${res.status} — ${RETRY_DELAY_MS}ms 후 1회 재시도`, { model });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      res = await doFetch();
    }
  } catch (e) {
    console.error('[AI] Gemini 연결 실패:', e && e.message, { model });
    throw aiError(slowMessage, 504);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[AI] Gemini 오류:', res.status, data?.error?.message, { model });
    throw upstreamError(res.status);
  }

  // 안전 정책으로 막힌 응답은 '다시 시도'로 해결되지 않으므로 따로 알린다.
  const blockReason = data?.promptFeedback?.blockReason;
  const finish = data?.candidates?.[0]?.finishReason;
  if (blockReason || BLOCKED_FINISH.has(finish)) {
    console.warn('[AI] Gemini 안전 정책 차단:', blockReason || finish, { model });
    throw aiError('이 내용으로는 AI가 결과를 만들 수 없어요. 내용을 바꿔서 다시 시도해 주세요.', 400);
  }
  return data;
}

function requireKey(env) {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    console.error('[AI] GEMINI_API_KEY 없음');
    throw aiError('AI 기능이 아직 준비되지 않았어요. 관리자에게 알려 주세요.', 503);
  }
  return key;
}

// images: ['data:image/jpeg;base64,…'] (선택) — 사진 인식용. 있으면 텍스트 앞에 inline_data로 붙인다.
// json: true면 JSON 객체만 받도록 요청(responseMimeType).
export async function generateContent({
  systemPrompt,
  userMessage,
  env,
  temperature = 0.8,
  model = DEFAULT_TEXT_MODEL,   // 모델 오버라이드(선택)
  images = null,
  json = false,
  timeoutMs = TEXT_TIMEOUT_MS,
  request = null // IP rate limiting용 request 객체
}) {
  await enforceAiLimit(request, 'text');
  const key = requireKey(env);
  const imgs = Array.isArray(images) ? images.filter((u) => typeof u === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(u)) : [];

  const data = await callGemini(model, {
    system_instruction: { parts: { text: systemPrompt } },
    contents: [{
      role: 'user',
      parts: [
        ...imgs.map((u) => {
          const m = u.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          return { inline_data: { mime_type: m[1], data: m[2] } };
        }),
        { text: userMessage }
      ]
    }],
    generationConfig: json ? { temperature, responseMimeType: 'application/json' } : { temperature }
  }, key, timeoutMs, 'AI 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.');

  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text.trim()) {
    console.error('[AI] Gemini 응답이 비어 있음', { model, finish: data?.candidates?.[0]?.finishReason });
    throw aiError('AI가 답을 만들지 못했어요. 다시 시도해 주세요.', 502);
  }
  return text.trim();
}

// 반환: base64 이미지 데이터(접두사 없음, 지금 모델은 JPEG).
// 표준 generateContent + responseModalities:["IMAGE"]로 호출한다(옛 imagen :predict는 404).
export async function generateImage({ prompt, env, request = null }) {
  await enforceAiLimit(request, 'image');
  const key = requireKey(env);

  const data = await callGemini(IMAGE_MODEL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1', imageSize: '1K' }  // 카드 레이아웃 일관성, 크기 상한 고정
    }
  }, key, IMAGE_TIMEOUT_MS, '그림 생성이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.');

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imageData = parts.find((p) => p.inlineData || p.inline_data);
  const b64 = imageData?.inlineData?.data || imageData?.inline_data?.data;
  if (!b64) {
    console.error('[AI] Gemini 이미지 응답이 비어 있음', { finish: data?.candidates?.[0]?.finishReason });
    throw aiError('그림을 만들지 못했어요. 다시 시도해 주세요.', 502);
  }
  return b64.trim();
}
