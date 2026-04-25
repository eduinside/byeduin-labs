/**
 * Netlify Function: 사이니지용 프롬프트 다듬기 (Gemini)
 * - Google Gemini를 사용해 입력 텍스트와 스타일을 받아 이미지 생성용 프롬프트 생성
 * - GOOGLE_API_KEY는 서버에서만 사용, 클라이언트 미노출
 */
const MODEL = 'gemini-2.0-flash-lite';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('Missing GOOGLE_API_KEY');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' })
    };
  }

  let text, style;
  try {
    ({ text, style } = JSON.parse(event.body || '{}'));
    if (!text || typeof text !== 'string') throw new Error();
    if (text.length > 500) throw new Error();
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '입력값(text)이 올바르지 않습니다.' })
    };
  }

  const styleDirective = (style && typeof style === 'string' && style.trim())
    ? style.trim()
    : '깔끔하고 가독성 높은 스타일';

  const systemPrompt = [
    '너는 학교 디지털 사이니지 세로 이미지(정확히 1080×1920 세로 9:16 비율) 생성 프롬프트를 만드는 보조자다.',
    '한국어 사이니지 이미지를 생성하기 위한 영문/한국어 혼용 프롬프트 한 단락을 만든다.',
    '규칙:',
    '1) 사용자가 제공한 한국어 텍스트를 큰 따옴표로 감싸 정확히 그대로 포함시키고, 글자가 깨지거나 오탈자가 생기지 않도록 명시할 것.',
    '2) 세로 9:16 사이니지 구도, 멀리서도 잘 읽히는 큰 글자, 배경과 충분한 명도 대비, 학교 환경에 적절한 안전한 분위기를 강조할 것.',
    '3) 텍스트가 잘리거나 화면 밖으로 나가지 않도록 충분한 여백 확보를 명시할 것.',
    '4) 사용자가 지정한 스타일 키워드를 시각 디테일(색감, 일러스트풍, 타이포 톤)로 풀어 쓸 것.',
    '5) 출력은 한 단락 프롬프트만, 그 외 설명/머리말/마크다운 없이 plain text로.',
  ].join('\n');

  const userMessage = `삽입할 한국어 텍스트: ${text}\n원하는 스타일: ${styleDirective}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: { text: systemPrompt }
        },
        contents: [{
          role: 'user',
          parts: [{ text: userMessage }]
        ]},
        generationConfig: {
          temperature: 0.7,
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('signage-prompt Gemini error:', res.status, data?.error?.message);
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '프롬프트 생성에 실패했습니다.' })
      };
    }

    const prompt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!prompt) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '응답이 비어 있습니다.' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    };
  } catch (e) {
    console.error('signage-prompt fetch fail:', e?.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '외부 API 연결에 실패했습니다.' })
    };
  }
};
