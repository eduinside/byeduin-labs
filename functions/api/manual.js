/**
 * Cloudflare Pages Function: 에듀서치 매뉴얼 목록·본문·원본 (D1 manual_* + R2 manual/)
 *   GET /api/manual            → { docs: [{ id, title, category, dept, year, fileType, pages, updatedAt }] }
 *   GET /api/manual?doc=<id>   → { doc, chunks: [{ seq, path, pageFrom, pageTo, text }] }
 *   GET /api/manual?file=<id>  → 원본 파일(PDF는 브라우저에서 바로 열림, #page=N 지원)
 */
const json = (data, maxAge = 300) => new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
});
const MIME = { pdf: 'application/pdf', hwpx: 'application/hwp+zip', hwp: 'application/x-hwp' };

export async function onRequestGet({ request, env }) {
  const db = env.BYEDUIN_DB;
  if (!db) return new Response('DB not configured', { status: 500 });
  const url = new URL(request.url);
  const docId = url.searchParams.get('doc');
  const fileId = url.searchParams.get('file');

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

  if (docId) {
    const doc = await db.prepare('SELECT id, title, category, dept, year, file_type AS fileType, file_key, pages FROM manual_docs WHERE id = ?').bind(docId).first();
    if (!doc) return new Response(JSON.stringify({ error: '문서를 찾을 수 없습니다.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    // 원본을 R2에 올리지 않은 문서도 있다 — 없으면 화면에서 "원문 보기" 버튼을 숨긴다
    doc.hasFile = !!(doc.file_key && env.MEDIA_R2 && await env.MEDIA_R2.head(doc.file_key));
    delete doc.file_key;
    const { results } = await db.prepare(
      'SELECT seq, path, page_from AS pageFrom, page_to AS pageTo, text FROM manual_chunks WHERE doc_id = ? ORDER BY seq'
    ).bind(docId).all();
    return json({ doc, chunks: results });
  }

  const { results } = await db.prepare(
    'SELECT id, title, category, dept, year, file_type AS fileType, pages, updated_at AS updatedAt FROM manual_docs ORDER BY category, title'
  ).all();
  return json({ docs: results });
}
