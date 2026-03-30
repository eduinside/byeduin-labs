/**
 * Netlify Function: YouTube 플레이리스트 API 프록시
 * - YOUTUBE_API_KEY 환경변수에서 API 키 읽기
 * - 클라이언트에 API 키 노출 없음
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'API key not configured' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { playlistId, pageToken } = body;

  if (!playlistId || !/^[A-Za-z0-9_-]{10,60}$/.test(playlistId)) {
    return { statusCode: 400, body: 'Invalid playlistId' };
  }

  const BASE = 'https://www.googleapis.com/youtube/v3';

  try {
    // 플레이리스트 제목 조회 (첫 페이지 요청 시에만)
    let playlistTitle = null;
    if (!pageToken) {
      const plRes = await fetch(
        `${BASE}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`,
        { headers: { 'Referer': 'https://byeduin-labs.netlify.app/' } }
      );
      const plData = await plRes.json();
      playlistTitle = plData.items?.[0]?.snippet?.title ?? '플레이리스트';
    }

    // 플레이리스트 아이템 조회
    let itemsUrl = `${BASE}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}`;
    if (pageToken) itemsUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

    const itemsRes = await fetch(itemsUrl, {
      headers: { 'Referer': 'https://byeduin-labs.netlify.app/' }
    });
    const itemsData = await itemsRes.json();

    if (!itemsRes.ok) {
      const errMsg = itemsData.error?.message ?? 'YouTube API error';
      // referer 관련 에러일 경우 안내 메시지 추가
      const displayMsg = errMsg.includes('referer')
        ? 'API 키 설정을 확인하세요. YouTube API 콘솔에서 API 키의 "HTTP referrers" 제한을 제거하거나 https://byeduin-labs.netlify.app 을 추가해주세요.'
        : errMsg;
      return {
        statusCode: itemsRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: displayMsg }),
      };
    }

    const items = (itemsData.items ?? [])
      .filter(it => it.snippet?.resourceId?.videoId)
      .map(it => ({
        videoId: it.snippet.resourceId.videoId,
        title: it.snippet.title ?? '',
        description: it.snippet.description ?? '',
        thumbnailUrl:
          it.snippet.thumbnails?.high?.url ??
          it.snippet.thumbnails?.medium?.url ??
          `https://img.youtube.com/vi/${it.snippet.resourceId.videoId}/hqdefault.jpg`,
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistTitle,
        items,
        nextPageToken: itemsData.nextPageToken ?? null,
      }),
    };
  } catch {
    return { statusCode: 502, body: 'Upstream request failed' };
  }
};
