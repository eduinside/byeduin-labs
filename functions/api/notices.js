// GET /api/notices?limit=6
// 블로그 RSS를 프록시(원본에 CORS 없음)해 최신 글 제목/링크/날짜/요약을 JSON으로 반환.
// Workers 런타임에는 DOMParser가 없으므로 정규식/문자열 연산으로만 파싱한다.
//
// 피드 주소: blog.eduin.info(대표 도메인) 우선, 실패 시 eduin.tistory.com 폴백.
// (blog.eduin.info의 SSL 인증서 프로비저닝 전까지도 공지가 끊기지 않도록)

const FEED_URLS = [
  'https://blog.eduin.info/rss',
  'https://eduin.tistory.com/rss',
];
const SOURCE_URL = 'https://blog.eduin.info/';
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
const SUMMARY_MAX = 200;
const FETCH_TIMEOUT_MS = 5000;

export async function onRequest(ctx) {
  const { request, env } = ctx;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=1800', // 30분
  };

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed', posts: [] }),
      { status: 405, headers }
    );
  }

  let limit = DEFAULT_LIMIT;
  try {
    const raw = new URL(request.url).searchParams.get('limit');
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) limit = Math.min(MAX_LIMIT, Math.max(1, n));
    }
  } catch { /* 기본 limit 유지 */ }

  // env 오버라이드 > blog.eduin.info > eduin.tistory.com 순으로 시도
  const candidates = [env.NOTICES_FEED_URL, ...FEED_URLS].filter(Boolean);

  let xml = null;
  let usedUrl = null;
  let lastErr = 'no feed';
  for (const url of candidates) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; byeduin-bot/1.0)' },
        signal: ctrl.signal,
      });
      if (res.ok) { xml = await res.text(); usedUrl = url; break; }
      lastErr = `status ${res.status} (${url})`;
    } catch (e) {
      lastErr = `${(e && e.message) || 'fetch failed'} (${url})`;
    } finally {
      clearTimeout(timer);
    }
  }

  if (xml == null) {
    console.error('[notices] all feeds failed:', lastErr);
    return new Response(
      JSON.stringify({ error: lastErr, posts: [], source: SOURCE_URL }),
      { status: 502, headers }
    );
  }

  const posts = parseRssItems(xml, limit);
  // source는 실제로 응답한 피드의 도메인으로 (blog 인증서 준비 전에도 '전체 보기' 링크가 안 깨지게)
  const source = originOf(usedUrl) || SOURCE_URL;
  return new Response(JSON.stringify({ posts, source }), { status: 200, headers });
}

function originOf(u) {
  try { return new URL(u).origin + '/'; } catch { return ''; }
}

function parseRssItems(xml, limit) {
  if (typeof xml !== 'string' || !xml) return [];
  const firstItem = xml.indexOf('<item');
  if (firstItem === -1) return [];
  const chunks = xml.slice(firstItem).split(/<item[\s>]/i);
  const posts = [];
  for (let i = 1; i < chunks.length && posts.length < limit; i++) {
    let block = chunks[i];
    const end = block.indexOf('</item>');
    if (end !== -1) block = block.slice(0, end);
    const title = extractTitle(block);
    const link = extractLink(block);
    if (!title || !link) continue;
    posts.push({ title, link, date: extractDate(block), summary: extractSummary(block) });
  }
  return posts;
}

function extractTitle(block) {
  let m = block.match(/<title[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i);
  if (!m) m = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return decodeEntities(m[1]).replace(/\s+/g, ' ').trim().slice(0, 300);
}

function extractLink(block) {
  let m = block.match(/<link[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/link>/i);
  if (!m) m = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  let url = m ? decodeEntities(m[1]).trim() : '';
  if (!url) {
    const g = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    if (g) url = decodeEntities(g[1]).trim();
  }
  return /^https?:\/\//i.test(url) ? url : '';
}

function extractDate(block) {
  const m = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
  if (!m) return '';
  const raw = m[1].trim();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

// <description>은 이스케이프된 HTML → 디코드 후 태그 제거하여 평문 요약 생성.
function extractSummary(block) {
  let m = block.match(/<description[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/description>/i);
  if (!m) m = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  if (!m) return '';
  // 1차 디코드: &lt;p&gt; → <p>
  const html = decodeEntities(m[1]);
  // 태그 제거 후 2차 디코드(태그 안에 가려졌던 &amp;nbsp; 등 처리) + 공백 정리
  const text = decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > SUMMARY_MAX ? text.slice(0, SUMMARY_MAX).trim() + '…' : text;
}

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; 마지막
}

function safeCodePoint(cp) {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return '';
  try { return String.fromCodePoint(cp); } catch { return ''; }
}
