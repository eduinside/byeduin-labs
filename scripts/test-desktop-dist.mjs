// functions/downloads/apps/[[path]].js 로컬 시험 — R2를 메모리 객체로 흉내 낸다.
//   node scripts/test-desktop-dist.mjs
import assert from 'node:assert/strict';
import { onRequest, parseRange, DESKTOP_APPS, versionOf, instHash } from '../functions/downloads/apps/[[path]].js';

const store = new Map();
const put = (key, body) => store.set(key, new TextEncoder().encode(body));
put('apps/login-helper/latest.json', JSON.stringify({
  id: 'login-helper', version: '0.3.0',
  files: { setup: { name: 'LoginHelper-0.3.0-win-Setup.exe' }, portable: { name: 'LoginHelper-0.3.0-win-Portable.zip' } },
}));
put('apps/login-helper/LoginHelper-0.3.0-win-Setup.exe', '0123456789');
put('apps/login-helper/releases.win.json', '{"Assets":[]}');
put('madang/BOARD/secret.webp', 'private');

const obj = (key, bytes, range) => {
  let slice = bytes;
  let r;
  if (range) {
    const offset = range.suffix != null ? bytes.length - range.suffix : range.offset;
    const length = range.length ?? bytes.length - offset;
    slice = bytes.slice(offset, offset + length);
    r = { offset, length };
  }
  return { size: bytes.length, httpEtag: `"${key.length}"`, range: r, body: slice, text: async () => new TextDecoder().decode(bytes) };
};
// D1 흉내: 실행한 SQL·값만 모아 둔다 (사용자 수 — kit 0.2)
const sql = [];
const stmt = (q) => ({ bind: (...v) => ({ run: async () => { sql.push({ q, v }); }, q, v }) });
const env = {
  BYEDUIN_DB: { prepare: stmt, batch: async (list) => { for (const s of list) sql.push({ q: s.q, v: s.v }); } },
  MEDIA_R2: {
    get: async (key, opts) => (store.has(key) ? obj(key, store.get(key), opts?.range) : null),
    head: async (key) => (store.has(key) ? obj(key, store.get(key)) : null),
  },
};
const waits = [];
const call = (path, init = {}) => {
  const segs = path.replace('/downloads/apps/', '').split('/').filter(Boolean);
  return onRequest({ request: new Request(`https://eduin.info${path}`, init), env, params: { path: segs }, waitUntil: (p) => waits.push(p) });
};
const body = async (res) => new Uint8Array(await res.arrayBuffer());

assert.deepEqual(DESKTOP_APPS, ['login-helper', 'gnote', 'edu-team', 'edu-dic']);

let res = await call('/downloads/apps/login-helper/setup');
assert.equal(res.status, 302);
assert.equal(res.headers.get('Location'), 'https://eduin.info/downloads/apps/login-helper/LoginHelper-0.3.0-win-Setup.exe');
assert.equal(res.headers.get('Cache-Control'), 'no-store');

res = await call('/downloads/apps/login-helper/LoginHelper-0.3.0-win-Setup.exe');
assert.equal(res.status, 200);
assert.equal(new TextDecoder().decode(await body(res)), '0123456789');
assert.match(res.headers.get('Content-Disposition'), /attachment/);
assert.match(res.headers.get('Cache-Control'), /immutable/);

res = await call('/downloads/apps/login-helper/LoginHelper-0.3.0-win-Setup.exe', { headers: { Range: 'bytes=2-5' } });
assert.equal(res.status, 206);
assert.equal(res.headers.get('Content-Range'), 'bytes 2-5/10');
assert.equal(new TextDecoder().decode(await body(res)), '2345');

res = await call('/downloads/apps/login-helper/releases.win.json');
assert.equal(res.headers.get('Cache-Control'), 'no-cache');
assert.match(res.headers.get('Content-Type'), /json/);

res = await call('/downloads/apps/login-helper/LoginHelper-0.3.0-win-Setup.exe', { method: 'HEAD' });
assert.equal(res.status, 200);
assert.equal(res.headers.get('Content-Length'), '10');

for (const bad of ['/downloads/apps/madang/BOARD', '/downloads/apps/other-app/latest.json', '/downloads/apps/login-helper/..%2Fx',
  '/downloads/apps/login-helper/a/b', '/downloads/apps/login-helper/missing.zip']) {
  res = await call(bad);
  assert.equal(res.status, 404, bad);
}
res = await call('/downloads/apps/login-helper/latest.json', { method: 'POST' });
assert.equal(res.status, 405);

assert.deepEqual(parseRange('bytes=0-'), { offset: 0 });
assert.deepEqual(parseRange('bytes=-5'), { suffix: 5 });
assert.equal(parseRange('bytes=5-1'), null);
assert.equal(parseRange('items=0-1'), null);

// 사용자 수: 설치 번호가 있으면 해시만, 없거나 형식이 틀리면 아무것도
sql.length = 0;
const id = '0123456789abcdef0123456789abcdef';
await call('/downloads/apps/login-helper/latest.json', { headers: { 'X-Kit-Install': id, 'User-Agent': 'login-helper/0.6.0' } });
await call('/downloads/apps/login-helper/latest.json', { headers: { 'X-Kit-Install': 'NOT-AN-ID' } });
await call('/downloads/apps/login-helper/latest.json');
await Promise.all(waits);
const pings = sql.filter((s) => s.q.includes('desktop_pings (app'));
assert.equal(pings.length, 1);
assert.equal(pings[0].v[0], 'login-helper');
assert.equal(pings[0].v[2], await instHash('login-helper', id));
assert.equal(pings[0].v[2].length, 16);
assert.equal(pings[0].v[3], '0.6.0');
// 같은 날 다시 오면(업데이트 뒤) 줄을 더하지 않고 판만 새로 — SQLite 동작은 로컬 D1 로 확인함
assert.match(pings[0].q, /ON CONFLICT \(app, day, inst\) DO UPDATE SET version = excluded\.version/);
assert.ok(!JSON.stringify(sql).includes(id), '설치 번호 원문은 저장하지 않는다');
sql.length = 0;
await call('/downloads/apps/login-helper/setup');
await Promise.all(waits);
assert.equal(sql.filter((s) => s.q.includes('desktop_downloads')).length, 1);
assert.equal(versionOf('gnote/0.9.1', 'gnote'), '0.9.1');
assert.equal(versionOf('Mozilla/5.0', 'gnote'), '');

console.log('desktop distribution function: all checks passed');
