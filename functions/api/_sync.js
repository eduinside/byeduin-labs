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
// ─────────────────────────────────────────────────────────────────────────────

const CODE_RE = /^[A-Z0-9]{6}$/;
const DEFAULT_ITEM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DOC_MAX_BYTES = 256 * 1024; // 코드당 문서 256KB 상한(폭주 방지)
const VAL_MAX_BYTES = 8 * 1024;   // set 항목 값 8KB 상한

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

// ── 마이그레이션 SQL 스니펫 생성기 (migrations/*.sql에 붙여넣기용) ──
export function docSchema(table) {
  return `CREATE TABLE IF NOT EXISTS ${table} (
  code       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;
}

export function setSchema(table) {
  const idx = table + '_code';
  return `CREATE TABLE IF NOT EXISTS ${table} (
  code       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, item_id)
);
CREATE INDEX IF NOT EXISTS idx_${idx} ON ${table} (code);`;
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
    if (!db) return json({ error: `D1 바인딩(${binding})이 설정되지 않았습니다.` }, 500);
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
        return json({ error: (e && e.message) || 'D1 오류' }, 500);
      }
    }

    if (method === 'PUT' || method === 'DELETE') {
      let body = {};
      try { body = await request.json(); } catch {}
      const code = String(body.code || '').toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);

      try {
        if (method === 'DELETE') {
          await db.prepare(`DELETE FROM ${table} WHERE code = ?`).bind(code).run();
          return json({ ok: true, deleted: true });
        }
        // PUT
        if (typeof body.data === 'undefined') return json({ error: 'data가 필요합니다.' }, 400);
        const dataStr = JSON.stringify(body.data);
        if (byteLen(dataStr) > maxBytes) return json({ error: `문서가 너무 큽니다(>${maxBytes}B).` }, 413);
        const incoming = typeof body.updatedAt === 'string' ? body.updatedAt : nowIso();

        const cur = await db.prepare(`SELECT updated_at FROM ${table} WHERE code = ?`).bind(code).first();
        if (cur && cur.updated_at > incoming) {
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
        return json({ error: (e && e.message) || 'D1 오류' }, 500);
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

  return async function onRequest(ctx) {
    const { request, env } = ctx;
    const db = env[binding];
    if (!db) return json({ error: `D1 바인딩(${binding})이 설정되지 않았습니다.` }, 500);
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
        return json({ error: (e && e.message) || 'D1 오류' }, 500);
      }
    }

    if (method === 'PUT' || method === 'DELETE') {
      let body = {};
      try { body = await request.json(); } catch {}
      const code = String(body.code || '').toUpperCase();
      const itemId = String(body.itemId || '');
      if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);
      if (!itemRe.test(itemId)) return json({ error: '유효한 itemId가 필요합니다.' }, 400);

      try {
        if (method === 'DELETE') {
          await db.prepare(`DELETE FROM ${table} WHERE code = ? AND item_id = ?`).bind(code, itemId).run();
          return json({ ok: true, itemId, deleted: true });
        }
        // PUT
        const value = typeof body.value === 'string' ? body.value : '';
        if (byteLen(value) > valueMax) return json({ error: `값이 너무 큽니다(>${valueMax}B).` }, 413);
        const at = typeof body.updatedAt === 'string' ? body.updatedAt : nowIso();
        await db.prepare(
          `INSERT INTO ${table} (code, item_id, value, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(code, item_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
           WHERE excluded.updated_at >= ${table}.updated_at`
        ).bind(code, itemId, value, at).run();
        return json({ ok: true, itemId, updated_at: at });
      } catch (e) {
        return json({ error: (e && e.message) || 'D1 오류' }, 500);
      }
    }

    return json({ error: 'Method Not Allowed' }, 405);
  };
}
