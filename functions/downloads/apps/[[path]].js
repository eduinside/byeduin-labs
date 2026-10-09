/**
 * Cloudflare Pages Function: byeduin 데스크톱 앱 배포 (docs/desktop-distribution.md)
 *   GET/HEAD /downloads/apps/{id}/{파일}       → R2 byeduin-media `apps/{id}/{파일}` (설치 파일·업데이트 패키지·매니페스트)
 *   GET/HEAD /downloads/apps/{id}/setup        → latest.json의 files.setup으로 302 (사이트 버튼용 고정 주소)
 *   GET/HEAD /downloads/apps/{id}/portable     → latest.json의 files.portable으로 302
 * 업로드 API는 없다 — 개발자가 wrangler r2 object put으로 올린다.
 * catch-all 단일 파일([[path]].js): 폴더명 [param]이 Pages Functions 빌드를 깨뜨린 2026-07-04 교훈.
 */

// 새 데스크톱 앱은 여기에 apps.json의 id만 추가한다.
export const DESKTOP_APPS = ['login-helper'];

const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALIASES = { setup: 'setup', portable: 'portable' };
const MIME = {
  json: 'application/json; charset=utf-8',
  exe: 'application/vnd.microsoft.portable-executable',
  zip: 'application/zip',
  nupkg: 'application/octet-stream',
  msi: 'application/x-msi',
  txt: 'text/plain; charset=utf-8',
};

const text = (message, status) => new Response(message, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const r2 = env.MEDIA_R2;
  if (!r2) return text('배포 저장소가 설정되지 않았습니다.', 503);

  const segs = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  if (segs.length !== 2) return text('Not Found', 404);
  const [app, name] = segs;
  if (!DESKTOP_APPS.includes(app) || !FILE_RE.test(name) || name.includes('..')) return text('Not Found', 404);

  // 고정 별칭: 버전이 바뀌어도 사이트 버튼 주소는 그대로.
  if (ALIASES[name]) {
    const manifest = await r2.get(`apps/${app}/latest.json`);
    if (!manifest) return text('아직 배포된 버전이 없습니다.', 404);
    let latest;
    try { latest = JSON.parse(await manifest.text()); } catch { return text('배포 정보가 올바르지 않습니다.', 502); }
    const file = latest?.files?.[ALIASES[name]]?.name;
    if (!file || !FILE_RE.test(file)) return text('해당 파일이 없습니다.', 404);
    const target = new URL(`/downloads/apps/${app}/${encodeURIComponent(file)}`, request.url);
    return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
  }

  const key = `apps/${app}/${name}`;
  const range = parseRange(request.headers.get('Range'));
  const obj = request.method === 'HEAD'
    ? await r2.head(key)
    : await r2.get(key, range ? { range } : undefined);
  if (!obj) return text('Not Found', 404);

  const ext = name.split('.').pop().toLowerCase();
  const headers = new Headers({
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    ETag: obj.httpEtag,
    // 매니페스트는 항상 최신, 버전이 붙은 패키지·설치 파일은 내용이 바뀌지 않는다.
    'Cache-Control': ext === 'json' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (ext === 'exe' || ext === 'zip' || ext === 'msi') {
    headers.set('Content-Disposition', `attachment; filename="${name}"`);
  }

  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(obj.size));
    return new Response(null, { status: 200, headers });
  }
  if (range && obj.range) {
    const start = obj.range.offset ?? 0;
    const length = obj.range.length ?? (obj.size - start);
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${obj.size}`);
    headers.set('Content-Length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

/** "bytes=100-199" → { offset, length }, "bytes=100-" → { offset }, "bytes=-50" → { suffix }. */
export function parseRange(header) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  if (m[2] === '') return { offset };
  const end = Number(m[2]);
  return end >= offset ? { offset, length: end - offset + 1 } : null;
}
