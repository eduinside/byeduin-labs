/**
 * Cloudflare Pages Function: 단축 URL 원본 조회
 * 1순위: short.io API (SHORT_IO_API_KEY 필요, 프래그먼트 포함 원본 URL 반환)
 * 2순위: GET redirect follow (response.url — 프래그먼트 미포함 가능성 있음)
 */
export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  let shortURL;
  try {
    const body = await ctx.request.json();
    shortURL = body.shortURL;
    if (!shortURL) throw new Error('shortURL 필드 필수');
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid request: ' + e.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const resHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    // 1순위: short.io API — 원본 URL(프래그먼트 포함)을 정확히 반환
    const apiKey = ctx.env.SHORT_IO_API_KEY;
    const parsed = new URL(shortURL);
    const domain = parsed.hostname;
    const path = parsed.pathname.slice(1);

    if (apiKey && path) {
      const apiRes = await fetch(
        `https://api.short.io/links/expand?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`,
        { headers: { Authorization: apiKey } }
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.originalURL) {
          return new Response(JSON.stringify({ resolvedURL: data.originalURL }), { status: 200, headers: resHeaders });
        }
      }
    }

    // 2순위: GET redirect follow (프래그먼트가 포함되지 않을 수 있음)
    const res = await fetch(shortURL, { method: 'GET', redirect: 'follow' });
    const resolvedURL = res.url;
    if (!resolvedURL) throw new Error('리다이렉트 따라가기 실패');
    return new Response(JSON.stringify({ resolvedURL }), { status: 200, headers: resHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'URL resolution failed: ' + err.message }),
      { status: 502, headers: resHeaders }
    );
  }
}
