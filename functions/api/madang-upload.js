// functions/api/madang-upload.js
// ─────────────────────────────────────────────────────────────────────────────
// 마당 사진·그림 카드 업로드 — R2(byeduin 공용 버킷, env.MEDIA_R2)에 저장.
//   클라이언트가 이미 canvas로 리사이즈(최대 1280px)·압축(≤400KB)한 결과물을 raw body로 받는다.
//   POST /api/madang-upload?board=ID&code=XX&pin=NN   (Content-Type: image/webp|jpeg|png)
//   응답: { ok:true, key:'uuid.webp' } — key는 madang_cards.content로 저장되고
//         GET /api/madang-img/{board}/{key}로 스트리밍된다.
// ─────────────────────────────────────────────────────────────────────────────

import { CODE_RE, BOARD_RE, json, parseSettings, ownerToken, checkAccess, madangR2Key } from './_madang-common.js';

const MAX_IMAGE_BYTES = 400 * 1024;              // 클라이언트 리사이즈 결과 상한(서버 안전망 재검증)
const MAX_BOARD_IMAGE_TOTAL = 60 * 1024 * 1024;  // 보드당 이미지 총 용량 상한
const ALLOWED_CONTENT_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const db = env.BYEDUIN_DB;
  const r2 = env.MEDIA_R2;
  if (!db || !r2) return json({ error: '이미지 저장소(R2)가 설정되지 않았습니다.' }, 500);

  const url = new URL(request.url);
  const boardId = (url.searchParams.get('board') || '').toUpperCase();
  const code = (url.searchParams.get('code') || '').toUpperCase();
  const pin = url.searchParams.get('pin') || '';
  if (!BOARD_RE.test(boardId)) return json({ error: '유효한 마당 코드가 필요합니다.' }, 400);
  if (!CODE_RE.test(code)) return json({ error: '참여 코드가 필요합니다.' }, 400);

  const board = await db.prepare('SELECT * FROM madang_boards WHERE id = ?').bind(boardId).first();
  if (!board) return json({ error: '마당을 찾을 수 없습니다.' }, 404);
  const settings = parseSettings(board.settings);
  const isOwner = (await ownerToken(env, boardId, code)) === board.owner_token;
  const acc = await checkAccess(env, board, settings, isOwner, pin);
  if (acc) return json(acc, acc.status);

  const allowed = Array.isArray(settings.allowedTypes) && settings.allowedTypes.length ? settings.allowedTypes : ['text', 'html'];
  if (!allowed.includes('image')) return json({ error: '이 마당에서 허용하지 않는 카드 유형입니다.' }, 400);

  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) return json({ error: '지원하지 않는 이미지 형식입니다.' }, 400);

  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: '이미지 내용이 비어 있습니다.' }, 400);
  if (buf.byteLength > MAX_IMAGE_BYTES) return json({ error: '이미지 용량이 너무 큽니다(최대 400KB).' }, 413);

  const totalBefore = Number(settings.imageBytes || 0);
  if (totalBefore + buf.byteLength > MAX_BOARD_IMAGE_TOTAL) {
    return json({ error: '이 마당의 이미지 저장 공간이 가득 찼습니다. 개설자에게 알려주세요.' }, 409);
  }

  const key = crypto.randomUUID() + '.' + ext;
  await r2.put(madangR2Key(boardId, key), buf, { httpMetadata: { contentType } });

  settings.imageBytes = totalBefore + buf.byteLength;
  await db.prepare('UPDATE madang_boards SET settings = ? WHERE id = ?').bind(JSON.stringify(settings), boardId).run();

  return json({ ok: true, key: key });
}
