/**
 * Netlify Function: 사이니지 이미지 생성 (gpt-image-2)
 * - SIGNAGE_LOGINCODE(4자리)로 호출 게이트
 * - OPENAI_API_KEY는 서버에서만 사용
 * - 1024x1536(2:3 portrait), quality=medium, opaque, n=1
 *   클라이언트가 1080x1920 캔버스로 패딩 후 다운로드
 */
const MODEL = 'gpt-image-1.5';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
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
    return { statusCode: 400, body: JSON.stringify({ error: '입력값(prompt, code)이 올바르지 않습니다.' }) };
  }

  if (code !== loginCode) {
    return { statusCode: 401, body: JSON.stringify({ error: '관리자 코드가 올바르지 않습니다.' }) };
  }

  try {
    const requestBody = {
      model: MODEL,
      prompt,
      size: '1024x1024',
      quality: 'auto',
      n: 1,
    };
    console.log('OpenAI request body:', JSON.stringify(requestBody));

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();
    console.log('OpenAI response status:', res.status, 'error:', data?.error?.message);
    if (!res.ok) {
      console.error('signage-image OpenAI error:', res.status, data?.error?.code, data?.error?.message);
      return { statusCode: res.status, body: JSON.stringify({ error: '이미지 생성에 실패했습니다.' }) };
    }

    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return { statusCode: 502, body: JSON.stringify({ error: '응답이 비어 있습니다.' }) };
    }

    // URL을 클라이언트로 반환 (클라이언트에서 직접 처리)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    };
  } catch (e) {
    console.error('signage-image fetch fail:', e?.message);
    return { statusCode: 502, body: JSON.stringify({ error: '외부 API 연결에 실패했습니다.' }) };
  }
};
