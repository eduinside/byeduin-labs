/**
 * Netlify Function: 노션 API 프록시
 * - 토큰은 헤더로만 전달, 서버에 저장/로깅 없음
 * - console.log 일절 없음 (Netlify 함수 로그에도 안 남음)
 */
exports.handler = async (event) => {
  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { token, path, payload } = body;

  // 필수값 체크
  if (!token || !path) {
    return { statusCode: 400, body: 'Missing token or path' };
  }

  // 허용된 노션 API 경로만 통과 (보안: 임의 경로 차단)
  const ALLOWED = [
    /^\/v1\/databases\/[a-f0-9]{32}\/query$/,
    /^\/v1\/blocks\/[a-f0-9-]{32,36}\/children$/,
  ];
  const allowed = ALLOWED.some(re => re.test(path));
  if (!allowed) {
    return { statusCode: 403, body: 'Forbidden path' };
  }

  try {
    const isGet = !payload;
    const resp = await fetch(`https://api.notion.com${path}`, {
      method: isGet ? 'GET' : 'POST',
      headers: {
        // 토큰은 여기서만 사용, 변수에 저장하거나 출력하지 않음
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      ...(isGet ? {} : { body: JSON.stringify(payload) }),
    });

    const data = await resp.json();

    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json' },
      // token을 응답에 절대 포함하지 않음
      body: JSON.stringify(data),
    };
  } catch (err) {
    // 에러 메시지에 토큰 등 민감정보 포함하지 않음
    return { statusCode: 502, body: 'Upstream request failed' };
  }
};
