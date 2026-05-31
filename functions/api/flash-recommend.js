/**
 * Cloudflare Pages Function: 플래시카드 AI 추천 (Gemini)
 * - Google Gemini를 사용해 주제(덱 이름)를 받아 10개의 학습용 단어/개념 카드 추천 쌍을 생성
 * - GEMINI_API_KEY는 서버에서만 사용, 클라이언트 미노출
 */
const MODEL = 'gemini-flash-lite-latest';

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = ctx.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY');
    return new Response(
      JSON.stringify({ error: '서버 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  let subject;
  try {
    const body = await ctx.request.json();
    subject = body.subject;
    if (!subject || typeof subject !== 'string') throw new Error();
    if (subject.length > 200) throw new Error();
  } catch {
    return new Response(
      JSON.stringify({ error: '입력값(subject)이 올바르지 않습니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const systemPrompt = [
    '너는 플래시카드(학습 낱말 카드) 제작 보조원이다.',
    '사용자가 제공한 주제(단어 덱 이름)에 관한 10개의 핵심 키워드/단어/개념 쌍(앞면과 뒷면)을 생성한다.',
    '각 개념 쌍은 학습하기에 유익하고 핵심적인 내용이어야 한다.',
    '출력 형식 규칙:',
    '1) 출력은 오직 각 줄마다 `앞면 내용 :: 뒷면 내용` 형식으로만 작성해야 한다.',
    '2) 추가 설명, 제목, 마크다운 코드 블록(예: ```), 번호 매기기 등은 절대 포함하지 말 것.',
    '3) 정확히 10개의 줄(10개의 개념 쌍)을 생성할 것.',
    '4) 언어: 사용자가 입력한 언어(보통 한국어 또는 영어)의 컨텍스트에 맞춰 자연스럽게 제공하되, 역사/용어 등 개념 설명은 한국어로 하라.',
    '예시:',
    'photosynthesis :: 식물이 빛 에너지를 이용해 이산화탄소와 물로부터 유기물을 합성하는 과정',
    'mitosis :: 모세포와 유전적으로 동일한 두 개의 딸세포가 생성되는 세포 분열 과정'
  ].join('\n');

  const userMessage = `주제(덱 이름): ${subject}\n이 주제에 맞는 10개의 학습용 단어/개념 쌍을 생성해줘.`;

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
        }],
        generationConfig: {
          temperature: 0.8, // 다양성을 위해 0.8로 지정 (다시 누르면 새로운 키워드가 나올 확률 증가)
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('flash-recommend Gemini error:', res.status, data?.error?.message);
      return new Response(
        JSON.stringify({ error: 'Gemini API 호출에 실패했습니다.' }),
        { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: '응답이 비어 있습니다.' }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 마크다운 백틱 코드 블록이나 앞뒤 공백 제거
    text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();

    return new Response(
      JSON.stringify({ recommendation: text }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    console.error('flash-recommend fetch fail:', e?.message);
    return new Response(
      JSON.stringify({ error: '외부 API 연결에 실패했습니다.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
