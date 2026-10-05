/**
 * Cloudflare Pages Function: 에듀서치 매뉴얼 목록·본문·원본 (D1 manual_* + R2 manual/)
 *   GET /api/manual            → { docs: [{ id, title, category, dept, year, fileType, pages, updatedAt }] }
 *   GET /api/manual?doc=<id>   → { doc, chunks: [{ seq, path, pageFrom, pageTo, text }] }
 *   GET /api/manual?file=<id>  → 원본 파일(PDF는 브라우저에서 바로 열림, #page=N 지원)
 * 목록·본문(JSON) 성공 응답은 엣지 캐시(caches.default)에 5분 보관 → 요청마다 D1을 읽지 않는다.
 * 오류 응답은 캐시하지 않는다. 적재(scripts/manual-ingest.mjs) 후 최대 5분 뒤 반영된다.
 */
const CACHE_SEC = 300;
const json = (data, status = 200, maxAge = CACHE_SEC) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? `public, max-age=${maxAge}` : 'no-store',
  },
});
const MIME = { pdf: 'application/pdf', hwpx: 'application/hwp+zip', hwp: 'application/x-hwp' };

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const db = env.BYEDUIN_DB;
  if (!db) return json({ error: '문서 저장소가 설정되지 않았습니다.' }, 500);
  const url = new URL(request.url);
  const docId = (url.searchParams.get('doc') || '').slice(0, 100);
  const fileId = (url.searchParams.get('file') || '').slice(0, 100);

  try {
    if (fileId) {
      const doc = await db.prepare('SELECT title, file_key, file_type FROM manual_docs WHERE id = ?').bind(fileId).first();
      const obj = doc?.file_key && env.MEDIA_R2 ? await env.MEDIA_R2.get(doc.file_key) : null;
      if (!obj) return new Response('원본 파일이 없습니다.', { status: 404 });
      const name = encodeURIComponent(`${doc.title}.${doc.file_type}`);
      return new Response(obj.body, {
        headers: {
          'Content-Type': MIME[doc.file_type] || 'application/octet-stream',
          // PDF는 새 탭에서 바로 보이게, HWP류는 내려받기
          'Content-Disposition': `${doc.file_type === 'pdf' ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // JSON 응답은 엣지 캐시 먼저(키: doc 파라미터만 남긴 주소)
    const cache = globalThis.caches?.default;
    const cacheKey = new Request(`${url.origin}/api/manual${docId ? `?doc=${encodeURIComponent(docId)}` : ''}`);
    if (cache) {
      const hit = await cache.match(cacheKey).catch(() => null);
      if (hit) return hit;
    }

    let res;
    if (docId) {
      const doc = await db.prepare('SELECT id, title, category, dept, year, file_type AS fileType, file_key, pages FROM manual_docs WHERE id = ?').bind(docId).first();
      if (!doc) return json({ error: '문서를 찾을 수 없습니다.' }, 404);
      // 원본을 R2에 올리지 않은 문서도 있다 — 없으면 화면에서 "원문 보기" 버튼을 숨긴다
      doc.hasFile = !!(doc.file_key && env.MEDIA_R2 && await env.MEDIA_R2.head(doc.file_key));
      delete doc.file_key;
      const { results } = await db.prepare(
        'SELECT seq, path, page_from AS pageFrom, page_to AS pageTo, text FROM manual_chunks WHERE doc_id = ? ORDER BY seq'
      ).bind(docId).all();
      res = json({ doc, chunks: results });
    } else {
      const { results } = await db.prepare(
        'SELECT id, title, category, dept, year, file_type AS fileType, pages, updated_at AS updatedAt FROM manual_docs ORDER BY category, title'
      ).all();
      res = json({ docs: results });
    }
    if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
    return res;
  } catch (e) {
    console.error('[manual]', e && e.message);
    return json({ error: '매뉴얼을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, 500);
  }
}
