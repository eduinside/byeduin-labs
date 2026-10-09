// functions/downloads/apps/[[path]].js 로컬 시험 — R2를 메모리 객체로 흉내 낸다.
//   node scripts/test-desktop-dist.mjs
import assert from 'node:assert/strict';
import { onRequest, parseRange, DESKTOP_APPS } from '../functions/downloads/apps/[[path]].js';

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
const env = {
  MEDIA_R2: {
    get: async (key, opts) => (store.has(key) ? obj(key, store.get(key), opts?.range) : null),
    head: async (key) => (store.has(key) ? obj(key, store.get(key)) : null),
  },
};
const call = (path, init = {}) => {
  const segs = path.replace('/downloads/apps/', '').split('/').filter(Boolean);
  return onRequest({ request: new Request(`https://eduin.info${path}`, init), env, params: { path: segs } });
};
const body = async (res) => new Uint8Array(await res.arrayBuffer());

assert.deepEqual(DESKTOP_APPS, ['login-helper']);

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

console.log('desktop distribution function: all checks passed');
