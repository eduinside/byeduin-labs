// functions/api/madang.js
// ─────────────────────────────────────────────────────────────────────────────
// 마당 — 실시간 응답 보드(패들렛형). byeduin 전용 D1(env.BYEDUIN_DB).
//
//   기존 _sync.js(doc/set)는 "개인 코드 1개 = 그 사람 데이터" 모델이라, 여러 사람의
//   카드가 한 보드에 모이고 소유권·접근제어가 필요한 마당에는 맞지 않는다. → 전용 모듈.
//
//   • 파티션: board_id (마당 코드). 카드는 (board_id, id).
//   • 신원/권한: 사용자 코드(vives:code)를 그대로 저장하지 않고 HMAC 해시로 판정.
//       owner_token  = HMAC(pepper, 'owner:'+boardId+':'+code)  → 개설자(관리)
//       author_token = HMAC(pepper, 'author:'+boardId+':'+code) → 작성자(수정/삭제)
//     코드를 아는 사람이 그 사람으로 행세 가능한 "소프트 인증"(교실·저위험 맥락용).
//   • 검열: 카드 게시/수정 시 OpenAI Moderation(omni-moderation-latest)로 텍스트 검열.
//     키 없음/오류 시에는 가용성 우선으로 통과(개설자 사후 삭제가 백업).
//   • 접근제어: shared=0(공유중단)이면 개설자 외 GET/게시 차단(링크가 있어도 진입 불가).
//
//   GET  ?board=ID&code=XX&pin=NN          → { board, isOwner, cards:[...] }
//   POST { action, code, ... }             → create / post / editCard / deleteCard /
//                                            settings / deleteBoard
// ─────────────────────────────────────────────────────────────────────────────

const CODE_RE   = /^[A-Z0-9]{6}$/;            // vives:code (작성자/개설자 신원)
const BOARD_RE  = /^[A-HJ-NP-Z2-9]{6}$/;      // 마당 코드(혼동 문자 0/O/1/I/L 제외)
const BOARD_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_RE    = /^[0-9]{4,8}$/;
const TYPES     = ['text', 'link', 'html'];
const NICK_MAX    = 40;
const TITLE_MAX   = 120;
const COMMENT_MAX = 2 * 1024;                  // 댓글 본문 상한
const CONTENT_MAX = 12 * 1024;                // 카드 본문 상한(폭주·폴링 대역 보호)
const CARDS_MAX   = 300;                       // 보드당 카드 상한
const EXPIRY_PRESETS = [1, 3, 7, 14, 28];      // 자동종료 기간(일) 프리셋
const EXPIRY_DEFAULT_DAYS = 7;                 // 기본 1주일
const DAY_MS = 86400000;
const BG_KEYS = ['whiteboard', 'chalkboard', 'dark', 'dots', 'grid', 'kraft'];  // 배경 패턴 키

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
function nowIso() { return new Date().toISOString(); }
function byteLen(s) { return new TextEncoder().encode(s).length; }
function parseSettings(s) { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } }
// 자동종료: settings.expiresAt(ISO) 지난 보드는 만료. 무기한이면 expiresAt 없음.
function isExpired(settings) { return !!(settings.expiresAt && new Date(settings.expiresAt).getTime() < Date.now()); }

// ── HMAC(pepper) 해시 — 코드 원본 미저장 ──
function pepperOf(env) { return env.MADANG_PEPPER || 'madang-default-pepper-v1'; }
async function hmacHex(pepper, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function ownerToken(env, boardId, code)  { return hmacHex(pepperOf(env), 'owner:'  + boardId + ':' + code); }
function authorToken(env, boardId, code) { return hmacHex(pepperOf(env), 'author:' + boardId + ':' + code); }
function pinHashOf(env, boardId, pin)    { return hmacHex(pepperOf(env), 'pin:'    + boardId + ':' + pin); }

function genBoardId() {
  const r = crypto.getRandomValues(new Uint32Array(6));
  let s = '';
  for (let i = 0; i < 6; i++) s += BOARD_ALPHA[r[i] % BOARD_ALPHA.length];
  return s;
}

// 검열용 텍스트 추출: html=태그 제거, link=URL 그대로.
function textForModeration(type, content) {
  if (type === 'html') return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return content;
}
// 반환: { flagged, ok(검열 수행됨), categories }. 키 없음·오류·미수행이면 통과(가용성 우선).
async function moderate(env, text) {
  const key = env.OPENAI_API_KEY;
  if (!key) return { flagged: false, ok: false };
  if (!text || !text.trim()) return { flagged: false, ok: true };
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text.slice(0, 4000) }),
    });
    if (!r.ok) return { flagged: false, ok: false };
    const d = await r.json();
    const res = d && d.results && d.results[0];
    if (!res) return { flagged: false, ok: false };
    const cats = Object.keys(res.categories || {}).filter((k) => res.categories[k]);
    return { flagged: !!res.flagged, ok: true, categories: cats };
  } catch {
    return { flagged: false, ok: false };
  }
}

function boardMeta(board, settings) {
  return {
    id: board.id,
    title: board.title,
    shared: !!board.shared,
    hasPin: !!settings.pinHash,
    allowedTypes: Array.isArray(settings.allowedTypes) && settings.allowedTypes.length ? settings.allowedTypes : TYPES.slice(),
    expiresAt: settings.expiresAt || null,
    expiryDays: settings.expiryDays || 0,
    expired: isExpired(settings),
    background: settings.background || 'whiteboard',
    allowComments: !!settings.allowComments,
    allowLikes: !!settings.allowLikes,
    updatedAt: board.updated_at,
  };
}

// 공유중단·만료·PIN 접근 검사(개설자는 통과). 막히면 {error,status,...}, OK면 null.
async function checkAccess(env, board, settings, isOwner, pin) {
  if (!board.shared && !isOwner) return { error: '공유가 중단된 마당입니다.', closed: true, status: 403 };
  if (isExpired(settings) && !isOwner) return { error: '운영 기간이 종료된 마당입니다.', expired: true, status: 403 };
  if (settings.pinHash && !isOwner) {
    if (!pin || (await pinHashOf(env, board.id, pin)) !== settings.pinHash) return { error: 'PIN이 필요합니다.', pinRequired: true, status: 401 };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const db = env.BYEDUIN_DB;
  if (!db) return json({ error: 'D1 바인딩(BYEDUIN_DB)이 설정되지 않았습니다.' }, 500);
  try {
    if (request.method === 'GET')  return await handleGet(env, db, request);
    if (request.method === 'POST') return await handlePost(env, db, request);
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (e) {
    return json({ error: (e && e.message) || '서버 오류' }, 500);
  }
}

// ── GET: 보드 + 카드 읽기(폴링) ──
async function handleGet(env, db, request) {
  const url = new URL(request.url);
  const boardId = (url.searchParams.get('board') || '').toUpperCase();
  const code = (url.searchParams.get('code') || '').toUpperCase();
  const pin = url.searchParams.get('pin') || '';
  if (!BOARD_RE.test(boardId)) return json({ error: '유효한 마당 코드가 필요합니다.' }, 400);

  const board = await db.prepare('SELECT * FROM madang_boards WHERE id = ?').bind(boardId).first();
  if (!board) return json({ error: '마당을 찾을 수 없습니다.', notFound: true }, 404);

  const settings = parseSettings(board.settings);
  const isOwner = CODE_RE.test(code) && (await ownerToken(env, boardId, code)) === board.owner_token;

  if (!board.shared && !isOwner) return json({ error: '공유가 중단된 마당입니다.', closed: true }, 403);
  if (isExpired(settings) && !isOwner) return json({ error: '운영 기간이 종료된 마당입니다.', expired: true }, 403);
  if (settings.pinHash && !isOwner) {
    if (!pin || (await pinHashOf(env, boardId, pin)) !== settings.pinHash) {
      return json({ error: 'PIN이 필요합니다.', pinRequired: true }, 401);
    }
  }

  const { results } = await db.prepare(
    'SELECT id, author_token, nickname, type, content, created_at, updated_at FROM madang_cards WHERE board_id = ? ORDER BY created_at ASC'
  ).bind(boardId).all();

  const myToken = CODE_RE.test(code) ? await authorToken(env, boardId, code) : null;

  // 좋아요·댓글은 설정이 켜진 경우만 조회(폴링 비용 절약)
  const likeCount = {}, likedByMe = {};
  if (settings.allowLikes) {
    const lr = await db.prepare('SELECT card_id, liker_token FROM madang_likes WHERE board_id = ?').bind(boardId).all();
    for (const r of lr.results || []) { likeCount[r.card_id] = (likeCount[r.card_id] || 0) + 1; if (myToken && r.liker_token === myToken) likedByMe[r.card_id] = true; }
  }
  const cmtByCard = {};
  if (settings.allowComments) {
    const cr = await db.prepare('SELECT id, card_id, author_token, nickname, text, created_at FROM madang_comments WHERE board_id = ? ORDER BY created_at ASC').bind(boardId).all();
    for (const r of cr.results || []) (cmtByCard[r.card_id] = cmtByCard[r.card_id] || []).push({ id: r.id, nickname: r.nickname, text: r.text, createdAt: r.created_at, own: isOwner || !!(myToken && r.author_token === myToken) });
  }

  const cards = (results || []).map((r) => ({
    id: r.id,
    nickname: r.nickname,
    type: r.type,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    own: !!(myToken && r.author_token === myToken),  // 내가 쓴 카드(수정·삭제 가능)
    likes: likeCount[r.id] || 0,
    liked: !!likedByMe[r.id],
    comments: cmtByCard[r.id] || [],
  }));

  return json({ board: boardMeta(board, settings), isOwner, cards });
}

// ── POST: 액션 라우팅 ──
async function handlePost(env, db, request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const action = String(body.action || '');
  const code = String(body.code || '').toUpperCase();

  // ── 마당 생성(개설자) ──
  if (action === 'create') {
    if (!CODE_RE.test(code)) return json({ error: '마당을 만들려면 동기화 코드가 필요합니다.', needCode: true }, 400);
    const title = String(body.title || '').trim().slice(0, TITLE_MAX);
    const pin = String(body.pin || '').trim();
    if (pin && !PIN_RE.test(pin)) return json({ error: 'PIN은 숫자 4~8자리여야 합니다.' }, 400);
    const at = nowIso();
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = genBoardId();
      const exists = await db.prepare('SELECT 1 FROM madang_boards WHERE id = ?').bind(id).first();
      if (exists) continue;
      const settings = { expiresAt: new Date(Date.now() + EXPIRY_DEFAULT_DAYS * DAY_MS).toISOString(), expiryDays: EXPIRY_DEFAULT_DAYS };
      if (pin) settings.pinHash = await pinHashOf(env, id, pin);
      const ownerTok = await ownerToken(env, id, code);
      try {
        await db.prepare(
          'INSERT INTO madang_boards (id, owner_token, title, settings, shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(id, ownerTok, title, JSON.stringify(settings), 1, at, at).run();
        return json({ ok: true, isOwner: true, board: boardMeta({ id, title, shared: 1, updated_at: at }, settings) });
      } catch { /* 경합 충돌 → 재시도 */ }
    }
    return json({ error: '마당 코드 생성에 실패했습니다. 다시 시도해주세요.' }, 500);
  }

  const boardId = String(body.board || '').toUpperCase();
  if (!BOARD_RE.test(boardId)) return json({ error: '유효한 마당 코드가 필요합니다.' }, 400);
  const board = await db.prepare('SELECT * FROM madang_boards WHERE id = ?').bind(boardId).first();
  if (!board) return json({ error: '마당을 찾을 수 없습니다.', notFound: true }, 404);
  const settings = parseSettings(board.settings);
  const isOwner = CODE_RE.test(code) && (await ownerToken(env, boardId, code)) === board.owner_token;

  // ── 카드 게시(참여자/개설자) ──
  if (action === 'post') {
    if (!CODE_RE.test(code)) return json({ error: '참여 코드가 필요합니다.' }, 400);
    if (!board.shared && !isOwner) return json({ error: '공유가 중단된 마당입니다.', closed: true }, 403);
    if (isExpired(settings) && !isOwner) return json({ error: '운영 기간이 종료된 마당입니다.', expired: true }, 403);
    if (settings.pinHash && !isOwner) {
      const pin = String(body.pin || '');
      if (!pin || (await pinHashOf(env, boardId, pin)) !== settings.pinHash) return json({ error: 'PIN이 필요합니다.', pinRequired: true }, 401);
    }
    const type = TYPES.includes(body.type) ? body.type : 'text';
    const allowed = Array.isArray(settings.allowedTypes) && settings.allowedTypes.length ? settings.allowedTypes : TYPES;
    if (!allowed.includes(type)) return json({ error: '이 마당에서 허용하지 않는 카드 유형입니다.' }, 400);

    let content = String(body.content || '');
    if (type === 'link') {
      content = content.trim();
      if (!/^https?:\/\//i.test(content)) return json({ error: '유효한 링크(http/https)를 입력하세요.' }, 400);
    }
    if (!content.trim()) return json({ error: '내용을 입력하세요.' }, 400);
    if (byteLen(content) > CONTENT_MAX) return json({ error: '내용이 너무 깁니다.' }, 413);
    const nickname = String(body.nickname || '').trim().slice(0, NICK_MAX);

    const cnt = await db.prepare('SELECT COUNT(*) AS n FROM madang_cards WHERE board_id = ?').bind(boardId).first();
    if (cnt && cnt.n >= CARDS_MAX) return json({ error: '이 마당의 카드 수가 가득 찼습니다.' }, 409);

    const mod = await moderate(env, textForModeration(type, content));
    if (mod.flagged) return json({ ok: false, flagged: true, error: '부적절한 내용으로 판단되어 게시할 수 없습니다.', categories: mod.categories }, 422);

    const id = crypto.randomUUID();
    const at = nowIso();
    const authTok = await authorToken(env, boardId, code);
    await db.prepare(
      'INSERT INTO madang_cards (id, board_id, author_token, nickname, type, content, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(id, boardId, authTok, nickname, type, content, at, at).run();
    return json({ ok: true, card: { id, nickname, type, content, createdAt: at, updatedAt: at, own: true } });
  }

  // ── 카드 수정(작성자만) ──
  if (action === 'editCard') {
    const cardId = String(body.cardId || '');
    if (!cardId) return json({ error: '카드 id가 필요합니다.' }, 400);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const card = await db.prepare('SELECT * FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ error: '카드를 찾을 수 없습니다.' }, 404);
    if (card.author_token !== (await authorToken(env, boardId, code))) return json({ error: '내가 쓴 카드만 수정할 수 있습니다.' }, 403);

    let content = String(body.content || '');
    if (card.type === 'link') {
      content = content.trim();
      if (!/^https?:\/\//i.test(content)) return json({ error: '유효한 링크(http/https)를 입력하세요.' }, 400);
    }
    if (!content.trim()) return json({ error: '내용을 입력하세요.' }, 400);
    if (byteLen(content) > CONTENT_MAX) return json({ error: '내용이 너무 깁니다.' }, 413);
    const mod = await moderate(env, textForModeration(card.type, content));
    if (mod.flagged) return json({ ok: false, flagged: true, error: '부적절한 내용으로 판단되어 수정할 수 없습니다.', categories: mod.categories }, 422);

    const at = nowIso();
    await db.prepare('UPDATE madang_cards SET content = ?, updated_at = ? WHERE board_id = ? AND id = ?').bind(content, at, boardId, cardId).run();
    return json({ ok: true, card: { id: cardId, content, updatedAt: at } });
  }

  // ── 카드 삭제(작성자 또는 개설자) ──
  if (action === 'deleteCard') {
    const cardId = String(body.cardId || '');
    if (!cardId) return json({ error: '카드 id가 필요합니다.' }, 400);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const card = await db.prepare('SELECT author_token FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ ok: true, deleted: true });  // 이미 없음 → 멱등
    const isAuthor = card.author_token === (await authorToken(env, boardId, code));
    if (!isOwner && !isAuthor) return json({ error: '삭제 권한이 없습니다.' }, 403);
    await db.prepare('DELETE FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).run();
    await db.prepare('DELETE FROM madang_comments WHERE board_id = ? AND card_id = ?').bind(boardId, cardId).run();
    await db.prepare('DELETE FROM madang_likes WHERE board_id = ? AND card_id = ?').bind(boardId, cardId).run();
    return json({ ok: true, deleted: true });
  }

  // ── 마당 설정(개설자만): 제목·공유토글·PIN·허용유형 ──
  if (action === 'settings') {
    if (!isOwner) return json({ error: '개설자만 설정을 바꿀 수 있습니다.' }, 403);
    const patch = body.patch || {};
    let title = board.title;
    let shared = board.shared;
    if (typeof patch.title === 'string') title = patch.title.trim().slice(0, TITLE_MAX);
    if (typeof patch.shared === 'boolean') shared = patch.shared ? 1 : 0;
    if (typeof patch.pin === 'string') {
      if (patch.pin === '') delete settings.pinHash;
      else if (!PIN_RE.test(patch.pin)) return json({ error: 'PIN은 숫자 4~8자리여야 합니다.' }, 400);
      else settings.pinHash = await pinHashOf(env, boardId, patch.pin);
    }
    if (Array.isArray(patch.allowedTypes)) {
      const filtered = patch.allowedTypes.filter((t) => TYPES.includes(t));
      settings.allowedTypes = filtered.length ? filtered : TYPES.slice();
    }
    if (typeof patch.expiryDays !== 'undefined') {
      const days = Number(patch.expiryDays);
      if (!days || days <= 0) { delete settings.expiresAt; delete settings.expiryDays; }            // 무기한
      else if (EXPIRY_PRESETS.includes(days)) { settings.expiresAt = new Date(Date.now() + days * DAY_MS).toISOString(); settings.expiryDays = days; }
      else return json({ error: '허용되지 않은 종료 기간입니다.' }, 400);
    }
    if (typeof patch.background === 'string') settings.background = BG_KEYS.includes(patch.background) ? patch.background : 'whiteboard';
    if (typeof patch.allowComments === 'boolean') settings.allowComments = patch.allowComments;
    if (typeof patch.allowLikes === 'boolean') settings.allowLikes = patch.allowLikes;
    const at = nowIso();
    await db.prepare('UPDATE madang_boards SET title = ?, shared = ?, settings = ?, updated_at = ? WHERE id = ?')
      .bind(title, shared, JSON.stringify(settings), at, boardId).run();
    return json({ ok: true, board: boardMeta({ id: boardId, title, shared, updated_at: at }, settings) });
  }

  // ── 마당 삭제(개설자만): 카드 일괄 + 보드 ──
  if (action === 'deleteBoard') {
    if (!isOwner) return json({ error: '개설자만 마당을 삭제할 수 있습니다.' }, 403);
    await db.prepare('DELETE FROM madang_cards WHERE board_id = ?').bind(boardId).run();
    await db.prepare('DELETE FROM madang_comments WHERE board_id = ?').bind(boardId).run();
    await db.prepare('DELETE FROM madang_likes WHERE board_id = ?').bind(boardId).run();
    await db.prepare('DELETE FROM madang_boards WHERE id = ?').bind(boardId).run();
    return json({ ok: true, deleted: true });
  }

  // ── 댓글 달기(참여자/개설자) ──
  if (action === 'addComment') {
    if (!settings.allowComments) return json({ error: '이 마당은 댓글이 꺼져 있습니다.' }, 403);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const acc = await checkAccess(env, board, settings, isOwner, String(body.pin || ''));
    if (acc) return json(acc, acc.status);
    const cardId = String(body.cardId || '');
    const card = await db.prepare('SELECT id FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ error: '카드를 찾을 수 없습니다.' }, 404);
    const text = String(body.text || '').trim();
    if (!text) return json({ error: '댓글을 입력하세요.' }, 400);
    if (byteLen(text) > COMMENT_MAX) return json({ error: '댓글이 너무 깁니다.' }, 413);
    const nickname = String(body.nickname || '').trim().slice(0, NICK_MAX);
    const mod = await moderate(env, text);
    if (mod.flagged) return json({ ok: false, flagged: true, error: '부적절한 내용으로 판단되어 게시할 수 없습니다.', categories: mod.categories }, 422);
    const id = crypto.randomUUID(), at = nowIso();
    await db.prepare('INSERT INTO madang_comments (id, board_id, card_id, author_token, nickname, text, created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, boardId, cardId, await authorToken(env, boardId, code), nickname, text, at).run();
    return json({ ok: true, comment: { id: id, cardId: cardId, nickname: nickname, text: text, createdAt: at, own: true } });
  }

  // ── 댓글 삭제(작성자 또는 개설자) ──
  if (action === 'deleteComment') {
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const commentId = String(body.commentId || '');
    const cm = await db.prepare('SELECT author_token FROM madang_comments WHERE board_id = ? AND id = ?').bind(boardId, commentId).first();
    if (!cm) return json({ ok: true, deleted: true });
    const isAuthor = cm.author_token === (await authorToken(env, boardId, code));
    if (!isOwner && !isAuthor) return json({ error: '삭제 권한이 없습니다.' }, 403);
    await db.prepare('DELETE FROM madang_comments WHERE board_id = ? AND id = ?').bind(boardId, commentId).run();
    return json({ ok: true, deleted: true });
  }

  // ── 좋아요 토글(on:true 추가 / on:false 취소) ──
  if (action === 'like') {
    if (!settings.allowLikes) return json({ error: '이 마당은 좋아요가 꺼져 있습니다.' }, 403);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const acc = await checkAccess(env, board, settings, isOwner, String(body.pin || ''));
    if (acc) return json(acc, acc.status);
    const cardId = String(body.cardId || '');
    const card = await db.prepare('SELECT id FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ error: '카드를 찾을 수 없습니다.' }, 404);
    const tok = await authorToken(env, boardId, code);
    if (body.on === false) {
      await db.prepare('DELETE FROM madang_likes WHERE board_id = ? AND card_id = ? AND liker_token = ?').bind(boardId, cardId, tok).run();
    } else {
      await db.prepare('INSERT INTO madang_likes (board_id, card_id, liker_token, created_at) VALUES (?,?,?,?) ON CONFLICT(board_id, card_id, liker_token) DO NOTHING')
        .bind(boardId, cardId, tok, nowIso()).run();
    }
    const cnt = await db.prepare('SELECT COUNT(*) AS n FROM madang_likes WHERE board_id = ? AND card_id = ?').bind(boardId, cardId).first();
    return json({ ok: true, likes: (cnt && cnt.n) || 0, liked: body.on !== false });
  }

  return json({ error: '알 수 없는 action입니다.' }, 400);
}
