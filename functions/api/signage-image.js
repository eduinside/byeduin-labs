/**
 * Cloudflare Pages Function: 사이니지 이미지 생성 (Google Gemini)
 * - SIGNAGE_LOGINCODE(4자리)로 호출 게이트
 * - GEMINI_API_KEY는 서버에서만 사용
 */
import { generateImage } from './_ai.js';

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const loginCode = ctx.env.SIGNAGE_LOGINCODE;
  if (!loginCode) {
    console.error('Missing env: SIGNAGE_LOGINCODE');
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
    console.log('Generating image with prompt length:', prompt.length);
    const imageData = await generateImage({ prompt, env: ctx.env });

    console.log('Image generated successfully, size:', imageData.length);
    return new Response(
      JSON.stringify({ b64: imageData }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    console.error('signage-image generation fail:', e?.message);
    return new Response(
      JSON.stringify({ error: e?.message || '이미지 생성에 실패했습니다.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

