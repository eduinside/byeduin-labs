// functions/api/madang.js
// ─────────────────────────────────────────────────────────────────────────────
// 마당 — 실시간 응답 보드(패들렛형). byeduin 전용 D1(env.BYEDUIN_DB) + R2(env.MEDIA_R2).
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
//   • 승인모드(settings.approval): 참여자 카드는 status='pending'으로 저장 — 본인+개설자만 보임.
//   • 잠금(settings.frozen): post/editCard/addComment 차단(개설자 제외).
//   • 이름숨김(settings.hideNames): 비개설자 응답에서 닉네임을 '익명'으로 치환.
//   • 사진/그림 카드(type='image'): content는 R2 키(파일명만). 실제 스트리밍은
//     madang-img/[board]/[key].js가 담당(같은 checkAccess 재사용).
//
//   GET  ?board=ID&code=XX&pin=NN          → { board, isOwner, cards:[...] }
//   POST { action, code, ... }             → create / post / editCard / deleteCard /
//                                            settings / deleteBoard / approve / reject / duplicate
// ─────────────────────────────────────────────────────────────────────────────

import { CODE_RE, BOARD_RE, json, nowIso, parseSettings, isExpired, ownerToken, authorToken, pinHashOf, checkAccess, madangR2Key, madangR2Prefix } from './_madang-common.js';

const BOARD_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_RE    = /^[0-9]{4,8}$/;
const TYPES     = ['text', 'html', 'image'];   // 'link' 제거 — 텍스트 내 URL은 자동 링크. image=사진/그림(R2 키)
const NICK_MAX    = 40;
const TITLE_MAX   = 120;
const COMMENT_MAX = 2 * 1024;                  // 댓글 본문 상한
const CONTENT_MAX = 12 * 1024;                // 카드 본문 상한(폭주·폴링 대역 보호)
const CARDS_MAX   = 300;                       // 보드당 카드 상한
const EXPIRY_PRESETS = [1, 3, 7, 14, 28];      // 자동종료 기간(일) 프리셋
const EXPIRY_DEFAULT_DAYS = 7;                 // 기본 1주일
const DAY_MS = 86400000;
const BG_KEYS = ['whiteboard', 'chalkboard', 'dark', 'dots', 'grid', 'kraft'];  // 배경 패턴 키
const MOD_TIMEOUT_MS = 2500;                   // 검열 API 타임아웃(초과 시 통과 + 사후검열)
const DEFAULT_REACTIONS = ['❤️', '👍', '😄', '👏'];  // 기본 이모지 반응 4종(긍정 반응만)
const REACTION_MAX = 4;

// 로컬 금칙어 프리필터 — 명백한 비속어를 API 왕복 없이 즉시 차단(1차 방어선). 검열 API가 2차 방어.
const LOCAL_BAD_PATTERNS = [
  /씨\s*발|시\s*발|씨\s*팔|ㅅ\s*ㅂ|ㅆ\s*ㅂ/i,
  /개\s*새\s*끼|개\s*색\s*끼|개\s*새\s*기/i,
  /병\s*신|븅\s*신|ㅂ\s*ㅅ/i,
  /좆|존\s*나|조\s*낸/i,
  /지\s*랄|ㅈ\s*ㄹ/i,
  /미친\s*놈|미친\s*년/i,
  /창\s*녀|걸레\s*년/i,
  /죽어라|뒤져라/i,
  /fuck|shit|bitch|asshole/i,
];
function localFilterHit(text) { return LOCAL_BAD_PATTERNS.some(function (re) { return re.test(text); }); }

function byteLen(s) { return new TextEncoder().encode(s).length; }

function genBoardId() {
  const r = crypto.getRandomValues(new Uint32Array(6));
  let s = '';
  for (let i = 0; i < 6; i++) s += BOARD_ALPHA[r[i] % BOARD_ALPHA.length];
  return s;
}

// 검열용 텍스트 추출: html=태그 제거. image는 검열 대상 텍스트가 없음(호출 측에서 건너뜀).
function textForModeration(type, content) {
  if (type === 'html') return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return content;
}
// 반환: { flagged, ok(검열 수행됨), categories, timedOut }. 키 없음·오류·타임아웃이면 통과(가용성 우선).
// opts.timeoutMs: 0이면 무제한 대기(사후검열 waitUntil 경로용). 기본 MOD_TIMEOUT_MS.
async function moderate(env, text, opts) {
  opts = opts || {};
  if (!text || !text.trim()) return { flagged: false, ok: true };
  if (localFilterHit(text)) return { flagged: true, ok: true, categories: ['local-filter'], local: true };
  const key = env.OPENAI_API_KEY;
  if (!key) return { flagged: false, ok: false, noKey: true };
  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : MOD_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text.slice(0, 4000) }),
      signal: controller.signal,
    });
    if (!r.ok) return { flagged: false, ok: false };
    const d = await r.json();
    const res = d && d.results && d.results[0];
    if (!res) return { flagged: false, ok: false };
    const cats = Object.keys(res.categories || {}).filter((k) => res.categories[k]);
    return { flagged: !!res.flagged, ok: true, categories: cats };
  } catch (e) {
    return { flagged: false, ok: false, timedOut: e && e.name === 'AbortError' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
// 게시 시 검열이 타임아웃되면 통과시키고, 백그라운드에서 무제한 대기로 재검열 → flagged면 카드 숨김 처리.
async function postHocModerateCard(env, db, boardId, cardId, text) {
  const mod = await moderate(env, text, { timeoutMs: 0 });
  if (mod.flagged) {
    await db.batch([
      db.prepare("UPDATE madang_cards SET status = 'hidden' WHERE board_id = ? AND id = ?").bind(boardId, cardId),
      bumpRevStmt(db, boardId),
    ]);
  }
}
function bumpRevStmt(db, boardId) { return db.prepare('UPDATE madang_boards SET rev = rev + 1 WHERE id = ?').bind(boardId); }

// ── R2 정리(카드/보드 삭제 시 이미지 잔존 방지) ──
async function deleteCardImage(env, db, boardId, key) {
  const r2 = env.MEDIA_R2; if (!r2 || !key) return;
  const r2Key = madangR2Key(boardId, key);
  const obj = await r2.head(r2Key).catch(() => null);
  await r2.delete(r2Key).catch(() => {});
  if (obj) {
    const board = await db.prepare('SELECT settings FROM madang_boards WHERE id = ?').bind(boardId).first();
    if (board) {
      const settings = parseSettings(board.settings);
      settings.imageBytes = Math.max(0, Number(settings.imageBytes || 0) - obj.size);
      await db.prepare('UPDATE madang_boards SET settings = ? WHERE id = ?').bind(JSON.stringify(settings), boardId).run();
    }
  }
}
async function deleteBoardImages(env, boardId) {
  const r2 = env.MEDIA_R2; if (!r2) return;
  let cursor;
  do {
    const listed = await r2.list({ prefix: madangR2Prefix(boardId), cursor });
    if (listed.objects.length) await r2.delete(listed.objects.map((o) => o.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

function boardMeta(board, settings) {
  return {
    id: board.id,
    title: board.title,
    shared: !!board.shared,
    hasPin: !!settings.pinHash,
    allowedTypes: (function () { var a = Array.isArray(settings.allowedTypes) ? settings.allowedTypes.filter(function (t) { return TYPES.includes(t); }) : []; return a.length ? a : ['text', 'html']; })(),
    layout: settings.layout === 'sections' ? 'sections' : 'wall',
    sections: Array.isArray(settings.sections) ? settings.sections : [],
    sort: ['newest', 'oldest', 'shuffle'].includes(settings.sort) ? settings.sort : 'newest',
    expiresAt: settings.expiresAt || null,
    expiryDays: settings.expiryDays || 0,
    expired: isExpired(settings),
    background: settings.background || 'whiteboard',
    allowComments: !!settings.allowComments,
    allowLikes: !!settings.allowLikes,
    reactions: (Array.isArray(settings.reactions) && settings.reactions.length) ? settings.reactions.slice(0, REACTION_MAX) : DEFAULT_REACTIONS.slice(),
    kidMode: !!settings.kidMode,
    approval: !!settings.approval,
    frozen: !!settings.frozen,
    hideNames: !!settings.hideNames,
    updatedAt: board.updated_at,
    rev: board.rev || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const db = env.BYEDUIN_DB;
  if (!db) return json({ error: 'D1 바인딩(BYEDUIN_DB)이 설정되지 않았습니다.' }, 500);
  try {
    if (request.method === 'GET')  return await handleGet(env, db, request);
    if (request.method === 'POST') return await handlePost(env, db, request, ctx);
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

  const myToken = CODE_RE.test(code) ? await authorToken(env, boardId, code) : null;

  // 댓글 전문은 모달을 열 때만 단건 조회(폴링 응답에서는 commentCount만) — GET ?comments=CARD_ID
  const commentsFor = url.searchParams.get('comments');
  if (commentsFor) {
    if (!settings.allowComments) return json({ error: '이 마당은 댓글이 꺼져 있습니다.' }, 403);
    const cr = await db.prepare(
      'SELECT id, author_token, nickname, text, created_at FROM madang_comments WHERE board_id = ? AND card_id = ? ORDER BY created_at ASC'
    ).bind(boardId, commentsFor).all();
    const comments = (cr.results || []).map((r) => ({
      id: r.id,
      nickname: (settings.hideNames && !isOwner && !(myToken && r.author_token === myToken)) ? '익명' : r.nickname,
      text: r.text, createdAt: r.created_at,
      own: isOwner || !!(myToken && r.author_token === myToken),
    }));
    return json({ ok: true, comments });
  }

  // rev 조건부 폴링: 클라이언트가 아는 rev와 같으면 무변경 — 페이로드 수십 바이트, D1 쿼리 이미 1개(board)로 끝.
  const reqRev = url.searchParams.get('rev');
  if (reqRev !== null && Number(reqRev) === board.rev) {
    return json({ unchanged: true, rev: board.rev });
  }

  const wantLikes = !!settings.allowLikes;
  const wantComments = !!settings.allowComments;
  // 승인모드: 비개설자에게는 status='live'이거나 본인이 올린 status='pending' 카드만 — 서버에서 필터.
  let cardsSql, cardsBind;
  if (isOwner) {
    cardsSql = "SELECT id, author_token, nickname, type, content, section, status, created_at, updated_at FROM madang_cards WHERE board_id = ? AND status != 'hidden' ORDER BY created_at ASC";
    cardsBind = [boardId];
  } else if (myToken) {
    cardsSql = "SELECT id, author_token, nickname, type, content, section, status, created_at, updated_at FROM madang_cards WHERE board_id = ? AND (status = 'live' OR (status = 'pending' AND author_token = ?)) ORDER BY created_at ASC";
    cardsBind = [boardId, myToken];
  } else {
    cardsSql = "SELECT id, author_token, nickname, type, content, section, status, created_at, updated_at FROM madang_cards WHERE board_id = ? AND status = 'live' ORDER BY created_at ASC";
    cardsBind = [boardId];
  }
  const stmts = [db.prepare(cardsSql).bind(...cardsBind)];
  if (wantLikes) stmts.push(db.prepare('SELECT card_id, emoji, COUNT(*) AS n FROM madang_likes WHERE board_id = ? GROUP BY card_id, emoji').bind(boardId));
  if (wantLikes && myToken) stmts.push(db.prepare('SELECT card_id, emoji FROM madang_likes WHERE board_id = ? AND liker_token = ?').bind(boardId, myToken));
  if (wantComments) stmts.push(db.prepare('SELECT card_id, COUNT(*) AS n FROM madang_comments WHERE board_id = ? GROUP BY card_id').bind(boardId));

  const results = await db.batch(stmts);
  let ix = 0;
  const cardRows = results[ix++].results || [];
  const reactionsByCard = {};
  if (wantLikes) { for (const r of (results[ix++].results || [])) { (reactionsByCard[r.card_id] = reactionsByCard[r.card_id] || {})[r.emoji] = r.n; } }
  const mineByCard = {};
  if (wantLikes && myToken) { for (const r of (results[ix++].results || [])) { (mineByCard[r.card_id] = mineByCard[r.card_id] || {})[r.emoji] = true; } }
  const cmtCount = {};
  if (wantComments) { for (const r of (results[ix++].results || [])) cmtCount[r.card_id] = r.n; }

  const cards = cardRows.map((r) => {
    const reactions = reactionsByCard[r.id] || {};
    const mine = Object.keys(mineByCard[r.id] || {});
    const own = !!(myToken && r.author_token === myToken);
    return {
      id: r.id,
      nickname: (settings.hideNames && !isOwner && !own) ? '익명' : r.nickname,
      type: r.type,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      own: own,  // 내가 쓴 카드(수정·삭제 가능)
      pending: r.status === 'pending',
      section: r.section || '',
      reactions: reactions,
      myReactions: mine,
      likes: reactions['❤️'] || 0,       // 구버전 클라이언트 하위호환
      liked: mine.indexOf('❤️') >= 0,    // 구버전 클라이언트 하위호환
      commentCount: cmtCount[r.id] || 0,
    };
  });

  return json({ board: boardMeta(board, settings), isOwner, rev: board.rev, cards });
}

// ── POST: 액션 라우팅 ──
async function handlePost(env, db, request, ctx) {
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
      if (body.kidMode) settings.kidMode = true;
      const ownerTok = await ownerToken(env, id, code);
      try {
        await db.prepare(
          'INSERT INTO madang_boards (id, owner_token, title, settings, shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(id, ownerTok, title, JSON.stringify(settings), 1, at, at).run();
        return json({ ok: true, isOwner: true, board: boardMeta({ id, title, shared: 1, updated_at: at, rev: 0 }, settings) });
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
    if (settings.frozen && !isOwner) return json({ error: '지금은 발표 시간이라 새 카드를 올릴 수 없어요. 조금만 기다려주세요.', frozen: true }, 403);
    if (settings.pinHash && !isOwner) {
      const pin = String(body.pin || '');
      if (!pin || (await pinHashOf(env, boardId, pin)) !== settings.pinHash) return json({ error: 'PIN이 필요합니다.', pinRequired: true }, 401);
    }
    const type = TYPES.includes(body.type) ? body.type : 'text';
    const allowed = Array.isArray(settings.allowedTypes) && settings.allowedTypes.length ? settings.allowedTypes : ['text', 'html'];
    if (!allowed.includes(type)) return json({ error: '이 마당에서 허용하지 않는 카드 유형입니다.' }, 400);

    let content = String(body.content || '');
    if (!content.trim()) return json({ error: '내용을 입력하세요.' }, 400);
    if (byteLen(content) > CONTENT_MAX) return json({ error: '내용이 너무 깁니다.' }, 413);
    const nickname = String(body.nickname || '').trim().slice(0, NICK_MAX);

    const cnt = await db.prepare("SELECT COUNT(*) AS n FROM madang_cards WHERE board_id = ? AND status != 'hidden'").bind(boardId).first();
    if (cnt && cnt.n >= CARDS_MAX) return json({ error: '이 마당의 카드 수가 가득 찼습니다.' }, 409);

    // 이미지 카드(content=R2 키)는 사람이 쓴 텍스트가 아니므로 검열 대상에서 제외.
    const mod = type === 'image' ? { flagged: false, ok: true } : await moderate(env, textForModeration(type, content));
    if (mod.flagged) return json({ ok: false, flagged: true, error: '부적절한 내용으로 판단되어 게시할 수 없습니다.', categories: mod.categories }, 422);

    const section = String(body.section || '').trim().slice(0, 40);
    const id = crypto.randomUUID();
    const at = nowIso();
    const authTok = await authorToken(env, boardId, code);
    const status = (settings.approval && !isOwner) ? 'pending' : 'live';
    await db.batch([
      db.prepare(
        'INSERT INTO madang_cards (id, board_id, author_token, nickname, type, content, section, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
      ).bind(id, boardId, authTok, nickname, type, content, section, status, at, at),
      bumpRevStmt(db, boardId),
    ]);
    if (mod.timedOut && env.OPENAI_API_KEY) {
      ctx.waitUntil(postHocModerateCard(env, db, boardId, id, textForModeration(type, content)));
    }
    return json({ ok: true, card: { id, nickname, type, content, section, createdAt: at, updatedAt: at, own: true, pending: status === 'pending' } });
  }

  // ── 카드 수정(작성자만) ──
  if (action === 'editCard') {
    if (settings.frozen && !isOwner) return json({ error: '지금은 발표 시간이라 카드를 수정할 수 없어요.', frozen: true }, 403);
    const cardId = String(body.cardId || '');
    if (!cardId) return json({ error: '카드 id가 필요합니다.' }, 400);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const card = await db.prepare('SELECT * FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ error: '카드를 찾을 수 없습니다.' }, 404);
    if (card.author_token !== (await authorToken(env, boardId, code))) return json({ error: '내가 쓴 카드만 수정할 수 있습니다.' }, 403);

    let content = String(body.content || '');
    if (!content.trim()) return json({ error: '내용을 입력하세요.' }, 400);
    if (byteLen(content) > CONTENT_MAX) return json({ error: '내용이 너무 깁니다.' }, 413);
    const mod = card.type === 'image' ? { flagged: false } : await moderate(env, textForModeration(card.type, content));
    if (mod.flagged) return json({ ok: false, flagged: true, error: '부적절한 내용으로 판단되어 수정할 수 없습니다.', categories: mod.categories }, 422);

    const at = nowIso();
    await db.batch([
      db.prepare('UPDATE madang_cards SET content = ?, updated_at = ? WHERE board_id = ? AND id = ?').bind(content, at, boardId, cardId),
      bumpRevStmt(db, boardId),
    ]);
    return json({ ok: true, card: { id: cardId, content, updatedAt: at } });
  }

  // ── 카드 삭제(작성자 또는 개설자) ──
  if (action === 'deleteCard') {
    const cardId = String(body.cardId || '');
    if (!cardId) return json({ error: '카드 id가 필요합니다.' }, 400);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const card = await db.prepare('SELECT author_token, type, content FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ ok: true, deleted: true });  // 이미 없음 → 멱등
    const isAuthor = card.author_token === (await authorToken(env, boardId, code));
    if (!isOwner && !isAuthor) return json({ error: '삭제 권한이 없습니다.' }, 403);
    await db.batch([
      db.prepare('DELETE FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId),
      db.prepare('DELETE FROM madang_comments WHERE board_id = ? AND card_id = ?').bind(boardId, cardId),
      db.prepare('DELETE FROM madang_likes WHERE board_id = ? AND card_id = ?').bind(boardId, cardId),
      bumpRevStmt(db, boardId),
    ]);
    if (card.type === 'image' && card.content) ctx.waitUntil(deleteCardImage(env, db, boardId, card.content));
    return json({ ok: true, deleted: true });
  }

  // ── 마당 설정(개설자만): 제목·공유토글·PIN·허용유형·교사통제 ──
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
      settings.allowedTypes = filtered.length ? filtered : ['text', 'html'];
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
    if (typeof patch.kidMode === 'boolean') settings.kidMode = patch.kidMode;
    if (typeof patch.approval === 'boolean') settings.approval = patch.approval;
    if (typeof patch.frozen === 'boolean') settings.frozen = patch.frozen;
    if (typeof patch.hideNames === 'boolean') settings.hideNames = patch.hideNames;
    if (Array.isArray(patch.reactions)) {
      const rs = patch.reactions.map((e) => String(e || '').trim()).filter(Boolean).slice(0, REACTION_MAX);
      settings.reactions = rs.length ? rs : DEFAULT_REACTIONS.slice();
    }
    if (typeof patch.layout === 'string') settings.layout = patch.layout === 'sections' ? 'sections' : 'wall';
    if (Array.isArray(patch.sections)) settings.sections = patch.sections.map(function (s) { return String(s).trim().slice(0, 40); }).filter(Boolean).slice(0, 12);
    if (typeof patch.sort === 'string') settings.sort = ['newest', 'oldest', 'shuffle'].includes(patch.sort) ? patch.sort : 'newest';
    const at = nowIso();
    const newRev = (board.rev || 0) + 1;
    await db.prepare('UPDATE madang_boards SET title = ?, shared = ?, settings = ?, updated_at = ?, rev = rev + 1 WHERE id = ?')
      .bind(title, shared, JSON.stringify(settings), at, boardId).run();
    return json({ ok: true, board: boardMeta({ id: boardId, title, shared, updated_at: at, rev: newRev }, settings) });
  }

  // ── 마당 삭제(개설자만): 카드 일괄 + 보드 + R2 이미지 ──
  if (action === 'deleteBoard') {
    if (!isOwner) return json({ error: '개설자만 마당을 삭제할 수 있습니다.' }, 403);
    await db.batch([
      db.prepare('DELETE FROM madang_cards WHERE board_id = ?').bind(boardId),
      db.prepare('DELETE FROM madang_comments WHERE board_id = ?').bind(boardId),
      db.prepare('DELETE FROM madang_likes WHERE board_id = ?').bind(boardId),
      db.prepare('DELETE FROM madang_members WHERE board_id = ?').bind(boardId),
      db.prepare('DELETE FROM madang_boards WHERE id = ?').bind(boardId),
    ]);
    ctx.waitUntil(deleteBoardImages(env, boardId));
    return json({ ok: true, deleted: true });
  }

  // ── 마당 복제(템플릿): 제목·설정·섹션만 복사, 카드는 제외 ──
  if (action === 'duplicate') {
    if (!isOwner) return json({ error: '개설자만 복제할 수 있습니다.' }, 403);
    const newSettings = parseSettings(board.settings);
    newSettings.expiresAt = new Date(Date.now() + EXPIRY_DEFAULT_DAYS * DAY_MS).toISOString();
    newSettings.expiryDays = EXPIRY_DEFAULT_DAYS;
    newSettings.frozen = false;
    delete newSettings.imageBytes;
    const at = nowIso();
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = genBoardId();
      const exists = await db.prepare('SELECT 1 FROM madang_boards WHERE id = ?').bind(id).first();
      if (exists) continue;
      const ownerTok = await ownerToken(env, id, code);
      try {
        await db.prepare(
          'INSERT INTO madang_boards (id, owner_token, title, settings, shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(id, ownerTok, board.title, JSON.stringify(newSettings), 1, at, at).run();
        return json({ ok: true, board: boardMeta({ id, title: board.title, shared: 1, updated_at: at, rev: 0 }, newSettings) });
      } catch { /* 경합 충돌 → 재시도 */ }
    }
    return json({ error: '복제에 실패했습니다. 다시 시도해주세요.' }, 500);
  }

  // ── 승인모드: 카드 승인/거절(개설자만) ──
  if (action === 'approve' || action === 'reject') {
    if (!isOwner) return json({ error: '개설자만 승인할 수 있습니다.' }, 403);
    const cardId = String(body.cardId || '');
    if (!cardId) return json({ error: '카드 id가 필요합니다.' }, 400);
    if (action === 'approve') {
      const at = nowIso();
      await db.batch([
        db.prepare("UPDATE madang_cards SET status = 'live', updated_at = ? WHERE board_id = ? AND id = ? AND status = 'pending'").bind(at, boardId, cardId),
        bumpRevStmt(db, boardId),
      ]);
    } else {
      const card = await db.prepare('SELECT type, content FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
      await db.batch([
        db.prepare('DELETE FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId),
        db.prepare('DELETE FROM madang_comments WHERE board_id = ? AND card_id = ?').bind(boardId, cardId),
        db.prepare('DELETE FROM madang_likes WHERE board_id = ? AND card_id = ?').bind(boardId, cardId),
        bumpRevStmt(db, boardId),
      ]);
      if (card && card.type === 'image' && card.content) ctx.waitUntil(deleteCardImage(env, db, boardId, card.content));
    }
    return json({ ok: true });
  }

  // ── 댓글 달기(참여자/개설자) ──
  if (action === 'addComment') {
    if (!settings.allowComments) return json({ error: '이 마당은 댓글이 꺼져 있습니다.' }, 403);
    if (settings.frozen && !isOwner) return json({ error: '지금은 발표 시간이라 댓글을 달 수 없어요.', frozen: true }, 403);
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
    await db.batch([
      db.prepare('INSERT INTO madang_comments (id, board_id, card_id, author_token, nickname, text, created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(id, boardId, cardId, await authorToken(env, boardId, code), nickname, text, at),
      bumpRevStmt(db, boardId),
    ]);
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
    await db.batch([
      db.prepare('DELETE FROM madang_comments WHERE board_id = ? AND id = ?').bind(boardId, commentId),
      bumpRevStmt(db, boardId),
    ]);
    return json({ ok: true, deleted: true });
  }

  // ── 반응 토글(on:true 추가 / on:false 취소) — 'like'는 emoji='❤️' 고정의 하위호환 별칭 ──
  if (action === 'react' || action === 'like') {
    if (!settings.allowLikes) return json({ error: '이 마당은 반응이 꺼져 있습니다.' }, 403);
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const acc = await checkAccess(env, board, settings, isOwner, String(body.pin || ''));
    if (acc) return json(acc, acc.status);
    const cardId = String(body.cardId || '');
    const card = await db.prepare('SELECT id FROM madang_cards WHERE board_id = ? AND id = ?').bind(boardId, cardId).first();
    if (!card) return json({ error: '카드를 찾을 수 없습니다.' }, 404);
    const allowedReactions = (Array.isArray(settings.reactions) && settings.reactions.length) ? settings.reactions.slice(0, REACTION_MAX) : DEFAULT_REACTIONS;
    const emoji = action === 'like' ? '❤️' : String(body.emoji || '❤️');
    if (!allowedReactions.includes(emoji)) return json({ error: '허용되지 않은 반응입니다.' }, 400);
    const tok = await authorToken(env, boardId, code);
    const stmts = [];
    if (body.on === false) {
      stmts.push(db.prepare('DELETE FROM madang_likes WHERE board_id = ? AND card_id = ? AND liker_token = ? AND emoji = ?').bind(boardId, cardId, tok, emoji));
    } else {
      stmts.push(db.prepare('INSERT INTO madang_likes (board_id, card_id, liker_token, emoji, created_at) VALUES (?,?,?,?,?) ON CONFLICT(board_id, card_id, liker_token, emoji) DO NOTHING')
        .bind(boardId, cardId, tok, emoji, nowIso()));
    }
    stmts.push(bumpRevStmt(db, boardId));
    stmts.push(db.prepare('SELECT emoji, COUNT(*) AS n FROM madang_likes WHERE board_id = ? AND card_id = ? GROUP BY emoji').bind(boardId, cardId));
    stmts.push(db.prepare('SELECT emoji FROM madang_likes WHERE board_id = ? AND card_id = ? AND liker_token = ?').bind(boardId, cardId, tok));
    const results = await db.batch(stmts);
    const reactions = {}; for (const r of (results[results.length - 2].results || [])) reactions[r.emoji] = r.n;
    const mine = (results[results.length - 1].results || []).map((r) => r.emoji);
    return json({ ok: true, reactions: reactions, mine: mine, likes: reactions['❤️'] || 0, liked: mine.indexOf('❤️') >= 0 });
  }

  // ── 입장 기록(멤버) ── 닉네임 있는 사용자가 입장하면 참여자 목록에 기록
  if (action === 'join') {
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const acc = await checkAccess(env, board, settings, isOwner, String(body.pin || ''));
    if (acc) return json(acc, acc.status);
    const nickname = String(body.nickname || '').trim().slice(0, NICK_MAX);
    const tok = await authorToken(env, boardId, code), at = nowIso();
    await db.prepare(
      'INSERT INTO madang_members (board_id, token, nickname, is_owner, joined_at, updated_at) VALUES (?,?,?,?,?,?) ' +
      'ON CONFLICT(board_id, token) DO UPDATE SET nickname = excluded.nickname, is_owner = excluded.is_owner, updated_at = excluded.updated_at'
    ).bind(boardId, tok, nickname, isOwner ? 1 : 0, at, at).run();
    return json({ ok: true });
  }

  // ── 닉네임 변경 ── 멤버 + 내 카드·댓글의 표시 이름까지 갱신
  if (action === 'setNick') {
    if (!CODE_RE.test(code)) return json({ error: '코드가 필요합니다.' }, 400);
    const nickname = String(body.nickname || '').trim().slice(0, NICK_MAX);
    if (!nickname) return json({ error: '별명을 입력하세요.' }, 400);
    const tok = await authorToken(env, boardId, code), at = nowIso();
    await db.batch([
      db.prepare(
        'INSERT INTO madang_members (board_id, token, nickname, is_owner, joined_at, updated_at) VALUES (?,?,?,?,?,?) ' +
        'ON CONFLICT(board_id, token) DO UPDATE SET nickname = excluded.nickname, updated_at = excluded.updated_at'
      ).bind(boardId, tok, nickname, isOwner ? 1 : 0, at, at),
      db.prepare('UPDATE madang_cards SET nickname = ? WHERE board_id = ? AND author_token = ?').bind(nickname, boardId, tok),
      db.prepare('UPDATE madang_comments SET nickname = ? WHERE board_id = ? AND author_token = ?').bind(nickname, boardId, tok),
      bumpRevStmt(db, boardId),
    ]);
    return json({ ok: true, nickname: nickname });
  }

  // ── 참여자 목록(개설자만) ──
  if (action === 'members') {
    if (!isOwner) return json({ error: '개설자만 참여자를 볼 수 있습니다.' }, 403);
    const mr = await db.prepare('SELECT token, nickname, is_owner, joined_at FROM madang_members WHERE board_id = ? ORDER BY joined_at ASC').bind(boardId).all();
    const cc = await db.prepare('SELECT author_token, COUNT(*) AS n FROM madang_cards WHERE board_id = ? GROUP BY author_token').bind(boardId).all();
    const cnt = {}; for (const r of cc.results || []) cnt[r.author_token] = r.n;
    const members = (mr.results || []).map((r) => ({ nickname: r.nickname || '익명', isOwner: !!r.is_owner, joinedAt: r.joined_at, cards: cnt[r.token] || 0 }));
    return json({ ok: true, members: members });
  }

  return json({ error: '알 수 없는 action입니다.' }, 400);
}
