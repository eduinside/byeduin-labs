// functions/api/madang-img/[board]/[key].js
// ─────────────────────────────────────────────────────────────────────────────
// 마당 사진·그림 카드 스트리밍 — GET /api/madang-img/{boardId}/{key}?code=XX&pin=NN
//   GET 폴링(madang.js handleGet)과 동일한 checkAccess를 재사용해 비공유/PIN 보드의
//   이미지가 URL 직접 접근으로 열리지 않게 한다.
// ─────────────────────────────────────────────────────────────────────────────

import { CODE_RE, BOARD_RE, ownerToken, parseSettings, checkAccess, madangR2Key } from '../../_madang-common.js';

export async function onRequestGet(ctx) {
  const { request, env, params } = ctx;
  const db = env.BYEDUIN_DB;
  const r2 = env.MEDIA_R2;
  if (!db || !r2) return new Response('Not configured', { status: 500 });

  const boardId = String(params.board || '').toUpperCase();
  const key = String(params.key || '');
  if (!BOARD_RE.test(boardId) || !key) return new Response('Bad Request', { status: 400 });

  const url = new URL(request.url);
  const code = (url.searchParams.get('code') || '').toUpperCase();
  const pin = url.searchParams.get('pin') || '';

  const board = await db.prepare('SELECT * FROM madang_boards WHERE id = ?').bind(boardId).first();
  if (!board) return new Response('Not Found', { status: 404 });
  const settings = parseSettings(board.settings);
  const isOwner = CODE_RE.test(code) && (await ownerToken(env, boardId, code)) === board.owner_token;
  const acc = await checkAccess(env, board, settings, isOwner, pin);
  if (acc) return new Response(acc.error || 'Forbidden', { status: acc.status || 403 });

  const obj = await r2.get(madangR2Key(boardId, key));
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { headers });
}
