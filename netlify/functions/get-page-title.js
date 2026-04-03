exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let url;
  try {
    ({ url } = JSON.parse(event.body));
    new URL(url);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'url 필드가 필요합니다.' }) };
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
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: null }),
    };
  }
};
