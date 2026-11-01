// functions/api/_moderation.js
// ─────────────────────────────────────────────────────────────────────────────
// 아이가 직접 쓴 글 검열 — 발명 아이디어 공작소(idea-lab)·진로 탐험대(career-talk) 공용.
//   로컬 금칙어 프리필터(즉시 차단) + OpenAI Moderation(타임아웃 시 통과 — 가용성 우선,
//   madang과 동일 정책). 금칙어 목록은 이 파일 한 곳에서 관리한다.
//
//   import { moderate, moderateAll, localFilterHit } from './_moderation.js';
//   const mod = await moderateAll(env, [text1, text2]);   // { flagged, local?, ... }
// ─────────────────────────────────────────────────────────────────────────────

const MOD_TIMEOUT_MS = 2500;

// 로컬 금칙어 프리필터 — madang과 같은 목록의 1차 방어선(API 왕복 없이 즉시 차단).
// 글자 사이 공백 허용 규칙: 붙여 쓴 형태("씨발")는 어디서든 잡고, 글자 사이에 공백을 넣은 형태("씨 발")는
// 그 글자들이 앞뒤 낱말과 떨어져 있을 때만 잡는다. 예전 /시\s*발/은 "다시 발명"·"도시 발전"·"출시 발표"처럼
// 앞 낱말의 끝 글자와 뒷 낱말의 첫 글자가 우연히 이어지는 경우까지 막았다(발명 앱의 핵심 낱말과 충돌).
// 놓친 변형은 뒤이은 OpenAI Moderation이 다시 거른다.
const HANGUL = '가-힣ㄱ-ㅎㅏ-ㅣ';
const SPACED_WORDS = [
  '씨발', '시발', '씨팔', 'ㅅㅂ', 'ㅆㅂ',
  '개새끼', '개색끼', '개새기',
  '병신', '븅신', 'ㅂㅅ',
  '존나', '조낸',
  '지랄', 'ㅈㄹ',
  '창녀',
];
function spacedWordRe(word) {
  const chars = [...word];
  // 붙여 쓴 형태 | (앞에 한글이 붙지 않은 자리에서) 글자 사이 공백 허용 + 끝은 낱말 경계 또는 흔한 접미(야·아·들·놈·년)
  return new RegExp(`${word}|(?<![${HANGUL}])${chars.join('\\s*')}(?=$|[^${HANGUL}]|[야아들놈년])`, 'i');
}
const LOCAL_BAD_PATTERNS = [
  ...SPACED_WORDS.map(spacedWordRe),
  /좆/i,
  /미친\s*놈|미친\s*년/i,
  /걸레\s*년/i,
  /죽어라|뒤져라/i,
  /fuck|shit|bitch|asshole/i,
];
export function localFilterHit(text) { return LOCAL_BAD_PATTERNS.some((re) => re.test(text)); }

// 검열: 텍스트 하나(또는 여러 개를 합친 것)를 검사. 키 없음/오류/타임아웃이면 통과(가용성 우선).
// 결과의 categories는 OpenAI가 걸러 낸 분류 이름(예: 'self-harm', 'violence')이고 로컬 금칙어면 없다.
export async function moderate(env, text) {
  if (!text || !text.trim()) return { flagged: false };
  if (localFilterHit(text)) return { flagged: true, local: true };
  const key = env.OPENAI_API_KEY;
  if (!key) return { flagged: false, noKey: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MOD_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text.slice(0, 4000) }),
      signal: controller.signal,
    });
    if (!r.ok) return { flagged: false, ok: false };
    const d = await r.json();
    const res = d && d.results && d.results[0];
    const categories = res && res.categories ? Object.keys(res.categories).filter((k) => res.categories[k]) : [];
    return { flagged: !!(res && res.flagged), categories };
  } catch (e) {
    return { flagged: false, timedOut: e && e.name === 'AbortError' };
  } finally {
    clearTimeout(timer);
  }
}
export async function moderateAll(env, texts) {
  const joined = texts.filter((t) => typeof t === 'string' && t.trim()).join('\n');
  return moderate(env, joined);
}
