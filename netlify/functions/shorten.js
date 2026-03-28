/**
 * Netlify Function: Short.io 단축 URL 프록시
 * - API 키는 환경변수에서만 읽음, 클라이언트에 노출되지 않음
 * - console.log 없음 (로그에 키 미포함)
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let originalURL;
  try {
    ({ url: originalURL } = JSON.parse(event.body));
    if (!originalURL) throw new Error();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'url 필드가 필요합니다.' }) };
  }

  const apiKey = process.env.SHORT_IO_API_KEY;
  const domain = process.env.SHORT_IO_DOMAIN;

  if (!apiKey || !domain) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '서버 환경변수(SHORT_IO_API_KEY, SHORT_IO_DOMAIN)가 설정되지 않았습니다.' }),
    };
  }

  try {
    const res = await fetch('https://api.short.io/links', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ originalURL, domain }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.message || '단축 URL 생성에 실패했습니다.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortURL: data.shortURL }),
    };
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: '외부 API 연결에 실패했습니다.' }) };
  }
};
