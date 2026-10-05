/**
 * Cloudflare Pages Function: Short.io 단축 URL 프록시
 * - API 키는 환경변수에서만 읽음, 클라이언트에 노출되지 않음
 * - 임의 URL 단축은 의도한 기능(qr 앱 "단축 URL")이므로 유지하되(docs/audit-2026-10.md 4.1),
 *   http(s) 주소만·길이 상한·같은 출처 요청만·IP당/사이트 전체 일일 상한을 둔다.
 *   한도 값은 _guard.js LIMITS.shorten(사이트 전체 하루 300회, IP당 하루 100회).
 *   한도를 넘으면 429 — 각 앱은 원본 주소 복사로 대체한다.
 * - 공유 내용이 URL에 들어 있으므로 요청 URL은 로그에 남기지 않는다.
 */
import { guard, json, readJson } from './_guard.js';

const URL_MAX = 8000;              // 단축할 주소 길이 상한(글자)
const BODY_MAX = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;

  const originalURL = typeof body.url === 'string' ? body.url.trim() : '';
  if (!originalURL) return json({ error: 'url 필드가 필요합니다.' }, 400);
  if (originalURL.length > URL_MAX) return json({ error: '주소가 너무 깁니다.' }, 400);
  let parsed;
  try { parsed = new URL(originalURL); } catch { parsed = null; }
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return json({ error: 'http 또는 https 주소만 단축할 수 있습니다.' }, 400);
  }

  // 형식 검사를 통과한 요청만 횟수에 넣는다
  const blocked = await guard(ctx.request, 'shorten');
  if (blocked) return blocked;

  const apiKey = ctx.env.SHORT_IO_API_KEY;
  const domain = ctx.env.SHORT_IO_DOMAIN;

  if (!apiKey || !domain) {
    console.error('[shorten] 환경변수 누락:', JSON.stringify({ hasApiKey: !!apiKey, hasDomain: !!domain }));
    return json({ error: '단축 주소 기능이 아직 준비되지 않았어요.' }, 503);
  }

  try {
    const res = await fetch('https://api.short.io/links', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ originalURL, domain }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // 응답 원문에 단축 대상 URL이 들어 있을 수 있어 상태와 메시지만 남긴다
      console.error('[shorten] short.io 오류 | status=' + res.status + ' | message=' + (data.message || data.error || '(없음)'));
      return json({ error: '단축 URL 생성에 실패했습니다.' }, res.status === 429 ? 429 : 502);
    }

    return json({ shortURL: data.shortURL });
  } catch (err) {
    console.error('[shorten] 외부 API 연결 실패:', err && (err.message || err));
    return json({ error: '외부 API 연결에 실패했습니다.' }, 502);
  }
}
