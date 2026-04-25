/**
 * Netlify Function: 사이니지용 한국어 프롬프트 다듬기
 * - OpenAI Chat Completions로 입력 텍스트와 스타일을 받아 이미지 생성용 프롬프트 생성
 * - 비용 최소화를 위해 저비용 GPT 모델 사용 (gpt-4o-mini)
 * - OPENAI_API_KEY는 서버에서만 사용, 클라이언트 미노출
 */
const MODEL = 'gpt-4o-mini';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY');
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

  const system = [
    '학교 사이니지(세로 1080x1920) 이미지 프롬프트 생성기. 간결하고 명확하게 작성할 것.',
    '규칙:',
    '1) 고정 정보(행사명, 날짜 등)는 정확히 그대로 큰 따옴표로 감싸기.',
    '2) 설명은 시각적 디테일로 번역(예: "신나는" → "vibrant, energetic colors").',
    '3) 세로 9:16, 큰 글자, 충분한 대비와 여백 강조.',
    '4) 지정된 스타일 키워드를 시각 디테일로 표현.',
    '5) 한 문장 프롬프트만 출력, 설명 없음.',
  ].join('\n');

  const user = `삽입할 한국어 텍스트: ${text}\n원하는 스타일: ${styleDirective}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('signage-prompt OpenAI error:', res.status, data?.error?.code);
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '프롬프트 생성에 실패했습니다.' })
      };
    }

    const prompt = data?.choices?.[0]?.message?.content?.trim();
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
