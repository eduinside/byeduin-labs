/* =====================================================
   자리 배치 (seating) — eduin VIVES
   원본: 교실 좌석 배치 단일 HTML(classroom-seating-v2)을 이식.
   - 상태·배치 알고리즘(parseRoster, normalize, 랜덤 배치·점수, 위반, 이동, 스냅샷, JSON)은 함수 단위로 그대로.
   - 렌더·이벤트는 새 UI(목록 → 전체화면 보드, Pointer Events, 키보드, 되돌리기)에 맞게 새로 작성.
   - 저장: localStorage `vives-seating-v1` (학급 배열). 서버·동기화·공유 링크 없음.
   ===================================================== */
(function () {
  "use strict";

  const LS_KEY = "vives-seating-v1";
  const NS = "http://www.w3.org/2000/svg";
  const W = 1000, H = 700;
  const UNDO_MAX = 20;
  const SNAP_MAX = 30;
  const LONG_PRESS_MS = 500;

  // 가상의 예시 명단(원본과 같음). "예시 명단 넣기" 버튼으로만 채운다.
  const SAMPLE = `김민준 남
이서연 여
박지호 남
최수아 여
정도윤 남
강하은 여
조시우 남
윤지유 여
임건우 남
한서윤 여
오주원 남
서다은 여
신현우 남
권채원 여
황지훈 남
안유나 여
배준서 남
문하린 여
양시윤 남
홍예린 여`;

  const $ = (id) => document.getElementById(id);
  const VUI = window.VUI;
  const toast = (m, t) => { if (VUI) VUI.toast(m, t); };

  /* ───── 앱 상태 ───── */
  let db = { v: 1, classes: [] };
  let cur = null;          // 열린 학급 레코드 { id, created, updated, s }
  let state = null;        // cur.s — 원본 앱의 state 객체와 같은 모양
  let selectedSeat = null, selectedStudent = null, focusKey = null;
  let activeTab = "roster";
  let violSet = new Set(), movedToSet = new Set();
  let undoStack = [];
  let gesture = null;      // 진행 중인 포인터 동작
  let suppressClickUntil = 0;
  let lastPointer = { type: "mouse", t: 0 };
  let pushedHistory = false;
  let openPop = null;      // 열린 팝업 메뉴 { el, anchor }

  /* ───── 유틸 ───── */
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function uid() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function isTouchish(t) { return t === "touch" || t === "pen"; }
  function fmtDate(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "오늘 " + d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function totalCols(s = state) { return s.cols * s.deskSeats; }
  function seatKeys(s = state) { const k = [], tc = totalCols(s); for (let r = 0; r < s.rows; r++) for (let c = 0; c < tc; c++) k.push(r + "-" + c); return k; }
  function isValidSeat(key, s = state) { if (typeof key !== "string" || !/^\d+-\d+$/.test(key)) return false; const [r, c] = key.split("-").map(Number); return r >= 0 && r < s.rows && c >= 0 && c < totalCols(s); }
  function studentById(id) { return state.students.find(s => s.id === id); }
  function seatOfStudent(id) { return Object.keys(state.assignment).find(k => state.assignment[k] === id) || null; }
  function unassignedStudents() { const a = new Set(Object.values(state.assignment)); return state.students.filter(s => !a.has(s.id)); }
  function sortSeatsFront(keys) { return keys.slice().sort((A, B) => { const [ra, ca] = A.split("-").map(Number), [rb, cb] = B.split("-").map(Number); return ra - rb || ca - cb; }); }
  function adjacent(ka, kb) { const [ra, ca] = ka.split("-").map(Number), [rb, cb] = kb.split("-").map(Number); return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1); }

  /* ───── 명부 파싱 (원본 그대로 + 이름 길이 제한) ───── */
  function parseRoster(text, existing) {
    const byName = {}; (existing || []).forEach(s => byName[s.name] = s);
    let nextId = Math.max(0, ...((existing || []).map(s => s.id)), 0) + 1;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = []; const used = new Set();
    lines.forEach((line, i) => {
      let name = line, gender = null;
      const m = line.match(/^(.*\S)\s+([남여MFmf])$/);
      if (m) { name = m[1].trim(); const g = m[2].toUpperCase(); gender = (g === "남" || g === "M") ? "M" : (g === "여" || g === "F") ? "F" : null; }
      name = name.slice(0, 20);
      if (!name) return;
      const prev = byName[name];
      if (prev && !used.has(prev.id)) {
        used.add(prev.id);
        out.push({ id: prev.id, name, seq: i + 1, gender: gender !== null ? gender : prev.gender, frontFix: prev.frontFix || false, pinnedSeat: prev.pinnedSeat || null });
      } else {
        out.push({ id: nextId++, name, seq: i + 1, gender, frontFix: false, pinnedSeat: null });
      }
    });
    return out;
  }

  /* ───── 정규화 (원본 그대로) ───── */
  function normalize() {
    const ids = new Set(state.students.map(s => s.id));
    for (const k of Object.keys(state.assignment)) { if (!isValidSeat(k) || !ids.has(state.assignment[k])) delete state.assignment[k]; }
    const seen = new Set();
    for (const k of sortSeatsFront(Object.keys(state.assignment))) { const id = state.assignment[k]; if (seen.has(id)) delete state.assignment[k]; else seen.add(id); }
    state.students.forEach(s => { if (s.pinnedSeat && (!isValidSeat(s.pinnedSeat) || state.assignment[s.pinnedSeat] !== s.id)) s.pinnedSeat = null; });
    for (const k of Object.keys(state.freePos)) { if (!isValidSeat(k)) delete state.freePos[k]; }
    state.pairs = state.pairs.filter(([a, b]) => ids.has(a) && ids.has(b));
  }

  /* ───── 기본 상태 ───── */
  function defaultStateRaw() {
    return {
      students: [], rows: 6, cols: 3, deskSeats: 2, layout: "columns", view: "teacher",
      assignment: {}, freePos: {}, pairs: [], snapshots: [], previous: null,
      genderBalance: true, compareOn: false, className: "", rosterText: "",
      avoidPrev: false, prevDesk: null,
    };
  }

  /* ───── 형식 검증: 외부(저장소·JSON 파일)에서 온 state를 안전한 모양으로 ───── */
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const clampInt = (v, lo, hi, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  function cleanAssignment(a) {
    const out = {};
    if (!isObj(a)) return out;
    for (const k of Object.keys(a)) { const id = Number(a[k]); if (/^\d{1,2}-\d{1,2}$/.test(k) && Number.isInteger(id)) out[k] = id; }
    return out;
  }
  function cleanFreePos(f) {
    const out = {};
    if (!isObj(f)) return out;
    for (const k of Object.keys(f)) {
      const p = f[k];
      if (/^\d{1,2}-\d{1,2}$/.test(k) && isObj(p) && Number.isFinite(+p.x) && Number.isFinite(+p.y)) out[k] = { x: Math.max(0, Math.min(W, +p.x)), y: Math.max(0, Math.min(H, +p.y)) };
    }
    return out;
  }
  function sanitizeState(obj) {
    if (!isObj(obj) || !Array.isArray(obj.students)) return null;
    const s = defaultStateRaw();
    const ids = new Set();
    let maxId = 0;
    obj.students.forEach(st => { const n = Number(st && st.id); if (Number.isInteger(n) && n > maxId) maxId = n; });
    obj.students.slice(0, 200).forEach((st, i) => {
      if (!isObj(st)) return;
      const name = String(st.name == null ? "" : st.name).trim().slice(0, 20);
      if (!name) return;
      let id = Number(st.id);
      if (!Number.isInteger(id) || id < 1 || ids.has(id)) id = ++maxId;
      ids.add(id);
      s.students.push({
        id, name,
        seq: Number.isFinite(+st.seq) ? +st.seq : i + 1,
        gender: st.gender === "M" || st.gender === "F" ? st.gender : null,
        frontFix: !!st.frontFix,
        pinnedSeat: typeof st.pinnedSeat === "string" ? st.pinnedSeat : null,
      });
    });
    s.rows = clampInt(obj.rows, 1, 10, 6);
    s.cols = clampInt(obj.cols, 1, 6, 3);
    s.deskSeats = +obj.deskSeats === 1 ? 1 : 2;
    s.layout = obj.layout === "free" ? "free" : "columns";
    s.view = obj.view === "student" ? "student" : "teacher";
    s.assignment = cleanAssignment(obj.assignment);
    s.freePos = cleanFreePos(obj.freePos);
    s.pairs = Array.isArray(obj.pairs) ? obj.pairs.filter(p => Array.isArray(p) && p.length === 2 && Number.isInteger(+p[0]) && Number.isInteger(+p[1])).map(p => [+p[0], +p[1]]) : [];
    s.snapshots = Array.isArray(obj.snapshots) ? obj.snapshots.filter(isObj).slice(0, SNAP_MAX).map((sn, i) => ({
      id: Number.isFinite(+sn.id) ? +sn.id : Date.now() + i,
      name: String(sn.name || "저장 배치").slice(0, 40),
      date: typeof sn.date === "string" ? sn.date : "",
      assignment: cleanAssignment(sn.assignment),
      rows: clampInt(sn.rows, 1, 10, s.rows), cols: clampInt(sn.cols, 1, 6, s.cols),
      deskSeats: +sn.deskSeats === 1 ? 1 : 2, layout: sn.layout === "free" ? "free" : "columns",
      freePos: cleanFreePos(sn.freePos),
    })) : [];
    s.previous = isObj(obj.previous) ? cleanAssignment(obj.previous) : null;
    s.prevDesk = +obj.prevDesk === 1 ? 1 : +obj.prevDesk === 2 ? 2 : null;
    s.genderBalance = obj.genderBalance !== false;
    s.compareOn = !!obj.compareOn && !!s.previous;
    s.avoidPrev = !!obj.avoidPrev;
    s.className = String(obj.className || "").slice(0, 30);
    s.rosterText = typeof obj.rosterText === "string" ? obj.rosterText.slice(0, 5000) : s.students.map(st => st.name + (st.gender === "M" ? " 남" : st.gender === "F" ? " 여" : "")).join("\n");
    return s;
  }
  function withState(s, fn) { const keep = state; state = s; try { return fn(); } finally { state = keep; } }

  /* ───── 저장소 ───── */
  function readRaw() { return VUI ? VUI.storage.get(LS_KEY, null, v => isObj(v) && Array.isArray(v.classes)) : null; }
  function loadDb(raw) {
    if (raw === undefined) raw = readRaw();
    const out = { v: 1, classes: [] };
    if (raw) {
      for (const c of raw.classes) {
        if (!isObj(c)) continue;
        const s = sanitizeState(c.s);
        if (!s) continue;
        withState(s, normalize);
        out.classes.push({ id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : uid(), created: +c.created || Date.now(), updated: +c.updated || Date.now(), s });
      }
    }
    return out;
  }
  function saveDb() {
    if (!VUI) return;
    if (cur) {
      // 다른 탭에서 바꾼 다른 학급을 덮어쓰지 않도록, 최신 저장본에 지금 학급(과 이 탭에서 새로 만든 학급)만 바꿔 넣는다
      const raw = readRaw();
      if (raw) {
        const latest = loadDb(raw);
        const have = new Set(latest.classes.map(c => c.id));
        for (const c of db.classes) if (!have.has(c.id)) latest.classes.push(c);
        const i = latest.classes.findIndex(c => c.id === cur.id);
        if (i >= 0) latest.classes[i] = cur; else latest.classes.push(cur);
        db = latest;
      }
    }
    VUI.storage.set(LS_KEY, db);
  }
  function newClassRecord(s) { const now = Date.now(); return { id: uid(), created: now, updated: now, s }; }
  function getClass(id) { return db.classes.find(c => c.id === id) || null; }

  /* ───── 레이아웃 계산 (원본 그대로, state 인자화) ───── */
  function colXs(s = state) {
    const tc = totalCols(s), groups = s.cols, per = s.deskSeats, padX = 44, availW = W - 2 * padX;
    const intra = 0.12, aisle = 0.55;
    const units = tc + groups * (per - 1) * intra + (groups - 1) * aisle;
    const seatW = Math.min(availW / units, 120);
    const intraGap = intra * seatW, aisleGap = aisle * seatW;
    const usedW = tc * seatW + groups * (per - 1) * intraGap + (groups - 1) * aisleGap;
    let x = padX + (availW - usedW) / 2; const xs = []; let col = 0;
    for (let g = 0; g < groups; g++) { for (let p = 0; p < per; p++) { xs[col] = x; x += seatW; if (p < per - 1) x += intraGap; col++; } if (g < groups - 1) x += aisleGap; }
    return { xs, seatW };
  }
  function rowYs(seatW, s = state) {
    const top = s.view === "student" ? 84 : 24, bot = s.view === "student" ? H - 24 : H - 84;
    const availH = bot - top, gapRel = 0.32;
    const units = s.rows + (s.rows - 1) * gapRel;
    const seatH = Math.min(availH / units, seatW * 0.74, 88);
    const gap = gapRel * seatH, usedH = s.rows * seatH + (s.rows - 1) * gap;
    let y = top + (availH - usedH) / 2; const ys = [];
    for (let r = 0; r < s.rows; r++) { ys[r] = y; y += seatH + gap; }
    return { ys, seatH };
  }
  function gridPos(key, xs, seatW, ys, seatH, s = state) {
    const [r, c] = key.split("-").map(Number);
    const gc = s.view === "student" ? c : (totalCols(s) - 1 - c);
    const gr = s.view === "student" ? r : (s.rows - 1 - r);
    return { x: xs[gc], y: ys[gr], w: seatW, h: seatH };
  }
  function seatRect(key, xs, seatW, ys, seatH, s = state) {
    if (s.layout === "free") { const p = s.freePos[key] || gridPos(key, xs, seatW, ys, seatH, s); return { x: p.x, y: p.y, w: seatW, h: seatH }; }
    return gridPos(key, xs, seatW, ys, seatH, s);
  }
  function ensureFreePos() {
    const { xs, seatW } = colXs(), { ys, seatH } = rowYs(seatW);
    for (const key of seatKeys()) { if (!state.freePos[key]) { const p = gridPos(key, xs, seatW, ys, seatH); state.freePos[key] = { x: p.x, y: p.y }; } }
  }

  /* ───── 배치 동작 (원본 그대로) ───── */
  function placeStudentInSeat(id, key) {
    const cur = state.assignment[key];
    const old = seatOfStudent(id); if (old) delete state.assignment[old];
    if (cur != null && cur !== id) { const cs = studentById(cur); if (cs) cs.pinnedSeat = null; }
    state.assignment[key] = id;
    const st = studentById(id); if (st && st.pinnedSeat) st.pinnedSeat = key;
  }
  function swapSeats(a, b) {
    const ida = state.assignment[a], idb = state.assignment[b];
    if (ida == null && idb == null) return;
    if (idb == null) { delete state.assignment[a]; state.assignment[b] = ida; const s = studentById(ida); if (s && s.pinnedSeat) s.pinnedSeat = b; }
    else if (ida == null) { delete state.assignment[b]; state.assignment[a] = idb; const s = studentById(idb); if (s && s.pinnedSeat) s.pinnedSeat = a; }
    else { state.assignment[a] = idb; state.assignment[b] = ida; const sa = studentById(ida), sb = studentById(idb); if (sa && sa.pinnedSeat) sa.pinnedSeat = b; if (sb && sb.pinnedSeat) sb.pinnedSeat = a; }
  }
  function fillEmpty() {
    const empty = sortSeatsFront(seatKeys().filter(k => !(k in state.assignment)));
    const pool = unassignedStudents().sort((a, b) => ((b.frontFix ? 1 : 0) - (a.frontFix ? 1 : 0)) || (a.seq - b.seq));
    for (const s of pool) { if (!empty.length) break; state.assignment[empty.shift()] = s.id; }
  }
  function clearAndFill() {
    state.assignment = {};
    const seats = sortSeatsFront(seatKeys());
    const pool = [...state.students].sort((a, b) => a.seq - b.seq);
    for (const s of pool) { if (!seats.length) break; state.assignment[seats.shift()] = s.id; }
  }
  function emptySeat(key) {
    const id = state.assignment[key]; if (id == null) return;
    const st = studentById(id); if (st && st.pinnedSeat === key) st.pinnedSeat = null;
    delete state.assignment[key];
  }

  /* ───── 이전 짝 (추가) ─────
     옆자리 = 같은 줄의 왼쪽·오른쪽 자리. 2인 책상이면 같은 책상 짝만. */
  function isMate(ka, kb, desk) {
    const [ra, ca] = ka.split("-").map(Number), [rb, cb] = kb.split("-").map(Number);
    if (ra !== rb || Math.abs(ca - cb) !== 1) return false;
    return desk === 2 ? Math.floor(ca / 2) === Math.floor(cb / 2) : true;
  }
  function baseline() {
    if (state.previous && Object.keys(state.previous).length) return { asg: state.previous, desk: state.prevDesk || state.deskSeats, label: "비교 기준" };
    const sn = state.snapshots[0];
    if (sn && Object.keys(sn.assignment).length) return { asg: sn.assignment, desk: sn.deskSeats || state.deskSeats, label: "최근 저장 배치(" + sn.name + ")" };
    return null;
  }
  const pairKey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
  function matePairsOf(asg, desk) {
    const out = [];
    for (const k in asg) {
      const [r, c] = k.split("-").map(Number), k2 = r + "-" + (c + 1);
      if (asg[k2] != null && isMate(k, k2, desk)) out.push([asg[k], asg[k2]]);
    }
    return out;
  }
  function prevMateSet() {
    const b = baseline(); if (!b) return null;
    return new Set(matePairsOf(b.asg, b.desk).map(([a, d]) => pairKey(a, d)));
  }
  function countPrevMates(asg, set) {
    if (!set || !set.size) return 0;
    return matePairsOf(asg, state.deskSeats).filter(([a, d]) => set.has(pairKey(a, d))).length;
  }

  /* ───── 랜덤 배치 (원본 + 이전 짝 점수) ───── */
  function buildCandidate() {
    const asg = {}, pinnedIds = new Set();
    state.students.forEach(s => { if (s.pinnedSeat && isValidSeat(s.pinnedSeat)) { asg[s.pinnedSeat] = s.id; pinnedIds.add(s.id); } });
    const avail = seatKeys().filter(k => !(k in asg));
    avail.sort((A, B) => { const ra = +A.split("-")[0], rb = +B.split("-")[0]; return ra !== rb ? ra - rb : Math.random() - 0.5; });
    const pool = shuffle(state.students.filter(s => !pinnedIds.has(s.id)));
    pool.sort((a, b) => (b.frontFix ? 1 : 0) - (a.frontFix ? 1 : 0));
    const n = Math.min(pool.length, avail.length);
    for (let i = 0; i < n; i++) asg[avail[i]] = pool[i].id;
    return asg;
  }
  function scoreAssignment(asg, mates) {
    const idSeat = {}; for (const k in asg) idSeat[asg[k]] = k;
    let score = 0, v = 0;
    state.pairs.forEach(([a, b]) => { const ka = idSeat[a], kb = idSeat[b]; if (ka && kb && adjacent(ka, kb)) v++; });
    score += v * 1000;
    const p = countPrevMates(asg, mates);
    score += p * 40;
    if (state.genderBalance) {
      const per = state.deskSeats, groups = state.cols;
      for (let g = 0; g < groups; g++) { let m = 0, f = 0; for (let q = 0; q < per; q++) { const c = g * per + q; for (let r = 0; r < state.rows; r++) { const id = asg[r + "-" + c]; if (id != null) { const st = studentById(id); if (st && st.gender === "M") m++; else if (st && st.gender === "F") f++; } } } score += Math.abs(m - f) * 3; }
    }
    return { score, v, p };
  }
  function randomPlace() {
    let autoBase = false, mates = null;
    if (state.avoidPrev) {
      if (!baseline() && Object.keys(state.assignment).length) {
        // 기준이 없으면 지금 배치를 기준으로 저장하고 그 짝을 피한다
        state.previous = { ...state.assignment }; state.prevDesk = state.deskSeats; state.compareOn = true; autoBase = true;
      }
      mates = prevMateSet();
    }
    let best = null, bestScore = Infinity, bestInfo = null;
    for (let i = 0; i < 350; i++) { const a = buildCandidate(); const r = scoreAssignment(a, mates); if (r.score < bestScore) { bestScore = r.score; best = a; bestInfo = r; if (r.score === 0) break; } }
    state.assignment = best || {};
    return { autoBase, v: bestInfo ? bestInfo.v : 0, p: bestInfo ? bestInfo.p : 0 };
  }

  /* ───── 위반 / 이동 (원본 그대로) ───── */
  function violationSeats() { const s = new Set(); state.pairs.forEach(([a, b]) => { const ka = seatOfStudent(a), kb = seatOfStudent(b); if (ka && kb && adjacent(ka, kb)) { s.add(ka); s.add(kb); } }); return s; }
  function countViolations() { let v = 0; state.pairs.forEach(([a, b]) => { const ka = seatOfStudent(a), kb = seatOfStudent(b); if (ka && kb && adjacent(ka, kb)) v++; }); return v; }
  function movedInfo() { const arr = []; if (!state.compareOn || !state.previous) return arr; const prevById = {}; for (const k in state.previous) prevById[state.previous[k]] = k; for (const k in state.assignment) { const id = state.assignment[k], pk = prevById[id]; if (pk && pk !== k && isValidSeat(pk)) arr.push({ id, from: pk, to: k }); } return arr; }

  /* ───── 스냅샷 / 백업 (원본 그대로 + 개수 제한) ───── */
  function saveSnapshot() {
    const now = new Date();
    const name = now.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) + " " + now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    state.snapshots.unshift({ id: Date.now(), name, date: now.toISOString(), assignment: { ...state.assignment }, rows: state.rows, cols: state.cols, deskSeats: state.deskSeats, layout: state.layout, freePos: JSON.parse(JSON.stringify(state.freePos)) });
    if (state.snapshots.length > SNAP_MAX) state.snapshots.length = SNAP_MAX;
    return name;
  }
  function loadSnapshot(id) {
    const s = state.snapshots.find(x => x.id === id); if (!s) return;
    state.rows = s.rows; state.cols = s.cols; state.deskSeats = s.deskSeats; state.layout = s.layout;
    state.assignment = { ...s.assignment }; if (s.freePos) state.freePos = JSON.parse(JSON.stringify(s.freePos));
    normalize(); selectedSeat = null;
  }
  function download(name, text) {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportClass(rec) {
    const s = rec.s;
    const safe = (s.className || "좌석배치").replace(/[\\/:*?"<>|]/g, "_");
    download(safe + "_" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(s, null, 2));
    toast("JSON 파일로 내보냈어요");
  }
  function importFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("파일이 너무 커요(2MB까지).", "error"); return; }
    const r = new FileReader();
    r.onload = () => {
      let obj;
      try { obj = JSON.parse(r.result); } catch (e) { toast("불러오기 실패: 올바른 JSON 파일이 아니에요.", "error"); return; }
      const list = isObj(obj) && Array.isArray(obj.classes) ? obj.classes.map(c => isObj(c) && c.s ? c.s : c) : [obj];
      const base = file.name.replace(/\.json$/i, "").replace(/_\d{4}-\d{2}-\d{2}$/, "").slice(0, 30);
      const added = [];
      for (const o of list) {
        const s = sanitizeState(o);
        if (!s) continue;
        if (!s.className) s.className = base || "불러온 학급";
        withState(s, normalize);
        const rec = newClassRecord(s);
        db.classes.push(rec); added.push(rec);
      }
      if (!added.length) { toast("불러오기 실패: 자리 배치 백업 파일이 아니에요.", "error"); return; }
      saveDb();
      toast(added.length === 1 ? `‘${added[0].s.className}’ 학급을 불러왔어요` : `학급 ${added.length}개를 불러왔어요`);
      if (added.length === 1) openClass(added[0].id); else renderList();
    };
    r.onerror = () => toast("파일을 읽지 못했어요.", "error");
    r.readAsText(file);
  }

  /* ───── 되돌리기 ───── */
  function undoSnapshot() { const o = { ...state }; delete o.snapshots; return JSON.stringify(o); }
  function pushUndo() { undoStack.push(undoSnapshot()); if (undoStack.length > UNDO_MAX) undoStack.shift(); }
  function undo() {
    if (!undoStack.length) { announce("되돌릴 작업이 없어요"); toast("되돌릴 작업이 없어요"); return; }
    const prev = JSON.parse(undoStack.pop());
    const restored = Object.assign(defaultStateRaw(), prev, { snapshots: state.snapshots, className: state.className });
    cur.s = state = restored;
    normalize();
    selectedSeat = null; selectedStudent = null;
    commit();
    announce("되돌렸어요");
    toast("되돌렸어요 ↶", 1500);
  }

  /* 상태를 바꾸는 동작은 모두 이 함수를 거친다: 되돌리기 저장 → 실행 → 정규화 → 저장·렌더 */
  function act(fn, opts) {
    opts = opts || {};
    if (opts.undo !== false) pushUndo();
    const r = fn();
    normalize();
    commit();
    if (opts.say) announce(opts.say);
    return r;
  }
  function commit() { cur.updated = Date.now(); saveDb(); render(); }

  /* ───── 알림 (aria-live) ───── */
  function announce(msg) {
    const el = $("sb-live"); if (!el) return;
    el.textContent = "";
    setTimeout(() => { el.textContent = msg; }, 30);
  }

  /* ───── 이름 글자 크기 (인쇄·발표용): 자리 칸에 맞춰 최대한 크게 ───── */
  function nameUnits(name) {
    let u = 0;
    for (const ch of name) {
      if (/[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿]/.test(ch)) u += 1;
      else if (ch === " ") u += 0.3;
      else if (/[A-Z0-9MW]/.test(ch)) u += 0.68;
      else u += 0.56;
    }
    return Math.max(u, 1.6);
  }
  function fitFont(name, w, h) {
    const fs = Math.min(h * 0.5, (w * 0.86) / nameUnits(name), 64);
    return Math.max(10, Math.floor(fs));
  }

  /* ═════════════ 렌더 ═════════════ */
  function center(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  function seatLabel(key) { const [r, c] = key.split("-").map(Number); return (r + 1) + "행 " + (c + 1) + "열"; }
  function seatAria(key) {
    const id = state.assignment[key], st = id != null ? studentById(id) : null;
    let s = seatLabel(key) + " " + (st ? st.name : "빈자리");
    if (st && st.pinnedSeat === key) s += ", 자리 고정";
    if (st && st.frontFix) s += ", 앞줄 우선";
    if (violSet.has(key)) s += ", 분리 위반";
    return s;
  }

  function render() {
    if (!state) return;
    renderToolbar();
    renderDrawer();
    renderCanvas();
    renderStatus();
  }

  function renderCanvas() {
    const canvas = $("sb-canvas");
    const hadFocus = canvas.contains(document.activeElement);
    canvas.innerHTML = "";
    canvas.classList.toggle("layout-free", state.layout === "free");
    if (state.layout === "free") ensureFreePos();
    const { xs, seatW } = colXs(), { ys, seatH } = rowYs(seatW);
    violSet = violationSeats();
    const moves = movedInfo(); movedToSet = new Set(moves.map(m => m.to));
    if (selectedSeat && (!isValidSeat(selectedSeat) || state.assignment[selectedSeat] == null)) selectedSeat = null;

    const board = document.createElement("div");
    board.className = "board " + (state.view === "student" ? "top" : "bottom");
    board.setAttribute("aria-hidden", "true");
    board.innerHTML = '<div class="chalk">칠판</div><div class="podium">교탁</div>';
    canvas.appendChild(board);

    const keys = seatKeys();
    if (!focusKey || !isValidSeat(focusKey)) focusKey = sortSeatsFront(keys)[0] || null;
    // 화면 순서(위→아래, 왼→오른)대로 DOM에 넣어 Tab·낭독 순서를 자연스럽게
    const rects = keys.map(k => ({ k, r: seatRect(k, xs, seatW, ys, seatH) }));
    rects.sort((a, b) => (a.r.y - b.r.y) || (a.r.x - b.r.x));
    for (const { k, r } of rects) canvas.appendChild(seatEl(k, r));

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 700"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true"); svg.classList.add("arrows");
    let inner = '<defs><marker id="sc-ah" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#16a34a"/></marker></defs>';
    moves.forEach(m => { const a = center(seatRect(m.from, xs, seatW, ys, seatH)), b = center(seatRect(m.to, xs, seatW, ys, seatH)); inner += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#16a34a" stroke-width="3" marker-end="url(#sc-ah)" opacity="0.85"/>`; });
    svg.innerHTML = inner; canvas.appendChild(svg);

    $("sb-empty").hidden = state.students.length > 0;
    fitCanvas();
    if (hadFocus && focusKey) { const el = seatButton(focusKey); if (el) el.focus({ preventScroll: true }); }
  }
  function seatButton(key) { return $("sb-canvas").querySelector('.seat[data-key="' + key + '"]'); }

  function seatEl(key, r) {
    const id = state.assignment[key];
    const st = id != null ? studentById(id) : null;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "seat " + (st ? "occupied" : "empty");
    b.dataset.key = key;
    if (violSet.has(key)) b.classList.add("violation");
    if (selectedSeat === key) b.classList.add("selected");
    if (st && st.pinnedSeat === key) b.classList.add("pinned");
    if (movedToSet.has(key)) b.classList.add("moved");
    b.style.left = r.x + "px"; b.style.top = r.y + "px"; b.style.width = r.w + "px"; b.style.height = r.h + "px";
    b.tabIndex = key === focusKey ? 0 : -1;
    b.setAttribute("aria-label", seatAria(key));
    b.setAttribute("aria-pressed", selectedSeat === key ? "true" : "false");
    if (st) {
      const g = st.gender === "M" ? "m" : st.gender === "F" ? "f" : "n";
      b.style.setProperty("--pfs", fitFont(st.name, r.w, r.h) + "px");
      b.innerHTML = `<span class="gdot ${g}" aria-hidden="true"></span><span class="sname" aria-hidden="true">${escapeHtml(st.name)}</span>` +
        (st.pinnedSeat === key ? '<span class="pin" aria-hidden="true">📌</span>' : "") + (st.frontFix ? '<span class="ff" aria-hidden="true">앞</span>' : "");
    }
    return b;
  }

  function fitCanvas() {
    const wrap = $("sb-wrap"), stage = $("sb-stage"), canvas = $("sb-canvas");
    if (!wrap.clientWidth) return;
    const present = $("view-board").classList.contains("present");
    const pad = present ? 12 : (wrap.clientWidth < 600 ? 10 : 24);
    const aw = wrap.clientWidth - pad * 2, ah = wrap.clientHeight - pad * 2;
    let sc = Math.min(aw / W, ah / H);
    sc = Math.max(0.2, Math.min(sc, 2.4));
    canvas.style.transform = "scale(" + sc + ")";
    stage.style.width = (W * sc) + "px"; stage.style.height = (H * sc) + "px";
  }

  function renderToolbar() {
    const name = $("sb-name"); if (document.activeElement !== name) name.value = state.className;
    const setSeg = (id, v) => document.querySelectorAll("#" + id + " button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === String(v))));
    setSeg("seg-layout", state.layout); setSeg("seg-desk", state.deskSeats); setSeg("seg-view", state.view);
    $("cols-val").textContent = state.cols; $("rows-val").textContent = state.rows;
    $("cols-dec").disabled = state.cols <= 1; $("cols-inc").disabled = state.cols >= 6;
    $("rows-dec").disabled = state.rows <= 1; $("rows-inc").disabled = state.rows >= 10;
    $("sb-compare").setAttribute("aria-pressed", String(!!state.compareOn));
    $("sb-undo").disabled = !undoStack.length;
    $("sb-undo").title = undoStack.length ? `되돌리기 (Ctrl+Z) · ${undoStack.length}단계` : "되돌릴 작업 없음";
  }

  function renderStatus() {
    const seats = state.rows * totalCols(), M = state.students.length, assigned = Object.keys(state.assignment).length, un = M - assigned;
    $("st-counts").innerHTML = `좌석 ${seats} · 학생 <b>${M}</b>명 · 배정 ${assigned} · 미배치 ${un}` + (M > seats ? ` <b style="color:var(--danger)">(자리 ${M - seats}개 부족)</b>` : "");
    const v = countViolations(), vel = $("st-viol");
    if (v > 0) { vel.textContent = "⚠ 분리 위반 " + v + "건"; vel.className = "bad"; }
    else { vel.textContent = "분리 위반 0건"; vel.className = "good"; }
    const prevEl = $("st-prev");
    if (state.avoidPrev && baseline()) { const n = countPrevMates(state.assignment, prevMateSet()); prevEl.textContent = "이전 짝 다시 " + n + "쌍"; }
    else prevEl.textContent = "";
    const touch = isTouchish(lastPointer.type);
    $("st-hint").textContent = state.layout === "free"
      ? "책상을 끌어 자유롭게 옮기기 · 자리 누르고 다른 자리 눌러 교환 · " + (touch ? "길게 누르면 메뉴" : "오른쪽 클릭 메뉴")
      : "학생을 자리로 끌어 놓기 · 자리 누르고 다른 자리 눌러 교환 · " + (touch ? "길게 누르면 메뉴" : "오른쪽 클릭 메뉴");
    const viewName = state.view === "teacher" ? "교사 시점" : "학생 시점";
    $("sb-print-title").textContent = `${state.className || "우리 반"} · ${viewName} · ${new Date().toLocaleDateString("ko-KR")} · ${assigned}명`;
  }

  /* ───── 서랍 ───── */
  function renderDrawer() {
    document.querySelectorAll(".dr-tabs [role=tab]").forEach(b => {
      const on = b.dataset.tab === activeTab;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    });
    const p = $("sb-panel");
    p.setAttribute("aria-labelledby", "tab-" + activeTab);
    const ae = document.activeElement;
    const fk = ae && p.contains(ae) ? ae.getAttribute("data-fk") : null;
    const scroll = p.scrollTop;
    if (activeTab === "roster") p.innerHTML = buildRoster();
    else if (activeTab === "constraints") p.innerHTML = buildConstraints();
    else p.innerHTML = buildStorage();
    p.scrollTop = scroll;
    if (fk) { const el = p.querySelector('[data-fk="' + fk + '"]'); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  }
  const GRIP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>';
  function buildRoster() {
    const un = new Set(unassignedStudents().map(s => s.id));
    const rows = state.students.map(s => {
      const g = s.gender === "M" ? "m" : s.gender === "F" ? "f" : "n", assigned = !un.has(s.id), gName = s.gender === "M" ? "남" : s.gender === "F" ? "여" : "모름";
      const seat = assigned ? seatOfStudent(s.id) : null;
      return `<div class="srow ${assigned ? "" : "un"} ${selectedStudent === s.id ? "picked" : ""}" data-id="${s.id}">
        <span class="grip" data-drag="1" aria-hidden="true" title="끌어서 자리에 놓기">${GRIP}</span>
        <span class="seq">${s.seq}</span>
        <button type="button" class="gbtn ${g}" data-action="gender" data-id="${s.id}" data-fk="g${s.id}" title="성별: ${gName} (눌러서 바꾸기)" aria-label="${escapeHtml(s.name)} 성별 ${gName}, 바꾸기"></button>
        <button type="button" class="rname" data-action="pick" data-id="${s.id}" data-fk="n${s.id}" aria-pressed="${selectedStudent === s.id}" title="${escapeHtml(s.name)} — 끌어서 놓거나, 누른 뒤 자리를 누르세요" aria-label="${escapeHtml(s.name)}, ${assigned ? seatLabel(seat) : "미배치"}. 눌러서 고른 뒤 앉힐 자리를 누르세요">${escapeHtml(s.name)}</button>
        <button type="button" class="tag" data-action="front" data-id="${s.id}" data-fk="f${s.id}" aria-pressed="${!!s.frontFix}" title="앞줄 우선" aria-label="${escapeHtml(s.name)} 앞줄 우선">앞</button>
        <button type="button" class="tag" data-action="pin" data-id="${s.id}" data-fk="p${s.id}" aria-pressed="${!!s.pinnedSeat}" title="좌석 고정" aria-label="${escapeHtml(s.name)} 좌석 고정" ${assigned ? "" : "disabled"}>핀</button>
      </div>`;
    }).join("");
    return `<div class="psec">
        <div class="prow"><button type="button" class="sc-btn block" data-action="editroster" data-fk="editroster">📝 명부 일괄 편집</button></div>
        ${state.students.length ? "" : '<div class="prow"><button type="button" class="sc-btn block" data-action="sample" data-fk="sample">예시 명단 넣기 (가상의 이름)</button></div>'}
        <div class="prow two"><button type="button" class="sc-btn" data-action="fill" data-fk="fill">빈자리 채우기</button><button type="button" class="sc-btn" data-action="clearfill" data-fk="clearfill">비우고 채우기</button></div>
        <div class="muted small">미배치 <b>${un.size}</b>명 · 총 ${state.students.length}명 ${selectedStudent != null ? "· <b style='color:var(--primary)'>앉힐 자리를 누르세요</b>" : ""}</div>
      </div>
      <div class="rlist">${rows || '<div class="muted small">명단이 비어 있어요.</div>'}</div>
      ${state.students.length ? '<div class="psec" style="margin-top:12px"><button type="button" class="sc-btn sm danger block" data-action="clear" data-fk="clear">전체 비우기</button></div>' : ""}`;
  }
  function buildConstraints() {
    const opts = state.students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    const pairs = state.pairs.map((p, i) => { const a = studentById(p[0]), b = studentById(p[1]); return `<div class="pairrow"><span>${escapeHtml(a ? a.name : "?")} ↔ ${escapeHtml(b ? b.name : "?")}</span><button type="button" class="x" data-action="pair-del" data-i="${i}" aria-label="${escapeHtml(a ? a.name : "?")}·${escapeHtml(b ? b.name : "?")} 쌍 지우기">✕</button></div>`; }).join("") || '<div class="muted small">설정된 쌍이 없어요.</div>';
    const b = baseline();
    const prevNote = b ? `기준: <b>${escapeHtml(b.label)}</b>` : "기준이 아직 없어요. 랜덤 배치 때 <b>지금 배치</b>를 기준으로 저장해서 피해요.";
    return `<div class="psec">
        <h3>떨어뜨릴 학생 쌍</h3>
        <div class="muted small" style="margin-bottom:8px">두 학생이 앞뒤·옆으로 붙지 않게 해요. 랜덤 배치 때 피하고, 붙어 있으면 빨갛게 표시돼요.</div>
        <div class="prow"><select class="sc-sel" id="pair-a" aria-label="첫째 학생">${opts}</select><span class="amp" aria-hidden="true">↔</span><select class="sc-sel" id="pair-b" aria-label="둘째 학생">${opts}</select></div>
        <div class="prow"><button type="button" class="sc-btn block" data-action="pair-add" data-fk="pair-add" ${state.students.length < 2 ? "disabled" : ""}>쌍 추가</button></div>
        <div class="pairlist">${pairs}</div>
      </div>
      <div class="psec">
        <h3>이전 짝 피하기</h3>
        <label class="check"><input type="checkbox" id="ap-check" data-fk="ap" ${state.avoidPrev ? "checked" : ""}> 이전에 옆자리(2인 책상은 짝)였던 학생끼리 다시 붙지 않게 랜덤 배치해요.</label>
        <div class="muted small" style="margin:4px 0 0 24px">${prevNote}<br>비교 기준이 없으면 최근 저장 배치를 써요.</div>
      </div>
      <div class="psec">
        <h3>성별 균형</h3>
        <label class="check"><input type="checkbox" id="gb-check" data-fk="gb" ${state.genderBalance ? "checked" : ""}> 랜덤 배치 때 분단마다 남녀 수를 비슷하게 맞춰요.</label>
      </div>
      <div class="psec">
        <h3>앞줄 우선 · 좌석 고정</h3>
        <div class="muted small">명단 탭에서 학생마다 <b>앞</b>(앞줄 우선) · <b>핀</b>(지금 자리 고정)을 켜세요. 자리를 오른쪽 클릭하거나 길게 눌러도 고정할 수 있어요.</div>
      </div>`;
  }
  function buildStorage() {
    const snaps = state.snapshots.map(s => `<div class="snap"><div class="sinfo"><b>${escapeHtml(s.name)}</b><span class="muted small">${Object.keys(s.assignment).length}명 · ${s.cols}분단 ${s.rows}줄 · ${s.layout === "free" ? "자유" : "분단"}</span></div><div class="sbtns"><button type="button" class="sc-btn sm" data-action="snap-load" data-id="${s.id}" data-fk="sl${s.id}">불러오기</button><button type="button" class="sc-btn sm" data-action="snap-base" data-id="${s.id}" data-fk="sb${s.id}">비교 기준</button><button type="button" class="sc-btn sm danger" data-action="snap-del" data-id="${s.id}" aria-label="${escapeHtml(s.name)} 삭제">삭제</button></div></div>`).join("") || '<div class="muted small">저장된 배치가 없어요.</div>';
    return `<div class="psec">
        <h3>배치 저장</h3>
        <div class="prow"><button type="button" class="sc-btn primary block" data-action="snap-save" data-fk="snap-save">＋ 현재 배치 저장</button></div>
        <div class="snaplist">${snaps}</div>
      </div>
      <div class="psec">
        <h3>JSON 백업</h3>
        <div class="prow two"><button type="button" class="sc-btn" data-action="export" data-fk="export">내보내기</button><button type="button" class="sc-btn" data-action="import-trigger" data-fk="import">불러오기</button></div>
        <div class="muted small" style="margin-top:4px">명단·제약·저장 배치·설정이 모두 들어가요. 불러온 파일은 <b>새 학급</b>으로 추가돼요(원본 자리 배치 앱 백업도 돼요).</div>
      </div>
      <div class="psec">
        <h3>저장 위치</h3>
        <div class="muted small">이 학급은 이 기기의 브라우저에만 저장돼요. 브라우저 기록을 지우면 사라질 수 있으니 가끔 내보내기 해 두세요.</div>
      </div>`;
  }

  function onPanelClick(e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    if (performance.now() < suppressClickUntil) return;
    const a = el.dataset.action, id = el.dataset.id ? parseInt(el.dataset.id, 10) : null;
    if (a === "gender") { act(() => { const s = studentById(id); s.gender = s.gender === "M" ? "F" : s.gender === "F" ? null : "M"; }); }
    else if (a === "front") { act(() => { const s = studentById(id); s.frontFix = !s.frontFix; }); }
    else if (a === "pin") { const s = studentById(id), seat = seatOfStudent(id); if (seat) act(() => { s.pinnedSeat = s.pinnedSeat === seat ? null : seat; }, { say: s.name + (s.pinnedSeat ? " 자리 고정 해제" : " 자리 고정") }); }
    else if (a === "pick") {
      selectedStudent = selectedStudent === id ? null : id; selectedSeat = null;
      renderDrawer(); renderCanvas();
      const s = studentById(id);
      if (selectedStudent != null) { announce(s.name + " 선택됨. 앉힐 자리를 누르세요."); if (window.innerWidth < 900) setDrawer(false); }
      else announce("선택을 취소했어요");
    }
    else if (a === "fill") act(fillEmpty, { say: "빈자리를 채웠어요" });
    else if (a === "clearfill") act(clearAndFill, { say: "비우고 번호순으로 채웠어요" });
    else if (a === "clear") doClear();
    else if (a === "editroster") openRoster();
    else if (a === "sample") insertSample();
    else if (a === "pair-add") {
      const av = +$("pair-a").value, bv = +$("pair-b").value;
      if (!av || !bv || av === bv) { toast("서로 다른 두 학생을 고르세요"); return; }
      if (state.pairs.some(p2 => (p2[0] === av && p2[1] === bv) || (p2[0] === bv && p2[1] === av))) { toast("이미 있는 쌍이에요"); return; }
      act(() => state.pairs.push([av, bv]), { say: "떨어뜨릴 쌍을 추가했어요" });
    }
    else if (a === "pair-del") act(() => state.pairs.splice(+el.dataset.i, 1), { say: "쌍을 지웠어요" });
    else if (a === "snap-save") { const n = saveSnapshot(); commit(); toast("배치를 저장했어요 · " + n); }
    else if (a === "snap-load") { act(() => loadSnapshot(parseInt(el.dataset.id, 10))); toast("저장 배치를 불러왔어요 · 되돌리기 가능"); }
    else if (a === "snap-base") { const s = state.snapshots.find(x => x.id === parseInt(el.dataset.id, 10)); if (s) { act(() => { state.previous = { ...s.assignment }; state.prevDesk = s.deskSeats; state.compareOn = true; }); toast("비교 기준으로 정했어요"); } }
    else if (a === "snap-del") { const sid = parseInt(el.dataset.id, 10); confirmDialog({ title: "저장 배치 삭제", msg: "이 저장 배치를 지울까요?", ok: "삭제", danger: true }).then(ok => { if (ok) { state.snapshots = state.snapshots.filter(x => x.id !== sid); commit(); } }); }
    else if (a === "export") exportClass(cur);
    else if (a === "import-trigger") $("sl-file").click();
  }
  function onPanelChange(e) {
    if (e.target.id === "gb-check") { act(() => { state.genderBalance = e.target.checked; }); }
    else if (e.target.id === "ap-check") { act(() => { state.avoidPrev = e.target.checked; }); }
  }

  /* ───── 학급 동작 ───── */
  function insertSample() {
    act(() => { state.rosterText = SAMPLE; state.students = parseRoster(SAMPLE, state.students.length ? state.students : []); clearAndFill(); });
    toast("가상의 예시 명단 20명을 넣었어요");
  }
  function doRandom() {
    if (!state.students.length) { toast("먼저 명단을 넣어 주세요"); return; }
    const r = act(randomPlace);
    let msg = "랜덤으로 배치했어요";
    if (r.v) msg += ` · 분리 위반 ${r.v}건 남음(자리가 부족해요)`;
    if (r.autoBase) msg += " · 지금 배치를 비교 기준으로 저장했어요";
    else if (state.avoidPrev && r.p) msg += ` · 이전 짝 ${r.p}쌍은 피하지 못했어요`;
    msg += isTouchish(lastPointer.type) ? " · ↶로 되돌리기" : " · Ctrl+Z로 되돌리기";
    toast(msg);
    announce("랜덤으로 배치했어요");
  }
  function doClear() {
    if (!Object.keys(state.assignment).length) { toast("비울 자리가 없어요"); return; }
    act(() => { state.assignment = {}; state.students.forEach(s => s.pinnedSeat = null); selectedSeat = null; });
    toast("모든 자리를 비웠어요 · 되돌리기 가능");
    announce("모든 자리를 비웠어요");
  }
  function doBaseline() {
    act(() => { state.previous = { ...state.assignment }; state.prevDesk = state.deskSeats; state.compareOn = true; });
    toast("지금 배치를 비교 기준으로 저장했어요");
  }
  function doCompare() {
    if (!state.previous) { toast("먼저 ‘기준 저장’을 눌러 주세요"); return; }
    act(() => { state.compareOn = !state.compareOn; }, { undo: false });
    announce(state.compareOn ? "이동 비교를 켰어요" : "이동 비교를 껐어요");
  }
  function doRestore() {
    if (!state.previous) { toast("저장된 비교 기준이 없어요"); return; }
    act(() => { state.assignment = { ...state.previous }; selectedSeat = null; });
    toast("기준 배치로 되돌렸어요");
  }

  /* 그리드 변경 (원본 그대로 + 되돌리기) */
  function setLayout(l) { if (l === state.layout) return; act(() => { state.layout = l; if (l === "free") ensureFreePos(); selectedSeat = null; }); }
  function setDeskSeats(n) { if (n === state.deskSeats) return; act(() => { const oldTotal = state.cols * state.deskSeats; const nc = Math.max(1, Math.min(6, Math.round(oldTotal / n))); state.deskSeats = n; state.cols = nc; state.freePos = {}; selectedSeat = null; }); }
  function setCols(n) { n = Math.max(1, Math.min(6, n)); if (n === state.cols) return; act(() => { state.cols = n; state.freePos = {}; selectedSeat = null; }); }
  function setRows(n) { n = Math.max(1, Math.min(10, n)); if (n === state.rows) return; act(() => { state.rows = n; selectedSeat = null; }); }
  function setView(v) { if (v === state.view) return; act(() => { state.view = v; selectedSeat = null; }); }

  /* ═════════════ 자리 클릭 / 선택 교환 ═════════════ */
  function nameAt(key) { const id = state.assignment[key]; const s = id != null ? studentById(id) : null; return s ? s.name : null; }
  function onSeatClick(key) {
    if (selectedStudent != null) {
      const s = studentById(selectedStudent);
      selectedStudent = null;
      if (s) { act(() => placeStudentInSeat(s.id, key), { say: `${s.name}, ${seatLabel(key)}에 앉혔어요` }); }
      return;
    }
    if (selectedSeat === null) {
      if (state.assignment[key] != null) { selectedSeat = key; renderCanvas(); announce(`${seatLabel(key)} ${nameAt(key)} 선택. 바꿀 자리를 고르세요.`); }
      else announce(`${seatLabel(key)} 빈자리`);
    } else if (selectedSeat === key) {
      selectedSeat = null; renderCanvas(); announce("선택을 취소했어요");
    } else {
      const a = selectedSeat, na = nameAt(a), nb = nameAt(key);
      selectedSeat = null;
      act(() => swapSeats(a, key), { say: nb ? `${na}, ${nb} 자리를 바꿨어요` : `${na}, ${seatLabel(key)}로 옮겼어요` });
    }
  }

  /* ═════════════ 포인터: 끌어 놓기·길게 누르기 ═════════════ */
  function toLogical(x, y) { const r = $("sb-canvas").getBoundingClientRect(); return { x: (x - r.left) / r.width * W, y: (y - r.top) / r.height * H }; }
  function seatAtPoint(x, y) { const el = document.elementFromPoint(x, y); const s = el && el.closest ? el.closest("#sb-canvas .seat") : null; return s; }
  function makeGhost(text, x, y) { const g = document.createElement("div"); g.className = "sc-ghost"; g.textContent = text; document.body.appendChild(g); moveGhost(g, x, y); return g; }
  function moveGhost(g, x, y) { g.style.left = x + "px"; g.style.top = y + "px"; }
  function setDragOver(el) {
    if (gesture.over === el) return;
    if (gesture.over) gesture.over.classList.remove("dragover");
    gesture.over = el; if (el) el.classList.add("dragover");
  }

  function onCanvasPointerDown(e) {
    lastPointer = { type: e.pointerType || "mouse", t: performance.now() };
    const seat = e.target.closest(".seat"); if (!seat) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (gesture) endGesture(true);
    closePop();
    const key = seat.dataset.key;
    gesture = { kind: "seat", key, el: seat, id: e.pointerId, type: e.pointerType || "mouse", sx: e.clientX, sy: e.clientY, started: false, long: false, over: null };
    if (isTouchish(gesture.type)) {
      gesture.timer = setTimeout(() => {
        if (!gesture || gesture.started || gesture.key !== key) return;
        gesture.long = true;
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) { /* 무시 */ }
        const r = seat.getBoundingClientRect();
        openSeatMenu(key, gesture.sx, Math.max(gesture.sy, r.top + 10));
      }, LONG_PRESS_MS);
    }
    try { seat.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    window.addEventListener("pointermove", onGestureMove);
    window.addEventListener("pointerup", onGestureUp);
    window.addEventListener("pointercancel", onGestureCancel);
  }
  function onRosterPointerDown(e) {
    lastPointer = { type: e.pointerType || "mouse", t: performance.now() };
    const row = e.target.closest(".srow"); if (!row) return;
    const onGrip = !!e.target.closest(".grip"), onName = !!e.target.closest(".rname");
    if (e.pointerType === "mouse") { if (e.button !== 0 || !(onGrip || onName)) return; }
    else if (!onGrip) return;   // 터치는 손잡이로만 끌기(나머지는 목록 스크롤)
    if (gesture) endGesture(true);
    const id = parseInt(row.dataset.id, 10), st = studentById(id); if (!st) return;
    gesture = { kind: "student", sid: id, name: st.name, row, id: e.pointerId, type: e.pointerType || "mouse", sx: e.clientX, sy: e.clientY, started: false, over: null };
    if (onGrip) e.preventDefault();
    window.addEventListener("pointermove", onGestureMove);
    window.addEventListener("pointerup", onGestureUp);
    window.addEventListener("pointercancel", onGestureCancel);
  }
  function onGestureMove(e) {
    const g = gesture; if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy, dist = Math.hypot(dx, dy);
    if (!g.started) {
      if (g.long) return;
      if (dist < (g.type === "mouse" ? 5 : 9)) return;
      clearTimeout(g.timer);
      g.started = true;
      if (g.kind === "seat") {
        if (state.layout === "free") {
          pushUndo();
          g.start = toLogical(g.sx, g.sy);
          g.orig = { x: parseFloat(g.el.style.left), y: parseFloat(g.el.style.top) };
        } else if (state.assignment[g.key] != null) {
          g.ghost = makeGhost(nameAt(g.key), e.clientX, e.clientY);
          g.el.classList.add("dragging");
        } else { g.dead = true; }
      } else {
        g.ghost = makeGhost(g.name, e.clientX, e.clientY);
        if (window.innerWidth < 900) $("sb-drawer").classList.add("peek");
      }
    }
    if (g.dead) return;
    e.preventDefault();
    if (g.kind === "seat" && state.layout === "free") {
      const p = toLogical(e.clientX, e.clientY);
      const w = g.el.offsetWidth, h = g.el.offsetHeight;
      const nx = Math.max(0, Math.min(W - w, g.orig.x + p.x - g.start.x)), ny = Math.max(0, Math.min(H - h, g.orig.y + p.y - g.start.y));
      g.el.style.left = nx + "px"; g.el.style.top = ny + "px";
      state.freePos[g.key] = { x: nx, y: ny };
      return;
    }
    if (g.ghost) moveGhost(g.ghost, e.clientX, e.clientY);
    const target = seatAtPoint(e.clientX, e.clientY);
    setDragOver(target && !(g.kind === "seat" && target.dataset.key === g.key) ? target : null);
  }
  function onGestureUp(e) {
    const g = gesture; if (!g || e.pointerId !== g.id) return;
    clearTimeout(g.timer);
    if (g.long) { suppressClickUntil = performance.now() + 250; endGesture(false); return; }
    if (!g.started) {
      endGesture(false);
      // 터치 탭은 여기서 바로 처리(빠른 연속 탭에서 브라우저가 click을 빼먹는 경우가 있어서). 마우스·키보드는 click이 처리
      if (g.kind === "seat" && isTouchish(g.type)) { suppressClickUntil = performance.now() + 350; focusKey = g.key; onSeatClick(g.key); }
      return;
    }
    suppressClickUntil = performance.now() + 250;
    const over = g.over;
    endGesture(false);
    if (g.dead) return;
    if (g.kind === "seat" && state.layout === "free") { commit(); announce("책상을 옮겼어요"); return; }
    if (!over) return;
    const to = over.dataset.key;
    if (g.kind === "seat") {
      const na = nameAt(g.key), nb = nameAt(to);
      selectedSeat = null;
      act(() => swapSeats(g.key, to), { say: nb ? `${na}, ${nb} 자리를 바꿨어요` : `${na}, ${seatLabel(to)}로 옮겼어요` });
    } else {
      selectedStudent = null;
      act(() => placeStudentInSeat(g.sid, to), { say: `${g.name}, ${seatLabel(to)}에 앉혔어요` });
    }
  }
  function onGestureCancel(e) {
    const g = gesture; if (!g || e.pointerId !== g.id) return;
    if (g.started && g.kind === "seat" && state.layout === "free") { // 위치 원래대로
      if (undoStack.length) undoStack.pop();
      state.freePos[g.key] = g.orig; endGesture(false); renderCanvas(); return;
    }
    endGesture(false);
  }
  function endGesture() {
    const g = gesture; if (!g) return;
    clearTimeout(g.timer);
    if (g.ghost) g.ghost.remove();
    if (g.over) g.over.classList.remove("dragover");
    if (g.el) { g.el.classList.remove("dragging"); try { g.el.releasePointerCapture(g.id); } catch (er) { /* 무시 */ } }
    $("sb-drawer").classList.remove("peek");
    window.removeEventListener("pointermove", onGestureMove);
    window.removeEventListener("pointerup", onGestureUp);
    window.removeEventListener("pointercancel", onGestureCancel);
    gesture = null;
  }

  /* ═════════════ 팝업 메뉴 (자리 메뉴·더보기·카드 메뉴) ═════════════ */
  function placePop(el, x, y) {
    el.hidden = false;
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
    el.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + "px";
  }
  function showPop(el, x, y, anchor) {
    closePop();
    placePop(el, x, y);
    openPop = { el, anchor };
    if (anchor && anchor.hasAttribute("aria-expanded")) anchor.setAttribute("aria-expanded", "true");
    const first = el.querySelector("button:not([disabled])"); if (first) first.focus({ preventScroll: true });
  }
  function closePop(restore) {
    if (!openPop) return;
    const { el, anchor } = openPop;
    el.hidden = true; openPop = null;
    if (anchor && anchor.hasAttribute("aria-expanded")) anchor.setAttribute("aria-expanded", "false");
    if (restore && anchor && document.contains(anchor)) anchor.focus({ preventScroll: true });
  }
  function popKeydown(e) {
    if (!openPop || !openPop.el.contains(e.target)) return;
    const items = [...openPop.el.querySelectorAll("button:not([disabled])")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(true); }
    else if (e.key === "Tab") { closePop(true); }
  }

  function openSeatMenu(key, x, y) {
    const m = $("sb-menu");
    const id = state.assignment[key], st = id != null ? studentById(id) : null, un = unassignedStudents();
    let h = `<div class="phead">${seatLabel(key)} · ${st ? escapeHtml(st.name) : "빈자리"}</div>`;
    if (st) {
      h += `<button type="button" role="menuitem" data-m="select">↔ 다른 자리와 바꾸기</button>`;
      h += `<button type="button" role="menuitem" data-m="pin">📌 ${st.pinnedSeat === key ? "좌석 고정 해제" : "이 자리에 고정"}</button>`;
      h += `<button type="button" role="menuitem" data-m="front">${st.frontFix ? "앞줄 우선 끄기" : "앞줄 우선 켜기"}</button>`;
      h += `<button type="button" role="menuitem" data-m="empty">이 자리 비우기</button>`;
    }
    h += `<div class="pdiv"></div><div class="psub">미배치 학생 ${st ? "넣기(지금 학생은 미배치로)" : "넣기"}</div>`;
    h += un.length ? `<div class="plist">` + un.map(s => `<button type="button" role="menuitem" data-m="assign" data-id="${s.id}">${escapeHtml(s.name)}</button>`).join("") + `</div>` : `<div class="muted small" style="padding:4px 10px 6px">없음</div>`;
    m.innerHTML = h;
    m.setAttribute("aria-label", seatLabel(key) + " 메뉴");
    m.dataset.key = key;
    showPop(m, x, y, seatButton(key));
  }
  function onSeatMenuClick(e) {
    const b = e.target.closest("button[data-m]"); if (!b) return;
    const key = $("sb-menu").dataset.key, a = b.dataset.m;
    const id = state.assignment[key], st = id != null ? studentById(id) : null;
    closePop(false);
    focusKey = key;
    if (a === "empty") act(() => emptySeat(key), { say: `${seatLabel(key)}를 비웠어요` });
    else if (a === "pin" && st) act(() => { st.pinnedSeat = st.pinnedSeat === key ? null : key; }, { say: st.name + (st.pinnedSeat === key ? " 고정 해제" : " 자리 고정") });
    else if (a === "front" && st) act(() => { st.frontFix = !st.frontFix; });
    else if (a === "select") { selectedSeat = key; selectedStudent = null; renderCanvas(); announce(`${seatLabel(key)} ${st.name} 선택. 바꿀 자리를 고르세요.`); }
    else if (a === "assign") { const s = studentById(parseInt(b.dataset.id, 10)); act(() => placeStudentInSeat(s.id, key), { say: `${s.name}, ${seatLabel(key)}에 앉혔어요` }); }
    const el = seatButton(key); if (el) el.focus({ preventScroll: true });
  }

  /* ═════════════ 키보드 ═════════════ */
  function moveFocus(dir) {
    const curEl = document.activeElement && document.activeElement.closest(".seat"); if (!curEl) return;
    const r0 = curEl.getBoundingClientRect(), c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
    let best = null, bd = Infinity;
    for (const s of $("sb-canvas").querySelectorAll(".seat")) {
      if (s === curEl) continue;
      const r = s.getBoundingClientRect(), dx = r.left + r.width / 2 - c0.x, dy = r.top + r.height / 2 - c0.y;
      let main, cross;
      if (dir === "ArrowRight") { main = dx; cross = dy; } else if (dir === "ArrowLeft") { main = -dx; cross = dy; }
      else if (dir === "ArrowDown") { main = dy; cross = dx; } else { main = -dy; cross = dx; }
      if (main <= 2) continue;
      const d = main + Math.abs(cross) * 2.5;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) {
      curEl.tabIndex = -1; best.tabIndex = 0; focusKey = best.dataset.key; best.focus();
    }
  }
  function onCanvasKeydown(e) {
    const seat = e.target.closest(".seat"); if (!seat) return;
    const key = seat.dataset.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); moveFocus(e.key); }
    else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (state.assignment[key] != null) { const n = nameAt(key); act(() => emptySeat(key), { say: `${seatLabel(key)} ${n} 자리를 비웠어요` }); }
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const all = [...$("sb-canvas").querySelectorAll(".seat")];
      const t = e.key === "Home" ? all[0] : all[all.length - 1];
      if (t) { seat.tabIndex = -1; t.tabIndex = 0; focusKey = t.dataset.key; t.focus(); }
    }
  }
  function onCanvasFocusIn(e) { const s = e.target.closest(".seat"); if (s && s.dataset.key !== focusKey) { const old = seatButton(focusKey); if (old) old.tabIndex = -1; s.tabIndex = 0; focusKey = s.dataset.key; } }
  function onCanvasContextMenu(e) {
    const seat = e.target.closest(".seat"); if (!seat) return;
    e.preventDefault();
    // 터치 길게 누르기는 자체 타이머가 메뉴를 연다(브라우저 contextmenu는 무시)
    if (isTouchish(lastPointer.type) && performance.now() - lastPointer.t < 2000) return;
    let x = e.clientX, y = e.clientY;
    if (!x && !y) { const r = seat.getBoundingClientRect(); x = r.left + r.width / 2; y = r.bottom; }
    openSeatMenu(seat.dataset.key, x, y);
  }
  function onCanvasClick(e) {
    const seat = e.target.closest(".seat"); if (!seat) return;
    if (isTouchish(e.pointerType) || performance.now() < suppressClickUntil) return;   // 터치 탭은 pointerup에서 처리함
    focusKey = seat.dataset.key;
    onSeatClick(seat.dataset.key);
  }

  function anyModalOpen() { return !!document.querySelector(".sc-modal.open"); }
  function onGlobalKeydown(e) {
    if (!$("view-board").classList.contains("active") || anyModalOpen()) return;
    popKeydown(e);
    if (e.defaultPrevented) return;
    const typing = e.target.closest && e.target.closest("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "z" || e.key === "Z")) {
      if (typing) return;
      e.preventDefault(); undo(); return;
    }
    if (e.key === "Escape") {
      if (openPop) { closePop(true); return; }
      if ($("view-board").classList.contains("present")) { setPresent(false); return; }
      if (selectedSeat || selectedStudent != null) { selectedSeat = null; selectedStudent = null; render(); announce("선택을 취소했어요"); return; }
      if (window.innerWidth < 900 && !$("view-board").classList.contains("drawer-closed")) { setDrawer(false); }
    }
  }

  /* ═════════════ 보드 크롬: 서랍·발표·전체화면·설정 ═════════════ */
  function setDrawer(open) {
    $("view-board").classList.toggle("drawer-closed", !open);
    const b = $("sb-drawer-btn");
    b.setAttribute("aria-expanded", String(open));
    b.setAttribute("aria-label", open ? "서랍 닫기" : "서랍 열기");
    requestAnimationFrame(fitCanvas);
  }
  function setPresent(on) {
    closePop();
    $("view-board").classList.toggle("present", on);
    requestAnimationFrame(fitCanvas);
    if (on) { $("sb-present-exit").focus(); announce("발표 모드. Esc로 끝내요."); }
    else { $("sb-more-btn").focus(); }
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => toast("이 브라우저는 전체화면을 쓸 수 없어요"));
  }

  /* ═════════════ 모달 ═════════════ */
  const rosterModal = VUI ? VUI.modal.bind("#m-roster", { className: "open", backdropClose: true, initialFocus: "#roster-text" }) : null;
  function openRoster() { $("roster-text").value = state.rosterText || state.students.map(s => s.name + (s.gender === "M" ? " 남" : s.gender === "F" ? " 여" : "")).join("\n"); rosterModal.open(); }
  function applyRoster() {
    const text = $("roster-text").value;
    const wasEmpty = !Object.keys(state.assignment).length;
    act(() => {
      state.rosterText = text;
      state.students = parseRoster(text, state.students);
      normalize();
      if (wasEmpty) clearAndFill();
      selectedSeat = null; selectedStudent = null;
    });
    rosterModal.close();
    const un = unassignedStudents().length, seats = state.rows * totalCols();
    let msg = `명단을 적용했어요(${state.students.length}명)`;
    if (state.students.length > seats) msg += ` · 자리가 ${state.students.length - seats}개 모자라요. 줄이나 분단을 늘리세요`;
    else if (un) msg += ` · 미배치 ${un}명은 ‘빈자리 채우기’나 랜덤 배치로 앉히세요`;
    toast(msg + " · 되돌리기 가능");
  }

  let dlgResolve = null;
  const dlgModal = VUI ? VUI.modal.bind("#m-dialog", { className: "open", backdropClose: true, onClose: () => finishDialog(null) }) : null;
  function openDialog(o) {
    return new Promise(res => {
      dlgResolve = res;
      $("dlg-title").textContent = o.title;
      $("dlg-msg").textContent = o.msg || ""; $("dlg-msg").hidden = !o.msg;
      const inp = $("dlg-input");
      inp.hidden = !o.input; inp.value = o.value || ""; inp.placeholder = o.placeholder || "";
      const ok = $("dlg-ok"); ok.textContent = o.ok || "확인"; ok.classList.toggle("danger", !!o.danger); ok.classList.toggle("primary", !o.danger);
      dlgModal.open({ initialFocus: o.input ? "#dlg-input" : "#dlg-ok" });
      if (o.input) setTimeout(() => inp.select(), 10);
    });
  }
  function finishDialog(val) { const r = dlgResolve; dlgResolve = null; if (r) r(val); }
  function confirmDialog(o) { return openDialog(o).then(v => v !== null); }
  function promptDialog(o) { return openDialog(Object.assign({ input: true }, o)).then(v => v === null ? null : String(v).trim()); }

  /* ═════════════ 목록 화면 ═════════════ */
  function miniSvg(s) {
    const { xs, seatW } = colXs(s), { ys, seatH } = rowYs(seatW, s);
    let h = "";
    const by = s.view === "student" ? 18 : H - 40;
    h += `<rect x="270" y="${by}" width="460" height="22" rx="5" fill="#1f4d3a"/>`;
    for (const key of seatKeys(s)) {
      const r = seatRect(key, xs, seatW, ys, seatH, s);
      const occ = s.assignment[key] != null;
      h += `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" rx="9" style="fill:${occ ? "var(--primary)" : "none"};fill-opacity:${occ ? 0.55 : 0};stroke:var(--sc-line);stroke-width:3${occ ? "" : ";stroke-dasharray:8 6"}"/>`;
    }
    return `<svg viewBox="0 0 1000 700" aria-hidden="true" focusable="false">${h}</svg>`;
  }
  function renderList() {
    const el = $("sl-grid");
    const list = db.classes.slice().sort((a, b) => b.updated - a.updated);
    if (!list.length) { el.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:40px 0">학급이 없어요. ＋ 새 학급을 눌러 만들어 보세요.</p>'; return; }
    el.innerHTML = list.map((c, i) => {
      const s = c.s, n = s.students.length, a = Object.keys(s.assignment).length;
      const name = s.className || "이름 없는 학급";
      return `<article class="sc-card" style="animation-delay:${Math.min(i, 8) * 30}ms">
        <button type="button" class="sc-open" data-open="${escapeHtml(c.id)}" aria-label="${escapeHtml(name)} 열기, 학생 ${n}명">
          <div class="sc-thumb">${miniSvg(s)}</div>
          <div class="sc-info"><div class="sc-name">${escapeHtml(name)}</div>
          <div class="sc-meta">${n ? `${n}명 · 배정 ${a}` : "명단 없음"} · ${s.cols}분단×${s.rows}줄 · ${s.deskSeats}인 책상${s.layout === "free" ? " · 자유" : ""}<br>수정 ${fmtDate(c.updated)}</div></div>
        </button>
        <button type="button" class="sc-cmenu" data-cmenu="${escapeHtml(c.id)}" aria-label="${escapeHtml(name)} 메뉴" aria-haspopup="menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
      </article>`;
    }).join("");
  }
  async function newClass() {
    const name = await promptDialog({ title: "새 학급", msg: "학급 이름을 적어 주세요. 인쇄 제목에도 쓰여요.", value: "", placeholder: "예: 3학년 2반", ok: "만들기" });
    if (name === null) return;
    const s = defaultStateRaw(); s.className = name || "우리 반";
    const rec = newClassRecord(s); db.classes.push(rec); saveDb();
    openClass(rec.id);
  }
  async function cardAction(act2, id) {
    const rec = getClass(id); if (!rec) return;
    if (act2 === "open") openClass(id);
    else if (act2 === "rename") {
      const name = await promptDialog({ title: "이름 바꾸기", value: rec.s.className, ok: "바꾸기" });
      if (name) { rec.s.className = name; rec.updated = Date.now(); saveDb(); renderList(); }
    } else if (act2 === "dup") {
      const s = JSON.parse(JSON.stringify(rec.s)); s.className = (s.className || "학급") + " (복사본)";
      db.classes.push(newClassRecord(s)); saveDb(); renderList(); toast("학급을 복제했어요");
    } else if (act2 === "export") exportClass(rec);
    else if (act2 === "delete") {
      const ok = await confirmDialog({ title: "학급 삭제", msg: `‘${rec.s.className || "이름 없는 학급"}’ 학급과 저장 배치를 모두 지울까요? 되돌릴 수 없어요.`, ok: "삭제", danger: true });
      if (!ok) return;
      db.classes = db.classes.filter(c => c.id !== id); saveDb(); renderList(); toast("학급을 지웠어요");
      const first = document.querySelector(".sc-open") || $("sl-new"); first.focus();
    }
  }

  /* ═════════════ 화면 전환 ═════════════ */
  function openClass(id, fromHistory) {
    const rec = getClass(id); if (!rec) { showList(); return; }
    cur = rec; state = rec.s;
    undoStack = []; selectedSeat = null; selectedStudent = null; focusKey = null;
    normalize();
    $("view-list").hidden = true;
    $("view-board").classList.add("active");
    document.body.classList.add("in-board");
    setDrawer(window.innerWidth >= 900);
    render();
    if (!fromHistory) {
      try { history.pushState({ sc: id }, "", "#" + encodeURIComponent(id)); pushedHistory = true; } catch (e) { /* 무시 */ }
    }
    setTimeout(() => { const b = seatButton(focusKey); (state.students.length && b ? b : $("sb-back")).focus({ preventScroll: true }); }, 0);
  }
  function showList() {
    endGesture(); closePop();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $("view-board").classList.remove("active", "present", "show-settings");
    document.body.classList.remove("in-board");
    $("view-list").hidden = false;
    const lastId = cur && cur.id;
    cur = null; state = null; undoStack = [];
    renderList();
    const el = lastId && document.querySelector('.sc-open[data-open="' + CSS.escape(lastId) + '"]');
    if (el) el.focus({ preventScroll: true });
  }
  function goHome() {
    if (pushedHistory && history.state && history.state.sc) { pushedHistory = false; history.back(); }
    else { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* 무시 */ } showList(); }
  }

  /* ═════════════ 초기화 ═════════════ */
  function bind() {
    // 목록
    $("sl-new").addEventListener("click", newClass);
    $("sl-import").addEventListener("click", () => $("sl-file").click());
    $("sl-file").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; importFile(f); });
    $("sl-grid").addEventListener("click", e => {
      const o = e.target.closest("[data-open]"); if (o) { openClass(o.dataset.open); return; }
      const m = e.target.closest("[data-cmenu]");
      if (m) { const r = m.getBoundingClientRect(); const pop = $("sl-menu"); pop.dataset.id = m.dataset.cmenu; showPop(pop, r.right - 200, r.bottom + 4, m); }
    });
    $("sl-menu").addEventListener("click", e => { const b = e.target.closest("[data-cact]"); if (!b) return; const id = $("sl-menu").dataset.id; closePop(false); cardAction(b.dataset.cact, id); });
    $("sl-menu").addEventListener("keydown", popKeydown);

    // 툴바
    $("sb-back").addEventListener("click", goHome);
    $("sb-name").addEventListener("input", e => { state.className = e.target.value.slice(0, 30); cur.updated = Date.now(); saveDb(); renderStatus(); });
    $("sb-name").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
    $("seg-layout").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setLayout(b.dataset.v); });
    $("seg-desk").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setDeskSeats(+b.dataset.v); });
    $("seg-view").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setView(b.dataset.v); });
    $("cols-dec").addEventListener("click", () => setCols(state.cols - 1));
    $("cols-inc").addEventListener("click", () => setCols(state.cols + 1));
    $("rows-dec").addEventListener("click", () => setRows(state.rows - 1));
    $("rows-inc").addEventListener("click", () => setRows(state.rows + 1));
    $("sb-settings-btn").addEventListener("click", e => { const on = !$("view-board").classList.contains("show-settings"); $("view-board").classList.toggle("show-settings", on); e.currentTarget.setAttribute("aria-expanded", String(on)); requestAnimationFrame(fitCanvas); });
    $("sb-random").addEventListener("click", doRandom);
    $("sb-undo").addEventListener("click", undo);
    $("sb-baseline").addEventListener("click", doBaseline);
    $("sb-compare").addEventListener("click", doCompare);
    $("sb-print").addEventListener("click", doPrint);
    if (!document.fullscreenEnabled) $("sb-full").hidden = true;
    $("sb-full").addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => { $("sb-full").setAttribute("aria-pressed", String(!!document.fullscreenElement)); setTimeout(fitCanvas, 50); });
    $("sb-drawer-btn").addEventListener("click", () => setDrawer($("view-board").classList.contains("drawer-closed")));
    $("sb-drawer-close").addEventListener("click", () => { setDrawer(false); $("sb-drawer-btn").focus(); });
    $("sb-more-btn").addEventListener("click", e => { const r = e.currentTarget.getBoundingClientRect(); if (openPop && openPop.el === $("sb-more")) { closePop(true); return; } showPop($("sb-more"), r.right - 230, r.bottom + 6, e.currentTarget); });
    $("sb-more").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      closePop(true);
      boardAction(b.dataset.act);
    });
    $("sb-empty").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b) boardAction(b.dataset.act); });
    $("sb-present-exit").addEventListener("click", () => setPresent(false));

    // 캔버스
    const cv = $("sb-canvas");
    cv.addEventListener("pointerdown", onCanvasPointerDown);
    cv.addEventListener("click", onCanvasClick);
    cv.addEventListener("contextmenu", onCanvasContextMenu);
    cv.addEventListener("keydown", onCanvasKeydown);
    cv.addEventListener("focusin", onCanvasFocusIn);
    $("sb-menu").addEventListener("click", onSeatMenuClick);

    // 서랍
    document.querySelector(".dr-tabs").addEventListener("click", e => { const b = e.target.closest("[role=tab]"); if (!b) return; activeTab = b.dataset.tab; renderDrawer(); });
    document.querySelector(".dr-tabs").addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tabs = ["roster", "constraints", "storage"], i = tabs.indexOf(activeTab);
      activeTab = tabs[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3]; renderDrawer(); $("tab-" + activeTab).focus();
    });
    const p = $("sb-panel");
    p.addEventListener("click", onPanelClick);
    p.addEventListener("change", onPanelChange);
    p.addEventListener("pointerdown", onRosterPointerDown);
    p.addEventListener("contextmenu", e => { if (e.target.closest(".grip, .rname")) e.preventDefault(); });

    // 모달
    $("roster-apply").addEventListener("click", applyRoster);
    $("roster-sample").addEventListener("click", () => { $("roster-text").value = SAMPLE; $("roster-text").focus(); toast("가상의 예시 이름이에요. ‘명부 적용’을 눌러야 반영돼요."); });
    $("dlg-ok").addEventListener("click", () => { const v = $("dlg-input").hidden ? "" : $("dlg-input").value; dlgModal.close(); finishDialog(v); });
    $("dlg-cancel").addEventListener("click", () => { dlgModal.close(); finishDialog(null); });
    $("dlg-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("dlg-ok").click(); } });

    // 전역
    document.addEventListener("keydown", onGlobalKeydown);
    document.addEventListener("pointerdown", e => { if (openPop && !openPop.el.contains(e.target) && !(openPop.anchor && openPop.anchor.contains(e.target))) closePop(false); }, true);
    window.addEventListener("resize", () => { closePop(); if (state) fitCanvas(); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (state) fitCanvas(); }).observe($("sb-wrap"));
    window.addEventListener("popstate", () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && getClass(id)) { if (!cur || cur.id !== id) openClass(id, true); }
      else if (cur) { pushedHistory = false; showList(); }
    });
    window.addEventListener("storage", e => {
      if (e.key !== LS_KEY || cur) return;   // 보드를 연 동안은 이 탭의 내용이 기준
      db = loadDb(); renderList();
    });
    window.addEventListener("beforeprint", () => { if (state) { renderStatus(); } });
  }
  function doPrint() { closePop(); selectedSeat = null; renderCanvas(); renderStatus(); setTimeout(() => window.print(), 60); }
  function boardAction(a) {
    if (a === "present") setPresent(true);
    else if (a === "baseline") doBaseline();
    else if (a === "compare") doCompare();
    else if (a === "print") doPrint();
    else if (a === "restore") doRestore();
    else if (a === "fill") act(fillEmpty, { say: "빈자리를 채웠어요" });
    else if (a === "clearfill") act(clearAndFill, { say: "비우고 번호순으로 채웠어요" });
    else if (a === "edit-roster") openRoster();
    else if (a === "sample") insertSample();
    else if (a === "snap-save") { const n = saveSnapshot(); commit(); toast("배치를 저장했어요 · " + n); }
    else if (a === "export") exportClass(cur);
    else if (a === "clear") doClear();
  }

  function init() {
    db = loadDb();
    if (!db.classes.length) {
      // 첫 방문: 빈 학급 하나 (예시 명단은 버튼으로만)
      const s = defaultStateRaw(); s.className = "우리 반";
      db.classes.push(newClassRecord(s)); saveDb();
    }
    bind();
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && getClass(id)) {
      try { history.replaceState({ sc: id }, "", location.href); } catch (e) { /* 무시 */ }
      openClass(id, true);
    } else renderList();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 테스트·디버깅용 읽기 전용 접근
  window.__seating = { get state() { return state; }, get db() { return db; } };
})();
