// /api/readtree — Read Tree 읽기기록 동기화 (byeduin 전용 D1, env.BYEDUIN_DB)
//
//   GET    /api/readtree?code=RT48K2     -> { reads: { "L2-ST-01": "2026-06-18", ... } }
//   PUT    /api/readtree  {code,bookId,readAt?} -> 읽음 upsert (readAt 없으면 서버 날짜)
//   DELETE /api/readtree  {code,bookId}  -> 읽음 해제
//
// 코드 = 유일 식별자(개인정보 없음). 코드 행은 첫 쓰기 때 자동 생성.
// 동일 출처(byeduin Pages)에서만 호출 → 로컬 우선, 서버는 백업·다기기 이어쓰기 채널.

const CODE_RE = /^[A-Z0-9]{6}$/;
const BOOK_RE = /^[A-Za-z0-9-]{3,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const db = env.BYEDUIN_DB;
  if (!db) return json({ error: 'D1 바인딩(BYEDUIN_DB)이 설정되지 않았습니다.' }, 500);

  const method = request.method;
  let code = '', bookId = '', readAt = '';

  if (method === 'GET') {
    try { code = (new URL(request.url).searchParams.get('code') || '').toUpperCase(); } catch {}
  } else if (method === 'PUT' || method === 'DELETE') {
    let body = {};
    try { body = await request.json(); } catch {}
    code = String(body.code || '').toUpperCase();
    bookId = String(body.bookId || '');
    readAt = DATE_RE.test(body.readAt) ? body.readAt : today();
  } else {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  if (!CODE_RE.test(code)) return json({ error: '유효한 6자리 코드가 필요합니다.' }, 400);

  try {
    if (method === 'GET') {
      const { results } = await db
        .prepare('SELECT book_id, read_at FROM read_tree_reads WHERE code = ?')
        .bind(code)
        .all();
      const reads = {};
      for (const row of results || []) reads[row.book_id] = row.read_at;
      return json({ reads });
    }

    if (!BOOK_RE.test(bookId)) return json({ error: '유효한 bookId가 필요합니다.' }, 400);

    if (method === 'PUT') {
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO read_tree_codes (code, created_at) VALUES (?, ?)').bind(code, readAt),
        db.prepare('INSERT OR REPLACE INTO read_tree_reads (code, book_id, read_at) VALUES (?, ?, ?)').bind(code, bookId, readAt),
      ]);
      return json({ ok: true, bookId, read_at: readAt });
    }

    // DELETE
    await db.prepare('DELETE FROM read_tree_reads WHERE code = ? AND book_id = ?').bind(code, bookId).run();
    return json({ ok: true, bookId, deleted: true });
  } catch (e) {
    return json({ error: (e && e.message) || 'D1 오류' }, 500);
  }
}
