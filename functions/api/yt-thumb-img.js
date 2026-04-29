/**
 * Cloudflare Pages Function: YouTube 썸네일 이미지 프록시
 * - CORS 우회용: img.youtube.com 이미지를 서버에서 fetch해 반환
 * - id/q 파라미터로 허용된 URL만 접근 가능
 */
export async function onRequest(ctx) {
  if (ctx.request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const url = new URL(ctx.request.url);
  const id = url.searchParams.get('id');
  const q = url.searchParams.get('q') || 'hq';

  // 유효성 검사: 11자리 영숫자+하이픈+언더바, 허용된 품질만
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return new Response('Invalid video id', { status: 400 });
  }

  const QUALITY_MAP = {
    maxres: 'maxresdefault.jpg',
    hq: 'hqdefault.jpg',
    mq: 'mqdefault.jpg',
    sd: 'sddefault.jpg',
  };

  const filename = QUALITY_MAP[q];
  if (!filename) {
    return new Response('Invalid quality', { status: 400 });
  }

  const imageUrl = `https://img.youtube.com/vi/${id}/${filename}`;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return new Response('Image not found', { status: res.status });
    }

    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Upstream request failed', { status: 502 });
  }
}
