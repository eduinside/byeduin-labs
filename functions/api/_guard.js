// functions/api/_guard.js
// ─────────────────────────────────────────────────────────────────────────────
// 서버 API 공용 가드 — 출처 검사 + 요청 횟수 제한 + 본문 크기 상한 + JSON 응답.
//   search.js에서 쓰던 방식(호스트 검사 + Cache API 카운터)을 모든 AI·프록시 API가 함께 쓰도록 뺀 것.
//
// 사용 예:
//   import { guard, json, readJson } from './_guard.js';
//   export async function onRequestPost({ request }) {
//     const blocked = await guard(request, 'bu-translate');   // 403·429 응답 또는 null
//     if (blocked) return blocked;
//     const body = await readJson(request, 16 * 1024);        // 413·400 응답 또는 객체
//     if (body instanceof Response) return body;
//     ...
//   }
//
// 한계(무료 티어): Cache API는 데이터센터(colo)별 저장이라 카운트는 근사치다. 이용자가 대부분
// 한국(같은 colo)에서 들어오므로 실제로는 거의 전체 합계에 가깝다. 출처 검사는 브라우저 밖 스크립트가
// 헤더를 꾸미면 통과하므로 실제 방어선은 횟수 상한(특히 사이트 전체 일일 상한)이다.
// IP는 해시(앞 12바이트)로만 키에 쓰고 따로 저장하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

// ── 허용 호스트 ─────────────────────────────────────────
// 정본 도메인, Cloudflare Pages 미리보기 배포(<브랜치|해시>.byeduin-labs.pages.dev), 로컬 개발.
// 운영 별칭 byeduin-labs.pages.dev 자체는 넣지 않는다(정본은 eduin.info).
export const ALLOWED_HOST_RE = /^((www\.)?eduin\.info|[a-z0-9-]+\.byeduin-labs\.pages\.dev|localhost|127\.0\.0\.1)$/i;

// ── 요청 한도 ───────────────────────────────────────────
// perMin : IP당 1분 한도(순간 폭주 방지)
// perDay : IP당 하루 한도. 학교는 공인 IP 하나를 함께 쓰므로(한 반 30명 동시 사용) 넉넉히 잡는다.
// siteDay: 사이트 전체 하루 한도. 외부 키(AI 크레딧·YouTube·short.io 등) 소진을 막는 실제 방어선.
// 값을 바꾸려면 이 표만 고치면 된다.
export const LIMITS = {
  // AI 종류별(_ai.js가 엔드포인트와 별도로 센다 — 텍스트와 그림을 따로 센다)
  'ai-text':           { perMin: 300, perDay: 3000,  siteDay: 10000 },
  'ai-image':          { perMin: 60,  perDay: 300,   siteDay: 600 },

  // AI 엔드포인트
  'search':            { perMin: 10,  perDay: 100,   siteDay: 2000 },  // 에듀서치(기존 값 유지)
  'bu-translate':      { perMin: 30,  perDay: 300,   siteDay: 1000 },
  'bu-recommend':      { perMin: 30,  perDay: 300,   siteDay: 1000 },
  'flash-recommend':   { perMin: 30,  perDay: 300,   siteDay: 1000 },
  'spell-check':       { perMin: 60,  perDay: 1000,  siteDay: 3000 },
  'dictation-ai':      { perMin: 60,  perDay: 600,   siteDay: 2000 },
  'idea-lab':          { perMin: 300, perDay: 3000,  siteDay: 8000 },  // 한 반 30명 × 질문 5회 안팎
  'timer-vision':      { perMin: 6,   perDay: 60,    siteDay: 400 },   // 시정표 사진 인식(이미지 입력 — 교사만, 가끔)

  // 외부 유료·쿼터 API 프록시
  'doc-parse':         { perMin: 10,  perDay: 100,   siteDay: 300 },   // Corepin(서버 키, 최대 50MB)
  'shorten':           { perMin: 30,  perDay: 100,   siteDay: 300 },   // short.io(서버 키)
  'book-lookup':       { perMin: 120, perDay: 2000,  siteDay: 10000 }, // 카카오(서버 키, D1 캐시 미스만 셈)
  'yt-duration':       { perMin: 120, perDay: 2000,  siteDay: 5000 },  // YouTube 키(일 1만 유닛, 엣지 캐시 미스만 셈)
  'yt-playlist':       { perMin: 60,  perDay: 500,   siteDay: 2000 },  // YouTube 키(요청당 1~2유닛)

  // 키 없는 중계(함수 호출 수·악용 방지)
  'get-page-title':    { perMin: 60,  perDay: 1000,  siteDay: 5000 },
  'resolve-short-url': { perMin: 120, perDay: 1000,  siteDay: 5000 },  // 채점표 수합: 링크 수십 개 연속 조회
  'yt-video-info':     { perMin: 120, perDay: 2000,  siteDay: 10000 },
  'yt-thumb-img':      { perMin: 600, perDay: 5000,  siteDay: 20000 }, // 재생목록 썸네일·ZIP(엣지 캐시 미스만 셈)
  'notion':            { perMin: 300, perDay: 5000,  siteDay: 10000 }, // 이용자 토큰 — DB 페이지 수만큼 연속 호출
  'padlet':            { perMin: 300, perDay: 3000,  siteDay: 10000 }, // 이용자 키 — 항목 수만큼 연속 게시

  // 동기화 쓰기(_sync.js PUT·DELETE). D1 무료 쓰기 한도(일 10만 행) 보호.
  'sync-write':        { perDay: 5000, siteDay: 50000 },
  'sync-bytes':        { perDay: 50 * 1024 * 1024 },                   // IP당 하루 업로드 총량(바이트)
};

const MESSAGES = {
  min: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  day: '오늘 사용 한도에 도달했어요. 내일 다시 이용해 주세요.',
  site: '오늘은 이 기능 사용량이 많아 잠시 멈췄어요. 내일 다시 이용해 주세요.',
};

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

// ── 출처 검사 ───────────────────────────────────────────
function hostOf(v) {
  try { return new URL(v).hostname; } catch { return ''; }
}

/**
 * 같은 출처(정본·미리보기·로컬)에서 온 요청인지 본다. 통과면 null, 아니면 403 응답.
 * - 요청 주소의 호스트가 허용 목록이어야 한다(search.js와 같은 규칙 + 미리보기 배포).
 * - Origin이 있으면 그것으로, 없으면 Referer로 판단한다.
 *   (브라우저는 같은 출처 GET에 Origin을 붙이지 않는 경우가 많지만 Referer는 보낸다.
 *    POST·PUT·DELETE에는 같은 출처여도 항상 Origin을 붙인다.)
 * - 둘 다 없으면: GET/HEAD는 통과(리퍼러 차단 확장 등), 그 밖은 allowNoOrigin일 때만 통과.
 */
export function checkOrigin(request, { allowNoOrigin = false } = {}) {
  const forbidden = () => json({ error: '허용되지 않은 요청입니다.', code: 'forbidden' }, 403);
  let reqHost = '';
  try { reqHost = new URL(request.url).hostname; } catch {}
  if (!ALLOWED_HOST_RE.test(reqHost)) return forbidden();

  const origin = request.headers.get('Origin');
  if (origin) return ALLOWED_HOST_RE.test(hostOf(origin)) ? null : forbidden(); // 'null' 출처도 거절
  const referer = request.headers.get('Referer');
  if (referer) return ALLOWED_HOST_RE.test(hostOf(referer)) ? null : forbidden();
  if (request.method === 'GET' || request.method === 'HEAD' || allowNoOrigin) return null;
  return forbidden();
}

// ── 횟수 제한 ───────────────────────────────────────────
// Cache API(무료)에 창(window)별 횟수를 적는다. Cache API가 동작하지 않는 환경(일부 미리보기 등)에
// 대비해 isolate 메모리에도 같이 세고, 둘 중 큰 값으로 판단한다(메모리 값은 항상 실제보다 작거나 같다).
const mem = new Map();
function memGet(key, now) {
  const r = mem.get(key);
  return r && r.exp > now ? r.n : 0;
}
function memSet(key, n, exp, now) {
  if (mem.size > 5000) for (const [k, v] of mem) if (v.exp <= now) mem.delete(k);
  mem.set(key, { n, exp });
}

async function ipHash(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * bucket 한도를 넘었으면 429 응답, 아니면 카운트를 올리고 null.
 * cost: 이번 요청이 차지하는 양(기본 1회. sync-bytes처럼 바이트를 셀 때는 바이트 수).
 */
export async function rateLimit(request, bucket, { cost = 1, limits } = {}) {
  const rule = limits || LIMITS[bucket];
  if (!rule) return null;
  const cache = globalThis.caches?.default;
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  const hash = await ipHash(request);

  const windows = [];
  if (rule.perMin) windows.push({ kind: 'min', win: 60, max: rule.perMin, id: hash });
  if (rule.perDay) windows.push({ kind: 'day', win: 86400, max: rule.perDay, id: hash });
  if (rule.siteDay) windows.push({ kind: 'site', win: 86400, max: rule.siteDay, id: 'site' });

  for (const w of windows) {
    w.key = `https://ratelimit.eduin.info/${bucket}/${w.win}/${Math.floor(sec / w.win)}/${w.id}`;
    let n = 0;
    if (cache) {
      try { n = Number(await (await cache.match(w.key))?.text() ?? 0) || 0; } catch {}
    }
    w.n = Math.max(n, memGet(w.key, now));
  }

  const over = windows.find(w => w.n + cost > w.max);
  if (over) {
    const retry = over.kind === 'min' ? 60 : 86400 - (sec % 86400);
    return json({ error: MESSAGES[over.kind], code: 'limited' }, 429, { 'Retry-After': String(retry) });
  }

  for (const w of windows) {
    const n = w.n + cost;
    const ttl = w.win - (sec % w.win) + 5;
    memSet(w.key, n, now + ttl * 1000, now);
    if (cache) {
      try {
        await cache.put(w.key, new Response(String(n), { headers: { 'Cache-Control': `max-age=${ttl}` } }));
      } catch {}
    }
  }
  return null;
}

/** 출처 검사 + 횟수 제한을 한 번에. 통과면 null. */
export async function guard(request, bucket, opts = {}) {
  return checkOrigin(request, opts) || (await rateLimit(request, bucket, opts));
}

// ── 본문 읽기(크기 상한) ─────────────────────────────────
/**
 * 본문을 maxBytes까지만 읽는다. content-length가 없거나 거짓이어도 스트림을 세며 읽다 끊는다.
 * 넘으면 413 응답(Response)을, 아니면 Uint8Array를 돌려준다.
 */
export async function readBody(request, maxBytes) {
  const tooLarge = () => json({ error: '요청 내용이 너무 커요.', code: 'too_large' }, 413);
  const cl = Number(request.headers.get('content-length'));
  if (Number.isFinite(cl) && cl > maxBytes) return tooLarge();
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      return tooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

/** JSON 본문을 maxBytes까지만 읽어 파싱. 실패하면 400/413 응답(Response)을 돌려준다. */
export async function readJson(request, maxBytes = 64 * 1024) {
  const bytes = await readBody(request, maxBytes);
  if (bytes instanceof Response) return bytes;
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data && typeof data === 'object') return data;
  } catch {}
  return json({ error: '잘못된 요청입니다.', code: 'bad_json' }, 400);
}

/**
 * 외부 응답 본문을 maxBytes까지만 텍스트로 읽는다(넘으면 거기서 끊음).
 * stopAt 정규식이 나오면 더 읽지 않는다(예: </title>).
 */
export async function readTextCapped(res, maxBytes, stopAt) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    text += dec.decode(value, { stream: true });
    if (total >= maxBytes || (stopAt && stopAt.test(text))) {
      try { await reader.cancel(); } catch {}
      break;
    }
  }
  return text;
}

/** 문자열 정리: 문자열이 아니면 '', 앞뒤 공백 제거 후 max자로 자름. */
export function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** _ai.js 등에서 던진 오류를 사용자용 문구로. 내부 메시지는 err.expose일 때만 그대로 보낸다. */
export function errorResponse(err, fallback = '처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.') {
  const status = err && err.status ? err.status : 502;
  return json({ error: err && err.expose ? err.message : fallback }, status);
}
