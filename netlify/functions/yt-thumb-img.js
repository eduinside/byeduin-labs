/**
 * Netlify Function: YouTube 썸네일 이미지 프록시
 * - CORS 우회용: img.youtube.com 이미지를 서버에서 fetch해 반환
 * - id/q 파라미터로 허용된 URL만 접근 가능
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { id, q = 'hq' } = event.queryStringParameters ?? {};

  // 유효성 검사: 11자리 영숫자+하이픈+언더바, 허용된 품질만
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return { statusCode: 400, body: 'Invalid video id' };
  }

  const QUALITY_MAP = {
    maxres: 'maxresdefault.jpg',
    hq: 'hqdefault.jpg',
    mq: 'mqdefault.jpg',
    sd: 'sddefault.jpg',
  };

  const filename = QUALITY_MAP[q];
  if (!filename) {
    return { statusCode: 400, body: 'Invalid quality' };
  }

  const imageUrl = `https://img.youtube.com/vi/${id}/${filename}`;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return { statusCode: res.status, body: 'Image not found' };
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 502, body: 'Upstream request failed' };
  }
};
