/**
 * Netlify Function: 사이니지 이미지 생성 (Google Gemini)
 * - SIGNAGE_LOGINCODE(4자리)로 호출 게이트
 * - GOOGLE_API_KEY는 서버에서만 사용
 */
const MODEL = 'gemini-3.1-flash-image-preview';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const loginCode = process.env.SIGNAGE_LOGINCODE;
  if (!apiKey || !loginCode) {
    console.error('Missing env:', { hasApiKey: !!apiKey, hasLoginCode: !!loginCode });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' })
    };
  }

  let prompt, code;
  try {
    ({ prompt, code } = JSON.parse(event.body || '{}'));
    if (!prompt || typeof prompt !== 'string') throw new Error('prompt');
    if (prompt.length > 4000) throw new Error('long');
    if (!code || typeof code !== 'string') throw new Error('code');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '입력값(prompt, code)이 올바르지 않습니다.' })
    };
  }

  if (code !== loginCode) {
    return { statusCode: 401, body: JSON.stringify({ error: '관리자 코드가 올바르지 않습니다.' }) };
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
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '이미지 생성에 실패했습니다.' })
      };
    }

    const imageData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!imageData) {
      console.error('No image data in response. Full data:', JSON.stringify(data).slice(0, 300));
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '응답이 비어 있습니다.' })
      };
    }

    console.log('Image generated successfully, size:', imageData.length);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b64: imageData }),
    };
  } catch (e) {
    console.error('signage-image fetch fail:', e?.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '외부 API 연결에 실패했습니다.' })
    };
  }
};
