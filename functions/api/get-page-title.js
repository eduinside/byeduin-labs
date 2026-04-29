/**
 * Cloudflare Pages Function: 페이지 제목 추출
 * - URL을 받아 HTML의 <title> 태그 추출
 * - 5초 타임아웃 적용
 */
export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let url;
  try {
    const body = await ctx.request.json();
    url = body.url;
    new URL(url);
  } catch {
    return new Response(
      JSON.stringify({ error: 'url 필드가 필요합니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; byeduin-bot/1.0)' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const html = await res.text();
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = m ? m[1].trim().replace(/\s+/g, ' ') : null;
    return new Response(
      JSON.stringify({ title }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ title: null }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
