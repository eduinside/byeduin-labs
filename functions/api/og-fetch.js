/**
 * POST /api/og-fetch — 오픈그래프(og-check) 앱용 페이지·이미지 가져오기 (docs/og-check-plan.md §4-1)
 *
 *  { url, mode: 'page' }  → { finalUrl, status, redirects, ms, bytes, contentType, html | htmlB64+charset, truncated }
 *  { url, mode: 'image' } → { finalUrl, status, contentType, bytes }
 *
 * - 메신저 봇처럼 서버에서 HTML만 받는다(자바스크립트 실행 없음). 태그 분석은 브라우저(DOMParser)가 한다.
 *   Worker CPU 10ms 예산 때문에 여기서는 파싱하지 않는다.
 * - 리다이렉트는 manual로 최대 5번 따라가며 경로를 기록한다(경로 자체가 점검 항목).
 * - 사설·내부 주소는 거절(Workers는 내부망에 닿지 않지만 이유를 분명히 알려 주려고).
 * - UTF-8이 아닌 문서(EUC-KR 학교 사이트 등)는 원본 바이트를 base64로 넘겨 브라우저가 디코딩한다.
 * - 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['og-fetch'](이미지 확인도 같이 셈)
 */
import { guard, json, readJson } from './_guard.js';

const URL_MAX = 2048;
const BODY_MAX = 8 * 1024;
const PAGE_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 6000;
const READ_MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;
const UA = 'Mozilla/5.0 (compatible; byeduin-bot/1.0; +https://eduin.info/apps/og-check/)';

// 사설·내부 주소(이름·IPv4·IPv6). 숫자 주소를 다른 표기(10진 정수 등)로 쓰면 URL 파서가 점 표기로 바꿔 준다.
function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.test')) return true;
  if (!h.includes('.') && !h.includes(':')) return true; // 점 없는 이름(사내 호스트)
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe80/.test(h) || h.startsWith('::ffff:');
  return false;
}

function checkUrl(raw) {
  let u = null;
  try { u = raw && raw.length <= URL_MAX ? new URL(raw) : null; } catch {}
  if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) return { error: '주소를 확인해 주세요. http:// 또는 https:// 로 시작해야 해요.' };
  if (isPrivateHost(u.hostname)) return { error: '내 컴퓨터·내부망 주소는 서버가 열 수 없어요. HTML 붙여넣기로 확인해 주세요.', code: 'private' };
  u.hash = '';
  return { url: u };
}

// 리다이렉트를 직접 따라간다. 각 단계 주소도 사설 주소인지 다시 본다.
async function fetchFollow(startUrl, init, timeoutMs) {
  const redirects = [];
  let url = startUrl;
  const signal = AbortSignal.timeout(timeoutMs);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(url.href, { ...init, redirect: 'manual', signal });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try { await res.body?.cancel(); } catch {}
      if (i === MAX_REDIRECTS) return { res: null, redirects, url, tooMany: true };
      let next;
      try { next = new URL(res.headers.get('location'), url); } catch { return { res, redirects, url }; }
      redirects.push({ url: url.href, status: res.status });
      const c = checkUrl(next.href);
      if (c.error) return { res: null, redirects, url: next, blocked: c.error };
      url = c.url;
      continue;
    }
    return { res, redirects, url };
  }
  return { res: null, redirects, url, tooMany: true };
}

async function readBytes(res, maxBytes) {
  if (!res.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) { truncated = true; try { await reader.cancel(); } catch {} break; }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, out.length - off);
    out.set(take === c.byteLength ? c : c.subarray(0, take), off);
    off += take;
    if (off >= out.length) break;
  }
  return { bytes: out, truncated };
}

// 헤더 → 문서 앞 2KB의 <meta charset> 순서로 문자 집합을 고른다.
function detectCharset(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType || '');
  if (fromHeader) return fromHeader[1].toLowerCase();
  // Workers의 TextDecoder는 UTF-8 말고는 지원이 고르지 않아 바이트를 그대로 글자로 옮겨 본다(ASCII 부분만 필요).
  const head = String.fromCharCode.apply(null, bytes.subarray(0, 2048));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  return fromMeta ? fromMeta[1].toLowerCase() : 'utf-8';
}

function toBase64(bytes) {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  return btoa(s);
}

async function handlePage(url) {
  const t0 = Date.now();
  const { res, redirects, url: finalUrl, tooMany, blocked } = await fetchFollow(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.6' },
  }, PAGE_TIMEOUT_MS);
  if (blocked) return json({ error: blocked, code: 'private', redirects }, 400);
  if (tooMany) return json({ error: `주소가 ${MAX_REDIRECTS}번 넘게 다른 곳으로 넘어가서 멈췄어요.`, code: 'redirects', redirects }, 422);

  const contentType = res.headers.get('content-type') || '';
  const base = { finalUrl: finalUrl.href, status: res.status, redirects, contentType };
  if (contentType && !/html|xml/i.test(contentType)) {
    try { await res.body?.cancel(); } catch {}
    return json({ ...base, ms: Date.now() - t0, error: '웹페이지(HTML)가 아니에요. 파일이나 이미지 주소인지 확인해 주세요.', code: 'not-html' }, 422);
  }

  const { bytes, truncated } = await readBytes(res, READ_MAX_BYTES);
  const out = { ...base, ms: Date.now() - t0, bytes: bytes.length, truncated };
  const charset = detectCharset(contentType, bytes);
  if (charset === 'utf-8' || charset === 'utf8') {
    out.html = new TextDecoder('utf-8').decode(bytes);
  } else {
    out.htmlB64 = toBase64(bytes);
    out.charset = charset;
  }
  return json(out);
}

async function handleImage(url) {
  const init = { headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.5' } };
  let r = await fetchFollow(url, { ...init, method: 'HEAD' }, IMAGE_TIMEOUT_MS);
  if (r.blocked) return json({ error: r.blocked, code: 'private' }, 400);
  // HEAD를 막거나 길이를 안 주는 서버는 GET으로 머리만 보고 끊는다.
  if (!r.res || r.res.status === 405 || r.res.status === 403 || !r.res.headers.get('content-length')) {
    r = await fetchFollow(url, { ...init, method: 'GET' }, IMAGE_TIMEOUT_MS);
    if (r.blocked) return json({ error: r.blocked, code: 'private' }, 400);
    if (r.res) { try { await r.res.body?.cancel(); } catch {} }
  }
  if (!r.res) return json({ finalUrl: r.url.href, status: 0, contentType: '', bytes: null });
  const len = Number(r.res.headers.get('content-length'));
  return json({
    finalUrl: r.url.href,
    status: r.res.status,
    contentType: r.res.headers.get('content-type') || '',
    bytes: Number.isFinite(len) && len > 0 ? len : null,
  });
}

export async function onRequest(ctx) {
  const { request } = ctx;
  if (request.method !== 'POST') return json({ error: '허용되지 않은 방식입니다.' }, 405);

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;
  const mode = body.mode === 'image' ? 'image' : 'page';
  const c = checkUrl(typeof body.url === 'string' ? body.url.trim() : '');
  if (c.error) return json({ error: c.error, code: c.code || 'bad-url' }, 400);

  const blocked = await guard(request, 'og-fetch');
  if (blocked) return blocked;

  try {
    return mode === 'image' ? await handleImage(c.url) : await handlePage(c.url);
  } catch (e) {
    const timeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    console.warn('[og-fetch] 실패:', mode, e && e.message);
    return json({
      error: timeout ? '사이트가 너무 늦게 응답해요. 잠시 후 다시 해 주세요.' : '사이트에 연결하지 못했어요. 주소를 확인하거나 HTML 붙여넣기로 확인해 주세요.',
      code: timeout ? 'timeout' : 'network',
    }, 502);
  }
}
