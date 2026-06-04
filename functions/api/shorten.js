/**
 * Cloudflare Pages Function: Short.io 단축 URL 프록시
 * - API 키는 환경변수에서만 읽음, 클라이언트에 노출되지 않음
 */
export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let originalURL;
  try {
    const body = await ctx.request.json();
    originalURL = body.url;
    if (!originalURL) throw new Error();
  } catch {
    return new Response(
      JSON.stringify({ error: 'url 필드가 필요합니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const apiKey = ctx.env.SHORT_IO_API_KEY;
  const domain = ctx.env.SHORT_IO_DOMAIN;

  // ── 디버그 로그 (wrangler dev 콘솔 / Cloudflare 실시간 로그에서 확인) ──
  console.log('[shorten] 요청:', JSON.stringify({ originalURL: originalURL, domain: domain, hasApiKey: !!apiKey }));

  if (!apiKey || !domain) {
    console.error('[shorten] 환경변수 누락:', JSON.stringify({ hasApiKey: !!apiKey, hasDomain: !!domain }));
    return new Response(
      JSON.stringify({ error: '서버 환경변수(SHORT_IO_API_KEY, SHORT_IO_DOMAIN)가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
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
    console.log('[shorten] short.io 응답:', res.status, JSON.stringify(data));

    if (!res.ok) {
      console.error('[shorten] short.io 오류 | status=' + res.status + ' | domain=' + domain + ' | message=' + (data.message || data.error || '(없음)'));
      return new Response(
        JSON.stringify({ error: data.message || '단축 URL 생성에 실패했습니다.', status: res.status, domain: domain }),
        { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return new Response(
      JSON.stringify({ shortURL: data.shortURL }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    console.error('[shorten] 외부 API 연결 실패:', err && (err.message || err));
    return new Response(
      JSON.stringify({ error: '외부 API 연결에 실패했습니다.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
