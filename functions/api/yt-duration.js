// GET /api/yt-duration?ids=ID1,ID2,... (최대 50개)
// YouTube Data API v3로 영상 길이(초) 조회 → { durations: { id: seconds } }
// - 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['yt-duration'](엣지 캐시 미스만 셈)
// - 성공 응답은 엣지 캐시(caches.default)에 7일 보관 → 같은 목록은 YouTube 키를 다시 쓰지 않는다.
import { checkOrigin, rateLimit, json } from './_guard.js';

const IDS_MAX = 50;
const CACHE_SEC = 604800;            // 영상 길이는 사실상 불변 — 7일
const FETCH_TIMEOUT_MS = 8000;

function isoToSec(iso) {
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'GET') return json({ error: '허용되지 않은 방식입니다.' }, 405);

  const denied = checkOrigin(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const ids = [...new Set((url.searchParams.get('ids') || '').slice(0, 1000)
    .split(',')
    .map(s => s.trim())
    .filter(s => /^[\w-]{11}$/.test(s)))]
    .slice(0, IDS_MAX);
  if (!ids.length) return json({ error: 'ids 파라미터가 필요합니다 (유튜브 영상 ID, 쉼표 구분)' }, 400);

  // 엣지 캐시: 순서·중복과 무관하게 같은 키가 되도록 정렬한 주소로 찾는다
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(`${url.origin}/api/yt-duration?ids=${[...ids].sort().join(',')}`);
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) return hit;
  }

  const limited = await rateLimit(request, 'yt-duration');
  if (limited) return limited;

  const key = env.YOUTUBE_API_KEY || env.YT_API_KEY || env.GOOGLE_API_KEY;
  if (!key) {
    console.error('[yt-duration] YOUTUBE_API_KEY 없음');
    return json({ error: '영상 길이 조회 기능이 아직 준비되지 않았어요.' }, 503);
  }

  let data;
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${key}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    data = await r.json().catch(() => null);
    if (!r.ok || !data) {
      console.error('[yt-duration] YouTube API 오류:', r.status, data?.error?.message);
      return json({ error: '영상 길이를 가져오지 못했어요.' }, 502);
    }
  } catch (e) {
    console.error('[yt-duration] YouTube API 연결 실패:', e && e.message);
    return json({ error: '영상 길이를 가져오지 못했어요.' }, 502);
  }

  const durations = {};
  for (const item of data.items || []) {
    durations[item.id] = isoToSec(item.contentDetails && item.contentDetails.duration);
  }
  const res = json({ durations }, 200, { 'Cache-Control': `public, max-age=${CACHE_SEC}` });
  if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
  return res;
}
