/**
 * Cloudflare Pages Function: 단축 URL 리다이렉트 해석
 * - Short.io 또는 다른 단축 URL 서비스의 최종 URL을 해석
 * - fetch의 redirect: 'follow' 옵션을 사용해 리다이렉트 자동 추종
 */
export async function onRequest(ctx) {
  // POST 요청만 허용
  if (ctx.request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // 요청 파싱
  let shortURL;
  try {
    const body = await ctx.request.json();
    shortURL = body.shortURL;
    if (!shortURL) {
      throw new Error('shortURL 필드 필수');
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid request: ' + e.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    // fetch의 redirect: 'follow'로 자동 리다이렉트 추종
    const res = await fetch(shortURL, {
      method: 'HEAD',
      redirect: 'follow',
      timeout: 10000,
    });

    // 최종 URL은 res.url에 포함됨
    const resolvedURL = res.url;

    if (!resolvedURL) {
      throw new Error('리다이렉트 따라가기 실패');
    }

    return new Response(
      JSON.stringify({ resolvedURL }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    console.error('URL resolution error:', err.message);
    return new Response(
      JSON.stringify({ error: 'URL resolution failed: ' + err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
