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

  // Content-Length 사전 검증 — body를 읽기 전에 50MB 초과 차단
  const cl = parseInt(request.headers.get('content-length') || '0', 10);
  if (cl > 52_428_800) return json({ error: '파일 크기가 50MB를 초과합니다.' }, 413);

  const apiKey = env.COREPIN_API_KEY;
  if (!apiKey) return json({ error: 'COREPIN_API_KEY not configured' }, 500);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'multipart 파싱 실패 — 파일 형식을 확인해주세요.' }, 400);
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

  // 비-JSON 오류 응답도 error 필드로 보존
  const raw = await upstream.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { error: raw.slice(0, 300) || `HTTP ${upstream.status}` };
  }

  // 429일 때 Retry-After 헤더 전달
  const retryAfter = upstream.headers.get('retry-after');
  const resHeaders = { ...cors, 'Content-Type': 'application/json' };
  if (retryAfter) resHeaders['Retry-After'] = retryAfter;

  return new Response(JSON.stringify(payload), {
    status: upstream.ok ? 200 : upstream.status,
    headers: resHeaders,
  });
}
