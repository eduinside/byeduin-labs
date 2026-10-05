/**
 * Cloudflare Pages Function: 단축 URL 원본 조회
 * 1순위: short.io API (SHORT_IO_API_KEY 필요, 프래그먼트 포함 원본 URL 반환)
 * 2순위: GET redirect follow (response.url — 프래그먼트 미포함 가능성 있음). 본문은 읽지 않는다.
 * 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['resolve-short-url']
 */
import { guard, json, readJson } from './_guard.js';

const URL_MAX = 2048;
const BODY_MAX = 8 * 1024;
const FETCH_TIMEOUT_MS = 6000;

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;
  const shortURL = typeof body.shortURL === 'string' ? body.shortURL.trim() : '';
  let parsed = null;
  try { parsed = shortURL && shortURL.length <= URL_MAX ? new URL(shortURL) : null; } catch {}
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return json({ error: '올바른 링크가 아닙니다.' }, 400);
  }

  const blocked = await guard(ctx.request, 'resolve-short-url');
  if (blocked) return blocked;

  try {
    // 1순위: short.io API — 원본 URL(프래그먼트 포함)을 정확히 반환
    const apiKey = ctx.env.SHORT_IO_API_KEY;
    const domain = parsed.hostname;
    const path = parsed.pathname.slice(1);

    if (apiKey && path) {
      const apiRes = await fetch(
        `https://api.short.io/links/expand?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`,
        { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
      ).catch(() => null);
      if (apiRes && apiRes.ok) {
        const data = await apiRes.json().catch(() => ({}));
        if (data.originalURL) {
          return json({ resolvedURL: data.originalURL });
        }
      } else if (apiRes) {
        try { await apiRes.body?.cancel(); } catch {}
      }
    }

    // 2순위: GET redirect follow (프래그먼트가 포함되지 않을 수 있음). 최종 주소만 필요하므로 본문은 버린다.
    const res = await fetch(parsed.href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const resolvedURL = res.url;
    try { await res.body?.cancel(); } catch {}
    if (!resolvedURL) throw new Error('리다이렉트 따라가기 실패');
    return json({ resolvedURL });
  } catch (err) {
    console.error('[resolve-short-url]', err && err.message);
    return json({ error: '링크의 원래 주소를 찾지 못했어요.' }, 502);
  }
}
