/**
 * Cloudflare Pages Function: 사이니지 이미지 생성 (Google Gemini)
 * - SIGNAGE_LOGINCODE(4자리)로 호출 게이트
 * - GEMINI_API_KEY는 서버에서만 사용
 */
const MODEL = 'gemini-3.1-flash-image-preview';

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = ctx.env.GEMINI_API_KEY;
  const loginCode = ctx.env.SIGNAGE_LOGINCODE;
  if (!apiKey || !loginCode) {
    console.error('Missing env:', { hasApiKey: !!apiKey, hasLoginCode: !!loginCode });
    return new Response(
      JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  let prompt, code;
  try {
    const body = await ctx.request.json();
    prompt = body.prompt;
    code = body.code;
    if (!prompt || typeof prompt !== 'string') throw new Error('prompt');
    if (prompt.length > 4000) throw new Error('long');
    if (!code || typeof code !== 'string') throw new Error('code');
  } catch {
    return new Response(
      JSON.stringify({ error: '입력값(prompt, code)이 올바르지 않습니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (code !== loginCode) {
    return new Response(
      JSON.stringify({ error: '관리자 코드가 올바르지 않습니다.' }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const requestBody = {
      model: MODEL,
      prompt: prompt,
    };
    console.log('Gemini request prompt length:', prompt.length);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `Optimize image size and quality for fast generation:\n${prompt}` }]
        }],
        generationConfig: {
          temperature: 0.8,
        }
      }),
    });

    const data = await res.json();
    console.log('Gemini response status:', res.status, 'error:', data?.error?.message);
    if (!res.ok) {
      console.error('signage-image Gemini error:', res.status, data?.error?.message);
      return new Response(
        JSON.stringify({ error: '이미지 생성에 실패했습니다.' }),
        { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const imageData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!imageData) {
      console.error('No image data in response. Full data:', JSON.stringify(data).slice(0, 300));
      return new Response(
        JSON.stringify({ error: '응답이 비어 있습니다.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log('Image generated successfully, size:', imageData.length);
    return new Response(
      JSON.stringify({ b64: imageData }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    console.error('signage-image fetch fail:', e?.message);
    return new Response(
      JSON.stringify({ error: '외부 API 연결에 실패했습니다.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
