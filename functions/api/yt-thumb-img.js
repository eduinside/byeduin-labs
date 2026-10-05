/**
 * Cloudflare Pages Function: YouTube 썸네일 이미지 프록시
 * - CORS 우회용: img.youtube.com 이미지를 서버에서 fetch해 반환(같은 출처라 ZIP 저장 가능)
 * - id/q 파라미터로 허용된 URL만 접근 가능
 * - 같은 출처에서만 받는다(_guard.js, <img>·fetch 모두 Referer로 판단). 한도: LIMITS['yt-thumb-img']
 * - 성공 응답은 엣지 캐시(caches.default)에 하루 보관, 캐시 적중은 한도에 넣지 않는다.
 */
import { checkOrigin, rateLimit } from './_guard.js';

const CACHE_SEC = 86400;
const FETCH_TIMEOUT_MS = 8000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;   // 유튜브 썸네일은 수백 KB 이하

const QUALITY_MAP = {
  maxres: 'maxresdefault.jpg',
  hq: 'hqdefault.jpg',
  mq: 'mqdefault.jpg',
  sd: 'sddefault.jpg',
};

export async function onRequest(ctx) {
  const { request } = ctx;
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const denied = checkOrigin(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const q = url.searchParams.get('q') || 'hq';

  // 유효성 검사: 11자리 영숫자+하이픈+언더바, 허용된 품질만
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return new Response('Invalid video id', { status: 400 });
  }
  const filename = QUALITY_MAP[q];
  if (!filename) {
    return new Response('Invalid quality', { status: 400 });
  }

  const cache = globalThis.caches?.default;
  const cacheKey = new Request(`${url.origin}/api/yt-thumb-img?id=${id}&q=${q}`);
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) return hit;
  }

  const limited = await rateLimit(request, 'yt-thumb-img');
  if (limited) return limited;

  const imageUrl = `https://img.youtube.com/vi/${id}/${filename}`;

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      try { await res.body?.cancel(); } catch {}
      return new Response('Image not found', { status: res.status === 404 ? 404 : 502 });
    }
    if (Number(res.headers.get('content-length')) > IMAGE_MAX_BYTES) {
      try { await res.body?.cancel(); } catch {}
      return new Response('Image too large', { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > IMAGE_MAX_BYTES) return new Response('Image too large', { status: 502 });

    const out = new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': `public, max-age=${CACHE_SEC}`,
      },
    });
    if (cache) ctx.waitUntil(cache.put(cacheKey, out.clone()).catch(() => {}));
    return out;
  } catch {
    return new Response('Upstream request failed', { status: 502 });
  }
}
