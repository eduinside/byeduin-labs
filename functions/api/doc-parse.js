export async function onRequest(ctx) {
  const { request, env } = ctx;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = env.COREPIN_API_KEY;
  if (!apiKey) return json({ error: 'COREPIN_API_KEY not configured' }, 500);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid multipart form data' }, 400);
  }

  if (!form.has('output_format')) form.set('output_format', 'markdown');

  let upstream;
  try {
    upstream = await fetch('https://api.corepin.ai/v1/doc/parse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (e) {
    return json({ error: `Corepin 연결 실패: ${e.message}` }, 502);
  }

  const payload = await upstream.json().catch(() => ({}));
  return json(payload, upstream.ok ? 200 : upstream.status);
}
