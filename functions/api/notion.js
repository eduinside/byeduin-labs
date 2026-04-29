/**
 * Cloudflare Pages Function: 노션 API 프록시
 * - 토큰은 헤더로만 전달, 서버에 저장/로깅 없음
 */
export async function onRequest(ctx) {
  // POST 요청만 허용
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { token, path, payload } = body;

  // 필수값 체크
  if (!token || !path) {
    return new Response('Missing token or path', { status: 400 });
  }

  // 허용된 노션 API 경로만 통과 (보안: 임의 경로 차단)
  const ALLOWED = [
    /^\/v1\/databases\/[a-f0-9]{32}\/query$/,
    /^\/v1\/blocks\/[a-f0-9-]{32,36}\/children$/,
  ];
  const allowed = ALLOWED.some(re => re.test(path));
  if (!allowed) {
    return new Response('Forbidden path', { status: 403 });
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

    return new Response(
      JSON.stringify(data),
      { status: resp.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    // 에러 메시지에 토큰 등 민감정보 포함하지 않음
    return new Response('Upstream request failed', { status: 502 });
  }
}
