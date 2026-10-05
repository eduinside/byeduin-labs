// functions/api/_sync.js
// ─────────────────────────────────────────────────────────────────────────────
// 코드 기반 익명 동기화 공용 헬퍼 (byeduin 전용 D1, 기본 바인딩 env.BYEDUIN_DB).
//
//   read-tree(/api/readtree)에서 검증된 패턴을 재사용 가능한 팩토리로 추출한 것.
//   개인정보 없음 — 6자리 코드가 곧 사용자 키. 로컬(localStorage) 우선, 서버는
//   백업·다기기 이어쓰기 채널. 오프라인/장애 시 클라이언트가 무시하면 그만.
//
// 두 가지 저장 모드:
//   • doc : 코드당 JSON 문서 1개.   flash-deck / allowance-calculator / scoring-table
//           처럼 상태를 통째 blob으로 저장하는 앱에 적합. 문서 단위 LWW.
//   • set : 코드당 다수 항목(항목별 토글·값). read-tree처럼 항목별로 저장하고
//           항목 단위 LWW로 머지하는 앱에 적합.
//
// 사용 예 (각 앱의 functions/api/<app>.js 한 줄):
//   import { createDocSync } from './_sync.js';
//   export const onRequest = createDocSync({ table: 'flash_deck_docs' });
//
//   import { createSetSync } from './_sync.js';
//   export const onRequest = createSetSync({ table: 'read_tree_reads' });
//
// 마이그레이션 SQL은 docSchema()/setSchema()로 생성 → docs/d1-sync-pattern.md 참고.
//
// 남용 방지(docs/audit-2026-10.md 4.2, 4.4):
//   • 쓰기(PUT·DELETE)는 같은 출처 요청만 받고, IP당 하루 쓰기 횟수·바이트 상한을 둔다
//     (_guard.js LIMITS['sync-write'], LIMITS['sync-bytes']).
//   • 클라이언트가 보낸 updatedAt은 형식을 검사하고, 서버 시각보다 미래면 서버 시각으로 맞춘다.
//     먼 미래 값이 한 번 들어가 이후 저장이 모두 무시되던 문제 방지. 이미 그런 행이 있으면 덮어쓰기를 허용한다.
//   • set 모드는 코드당 항목 수 상한(maxItems)을 둔다.
// ─────────────────────────────────────────────────────────────────────────────

import { checkOrigin, rateLimit } from './_guard.js';

const CODE_RE = /^[A-Z0-9]{6}$/;
const DEFAULT_ITEM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DOC_MAX_BYTES = 256 * 1024; // 코드당 문서 256KB 상한(폭주 방지)
const VAL_MAX_BYTES = 8 * 1024;   // set 항목 값 8KB 상한
const MAX_ITEMS = 500;            // set 모드 코드당 항목 수 상한(기본값, opts.maxItems로 조정)
const CLOCK_SKEW_MS = 10 * 60 * 1000; // 기기 시계가 서버보다 빠른 정도의 허용치(10분)
const BODY_SLACK = 4 * 1024;      // 본문 상한 = 값 상한 + 여유(코드·itemId·updatedAt·JSON 이스케이프)
const DB_ERROR = '저장소 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// ISO8601(UTC, 밀리초). 문서/항목 LWW 비교 키로 사용(문자열 비교 = 시간 비교).
function nowIso() {
  return new Date().toISOString();
}

function byteLen(s) {
  return new TextEncoder().encode(s).length;
}

// 허용 상한 시각(서버 시각 + 허용치). 저장본이 이보다 미래면 오염된 값으로 보고 덮어쓰기를 허용한다.
function maxIso() {
  return new Date(Date.now() + CLOCK_SKEW_MS).toISOString();
}

// 클라이언트 updatedAt 검사.
//   • ISO8601 UTC(예: 2026-10-05T01:02:03.456Z) — 기본 형식(sync.js nowIso)
//   • 날짜만(YYYY-MM-DD) — read-tree는 '읽은 날짜'가 곧 LWW 키
// 형식이 아니거나 미래(ISO는 10분, 날짜는 하루 초과)면 서버 시각을 쓴다.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function sanitizeAt(v) {
  const now = Date.now();
  if (typeof v !== 'string') return nowIso();
  if (ISO_RE.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t) && t <= now + CLOCK_SKEW_MS ? v : nowIso();
  }
  if (DATE_RE.test(v)) {
    const t = Date.parse(v + 'T00:00:00Z');
    return Number.isFinite(t) && t <= now + 24 * 3600 * 1000 ? v : nowIso();
  }
  return nowIso();
}

// 쓰기 요청 공통 검사: 같은 출처 + IP당 하루 쓰기 횟수·바이트 상한. 통과면 null.
async function writeGuard(request, bytes) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  const limited = await rateLimit(request, 'sync-write');
  if (limited) return limited;
  if (bytes > 0) return rateLimit(request, 'sync-bytes', { cost: bytes });
  return null;
}

// 본문을 maxBytes까지만 받아 JSON 파싱. 너무 크면 null, 파싱 실패면 {}(기존 동작: 이후 코드 검사에서 400).
async function readBodyJson(request, maxBytes) {
  const cl = Number(request.headers.get('content-length'));
  if (Number.isFinite(cl) && cl > maxBytes) return null;
  try {
    const text = await request.text();
    if (byteLen(text) > maxBytes) return null;
    return JSON.parse(text) || {};
  } catch {
    return {};
  }
}

// ── 마이그레이션 SQL 스니펫 생성기 (migrations/*.sql에 붙여넣기용) ──
export function docSchema(table) {
  return `CREATE TABLE IF NOT EXISTS ${table} (
  code       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;
}

// (code) 단독 인덱스는 만들지 않는다 — PRIMARY KEY (code, item_id)가 같은 조회를 처리한다(0014 참고).
export function setSchema(table) {
  return `CREATE TABLE IF NOT EXISTS ${table} (
  code       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, item_id)
);`;
}

// ─────────────────────────────────────────────────────────────────────────────
// doc 모드 — 코드당 JSON 문서 1개.
//   GET    ?code=ABC123                      -> { data, updated_at } | { data:null }
//   PUT    { code, data, updatedAt? }        -> 문서 upsert (LWW: 들어온 updatedAt이
//                                               저장본보다 과거면 거부하고 최신본 반환)
//   DELETE { code }                          -> 문서 삭제
// ─────────────────────────────────────────────────────────────────────────────
export function createDocSync(opts = {}) {
  const table = opts.table;
  if (!table) throw new Error('_sync: createDocSync에는 { table }이 필요합니다.');
  const binding = opts.binding || 'BYEDUIN_DB';
  const maxBytes = opts.maxBytes || DOC_MAX_BYTES;

  return async function onRequest(ctx) {
    const { request, env } = ctx;
    const db = env[binding];
    if (!db) { console.error(`[_sync] D1 바인딩(${binding}) 없음`); return json({ error: DB_ERROR }, 500); }
    const method = request.method;

    if (method === 'GET') {
      let code = '';
      try { code = (new URL(request.url).searchParams.get('code') || '').toUpperCase(); } catch {}
      if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);
      try {
        const row = await db.prepare(`SELECT data, updated_at FROM ${table} WHERE code = ?`).bind(code).first();
        if (!row) return json({ data: null, updated_at: null });
        let data = null;
        try { data = JSON.parse(row.data); } catch { data = null; }
        return json({ data, updated_at: row.updated_at });
      } catch (e) {
        console.error(`[_sync] ${table}`, e && e.message);
        return json({ error: DB_ERROR }, 500);
      }
    }

    if (method === 'PUT' || method === 'DELETE') {
      const body = await readBodyJson(request, maxBytes * 2 + BODY_SLACK);
      if (!body) return json({ error: '문서가 너무 큽니다.' }, 413);
      const code = String(body.code || '').toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);

      let dataStr = '';
      if (method === 'PUT') {
        if (typeof body.data === 'undefined') return json({ error: 'data가 필요합니다.' }, 400);
        dataStr = JSON.stringify(body.data);
        if (byteLen(dataStr) > maxBytes) return json({ error: `문서가 너무 큽니다(>${maxBytes}B).` }, 413);
      }
      const blocked = await writeGuard(request, byteLen(dataStr));
      if (blocked) return blocked;

      try {
        if (method === 'DELETE') {
          await db.prepare(`DELETE FROM ${table} WHERE code = ?`).bind(code).run();
          return json({ ok: true, deleted: true });
        }
        // PUT
        const incoming = sanitizeAt(body.updatedAt);

        const cur = await db.prepare(`SELECT updated_at FROM ${table} WHERE code = ?`).bind(code).first();
        // 저장본이 더 최신이면 거부. 단 저장본 시각이 서버 시각보다 미래(오염)면 덮어쓴다.
        if (cur && cur.updated_at > incoming && cur.updated_at <= maxIso()) {
          // 저장본이 더 최신 → 덮어쓰지 않고 최신본 반환(클라가 머지하도록)
          const row = await db.prepare(`SELECT data, updated_at FROM ${table} WHERE code = ?`).bind(code).first();
          let data = null; try { data = JSON.parse(row.data); } catch {}
          return json({ ok: false, stale: true, data, updated_at: row.updated_at });
        }
        await db.prepare(
          `INSERT INTO ${table} (code, data, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind(code, dataStr, incoming).run();
        return json({ ok: true, updated_at: incoming });
      } catch (e) {
        console.error(`[_sync] ${table}`, e && e.message);
        return json({ error: DB_ERROR }, 500);
      }
    }

    return json({ error: 'Method Not Allowed' }, 405);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// set 모드 — 코드당 다수 항목(항목별 값 + 타임스탬프).
//   GET    ?code=ABC123                          -> { items: { id: { v, at } } }
//   PUT    { code, itemId, value?, updatedAt? }  -> 항목 upsert(value 기본 '')
//   DELETE { code, itemId }                      -> 항목 삭제
// read-tree(읽음 토글)처럼 value 없이 존재 자체가 의미인 경우 value=''로 둠.
// ─────────────────────────────────────────────────────────────────────────────
export function createSetSync(opts = {}) {
  const table = opts.table;
  if (!table) throw new Error('_sync: createSetSync에는 { table }이 필요합니다.');
  const binding = opts.binding || 'BYEDUIN_DB';
  const itemRe = opts.itemRe || DEFAULT_ITEM_RE;
  const valueMax = opts.valueMax || VAL_MAX_BYTES;   // 문서 라이브러리(set)는 항목 값이 클 수 있어 상향 가능
  const maxItems = opts.maxItems || MAX_ITEMS;

  return async function onRequest(ctx) {
    const { request, env } = ctx;
    const db = env[binding];
    if (!db) { console.error(`[_sync] D1 바인딩(${binding}) 없음`); return json({ error: DB_ERROR }, 500); }
    const method = request.method;

    if (method === 'GET') {
      let code = '';
      try { code = (new URL(request.url).searchParams.get('code') || '').toUpperCase(); } catch {}
      if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);
      try {
        const { results } = await db
          .prepare(`SELECT item_id, value, updated_at FROM ${table} WHERE code = ?`)
          .bind(code).all();
        const items = {};
        for (const r of results || []) items[r.item_id] = { v: r.value, at: r.updated_at };
        return json({ items });
      } catch (e) {
        console.error(`[_sync] ${table}`, e && e.message);
        return json({ error: DB_ERROR }, 500);
      }
    }

    if (method === 'PUT' || method === 'DELETE') {
      // 값은 JSON 문자열 안에 한 번 더 이스케이프되어 오므로 본문 상한은 값 상한의 2배 + 여유
      const body = await readBodyJson(request, valueMax * 2 + BODY_SLACK);
      if (!body) return json({ error: '값이 너무 큽니다.' }, 413);
      const code = String(body.code || '').toUpperCase();
      const itemId = String(body.itemId || '');
      if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);
      if (!itemRe.test(itemId)) return json({ error: '유효한 itemId가 필요합니다.' }, 400);

      const value = method === 'PUT' && typeof body.value === 'string' ? body.value : '';
      if (byteLen(value) > valueMax) return json({ error: `값이 너무 큽니다(>${valueMax}B).` }, 413);
      const blocked = await writeGuard(request, byteLen(value));
      if (blocked) return blocked;

      try {
        if (method === 'DELETE') {
          await db.prepare(`DELETE FROM ${table} WHERE code = ? AND item_id = ?`).bind(code, itemId).run();
          return json({ ok: true, itemId, deleted: true });
        }
        // PUT — 새 항목이면 코드당 항목 수 상한 확인(기존 항목 수정은 항상 허용)
        const cnt = await db.prepare(
          `SELECT COUNT(*) AS n, COALESCE(SUM(item_id = ?), 0) AS mine FROM ${table} WHERE code = ?`
        ).bind(itemId, code).first();
        if (cnt && !cnt.mine && cnt.n >= maxItems) {
          return json({ error: `저장할 수 있는 개수(${maxItems}개)를 넘었어요. 안 쓰는 항목을 지운 뒤 다시 저장해 주세요.` }, 413);
        }
        const at = sanitizeAt(body.updatedAt);
        // 항목 단위 LWW. 저장본 시각이 서버 시각보다 미래(오염)면 덮어쓴다.
        await db.prepare(
          `INSERT INTO ${table} (code, item_id, value, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(code, item_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
           WHERE excluded.updated_at >= ${table}.updated_at OR ${table}.updated_at > ?`
        ).bind(code, itemId, value, at, maxIso()).run();
        return json({ ok: true, itemId, updated_at: at });
      } catch (e) {
        console.error(`[_sync] ${table}`, e && e.message);
        return json({ error: DB_ERROR }, 500);
      }
    }

    return json({ error: 'Method Not Allowed' }, 405);
  };
}
