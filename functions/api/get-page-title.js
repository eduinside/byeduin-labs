/**
 * Cloudflare Pages Function: 페이지 제목 추출
 * - URL을 받아 HTML의 <title> 태그 추출(qr 앱의 스캔 결과 제목 표시)
 * - http(s)만, 5초 타임아웃, 본문은 앞부분(최대 256KB)만 읽음
 * - 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['get-page-title']
 */
import { guard, json, readJson, readTextCapped } from './_guard.js';

const URL_MAX = 2048;
const BODY_MAX = 8 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const READ_MAX_BYTES = 256 * 1024;   // 제목은 문서 앞쪽에 있으므로 이 이상 읽지 않는다

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  let parsed = null;
  try { parsed = url && url.length <= URL_MAX ? new URL(url) : null; } catch {}
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return json({ error: 'url 필드가 필요합니다.' }, 400);
  }

  const blocked = await guard(ctx.request, 'get-page-title');
  if (blocked) return blocked;

  try {
    const res = await fetch(parsed.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; byeduin-bot/1.0)', Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || (type && !/html|xml/i.test(type))) {
      try { await res.body?.cancel(); } catch {}
      return json({ title: null });
    }
    const html = await readTextCapped(res, READ_MAX_BYTES, /<\/title>/i);
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = m ? m[1].trim().replace(/\s+/g, ' ') : null;
    return json({ title });
  } catch {
    return json({ title: null });
  }
}
