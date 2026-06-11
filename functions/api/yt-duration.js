// GET /api/yt-duration?ids=ID1,ID2,... (최대 50개)
// YouTube Data API v3로 영상 길이(초) 조회 → { durations: { id: seconds } }
function isoToSec(iso) {
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const cors = { 'Access-Control-Allow-Origin': '*' };
  const json = (body, status = 200, extra = {}) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => /^[\w-]{11}$/.test(s))
    .slice(0, 50);
  if (!ids.length) return json({ error: 'ids 파라미터가 필요합니다 (유튜브 영상 ID, 쉼표 구분)' }, 400);

  const key = env.YOUTUBE_API_KEY || env.YT_API_KEY || env.GOOGLE_API_KEY;
  if (!key) return json({ error: 'YOUTUBE_API_KEY not configured' }, 500);

  let data;
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${key}`
    );
    data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || `YouTube API ${r.status}` }, 502);
  } catch (e) {
    return json({ error: `YouTube API 연결 실패: ${e.message}` }, 502);
  }

  const durations = {};
  for (const item of data.items || []) {
    durations[item.id] = isoToSec(item.contentDetails && item.contentDetails.duration);
  }
  // 영상 길이는 사실상 불변 — 7일 캐시
  return json({ durations }, 200, { 'Cache-Control': 'public, max-age=604800' });
}
