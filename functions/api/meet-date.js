// functions/api/meet-date.js
// ─────────────────────────────────────────────────────────────────────────────
// 협의 날짜 모으기(apps/meet-date) — docs/meet-date-plan.md §4, §11
//
//   로그인 없음. 협의 1건 = 6자리 코드. 담당자는 '관리키', 응답자는 '응답키'·'서명키'로 자기 것만 고친다.
//   키 원본은 저장하지 않고 SHA-256만 둔다(무작위 128비트). 키는 요청 헤더·본문으로 받는다(주소에 안 남게).
//   종류(config.kind): schedule(일정 정하기) · activity(활동 날짜 + 확인서) · live(실시간 등록부)
//   저장하는 개인정보: 이름·담당자가 고른 칸(소속 등)·의견 한 줄·손글씨 서명 그림(PNG, 실시간 등록부와
//   확인서 '바로 내기'만 — 운영자 결정 2026-11-27). 마감 30일 뒤 모두 자동 삭제(purge_at).
//   Pages Functions에는 cron이 없어 호출 때 가끔 지운다.
//
//   GET  /api/meet-date?m=CODE
//        헤더 X-Meet-Key  → 담당자용(응답 전체). &signs=1[&after=ISO] → 서명 목록(그림 포함, after 뒤 바뀐 것만)
//        헤더 X-Resp-Id + X-Resp-Key → 내 응답 같이 받기 / X-Sign-Id + X-Sign-Key → 내 서명(출석) 같이 받기
//   POST /api/meet-date  { action, ... }
//        create   { config, closesAt }                     → { id, key }
//        update   { id, key, config?, closesAt?, confirmed? }
//        delete   { id, key }
//        remove   { id, key, rid }                          담당자가 응답 하나 지우기
//        mark     { id, key, rid, status: 'file'|null }     확인서 파일 받음 표시
//        live     { id, key, open }                         출석 받기 열기·닫기
//        removeSign { id, key, sid } / clearSigns { id, key } 서명 하나 지우기 / 서명 그림만 모두 지우기
//        respond  { id, name, fields, picks, memo, rid?, rkey? } → { rid, rkey }
//        unrespond{ id, rid, rkey }
//        sign     { id, name, fields, png, sid?, skey? }    실시간 등록부 출석 → { sid, skey }
//        cert     { id, rid, rkey, png|null }               확인서 바로 내기
// ─────────────────────────────────────────────────────────────────────────────

import { checkOrigin, rateLimit, json, readJson } from './_guard.js';

const ID_RE = /^[A-HJ-NP-Z2-9]{6}$/;          // 혼동 문자(0 O 1 I L) 제외
const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const KEY_RE = /^[A-Za-z0-9_-]{22}$/;
const RID_RE = /^[a-z0-9]{10}$/;
const SID_RE = /^(s|c)[a-z0-9]{10}$/;          // s… 출석 서명, c+응답id 확인서 서명
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_ID_RE = /^[a-z0-9]{1,8}$/;
const PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const RID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';

const DAY = 86400000;
const PURGE_AFTER = 30 * DAY;      // 마감 뒤 보관(운영자 결정 2026-11-27: 30일)
const MAX_OPEN = 180 * DAY;        // 마감은 만든 날부터 180일 안
const MAX_RANGE_DAYS = 92;
const MAX_SLOTS = 150;
const MAX_FREE = 20;
const MAX_RESPONSES = 300;
const MAX_SIGNS = 300;
const MAX_PNG = 40000;             // data URL 글자 수(약 29KB PNG). 400×160 손글씨는 보통 5~15KB
const FIELD_KEYS = ['org', 'pos', 'cls'];  // 소속·직위·학년반/과목
const KINDS = ['schedule', 'activity', 'live'];
const FORM_DEFAULT = {
  schedule: { title: '협의회 참석 등록부', foot: '위와 같이 협의회에 참석하였음을 확인합니다.' },
  activity: { title: '활동 확인서', foot: '위와 같이 활동하였음을 확인합니다.' },
  live: { title: '참석 등록부', foot: '위와 같이 참석하였음을 확인합니다.' },
};

const nowIso = () => new Date().toISOString();
const err = (msg, status, code) => json({ error: msg, code: code || 'bad_request' }, status || 400);

function rand(n, chars) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (v) => chars[v % chars.length]).join('');
}
function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (v) => v.toString(16).padStart(2, '0')).join('');
}
function str(v, max) {
  if (v == null) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
function validDate(s) {
  if (!DATE_RE.test(s || '')) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}
function parseJ(s, def) { try { return JSON.parse(s); } catch { return def; } }
// 손글씨 서명 PNG 검사. 없으면 null, 잘못되면 false
function cleanPng(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.length > MAX_PNG || !PNG_RE.test(v)) return false;
  try {
    const head = atob(v.slice(22, 34));
    if (head.charCodeAt(0) !== 0x89 || head.slice(1, 4) !== 'PNG') return false;
  } catch { return false; }
  return v;
}
function cleanFields(cfg, src) {
  const fields = {};
  for (const k of cfg.fields) fields[k] = str(src && src[k], 40);
  return fields;
}

// ── 설정 검사(서버가 정본). 잘못되면 { error }. ──
function cleanConfig(c) {
  if (!c || typeof c !== 'object') return { error: '설정이 비어 있어요.' };
  const kind = KINDS.includes(c.kind) ? c.kind : 'schedule';
  const title = str(c.title, 60);
  if (!title) return { error: '제목을 적어 주세요.' };
  let mode = c.mode === 'free' ? 'free' : 'pick';
  let from = str(c.range && c.range.from, 10), to = str(c.range && c.range.to, 10);
  let session = null;
  if (kind === 'live') {
    const d = str(c.session && c.session.d, 10), s = str(c.session && c.session.s, 5), e = str(c.session && c.session.e, 5);
    if (!validDate(d) || !TIME_RE.test(s) || !TIME_RE.test(e) || s >= e) return { error: '협의 날짜와 시간을 확인해 주세요.' };
    session = { d, s, e };
    mode = 'free'; from = d; to = d;
  }
  if (!validDate(from) || !validDate(to) || from > to) return { error: '기간을 확인해 주세요.' };
  if ((Date.parse(to) - Date.parse(from)) / DAY > MAX_RANGE_DAYS) return { error: '기간은 석 달 안으로 정해 주세요.' };

  let slots = [];
  if (kind !== 'live' && mode === 'pick') {
    const seen = new Set();
    for (const s of Array.isArray(c.slots) ? c.slots.slice(0, MAX_SLOTS + 1) : []) {
      const id = str(s && s.id, 8), d = str(s && s.d, 10), st = str(s && s.s, 5), en = str(s && s.e, 5);
      if (!SLOT_ID_RE.test(id) || seen.has(id) || !validDate(d) || !TIME_RE.test(st) || !TIME_RE.test(en) || st >= en) {
        return { error: '후보 시간에 잘못된 값이 있어요.' };
      }
      seen.add(id);
      slots.push({ id, d, s: st, e: en });
    }
    if (!slots.length) return { error: '후보 시간을 하나 이상 만들어 주세요.' };
    if (slots.length > MAX_SLOTS) return { error: '후보 시간은 ' + MAX_SLOTS + '개까지 만들 수 있어요.' };
    slots.sort((a, b) => (a.d + a.s).localeCompare(b.d + b.s));
  }

  let rt = ['exact', 'min', 'any'].includes(c.rule && c.rule.type) ? c.rule.type : 'any';
  let n = Math.round(Number(c.rule && c.rule.n) || 1);
  if (kind === 'live') rt = 'any';
  n = Math.max(1, Math.min(rt === 'any' ? 1 : (mode === 'pick' ? slots.length : MAX_FREE), n));
  const fields = Array.isArray(c.fields) ? FIELD_KEYS.filter((k) => c.fields.includes(k)) : [];
  const f = c.form || {};
  const def = FORM_DEFAULT[kind];
  const form = {
    title: str(f.title, 40) || def.title,
    head: str(f.head, 300),
    foot: f.foot == null ? def.foot : str(f.foot, 200),
    owner: str(f.owner, 20),
    signFill: f.signFill === 'blank' ? 'blank' : 'name',
    when: f.when !== false,
  };
  let submit = null;
  if (kind === 'activity') {
    const s = c.submit || {};
    submit = { file: s.file !== false, direct: s.direct !== false };
    if (!submit.file && !submit.direct) return { error: '확인서 내는 방법을 하나 이상 골라 주세요.' };
  }
  return {
    config: {
      v: 2, kind, title, desc: str(c.desc, 1000), place: str(c.place, 60), mode,
      range: { from, to }, slots, session, rule: { type: rt, n }, fields,
      memo: kind !== 'live' && !!c.memo, showOthers: kind !== 'live' && !!c.showOthers, form, submit,
    },
  };
}

function cleanPicks(cfg, picks) {
  if (!Array.isArray(picks)) return { error: '고른 시간이 없어요.' };
  let out;
  if (cfg.mode === 'pick') {
    const ids = new Set(cfg.slots.map((s) => s.id));
    const uniq = [...new Set(picks.slice(0, MAX_SLOTS + 1).map((p) => str(p, 8)))];
    out = uniq.filter((p) => ids.has(p));
    if (out.length !== uniq.length) return { error: '없는 후보 시간이 있어요. 새로 고침 후 다시 골라 주세요.' };
  } else {
    out = [];
    for (const p of picks.slice(0, MAX_FREE + 1)) {
      const d = str(p && p.d, 10), s = str(p && p.s, 5), e = str(p && p.e, 5);
      if (!validDate(d) || d < cfg.range.from || d > cfg.range.to) return { error: '기간 안의 날짜를 골라 주세요.' };
      if (!TIME_RE.test(s) || !TIME_RE.test(e) || s >= e) return { error: '시작 시간이 끝 시간보다 빨라야 해요.' };
      out.push({ d, s, e });
    }
    if (out.length > MAX_FREE) return { error: '날짜는 ' + MAX_FREE + '개까지 적을 수 있어요.' };
    out.sort((a, b) => (a.d + a.s).localeCompare(b.d + b.s));
  }
  const { type, n } = cfg.rule;
  if (!out.length) return { error: '되는 시간을 하나 이상 골라 주세요.' };
  if (type === 'exact' && out.length !== n) return { error: '시간을 ' + n + '개 골라 주세요.' };
  if (type === 'min' && out.length < n) return { error: '시간을 ' + n + '개 이상 골라 주세요.' };
  return { picks: out };
}

function cleanConfirmed(cfg, v) {
  if (v === null) return { confirmed: null };
  if (!Array.isArray(v)) return { error: '확정 값이 잘못됐어요.' };
  if (cfg.mode === 'pick') {
    const ids = new Set(cfg.slots.map((s) => s.id));
    const out = [...new Set(v.map((x) => str(x, 8)))].filter((x) => ids.has(x)).slice(0, 50);
    return { confirmed: out.length ? out : null };
  }
  // 직접 적기: 확정 일시를 담당자가 적는다 [{d,s,e}]
  const out = [];
  for (const p of v.slice(0, 20)) {
    const d = str(p && p.d, 10), s = str(p && p.s, 5), e = str(p && p.e, 5);
    if (!validDate(d) || !TIME_RE.test(s) || !TIME_RE.test(e) || s >= e) return { error: '확정 일시를 확인해 주세요.' };
    out.push({ d, s, e });
  }
  return { confirmed: out.length ? out : null };
}

function cleanClose(v) {
  const t = Date.parse(v || '');
  if (!Number.isFinite(t)) return { error: '마감 일시를 정해 주세요.' };
  const now = Date.now();
  if (t < now - 60000) return { error: '마감 일시는 지금보다 뒤여야 해요.' };
  if (t > now + MAX_OPEN) return { error: '마감은 180일 안으로 정해 주세요.' };
  return { closesAt: new Date(t).toISOString(), purgeAt: new Date(t + PURGE_AFTER).toISOString() };
}

async function loadEvent(db, id) {
  if (!ID_RE.test(id || '')) return null;
  const ev = await db.prepare('SELECT * FROM meet_events WHERE id = ?').bind(id).first();
  if (!ev || ev.purge_at < nowIso()) return null;
  return ev;
}
async function isOwner(ev, key) { return !!(key && KEY_RE.test(key) && (await sha('o:' + ev.id + ':' + key)) === ev.owner_hash); }
async function respOk(ev, r, rkey) { return !!(r && rkey && KEY_RE.test(rkey) && r.edit_hash === (await sha('r:' + ev.id + ':' + r.id + ':' + rkey))); }

function eventView(ev, cfg) {
  return {
    id: ev.id, config: cfg, confirmed: parseJ(ev.confirmed, null),
    closesAt: ev.closes_at, purgeAt: ev.purge_at, closed: ev.closes_at < nowIso(), updatedAt: ev.updated_at,
    liveOpen: !!ev.live_open,
  };
}
function respView(r, full) {
  const o = { rid: r.id, name: r.name, picks: parseJ(r.picks, []), updatedAt: r.updated_at };
  if (full) { o.fields = parseJ(r.fields, {}); o.memo = r.memo || ''; o.status = r.status || null; }
  return o;
}
function signView(s, withPng) {
  const o = { sid: s.id, kind: s.kind, rid: s.resp_id || null, name: s.name, fields: parseJ(s.fields, {}), at: s.created_at, updatedAt: s.updated_at, hasPng: !!s.png };
  if (withPng) o.png = s.png || null;
  return o;
}

async function maybePurge(db, ctx) {
  if (Math.random() > 0.05) return;
  const now = nowIso();
  const sub = '(SELECT id FROM meet_events WHERE purge_at < ?)';
  const job = db.batch([
    db.prepare('DELETE FROM meet_signs WHERE event_id IN ' + sub).bind(now),
    db.prepare('DELETE FROM meet_responses WHERE event_id IN ' + sub).bind(now),
    db.prepare('DELETE FROM meet_events WHERE purge_at < ?').bind(now),
  ]).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
}
const bump = (db, id, now) => db.prepare('UPDATE meet_events SET rev = rev + 1, updated_at = ? WHERE id = ?').bind(now, id);

// ── GET ──
async function handleGet(request, db) {
  const url = new URL(request.url);
  const ev = await loadEvent(db, url.searchParams.get('m'));
  if (!ev) return err('찾을 수 없어요. 주소를 확인하거나 담당자에게 물어보세요.', 404, 'not_found');
  const cfg = parseJ(ev.config, null);
  const owner = await isOwner(ev, request.headers.get('X-Meet-Key'));

  // 담당자 서명 목록(출석 화면이 몇 초마다 부름 — after 뒤 바뀐 것만 그림과 함께)
  if (owner && url.searchParams.get('signs') === '1') {
    const after = str(url.searchParams.get('after'), 30);
    const all = (await db.prepare('SELECT id, updated_at FROM meet_signs WHERE event_id = ?').bind(ev.id).all()).results;
    const q = after
      ? db.prepare('SELECT * FROM meet_signs WHERE event_id = ? AND updated_at > ? ORDER BY created_at').bind(ev.id, after)
      : db.prepare('SELECT * FROM meet_signs WHERE event_id = ? ORDER BY created_at').bind(ev.id);
    const { results } = await q.all();
    return json({ liveOpen: !!ev.live_open, rev: ev.rev, ids: all.map((s) => s.id), signs: results.map((s) => signView(s, true)), now: nowIso() });
  }

  const { results } = await db.prepare('SELECT * FROM meet_responses WHERE event_id = ? ORDER BY created_at').bind(ev.id).all();
  const out = { event: eventView(ev, cfg), owner, total: results.length };

  if (owner) {
    out.responses = results.map((r) => respView(r, true));
    const signs = (await db.prepare('SELECT id, kind, resp_id, name, fields, created_at, updated_at, png IS NOT NULL AS has FROM meet_signs WHERE event_id = ? ORDER BY created_at').bind(ev.id).all()).results;
    out.signs = signs.map((s) => ({ sid: s.id, kind: s.kind, rid: s.resp_id || null, name: s.name, fields: parseJ(s.fields, {}), at: s.created_at, hasPng: !!s.has }));
  } else {
    if (cfg.mode === 'pick') {
      const counts = {};
      for (const r of results) for (const p of parseJ(r.picks, [])) counts[p] = (counts[p] || 0) + 1;
      out.counts = counts;
    }
    if (cfg.showOthers) out.others = results.map((r) => respView(r, false));
  }
  const rid = request.headers.get('X-Resp-Id'), rkey = request.headers.get('X-Resp-Key');
  if (rid && RID_RE.test(rid)) {
    const mine = results.find((r) => r.id === rid);
    if (await respOk(ev, mine, rkey)) {
      out.mine = respView(mine, true);
      const c = await db.prepare('SELECT png IS NOT NULL AS has, updated_at FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, 'c' + rid).first();
      if (c) out.mine.cert = { hasPng: !!c.has, at: c.updated_at };
    }
  }
  const sid = request.headers.get('X-Sign-Id'), skey = request.headers.get('X-Sign-Key');
  if (sid && SID_RE.test(sid) && skey && KEY_RE.test(skey)) {
    const s = await db.prepare('SELECT * FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, sid).first();
    if (s && s.edit_hash === (await sha('s:' + ev.id + ':' + sid + ':' + skey))) out.mySign = signView(s, false);
  }
  return json(out);
}

// ── POST ──
async function handlePost(request, db) {
  const body = await readJson(request, 48 * 1024);
  if (body instanceof Response) return body;
  const a = body.action;
  const now = nowIso();

  if (a === 'create') {
    const lim = await rateLimit(request, 'meet-create');
    if (lim) return lim;
    const c = cleanConfig(body.config);
    if (c.error) return err(c.error);
    const cl = cleanClose(body.closesAt);
    if (cl.error) return err(cl.error);
    const key = newKey();
    const cfgStr = JSON.stringify(c.config);
    const liveOpen = c.config.kind === 'live' && body.liveOpen !== false ? 1 : 0;
    for (let i = 0; i < 5; i++) {
      const id = rand(6, ID_CHARS);
      try {
        await db.prepare('INSERT INTO meet_events (id, owner_hash, config, confirmed, closes_at, purge_at, created_at, updated_at, live_open, rev) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 0)')
          .bind(id, await sha('o:' + id + ':' + key), cfgStr, cl.closesAt, cl.purgeAt, now, now, liveOpen).run();
        return json({ id, key, closesAt: cl.closesAt, purgeAt: cl.purgeAt, config: c.config });
      } catch (e) {
        if (!/UNIQUE|constraint/i.test(String(e && e.message))) throw e;
      }
    }
    return err('잠시 후 다시 해 주세요.', 503, 'busy');
  }

  const lim = await rateLimit(request, 'meet-write');
  if (lim) return lim;
  const ev = await loadEvent(db, body.id);
  if (!ev) return err('찾을 수 없어요.', 404, 'not_found');
  const cfg = parseJ(ev.config, null);

  // ── 담당자 동작 ──
  if (['update', 'delete', 'remove', 'mark', 'live', 'removeSign', 'clearSigns'].includes(a)) {
    if (!(await isOwner(ev, body.key))) return err('관리 링크가 맞지 않아요.', 403, 'forbidden');
    if (a === 'delete') {
      await db.batch([
        db.prepare('DELETE FROM meet_signs WHERE event_id = ?').bind(ev.id),
        db.prepare('DELETE FROM meet_responses WHERE event_id = ?').bind(ev.id),
        db.prepare('DELETE FROM meet_events WHERE id = ?').bind(ev.id),
      ]);
      return json({ ok: true });
    }
    if (a === 'remove') {
      if (!RID_RE.test(body.rid || '')) return err('응답을 찾을 수 없어요.', 404, 'not_found');
      await db.batch([
        db.prepare('DELETE FROM meet_responses WHERE event_id = ? AND id = ?').bind(ev.id, body.rid),
        db.prepare('DELETE FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, 'c' + body.rid),
      ]);
      return json({ ok: true });
    }
    if (a === 'mark') {
      if (!RID_RE.test(body.rid || '')) return err('응답을 찾을 수 없어요.', 404, 'not_found');
      const r = await db.prepare('SELECT status FROM meet_responses WHERE event_id = ? AND id = ?').bind(ev.id, body.rid).first();
      if (!r) return err('응답을 찾을 수 없어요.', 404, 'not_found');
      if (r.status === 'direct') return err('이미 바로 낸 확인서예요.');
      await db.prepare('UPDATE meet_responses SET status = ? WHERE event_id = ? AND id = ?').bind(body.status === 'file' ? 'file' : null, ev.id, body.rid).run();
      return json({ ok: true });
    }
    if (a === 'live') {
      await db.prepare('UPDATE meet_events SET live_open = ?, rev = rev + 1, updated_at = ? WHERE id = ?').bind(body.open ? 1 : 0, now, ev.id).run();
      return json({ ok: true, liveOpen: !!body.open });
    }
    if (a === 'removeSign') {
      if (!SID_RE.test(body.sid || '')) return err('서명을 찾을 수 없어요.', 404, 'not_found');
      const stmts = [db.prepare('DELETE FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, body.sid)];
      if (body.sid[0] === 'c') stmts.push(db.prepare("UPDATE meet_responses SET status = NULL WHERE event_id = ? AND id = ? AND status = 'direct'").bind(ev.id, body.sid.slice(1)));
      stmts.push(bump(db, ev.id, now));
      await db.batch(stmts);
      return json({ ok: true });
    }
    if (a === 'clearSigns') {
      await db.batch([
        db.prepare('UPDATE meet_signs SET png = NULL, updated_at = ? WHERE event_id = ?').bind(now, ev.id),
        bump(db, ev.id, now),
      ]);
      return json({ ok: true });
    }
    // update
    let newCfg = cfg, closes = { closesAt: ev.closes_at, purgeAt: ev.purge_at }, confirmed = parseJ(ev.confirmed, null);
    if (body.config !== undefined) {
      const c = cleanConfig(body.config);
      if (c.error) return err(c.error);
      if (c.config.mode !== cfg.mode || c.config.kind !== (cfg.kind || 'schedule')) return err('만든 뒤에는 종류와 방식을 바꿀 수 없어요.');
      // 이미 응답이 고른 후보를 지우지 못하게(응답이 깨짐)
      if (cfg.mode === 'pick') {
        const keep = new Set(c.config.slots.map((s) => s.id));
        const { results } = await db.prepare('SELECT picks FROM meet_responses WHERE event_id = ?').bind(ev.id).all();
        if (results.some((r) => parseJ(r.picks, []).some((p) => !keep.has(p)))) return err('누군가 고른 후보 시간은 지울 수 없어요.');
      }
      newCfg = c.config;
      if (newCfg.mode === 'pick' && Array.isArray(confirmed)) {
        const keep = new Set(newCfg.slots.map((s) => s.id));
        confirmed = confirmed.filter((id) => keep.has(id));
        if (!confirmed.length) confirmed = null;
      }
    }
    if (body.closesAt !== undefined) {
      const cl = cleanClose(body.closesAt);
      if (cl.error) return err(cl.error);
      closes = cl;
    }
    if (body.confirmed !== undefined) {
      const cf = cleanConfirmed(newCfg, body.confirmed);
      if (cf.error) return err(cf.error);
      confirmed = cf.confirmed;
    }
    await db.prepare('UPDATE meet_events SET config = ?, confirmed = ?, closes_at = ?, purge_at = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(newCfg), confirmed ? JSON.stringify(confirmed) : null, closes.closesAt, closes.purgeAt, now, ev.id).run();
    const ev2 = { ...ev, config: JSON.stringify(newCfg), confirmed: confirmed ? JSON.stringify(confirmed) : null, closes_at: closes.closesAt, purge_at: closes.purgeAt, updated_at: now };
    return json({ ok: true, event: eventView(ev2, newCfg) });
  }

  // ── 실시간 등록부 출석 ──
  if (a === 'sign') {
    if (!ev.live_open) return err('지금은 출석을 받지 않아요. 담당자에게 문의해 주세요.', 403, 'live_closed');
    const name = str(body.name, 20);
    if (!name) return err('이름을 적어 주세요.');
    const png = cleanPng(body.png);
    if (png === false) return err('서명 그림을 읽지 못했어요. 다시 서명해 주세요.');
    if (!png) return err('서명해 주세요.');
    const fields = JSON.stringify(cleanFields(cfg, body.fields));
    if (body.sid && SID_RE.test(body.sid) && body.sid[0] === 's' && KEY_RE.test(body.skey || '')) {
      const s = await db.prepare('SELECT edit_hash FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, body.sid).first();
      if (s && s.edit_hash === (await sha('s:' + ev.id + ':' + body.sid + ':' + body.skey))) {
        await db.batch([
          db.prepare('UPDATE meet_signs SET name = ?, fields = ?, png = ?, updated_at = ? WHERE event_id = ? AND id = ?').bind(name, fields, png, now, ev.id, body.sid),
          bump(db, ev.id, now),
        ]);
        return json({ ok: true, sid: body.sid, skey: body.skey, updated: true, at: now });
      }
    }
    const sid = 's' + rand(10, RID_CHARS), skey = newKey();
    const r = await db.prepare(
      'INSERT INTO meet_signs (event_id, id, kind, resp_id, name, fields, png, edit_hash, created_at, updated_at) ' +
      "SELECT ?, ?, 'live', NULL, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM meet_signs WHERE event_id = ?) < ?")
      .bind(ev.id, sid, name, fields, png, await sha('s:' + ev.id + ':' + sid + ':' + skey), now, now, ev.id, MAX_SIGNS).run();
    if (!r.meta || !r.meta.changes) return err('출석이 ' + MAX_SIGNS + '명을 넘어 더 받을 수 없어요.', 409, 'full');
    await bump(db, ev.id, now).run();
    return json({ ok: true, sid, skey, at: now });
  }

  // ── 확인서 바로 내기 ──
  if (a === 'cert') {
    if ((cfg.kind || 'schedule') !== 'activity' || !cfg.submit || !cfg.submit.direct) return err('이 활동은 확인서를 바로 받지 않아요. 파일로 보내 주세요.');
    if (!RID_RE.test(body.rid || '')) return err('내 응답을 찾을 수 없어요.', 404, 'not_found');
    const r = await db.prepare('SELECT * FROM meet_responses WHERE event_id = ? AND id = ?').bind(ev.id, body.rid).first();
    if (!(await respOk(ev, r, body.rkey))) return err('내 응답을 찾을 수 없어요.', 404, 'not_found');
    const png = cleanPng(body.png);
    if (png === false) return err('서명 그림을 읽지 못했어요. 다시 서명해 주세요.');
    const sid = 'c' + r.id;
    await db.batch([
      db.prepare('INSERT INTO meet_signs (event_id, id, kind, resp_id, name, fields, png, edit_hash, created_at, updated_at) VALUES (?, ?, \'cert\', ?, ?, ?, ?, \'\', ?, ?) ' +
        'ON CONFLICT(event_id, id) DO UPDATE SET name = excluded.name, fields = excluded.fields, png = excluded.png, updated_at = excluded.updated_at')
        .bind(ev.id, sid, r.id, r.name, r.fields || '{}', png, now, now),
      db.prepare("UPDATE meet_responses SET status = 'direct' WHERE event_id = ? AND id = ?").bind(ev.id, r.id),
      bump(db, ev.id, now),
    ]);
    return json({ ok: true, at: now });
  }

  if (a === 'respond' || a === 'unrespond') {
    if ((cfg.kind || 'schedule') === 'live') return err('이 링크는 출석 서명용이에요.');
    let existing = null;
    if (body.rid || body.rkey) {
      if (!RID_RE.test(body.rid || '') || !KEY_RE.test(body.rkey || '')) return err('내 응답을 찾을 수 없어요.', 404, 'not_found');
      existing = await db.prepare('SELECT * FROM meet_responses WHERE event_id = ? AND id = ?').bind(ev.id, body.rid).first();
      if (!(await respOk(ev, existing, body.rkey))) {
        if (a === 'unrespond') return err('내 응답을 찾을 수 없어요.', 404, 'not_found');
        existing = null; // 지워진 응답이면 새로 낸다
      }
    }
    if (ev.closes_at < now) return err('응답이 마감됐어요. 담당자에게 문의해 주세요.', 403, 'closed');
    if (a === 'unrespond') {
      await db.batch([
        db.prepare('DELETE FROM meet_responses WHERE event_id = ? AND id = ?').bind(ev.id, existing.id),
        db.prepare('DELETE FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, 'c' + existing.id),
      ]);
      return json({ ok: true });
    }
    const name = str(body.name, 20);
    if (!name) return err('이름을 적어 주세요.');
    const fields = cleanFields(cfg, body.fields);
    const memo = cfg.memo ? str(body.memo, 200) : '';
    const p = cleanPicks(cfg, body.picks);
    if (p.error) return err(p.error);

    if (existing) {
      // 고르면 이미 낸 확인서 내용이 달라지므로 바로 낸 표시는 풀고 다시 내게 한다
      const changed = JSON.stringify(p.picks) !== existing.picks || name !== existing.name;
      const stmts = [db.prepare('UPDATE meet_responses SET name = ?, fields = ?, picks = ?, memo = ?, updated_at = ?' + (changed ? ', status = NULL' : '') + ' WHERE event_id = ? AND id = ?')
        .bind(name, JSON.stringify(fields), JSON.stringify(p.picks), memo, now, ev.id, existing.id)];
      if (changed) stmts.push(db.prepare('DELETE FROM meet_signs WHERE event_id = ? AND id = ?').bind(ev.id, 'c' + existing.id));
      await db.batch(stmts);
      return json({ ok: true, rid: existing.id, rkey: body.rkey, updated: true, certReset: changed && !!existing.status });
    }
    const rid = rand(10, RID_CHARS);
    const rkey = newKey();
    const r = await db.prepare(
      'INSERT INTO meet_responses (event_id, id, edit_hash, name, fields, picks, memo, created_at, updated_at) ' +
      'SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM meet_responses WHERE event_id = ?) < ?')
      .bind(ev.id, rid, await sha('r:' + ev.id + ':' + rid + ':' + rkey), name, JSON.stringify(fields), JSON.stringify(p.picks), memo, now, now, ev.id, MAX_RESPONSES).run();
    if (!r.meta || !r.meta.changes) return err('응답이 ' + MAX_RESPONSES + '개를 넘어 더 받을 수 없어요.', 409, 'full');
    return json({ ok: true, rid, rkey });
  }

  return err('알 수 없는 요청이에요.');
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.BYEDUIN_DB;
  if (!db) return err('저장소에 연결하지 못했어요.', 503, 'no_db');
  const bad = checkOrigin(request);
  if (bad) return bad;
  try {
    if (request.method === 'GET') {
      const lim = await rateLimit(request, 'meet-read');
      if (lim) return lim;
      const res = await handleGet(request, db);
      await maybePurge(db, context);
      return res;
    }
    if (request.method === 'POST') {
      const res = await handlePost(request, db);
      await maybePurge(db, context);
      return res;
    }
    return err('지원하지 않는 요청이에요.', 405, 'method');
  } catch (e) {
    return err('서버에 잠시 문제가 생겼어요. 잠시 후 다시 해 주세요.', 500, 'server');
  }
}
