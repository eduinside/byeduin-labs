/**
 * Cloudflare Pages Function: byeduin 데스크톱 앱 배포 (docs/desktop-distribution.md)
 *   GET/HEAD /downloads/apps/{id}/{파일}       → R2 byeduin-media `apps/{id}/{파일}` (설치 파일·업데이트 패키지·매니페스트)
 *   GET/HEAD /downloads/apps/{id}/setup        → latest.json의 files.setup으로 302 (사이트 버튼용 고정 주소)
 *   GET/HEAD /downloads/apps/{id}/portable     → latest.json의 files.portable으로 302
 * 업로드 API는 없다 — 개발자가 wrangler r2 object put으로 올린다.
 * catch-all 단일 파일([[path]].js): 폴더명 [param]이 Pages Functions 빌드를 깨뜨린 2026-07-04 교훈.
 */

// 새 데스크톱 앱은 여기에 apps.json의 id만 추가한다.
export const DESKTOP_APPS = ['login-helper', 'gnote', 'edu-team', 'edu-dic'];

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

  // 사용자 수 (DesktopKit kit 0.2): 매니페스트 요청의 익명 설치 번호 → 해시만 D1 에. 응답을 늦추지 않게 waitUntil, 실패는 무시
  if (name === 'latest.json' && request.method === 'GET') {
    const inst = request.headers.get('X-Kit-Install');
    if (inst && INSTALL_RE.test(inst)) later(ctx, recordPing(env, app, inst, versionOf(request.headers.get('User-Agent'), app)).catch(() => {}));
  }

  // 고정 별칭: 버전이 바뀌어도 사이트 버튼 주소는 그대로.
  if (ALIASES[name]) {
    if (request.method === 'GET') later(ctx, recordDownload(env, app).catch(() => {}));
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

// ───────── 사용자 수 (docs/desktop-distribution.md · LOCAL/local-desktop-kit docs/spec.md §6.1) ─────────
// 저장하는 것: (앱, 날짜, SHA-256(app:installId) 앞 16자, 판). 설치 번호 원문·IP·User-Agent 원문은 저장하지 않는다.

const INSTALL_RE = /^[0-9a-f]{32}$/;
const KEEP_DAYS = 90;

/** 응답 뒤에 (Pages 는 ctx.waitUntil, 시험 등 없으면 그냥 실행) */
const later = (ctx, p) => (ctx.waitUntil ? ctx.waitUntil(p) : p);

/** "gnote/0.9.1" 꼴 User-Agent 에서 판만 (형식이 다르면 빈 값) */
export function versionOf(ua, app) {
  const m = new RegExp(`(?:^|\\s)${app.replace(/[^a-z0-9-]/gi, '')}\\/(\\d+\\.\\d+\\.\\d+)`).exec(ua || '');
  return m ? m[1] : '';
}

export async function instHash(app, inst) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${app}:${inst}`));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const today = () => new Date().toISOString().slice(0, 10);

async function recordPing(env, app, inst, version) {
  const db = env.BYEDUIN_DB;
  if (!db) return;
  // 하루 한 줄 — 같은 날 다시 오면(업데이트 뒤 다시 켬) 판만 새 것으로
  await db.prepare('INSERT INTO desktop_pings (app, day, inst, version) VALUES (?, ?, ?, ?) ON CONFLICT (app, day, inst) DO UPDATE SET version = excluded.version WHERE excluded.version <> \'\'')
    .bind(app, today(), await instHash(app, inst), version).run();
  // 가끔(약 1/200) 90일 지난 줄을 날짜별 합계로 접고 지운다
  if (Math.random() < 0.005) {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
    await db.batch([
      db.prepare('INSERT OR REPLACE INTO desktop_daily (app, day, users) SELECT app, day, COUNT(*) FROM desktop_pings WHERE day < ? GROUP BY app, day').bind(cutoff),
      db.prepare('DELETE FROM desktop_pings WHERE day < ?').bind(cutoff),
    ]);
  }
}

async function recordDownload(env, app) {
  const db = env.BYEDUIN_DB;
  if (!db) return;
  await db.prepare('INSERT INTO desktop_downloads (app, day, n) VALUES (?, ?, 1) ON CONFLICT (app, day) DO UPDATE SET n = n + 1')
    .bind(app, today()).run();
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
