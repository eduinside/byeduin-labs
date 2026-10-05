#!/usr/bin/env node
// 빌드 결과(dist/)의 모든 페이지를 헤드리스 브라우저로 열어 스크립트 오류가 없는지 확인하는 스모크 테스트.
//
//   npm run build && npm run smoke
//
// - dist/를 간이 정적 서버로 띄운다(/api/*는 없음 → 404). 서버 함수까지는 보지 않는다.
// - 실패 기준: 잡히지 않은 스크립트 오류(pageerror). console.error는 경고로만 출력.
// - 브라우저: 설치된 Edge/Chrome을 쓴다(SMOKE_CHANNEL=msedge|chrome, 기본 msedge).
//   CI처럼 브라우저가 없으면 `npx playwright-core install chromium` 후 SMOKE_CHANNEL=chromium.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.env.SMOKE_DIST || 'dist'); // 여러 빌드를 따로 검사할 때 SMOKE_DIST=<폴더>
const PORT = Number(process.env.SMOKE_PORT || 4399);
const CHANNEL = process.env.SMOKE_CHANNEL || 'msedge';
const WAIT_MS = Number(process.env.SMOKE_WAIT || 1500);
const ONLY = process.argv.slice(2); // 일부 경로만: node scripts/smoke.mjs /apps/timer/

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml',
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  return fs.existsSync(f) ? f : null;
}

const server = http.createServer((req, res) => {
  const f = resolveFile(req.url);
  if (!f) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"not found"}'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

function listPages() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['_astro', 'vendor', 'data', 'og-images', 'downloads'].includes(e.name)) walk(full); continue; }
      if (!e.name.endsWith('.html') || e.name === '404.html') continue;
      let rel = '/' + path.relative(DIST, full).split(path.sep).join('/');
      rel = rel.replace(/index\.html$/, '');
      out.push(rel);
    }
  })(DIST);
  return out.sort();
}

if (!fs.existsSync(DIST)) { console.error('dist/가 없습니다. 먼저 npm run build'); process.exit(2); }
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch({ channel: CHANNEL === 'chromium' ? undefined : CHANNEL, headless: true });
const pages = ONLY.length ? ONLY : listPages();
let failed = 0;

for (const p of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [], warns = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR_|status of 404/.test(t)) return; // /api 없음·외부 차단은 무시
    warns.push(t);
  });
  try {
    await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(WAIT_MS);
  } catch (e) { errors.push('로드 실패: ' + e.message); }
  if (errors.length) failed++;
  const mark = errors.length ? 'FAIL' : warns.length ? 'warn' : ' ok ';
  console.log(`[${mark}] ${p}`);
  for (const e of errors) console.log('       ✗ ' + e.split('\n')[0].slice(0, 300));
  for (const w of warns) console.log('       ! ' + w.split('\n')[0].slice(0, 300));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${pages.length}페이지 중 ${failed}개 실패`);
process.exit(failed ? 1 : 0);
