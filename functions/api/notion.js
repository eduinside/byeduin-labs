/**
 * Cloudflare Pages Function: 노션 API 프록시
 * - 토큰은 헤더로만 전달, 서버에 저장/로깅 없음
 * - 같은 출처에서만 받는다(_guard.js). 한도: LIMITS.notion
 * - 노션 응답(이용자 자신의 토큰·DB에 대한 결과)은 그대로 돌려준다 — 화면이 오류 내용을 안내에 쓴다.
 */
import { guard, json, readJson } from './_guard.js';

const BODY_MAX = 16 * 1024;     // { token, path, payload }
const TOKEN_MAX = 200;
const FETCH_TIMEOUT_MS = 15000;

// 허용된 노션 API 경로만 통과 (보안: 임의 경로 차단)
const ALLOWED = [
  /^\/v1\/databases\/[a-f0-9]{32}\/query$/,
  // 블록 자식 조회(GET). 페이지 넘김용 쿼리 ?page_size=100 / ?start_cursor=<uuid>&page_size=100만 허용
  /^\/v1\/blocks\/[a-f0-9-]{32,36}\/children(\?(start_cursor=[a-f0-9-]{32,36}&)?page_size=100)?$/,
];

export async function onRequest(ctx) {
  // POST 요청만 허용
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const blocked = await guard(ctx.request, 'notion');
  if (blocked) return blocked;

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;

  const { token, path, payload } = body;

  // 필수값 체크
  if (typeof token !== 'string' || !token || token.length > TOKEN_MAX || typeof path !== 'string' || !path) {
    return new Response('Missing token or path', { status: 400 });
  }

  const allowed = ALLOWED.some(re => re.test(path));
  if (!allowed) {
    return new Response('Forbidden path', { status: 403 });
  }
  if (payload != null && typeof payload !== 'object') {
    return new Response('Invalid payload', { status: 400 });
  }

  try {
    const isGet = !payload;
    const resp = await fetch(`https://api.notion.com${path}`, {
      method: isGet ? 'GET' : 'POST',
      headers: {
        // 토큰은 여기서만 사용, 변수에 저장하거나 출력하지 않음
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      ...(isGet ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const data = await resp.json();

    return json(data, resp.status);
  } catch (err) {
    // 에러 메시지에 토큰 등 민감정보 포함하지 않음
    return new Response('Upstream request failed', { status: 502 });
  }
}
