import { generateContent } from './_ai.js';

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let text, style, provider;
  try {
    const body = await ctx.request.json();
    text = body.text;
    style = body.style;
    provider = body.provider || 'gemini';
    if (!text || typeof text !== 'string') throw new Error();
    if (text.length > 500) throw new Error();
  } catch {
    return new Response(
      JSON.stringify({ error: '입력값(text)이 올바르지 않습니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
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
    '5) 배경에는 실제 환경(교실, 책장, 가구, 사람 등)을 그리지 말 것. 오직 "사이니지 화면에 직접 디스플레이될 콘텐츠"만 생성하도록 명시할 것. 배경은 단색 또는 추상적 패턴/그래디언트만 사용.',
    '6) 출력은 한 단락 프롬프트만, 그 외 설명/머리말/마크다운 없이 plain text로.',
  ].join('\n');

  const userMessage = `삽입할 한국어 텍스트: ${text}\n원하는 스타일: ${styleDirective}`;

  try {
    const prompt = await generateContent({
      provider,
      systemPrompt,
      userMessage,
      env: ctx.env,
      temperature: 0.7
    });

    return new Response(
      JSON.stringify({ prompt }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    console.error('signage-prompt error:', e?.message);
    return new Response(
      JSON.stringify({ error: e.message || '프롬프트 생성에 실패했습니다.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
