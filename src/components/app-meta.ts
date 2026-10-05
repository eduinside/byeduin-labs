/**
 * app-meta.ts — AppLayout이 빌드 때 쓰는 도우미.
 *
 * 예전에는 public/common/seo-injector.js가 런타임에 /apps.json을 받아
 *   1) 앱 헤더(.app-header)를 아이콘 블롭 + 텍스트 2열 구조로 다시 그리고
 *   2) JSON-LD·og:image 등을 주입했다.
 * 이제 같은 결과를 빌드 때 HTML 문자열로 만든다(화면 밀림·요청 1회 제거).
 * 헤더 변환 규칙은 seo-injector.js의 injectAppHeader()와 동일하게 유지한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import appsData from '../../public/apps.json';

export interface AppEntry {
  id: string;
  title?: string;
  desc?: string;
  href?: string;
  badge?: string;
  subcategory?: string;
  lucideIcon?: string;
  ogImage?: string;
  seo?: { title?: string; description?: string };
}

export const site: { name?: string; url?: string; ogImage?: string } = (appsData as any).site || {};
const apps: AppEntry[] = (appsData as any).apps || [];

export const SITE_URL = (site.url || 'https://eduin.info').replace(/\/$/, '');
export const SITE_NAME = site.name || 'eduin VIVES';

export function absUrl(p?: string): string {
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  return SITE_URL + (p.startsWith('/') ? p : '/' + p);
}

/* ── 경로 → 앱 (seo-injector.js matchApp과 동일) ── */
function normalizePath(p: string) {
  return (p || '').replace(/index\.html$/, '').replace(/\/$/, '') || '/';
}

export function matchApp(pathname: string): AppEntry | null {
  const n = normalizePath(pathname);
  return (
    apps.find((a) => a.href === pathname) ||
    apps.find((a) => a.href && normalizePath(a.href) === n) ||
    apps.find((a) => a.href && a.href.startsWith('/') && pathname.indexOf(normalizePath(a.href)) === 0) ||
    null
  );
}

/* ── JSON-LD (seo-injector.js와 같은 모양) ── */
export function jsonLd(app: AppEntry, description: string, url?: string): string {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: app.title || app.seo?.title,
    description,
    url: url || absUrl(app.href),
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  };
  // </script> 탈출 방지
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/* ── Lucide 아이콘 → 인라인 SVG ──
   자체 호스팅 UMD(public/vendor/lucide-*.min.js)를 빌드 때 한 번 평가해 아이콘 노드만 꺼낸다.
   출력은 lucide.createIcons()가 <i data-lucide="x">를 바꿔 넣은 결과와 같은 마크업. */
const LUCIDE_FILE = 'public/vendor/lucide-1.52.0.min.js';
let lucideIcons: Record<string, [string, Record<string, string>][]> | null = null;

function loadLucide() {
  if (lucideIcons) return lucideIcons;
  try {
    const src = fs.readFileSync(path.join(process.cwd(), LUCIDE_FILE), 'utf8');
    const mod: any = { exports: {} };
    new Function('exports', 'module', src)(mod.exports, mod);
    lucideIcons = mod.exports.icons || {};
  } catch (e) {
    console.warn('[app-meta] lucide 아이콘을 읽지 못함:', (e as Error).message);
    lucideIcons = {};
  }
  return lucideIcons!;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const toPascal = (name: string) =>
  name.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase());

export function lucideSvg(name: string): string | null {
  const node = loadLucide()[toPascal(name)];
  if (!node) return null;
  const attrs: Record<string, string | number> = {
    xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'data-lucide': name, 'aria-hidden': 'true', class: `lucide lucide-${name}`,
  };
  const a = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  return `<svg${a(attrs)}>` + node.map(([tag, at]) => `<${tag}${a(at)}></${tag}>`).join('') + '</svg>';
}

/* ── 아주 작은 HTML 요소 탐색기 (script/style/주석 내부는 건너뜀) ── */
const SKIP_RE = /<!--[\s\S]*?-->|<(script|style|template|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:\s[^>]*)?)>/g;

/** 건너뛸 구간 [start, end) 목록 */
function skipRanges(html: string) {
  const out: [number, number][] = [];
  for (const m of html.matchAll(SKIP_RE)) out.push([m.index!, m.index! + m[0].length]);
  return out;
}

function classList(attrs: string): string[] {
  const m = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '').split(/\s+/).filter(Boolean) : [];
}

interface Found { start: number; end: number; openEnd: number; tag: string; attrs: string; }

/** match(tag, classes)를 만족하는 첫 요소의 위치(outer)를 찾는다. */
function findElement(html: string, match: (tag: string, cls: string[]) => boolean): Found | null {
  const skips = skipRanges(html);
  const inSkip = (i: number) => skips.find(([s, e]) => i >= s && i < e);
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html))) {
    const sk = inSkip(m.index);
    if (sk) { TAG_RE.lastIndex = sk[1]; continue; }
    if (m[1] || !match(m[2].toLowerCase(), classList(m[3]))) continue;
    const tag = m[2].toLowerCase();
    const start = m.index, openEnd = m.index + m[0].length;
    // 같은 이름 태그의 열고 닫힘을 세어 짝을 찾는다
    const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi');
    re.lastIndex = openEnd;
    let depth = 1, t: RegExpExecArray | null;
    while ((t = re.exec(html))) {
      const sk2 = inSkip(t.index);
      if (sk2) { re.lastIndex = sk2[1]; continue; }
      depth += t[1] ? -1 : 1;
      if (depth === 0) return { start, end: t.index + t[0].length, openEnd, tag, attrs: m[3] };
    }
    return null;
  }
  return null;
}

const outer = (html: string, f: Found | null) => (f ? html.slice(f.start, f.end) : '');

function stripLeadingEmoji(text: string) {
  return text.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}️‍\s]+/u, '').trim();
}

/**
 * body HTML에서 첫 번째 .app-header를 아이콘+텍스트 2열 헤더로 바꾼다.
 * (seo-injector.js injectAppHeader와 같은 결과. 이미 has-lucide-header면 그대로 둔다.)
 */
export function renderAppHeader(html: string, app: AppEntry): string {
  const header = findElement(html, (_t, c) => c.includes('app-header'));
  if (!header) return html;
  const openTag = html.slice(header.start, header.openEnd);
  if (classList(header.attrs).includes('has-lucide-header')) return html;

  const inner = html.slice(header.openEnd, header.end - `</${header.tag}>`.length);

  // 1) 배지
  const badge = findElement(inner, (_t, c) => c.includes('app-badge'));
  const badgeHtml = badge ? outer(inner, badge) : app.badge ? `<div class="app-badge">◆ ${esc(app.badge)}</div>` : '';

  // 2) 제목: 앞쪽 이모지 제거, 첫 span 유지
  const h1 = findElement(inner, (t, c) => t === 'h1' && c.includes('app-title'));
  let titleHtml: string;
  if (h1) {
    const h1Inner = inner.slice(h1.openEnd, h1.end - '</h1>'.length);
    const span = findElement(h1Inner, (t) => t === 'span');
    const spanHtml = span ? outer(h1Inner, span) : '';
    const rawText = h1Inner.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '');
    titleHtml = '<h1 class="app-title">' + stripLeadingEmoji(rawText) + (spanHtml ? ' ' + spanHtml : '') + '</h1>';
  } else {
    titleHtml = `<h1 class="app-title">${esc(app.title)}</h1>`;
  }

  // 3) 설명
  const desc = findElement(inner, (_t, c) => c.includes('app-desc'));
  const descHtml = desc ? outer(inner, desc) : app.desc ? `<p class="app-desc">${esc(app.desc)}</p>` : '';

  // .app-actions는 app-shell.js가 상단 크롬으로 끌어올리므로 보존
  const actionsHtml = outer(inner, findElement(inner, (_t, c) => c.includes('app-actions')));

  // 4) 아이콘 블롭 (빌드 때 인라인 SVG, 실패 시 lucide 런타임용 <i>)
  const iconName = app.lucideIcon || 'hash';
  const svg = lucideSvg(iconName) || `<i data-lucide="${esc(iconName)}"></i>`;
  const iconHtml = `<div class="app-header-icon-blob sub-${esc(app.subcategory || 'default')}">${svg}</div>`;

  // 5) 여는 태그에 클래스·표식 추가
  const newOpen = openTag
    .replace(/((?:^|\s)class\s*=\s*")([^"]*)"/i, (_m, p, v) => `${p}${v} has-lucide-header"`)
    .replace(/>$/, ' data-static-header>');

  const newHeader = newOpen + iconHtml + '<div class="app-header-text">' + badgeHtml + titleHtml + descHtml + '</div>' +
    actionsHtml + `</${header.tag}>`;
  return html.slice(0, header.start) + newHeader + html.slice(header.end);
}
