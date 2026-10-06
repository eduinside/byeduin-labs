#!/usr/bin/env node
/**
 * build-icons.mjs — 사이트에서 쓰는 lucide 아이콘만 모아 SVG 스프라이트를 만든다.
 *
 *   node scripts/build-icons.mjs        → public/common/icons.svg 생성
 *   node scripts/build-icons.mjs --check → 없는 아이콘 이름이 있으면 실패(종료 코드 1)
 *
 * 아이콘 이름을 찾는 곳(src/, public/ — vendor 제외):
 *   <Icon name="camera" …>          Astro 컴포넌트 (src/components/Icon.astro)
 *   VUI.icon('camera') / ("camera")  런타임 문자열 (public/common/ui.js)
 *   icons.svg#camera                 직접 쓴 <use href>
 *   data-icon="camera"               VUI.icons.render()가 바꿔 넣는 자리
 *   @icons camera trash-2 …          동적으로 이름을 만드는 코드가 쓸 목록(주석)
 *   apps.json의 "lucideIcon"         홈 카드·앱 헤더
 *
 * 원본: public/vendor/lucide-1.52.0.min.js (app-meta.ts와 같은 방식으로 평가)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LUCIDE_FILE = 'public/vendor/lucide-1.52.0.min.js';
const OUT = 'public/common/icons.svg';
const CHECK = process.argv.includes('--check');

const src = fs.readFileSync(path.join(ROOT, LUCIDE_FILE), 'utf8');
const mod = { exports: {} };
new Function('exports', 'module', src)(mod.exports, mod);
const icons = mod.exports.icons || {};
const toPascal = (n) => n.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase());

const PATTERNS = [
  /<Icon\b[^>]*?\bname=["']([a-z0-9-]+)["']/g,
  /\bicon\(\s*["']([a-z0-9-]+)["']/g,          // VUI.icon('x'), SimKit.icon('x'), icon('x') — 짧은 도우미 이름(ic 등)은 안 모임
  /icons\.svg#([a-z0-9-]+)/g,
  /data-icon=["']([a-z0-9-]+)["']/g,
  /data-icon=\\["']([a-z0-9-]+)\\["']/g,
];
const LIST_RE = /@icons[ \t]+([a-z0-9][a-z0-9\- \t]*)/g;

const names = new Set();
const where = new Map();
function add(n, file) {
  names.add(n);
  if (!where.has(n)) where.set(n, file);
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['vendor', 'node_modules', 'og-images'].includes(ent.name)) continue;
      walk(p);
    } else if (/\.(astro|ts|js|mjs|html)$/.test(ent.name)) {
      const text = fs.readFileSync(p, 'utf8');
      for (const re of PATTERNS) for (const m of text.matchAll(re)) add(m[1], p);
      for (const m of text.matchAll(LIST_RE)) for (const n of m[1].trim().split(/\s+/)) add(n, p);
    }
  }
}
walk(path.join(ROOT, 'src'));
walk(path.join(ROOT, 'public'));

const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/apps.json'), 'utf8'));
for (const a of apps.apps || []) if (a.lucideIcon) add(a.lucideIcon, 'public/apps.json');
for (const c of apps.categories || []) if (c.lucideIcon) add(c.lucideIcon, 'public/apps.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const missing = [];
const symbols = [];
for (const n of [...names].sort()) {
  const node = icons[toPascal(n)];
  if (!node) { missing.push(n); continue; }
  const body = node.map(([tag, at]) =>
    `<${tag}${Object.entries(at).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}/>`).join('');
  symbols.push(`<symbol id="${n}" viewBox="0 0 24 24">${body}</symbol>`);
}

if (missing.length) {
  console.error('[icons] lucide에 없는 이름:');
  for (const n of missing) console.error(`  - ${n}  (${path.relative(ROOT, where.get(n))})`);
  if (CHECK) process.exit(1);
}
if (CHECK) {
  // 검사만: 파일은 쓰지 않는다(여러 작업이 동시에 돌아도 안전)
  console.log(`[icons] 검사 통과 — ${symbols.length}개`);
  process.exit(0);
}

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg">\n' +
  '<!-- 자동 생성: scripts/build-icons.mjs — 직접 고치지 말 것. lucide (ISC) -->\n' +
  symbols.join('\n') + '\n</svg>\n';
fs.writeFileSync(path.join(ROOT, OUT), svg);
console.log(`[icons] ${symbols.length}개 → ${OUT} (${(svg.length / 1024).toFixed(1)}KB)`);
