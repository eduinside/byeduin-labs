/* =====================================================
   뽑기·모둠 (picker) — eduin VIVES
   - 학급 목록 → 학급 화면(뽑기·순서·모둠·명단 탭). 각 탭의 결과 상자는 '크게 보기'로 전체화면.
   - 난수: crypto.getRandomValues(나머지 편향 제거) + Fisher–Yates.
   - 저장: localStorage `vives-picker-v1`만. 서버·동기화·공유 링크 없음(학생 이름 보호).
   - 자리 배치(`vives-seating-v1`)는 읽기만 한다(명단·성별·떨어뜨릴 쌍 가져오기).
   계획: docs/picker-plan.md
   ===================================================== */
(function () {
  "use strict";

  const LS_KEY = "vives-picker-v1";
  const SEAT_KEY = "vives-seating-v1";
  const MAX_STU = 200, MAX_CLASSES = 40, MAX_PICKS = 300, GROUP_HISTORY = 3, WHEEL_MAX = 40, CARD_MAX = 40;
  const GROUP_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#e11d48"];

  // 가상의 예시 명단(자리 배치와 같음). "예시 명단" 버튼으로만 채운다.
  const SAMPLE = "김민준 남\n이서연 여\n박지호 남\n최수아 여\n정도윤 남\n강하은 여\n조시우 남\n윤지유 여\n임건우 남\n한서윤 여\n오주원 남\n서다은 여\n신현우 남\n권채원 여\n황지훈 남\n안유나 여\n배준서 남\n문하린 여\n양시윤 남\n홍예린 여";

  const $ = (id) => document.getElementById(id);
  const VUI = window.VUI;
  const SK = window.SimKit;
  const toast = (m, t) => { if (VUI) VUI.toast(m, t); };
  const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  /* ───── 난수 ───── */
  function randInt(n) {
    if (n <= 1) return 0;
    const c = window.crypto;
    if (c && c.getRandomValues) {
      const lim = Math.floor(0x100000000 / n) * n;
      const buf = new Uint32Array(1);
      let x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= lim);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function sample(a, k) { return shuffle(a).slice(0, k); }

  /* ───── 유틸 ───── */
  const pad = (n) => String(n).padStart(2, "0");
  function todayStr(d = new Date()) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function uid() { return "p" + Date.now().toString(36) + randInt(1e9).toString(36); }
  function clampInt(v, min, max, def) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function fmtDate(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return "";
    if (d.toDateString() === new Date().toDateString()) return "오늘 " + d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function announce(msg) { const l = $("pk-live"); if (!l) return; l.textContent = ""; setTimeout(() => { l.textContent = msg; }, 30); }

  /* ───── 데이터 모양 ───── */
  function defaultClass(name) {
    const now = Date.now();
    return {
      id: uid(), name: name || "새 학급", created: now, updated: now, numbersOnly: false,
      students: [], pairs: [],
      absent: { date: "", ids: [] },
      picked: [], picks: [],
      draw: { count: 1, fair: true, effect: "slot" },
      order: { list: [], cur: 0, done: [] },
      groups: { mode: "count", count: 4, size: 4, rem: "add", gender: true, avoidPrev: true, lead: false, cur: null, leaders: [], pins: {}, history: [] },
    };
  }

  function sanitizeClass(raw) {
    if (!isObj(raw)) return null;
    const c = defaultClass(typeof raw.name === "string" ? raw.name.trim().slice(0, 30) || "학급" : "학급");
    if (typeof raw.id === "string" && raw.id) c.id = raw.id.slice(0, 40);
    c.created = +raw.created || c.created; c.updated = +raw.updated || c.updated;
    c.numbersOnly = !!raw.numbersOnly;
    const ids = new Set();
    let maxId = 0;
    (Array.isArray(raw.students) ? raw.students : []).forEach((s) => { const n = Number(s && s.id); if (Number.isInteger(n) && n > maxId) maxId = n; });
    (Array.isArray(raw.students) ? raw.students : []).slice(0, MAX_STU).forEach((s) => {
      if (!isObj(s)) return;
      const name = String(s.name == null ? "" : s.name).trim().slice(0, 20);
      if (!name) return;
      let id = Number(s.id);
      if (!Number.isInteger(id) || id < 1 || ids.has(id)) id = ++maxId;
      ids.add(id);
      c.students.push({ id, name, gender: s.gender === "M" || s.gender === "F" ? s.gender : null });
    });
    const has = (v) => ids.has(v);
    const idList = (a, max) => (Array.isArray(a) ? a : []).map(Number).filter(has).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, max || MAX_STU);
    c.pairs = (Array.isArray(raw.pairs) ? raw.pairs : []).filter((p) => Array.isArray(p) && p.length === 2 && has(+p[0]) && has(+p[1]) && +p[0] !== +p[1]).map((p) => [+p[0], +p[1]]).slice(0, 200);
    if (isObj(raw.absent) && typeof raw.absent.date === "string") c.absent = { date: raw.absent.date.slice(0, 10), ids: idList(raw.absent.ids) };
    c.picked = idList(raw.picked);
    c.picks = (Array.isArray(raw.picks) ? raw.picks : []).filter((p) => isObj(p) && Number.isFinite(+p.t)).map((p) => ({ t: +p.t, ids: idList(p.ids, 20) })).filter((p) => p.ids.length).slice(-MAX_PICKS);
    if (isObj(raw.draw)) {
      c.draw.count = clampInt(raw.draw.count, 1, 10, 1);
      c.draw.fair = raw.draw.fair !== false;
      c.draw.effect = ["slot", "card", "wheel"].includes(raw.draw.effect) ? raw.draw.effect : "slot";
    }
    if (isObj(raw.order)) {
      c.order.list = idList(raw.order.list);
      c.order.cur = clampInt(raw.order.cur, 0, c.order.list.length, 0);
      c.order.done = idList(raw.order.done);
    }
    if (isObj(raw.groups)) {
      const g = raw.groups, o = c.groups;
      o.mode = g.mode === "size" ? "size" : "count";
      o.count = clampInt(g.count, 1, 30, 4); o.size = clampInt(g.size, 1, 30, 4);
      o.rem = g.rem === "new" ? "new" : "add";
      o.gender = g.gender !== false; o.avoidPrev = g.avoidPrev !== false; o.lead = !!g.lead;
      const cleanGroups = (arr) => Array.isArray(arr) ? arr.slice(0, 40).map((gr) => idList(gr)) : null;
      o.cur = cleanGroups(g.cur);
      if (o.cur && !o.cur.length) o.cur = null;
      o.leaders = idList(g.leaders);
      if (isObj(g.pins)) for (const k of Object.keys(g.pins)) { const id = +k; if (has(id)) o.pins[id] = clampInt(g.pins[k], 0, 39, 0); }
      o.history = (Array.isArray(g.history) ? g.history : []).slice(-GROUP_HISTORY).map(cleanGroups).filter(Boolean);
    }
    return c;
  }

  function readRaw() { return VUI ? VUI.storage.get(LS_KEY, null, (v) => isObj(v) && Array.isArray(v.classes)) : null; }
  function loadDb(raw) {
    const out = { v: 1, classes: [] };
    if (raw) for (const c of raw.classes.slice(0, MAX_CLASSES)) { const s = sanitizeClass(c); if (s) out.classes.push(s); }
    return out;
  }

  /* ───── 앱 상태 ───── */
  let db = loadDb(readRaw());
  let cur = null;
  let tab = "draw";
  let busy = false;          // 뽑기 연출 중
  let runToken = 0;          // 연출 취소용
  let lastDraw = null;       // 방금 뽑기 취소용
  let cardState = null;      // 카드 연출 진행 상태
  let wheelRot = 0;
  let groupUndo = [];
  let selMem = null;         // 모둠에서 고른 학생 id
  let pushedHistory = false;

  function saveAll() { if (VUI) VUI.storage.set(LS_KEY, db); }
  function save() {
    if (!cur) return saveAll();
    cur.updated = Date.now();
    // 다른 탭에서 바꾼 다른 학급을 덮어쓰지 않도록, 최신 저장본에 지금 학급만 바꿔 넣는다
    const raw = readRaw();
    if (raw) {
      const latest = loadDb(raw);
      const i = latest.classes.findIndex((c) => c.id === cur.id);
      if (i >= 0) latest.classes[i] = cur; else latest.classes.push(cur);
      db = latest;
    }
    saveAll();
  }

  /* ───── 학생·결석 ───── */
  function stu(id) { return cur.students.find((s) => s.id === id); }
  function nameOf(id) { const s = stu(id); return s ? s.name : "?"; }
  function absentSet(c = cur) { return c.absent.date === todayStr() ? new Set(c.absent.ids) : new Set(); }
  function presentIds(c = cur) { const a = absentSet(c); return c.students.filter((s) => !a.has(s.id)).map((s) => s.id); }
  function toggleAbsent(id) {
    if (cur.absent.date !== todayStr()) cur.absent = { date: todayStr(), ids: [] };
    const i = cur.absent.ids.indexOf(id);
    if (i >= 0) cur.absent.ids.splice(i, 1); else cur.absent.ids.push(id);
    save();
  }

  // 명단이 바뀐 뒤 다른 곳의 id를 정리
  function cleanRefs() {
    const ids = new Set(cur.students.map((s) => s.id));
    const keep = (a) => a.filter((v) => ids.has(v));
    cur.pairs = cur.pairs.filter(([a, b]) => ids.has(a) && ids.has(b));
    cur.absent.ids = keep(cur.absent.ids);
    cur.picked = keep(cur.picked);
    cur.picks = cur.picks.map((p) => ({ t: p.t, ids: keep(p.ids) })).filter((p) => p.ids.length);
    cur.order.list = keep(cur.order.list); cur.order.done = keep(cur.order.done);
    cur.order.cur = Math.min(cur.order.cur, cur.order.list.length);
    const g = cur.groups;
    if (g.cur) { g.cur = g.cur.map(keep); if (!g.cur.some((x) => x.length)) g.cur = null; }
    g.leaders = keep(g.leaders);
    for (const k of Object.keys(g.pins)) if (!ids.has(+k)) delete g.pins[k];
    g.history = g.history.map((h) => h.map(keep));
  }

  function parseRoster(text, existing) {
    const byName = new Map(); existing.forEach((s) => { if (!byName.has(s.name)) byName.set(s.name, s); });
    let nextId = Math.max(0, ...existing.map((s) => s.id)) + 1;
    const out = [], used = new Set();
    text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_STU).forEach((line) => {
      let name = line, gender = null;
      const m = line.match(/^(.*\S)\s+([남여MFmf])$/);
      if (m) { name = m[1].trim(); const g = m[2].toUpperCase(); gender = g === "남" || g === "M" ? "M" : "F"; }
      name = name.slice(0, 20);
      if (!name) return;
      const prev = byName.get(name);
      if (prev && !used.has(prev.id)) { used.add(prev.id); out.push({ id: prev.id, name, gender: gender || prev.gender || null }); }
      else out.push({ id: nextId++, name, gender });
    });
    return out;
  }
  function rosterText(c) { return c.students.map((s) => s.name + (s.gender === "M" ? " 남" : s.gender === "F" ? " 여" : "")).join("\n"); }
  function numberStudents(n, existing) {
    const byName = new Map(existing.map((s) => [s.name, s]));
    let nextId = Math.max(0, ...existing.map((s) => s.id)) + 1;
    const out = [];
    for (let i = 1; i <= n; i++) { const nm = i + "번"; const p = byName.get(nm); out.push({ id: p ? p.id : nextId++, name: nm, gender: null }); }
    return out;
  }

  /* ───── 화면 전환 ───── */
  function showList() {
    exitPresent();
    cancelRun();
    cur = null;
    $("view-class").hidden = true;
    $("view-list").hidden = false;
    document.body.classList.remove("pk-in-class");
    db = loadDb(readRaw()); // 다른 탭에서 바뀐 내용 반영
    renderList();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !cur) { db = loadDb(readRaw()); renderList(); }
  });
  function openClass(id, opts = {}) {
    const c = db.classes.find((x) => x.id === id);
    if (!c) return;
    cur = c; lastDraw = null; groupUndo = []; selMem = null; cardState = null;
    $("view-list").hidden = true;
    $("view-class").hidden = false;
    document.body.classList.add("pk-in-class");
    $("pk-name").value = cur.name;
    if (!pushedHistory) { try { history.pushState({ pk: "class" }, ""); pushedHistory = true; } catch (e) { /* 무시 */ } }
    setTab(opts.tab || (cur.students.length ? "draw" : "roster"));
    window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", () => { if (cur) { pushedHistory = false; showList(); } });
  function backToList() { if (pushedHistory) { history.back(); } else showList(); }

  function setTab(t) {
    cancelRun();
    exitPresent();
    tab = t;
    for (const b of document.querySelectorAll(".pk-tabs [role=tab]")) {
      const on = b.dataset.tab === t;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    }
    for (const p of ["draw", "order", "groups", "roster"]) $("panel-" + p).hidden = p !== t;
    renderClass();
  }

  function renderClass() {
    if (!cur) return;
    const ab = absentSet().size;
    const chip = $("pc-absent");
    chip.textContent = ab ? "오늘 결석 " + ab + "명" : "결석 없음";
    chip.classList.toggle("has", ab > 0);
    if (tab === "draw") renderDraw();
    else if (tab === "order") renderOrder();
    else if (tab === "groups") renderGroups();
    else renderRoster();
  }

  /* ───── 목록 ───── */
  function seatingClasses() {
    if (!VUI) return [];
    const raw = VUI.storage.get(SEAT_KEY, null, (v) => isObj(v) && Array.isArray(v.classes));
    if (!raw) return [];
    return raw.classes.filter((c) => isObj(c) && isObj(c.s) && Array.isArray(c.s.students) && c.s.students.length).map((c) => c.s);
  }

  function renderList() {
    const grid = $("pl-grid");
    grid.textContent = "";
    const hasSeat = seatingClasses().length > 0;
    $("pl-seating").hidden = !hasSeat;
    if (!db.classes.length) {
      const e = el("div", "pk-empty");
      e.innerHTML = "<b>아직 학급이 없어요.</b><br>새 학급을 만들어 명단을 넣거나, 번호만으로 바로 시작해 보세요." + (hasSeat ? "<br>자리 배치 앱에 만든 학급이 있으면 그대로 가져올 수 있어요." : "");
      grid.appendChild(e);
      return;
    }
    const list = db.classes.slice().sort((a, b) => b.updated - a.updated);
    for (const c of list) {
      const card = el("div", "pk-card");
      const open = el("button", "pk-card-open");
      open.type = "button";
      open.appendChild(el("div", "pk-card-name", c.name));
      const ab = absentSet(c).size;
      open.appendChild(el("div", "pk-card-meta", (c.numbersOnly ? "번호 " : "") + c.students.length + "명" + (ab ? " · 오늘 결석 " + ab + "명" : "") + " · " + fmtDate(c.updated)));
      open.addEventListener("click", () => openClass(c.id));
      const menu = el("button", "pk-card-menu");
      menu.type = "button";
      menu.setAttribute("aria-label", c.name + " 메뉴");
      menu.setAttribute("aria-haspopup", "menu");
      menu.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
      menu.addEventListener("click", (ev) => { ev.stopPropagation(); openCardMenu(menu, c.id); });
      card.append(open, menu);
      grid.appendChild(card);
    }
  }

  let menuFor = null;
  function openCardMenu(anchor, id) {
    const m = $("pl-menu");
    menuFor = id;
    m.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + "px";
    m.querySelector("button").focus();
  }
  function closeMenu() { $("pl-menu").hidden = true; menuFor = null; }
  document.addEventListener("pointerdown", (e) => { if (!$("pl-menu").hidden && !e.target.closest("#pl-menu") && !e.target.closest(".pk-card-menu")) closeMenu(); });
  $("pl-menu").addEventListener("keydown", (e) => {
    const items = [...$("pl-menu").querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { closeMenu(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  $("pl-menu").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cact]");
    if (!b) return;
    const id = menuFor; closeMenu();
    const c = db.classes.find((x) => x.id === id);
    if (!c) return;
    const act = b.dataset.cact;
    if (act === "open") openClass(id);
    else if (act === "rename") {
      const v = await promptDlg("이름 바꾸기", "", c.name);
      if (v) { c.name = v.slice(0, 30); c.updated = Date.now(); saveAll(); renderList(); }
    } else if (act === "dup") {
      const d = sanitizeClass(JSON.parse(JSON.stringify(c)));
      d.id = uid(); d.name = (c.name + " (복사본)").slice(0, 30); d.created = d.updated = Date.now();
      db.classes.push(d); saveAll(); renderList(); toast("복제했어요");
    } else if (act === "export") exportClass(c);
    else if (act === "delete") {
      if (await confirmDlg("학급 삭제", "‘" + c.name + "’ 학급을 지울까요? 되돌릴 수 없어요.", "삭제")) {
        db.classes = db.classes.filter((x) => x.id !== id); saveAll(); renderList(); toast("삭제했어요");
      }
    }
  });

  function addClass(c) {
    if (db.classes.length >= MAX_CLASSES) { toast("학급은 " + MAX_CLASSES + "개까지 만들 수 있어요", "error"); return false; }
    db.classes.push(c); saveAll(); return true;
  }

  $("pl-new").addEventListener("click", async () => {
    const name = await promptDlg("새 학급", "학급 이름을 적어 주세요. (예: 4학년 2반)", "");
    if (name == null) return;
    const c = defaultClass(name.trim() || "새 학급");
    if (addClass(c)) { openClass(c.id, { tab: "roster" }); openRosterModal(); }
  });
  $("pl-numbers").addEventListener("click", async () => {
    const name = await promptDlg("번호로 시작", "학생 수를 숫자로 적어 주세요.", "25");
    if (name == null) return;
    const n = clampInt(String(name).replace(/[^0-9]/g, ""), 1, 60, 0);
    if (!n) { toast("1에서 60 사이 숫자를 적어 주세요", "error"); return; }
    const c = defaultClass(n + "명 (번호)");
    c.numbersOnly = true; c.students = numberStudents(n, []);
    if (addClass(c)) openClass(c.id, { tab: "draw" });
  });
  $("pl-seating").addEventListener("click", () => openSeatingModal(null));
  $("pl-import").addEventListener("click", () => $("pl-file").click());
  $("pl-file").addEventListener("change", () => {
    const f = $("pl-file").files[0];
    $("pl-file").value = "";
    if (!f) return;
    if (f.size > 2e6) { toast("파일이 너무 커요", "error"); return; }
    const r = new FileReader();
    r.onload = () => {
      let obj;
      try { obj = JSON.parse(r.result); } catch (e) { toast("올바른 JSON 파일이 아니에요", "error"); return; }
      const c = sanitizeClass(isObj(obj) && isObj(obj.class) ? obj.class : obj);
      if (!c || !c.students.length) { toast("학생 명단이 없는 파일이에요", "error"); return; }
      c.id = uid(); c.created = c.updated = Date.now();
      if (addClass(c)) { renderList(); toast("‘" + c.name + "’ 학급을 불러왔어요"); }
    };
    r.readAsText(f);
  });

  function exportClass(c) {
    const data = JSON.stringify({ app: "vives-picker", v: 1, class: c }, null, 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "뽑기모둠-" + c.name.replace(/[\\/:*?"<>|]/g, "_") + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ───── 자리 배치에서 가져오기 ───── */
  let seatTarget = null; // null이면 새 학급, 학급 객체면 그 학급 명단 교체
  const seatModal = VUI ? VUI.modal.bind("#m-seating", { className: "open", backdropClose: true }) : null;
  function openSeatingModal(target) {
    seatTarget = target;
    const list = $("ms-list");
    list.textContent = "";
    const classes = seatingClasses();
    if (!classes.length) { toast("이 기기의 자리 배치 앱에 학급이 없어요"); return; }
    $("ms-desc").textContent = target
      ? "고른 학급의 명단으로 지금 명단을 바꿔요. 이름이 같은 학생은 결석·기록이 유지돼요. (자리 배치 데이터는 바뀌지 않아요)"
      : "이 기기의 자리 배치 앱에 저장된 학급이에요. 이름·성별·떨어뜨릴 쌍을 복사해 새 학급을 만들어요. (자리 배치 데이터는 바뀌지 않아요)";
    classes.forEach((s) => {
      const b = el("button", "pk-btn src");
      b.type = "button";
      b.append(el("span", null, (s.className || "이름 없는 학급").slice(0, 30)), el("small", null, s.students.length + "명"));
      b.addEventListener("click", () => { importSeating(s); if (seatModal) seatModal.close(); });
      list.appendChild(b);
    });
    if (seatModal) seatModal.open();
  }
  function importSeating(s) {
    const src = s.students.filter((st) => isObj(st) && String(st.name || "").trim()).slice(0, MAX_STU);
    const text = src.map((st) => String(st.name).trim().slice(0, 20) + (st.gender === "M" ? " 남" : st.gender === "F" ? " 여" : "")).join("\n");
    let c = seatTarget;
    if (!c) {
      c = defaultClass((s.className || "자리 배치 학급").slice(0, 30));
      if (!addClass(c)) return;
    }
    const prevCur = cur;
    cur = c;
    cur.numbersOnly = false;
    cur.students = parseRoster(text, cur.students);
    // 쌍: 자리 배치 id → 이름 → 새 id
    const idToName = new Map(src.map((st) => [Number(st.id), String(st.name).trim().slice(0, 20)]));
    const nameToId = new Map(cur.students.map((st) => [st.name, st.id]));
    const pairs = [];
    (Array.isArray(s.pairs) ? s.pairs : []).forEach((p) => {
      if (!Array.isArray(p)) return;
      const a = nameToId.get(idToName.get(Number(p[0]))), b = nameToId.get(idToName.get(Number(p[1])));
      if (a && b && a !== b && !pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) pairs.push([a, b]);
    });
    if (pairs.length || !seatTarget) cur.pairs = pairs.concat(seatTarget ? cur.pairs.filter(([a, b]) => !pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) : []);
    cleanRefs();
    save();
    toast(cur.students.length + "명을 가져왔어요" + (pairs.length ? " (떨어뜨릴 쌍 " + pairs.length + "개)" : ""));
    if (!seatTarget) { cur = prevCur; openClass(c.id, { tab: "draw" }); }
    else renderClass();
  }

  /* ───── 명단 편집 ───── */
  let rmode = "names", rnum = 25;
  const rosterModal = VUI ? VUI.modal.bind("#m-roster", { className: "open", backdropClose: true, initialFocus: "#roster-text" }) : null;
  function paintRmode() {
    for (const b of $("seg-rmode").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.v === rmode ? "true" : "false");
    $("rm-names").hidden = rmode !== "names";
    $("rm-numbers").hidden = rmode !== "numbers";
    $("roster-sample").hidden = rmode !== "names";
    $("rn-val").textContent = rnum;
  }
  function openRosterModal() {
    rmode = cur.numbersOnly ? "numbers" : "names";
    rnum = cur.numbersOnly && cur.students.length ? cur.students.length : 25;
    $("roster-text").value = cur.numbersOnly ? "" : rosterText(cur);
    paintRmode();
    if (rosterModal) rosterModal.open();
  }
  $("seg-rmode").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { rmode = b.dataset.v; paintRmode(); } });
  $("rn-dec").addEventListener("click", () => { rnum = Math.max(1, rnum - 1); paintRmode(); });
  $("rn-inc").addEventListener("click", () => { rnum = Math.min(60, rnum + 1); paintRmode(); });
  $("roster-sample").addEventListener("click", () => { $("roster-text").value = SAMPLE; });
  $("roster-apply").addEventListener("click", () => {
    if (rmode === "numbers") { cur.students = numberStudents(rnum, cur.students); cur.numbersOnly = true; }
    else {
      const list = parseRoster($("roster-text").value, cur.students);
      if (!list.length) { toast("이름을 한 줄에 한 명씩 적어 주세요", "error"); return; }
      cur.students = list; cur.numbersOnly = false;
    }
    cleanRefs(); save();
    if (rosterModal) rosterModal.close();
    toast("명단 " + cur.students.length + "명을 적용했어요");
    renderClass();
  });

  /* ───── 떨어뜨릴 쌍 ───── */
  const pairsModal = VUI ? VUI.modal.bind("#m-pairs", { className: "open", backdropClose: true, onClose: () => renderClass() }) : null;
  function renderPairs() {
    const sorted = cur.students.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
    for (const id of ["mp-a", "mp-b"]) {
      const s = $(id), v = s.value;
      s.textContent = "";
      sorted.forEach((st) => { const o = el("option", null, st.name); o.value = st.id; s.appendChild(o); });
      if (v) s.value = v;
    }
    if (!$("mp-b").value || $("mp-b").value === $("mp-a").value) { if (sorted[1]) $("mp-b").value = sorted[1].id; }
    const list = $("mp-list");
    list.textContent = "";
    if (!cur.pairs.length) list.appendChild(el("p", "pk-hint", "아직 쌍이 없어요."));
    cur.pairs.forEach(([a, b], i) => {
      const it = el("div", "it");
      it.appendChild(el("span", null, nameOf(a) + " ↔ " + nameOf(b)));
      const x = el("button", "pk-btn sm danger", "빼기");
      x.type = "button";
      x.setAttribute("aria-label", nameOf(a) + "와 " + nameOf(b) + " 쌍 빼기");
      x.addEventListener("click", () => { cur.pairs.splice(i, 1); save(); renderPairs(); });
      it.appendChild(x);
      list.appendChild(it);
    });
  }
  function openPairs() {
    if (cur.students.length < 2) { toast("학생이 두 명 이상 있어야 해요"); return; }
    renderPairs();
    if (pairsModal) pairsModal.open();
  }
  $("mp-add").addEventListener("click", () => {
    const a = +$("mp-a").value, b = +$("mp-b").value;
    if (!a || !b || a === b) { toast("서로 다른 두 학생을 골라 주세요"); return; }
    if (cur.pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) { toast("이미 있는 쌍이에요"); return; }
    cur.pairs.push([a, b]); save(); renderPairs();
  });

  /* ───── 확인·입력 창 ───── */
  let dlgResolve = null;
  const dlgModal = VUI ? VUI.modal.bind("#m-dialog", { className: "open", backdropClose: true, onClose: () => finishDlg(null) }) : null;
  function finishDlg(v) { const r = dlgResolve; dlgResolve = null; if (dlgModal) dlgModal.close(); if (r) r(v); }
  function openDlg(title, msg, value, ok, withInput) {
    if (!dlgModal) return Promise.resolve(withInput ? window.prompt(title, value || "") : window.confirm(msg || title) || null);
    if (dlgResolve) finishDlg(null);
    $("dlg-title").textContent = title;
    $("dlg-msg").textContent = msg || "";
    $("dlg-msg").hidden = !msg;
    const inp = $("dlg-input");
    inp.hidden = !withInput;
    inp.value = value || "";
    $("dlg-ok").textContent = ok || "확인";
    $("dlg-ok").classList.toggle("danger", ok === "삭제");
    return new Promise((res) => {
      dlgResolve = res;
      dlgModal.open({ initialFocus: withInput ? "#dlg-input" : "#dlg-ok" });
      if (withInput) setTimeout(() => inp.select(), 30);
    });
  }
  const promptDlg = (t, m, v) => openDlg(t, m, v, "확인", true);
  const confirmDlg = (t, m, ok) => openDlg(t, m, "", ok, false).then((v) => v === true);
  $("dlg-ok").addEventListener("click", () => finishDlg($("dlg-input").hidden ? true : $("dlg-input").value));
  $("dlg-cancel").addEventListener("click", () => finishDlg(null));
  $("dlg-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); finishDlg($("dlg-input").value); } });

  /* ───── 학급 화면 공통 ───── */
  $("pc-back").addEventListener("click", backToList);
  $("pk-name").addEventListener("change", () => { cur.name = $("pk-name").value.trim().slice(0, 30) || "학급"; $("pk-name").value = cur.name; save(); });
  $("pc-absent").addEventListener("click", () => setTab("roster"));
  document.querySelector(".pk-tabs").addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b) setTab(b.dataset.tab); });
  document.querySelector(".pk-tabs").addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll(".pk-tabs [role=tab]")];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    if (n >= 0) { e.preventDefault(); setTab(tabs[n].dataset.tab); tabs[n].focus(); }
  });

  /* ───── 크게 보기 ───── */
  let presentEl = null;
  function enterPresent(display) {
    if (!display) return;
    presentEl = display;
    display.classList.add("is-present");
    document.body.classList.add("pk-present");
    const de = document.documentElement;
    if (de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen().catch(() => { /* 태블릿 일부는 지원 안 함 — 화면 채우기만 */ });
    // 크게 보기에서는 주 버튼(뽑기·다음·모둠 나누기)에 초점 → Space/Enter로 바로 진행
    const main = display.querySelector(".pk-btn.primary");
    if (main) main.focus();
    requestAnimationFrame(relayout);
  }
  function exitPresent() {
    if (!presentEl) return;
    presentEl.classList.remove("is-present");
    document.body.classList.remove("pk-present");
    presentEl = null;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    requestAnimationFrame(relayout);
  }
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && presentEl) exitPresent(); });
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-present]");
    if (p) { enterPresent($(p.dataset.present)); return; }
    if (e.target.closest("[data-present-close]")) exitPresent();
  });

  function relayout() {
    if (!cur) return;
    if (tab === "draw") layoutDraw();
    else if (tab === "order") layoutOrder();
    else if (tab === "groups") layoutGroups();
  }
  let rzT = 0;
  window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(relayout, 80); });

  // 이름 상자 k개를 상자에 가장 크게 들어가도록 배치
  function fitGrid(box, k, maxChars, opts = {}) {
    const r = box.getBoundingClientRect();
    const W = Math.max(100, r.width - 32), H = Math.max(80, r.height - 32);
    const gap = 12;
    let best = { cols: 1, font: 10 };
    for (let c = 1; c <= k; c++) {
      const rows = Math.ceil(k / c);
      const cw = (W - gap * (c - 1)) / c, ch = (H - gap * (rows - 1)) / rows;
      const font = Math.min(ch * (opts.hRatio || 0.6), cw / (maxChars * 1.02 + 0.8));
      if (font > best.font) best = { cols: c, font, cw, ch };
    }
    best.font = Math.max(14, Math.min(opts.max || 260, best.font));
    return best;
  }
  function charLen(s) { return Math.max(2, [...String(s)].length); }

  /* ───── 뽑기 ───── */
  function paintDrawOpts() {
    const d = cur.draw;
    const wheel = d.effect === "wheel"; // 룰렛은 한 번에 한 명
    $("dr-count").textContent = wheel ? 1 : d.count;
    $("dr-dec").disabled = wheel || d.count <= 1;
    $("dr-inc").disabled = wheel || d.count >= 10;
    $("dr-count").parentElement.title = wheel ? "룰렛은 한 번에 한 명씩 돌려요" : "";
    for (const b of $("seg-fair").querySelectorAll("button")) b.setAttribute("aria-pressed", (b.dataset.v === "fair") === d.fair ? "true" : "false");
    for (const b of $("seg-effect").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.v === d.effect ? "true" : "false");
  }

  function eligible() {
    const pool = presentIds();
    if (!cur.draw.fair) return { pool, cand: pool };
    const picked = new Set(cur.picked);
    return { pool, cand: pool.filter((id) => !picked.has(id)) };
  }

  function renderDraw() {
    paintDrawOpts();
    const { pool, cand } = eligible();
    const left = $("dr-left");
    if (!cur.students.length) left.innerHTML = "";
    else if (cur.draw.fair) left.innerHTML = "이번 바퀴에서 아직 안 뽑힌 사람 <b>" + cand.length + "</b>명 / 출석 " + pool.length + "명";
    else left.innerHTML = "출석 <b>" + pool.length + "</b>명 중에서 뽑아요";
    $("dr-undo").disabled = !lastDraw || lastDraw.cls !== cur.id;
    $("dr-reset").hidden = !cur.draw.fair;
    $("dr-reset").disabled = !cur.picked.length;
    $("dr-go").disabled = busy;
    renderHistory();
    if (!busy) drawIdle();
  }

  function renderHistory() {
    const h = $("dr-history");
    h.textContent = "";
    const today = todayStr();
    const list = cur.picks.filter((p) => todayStr(new Date(p.t)) === today).slice(-30).reverse();
    if (!list.length) return;
    h.appendChild(el("span", "pk-hint", "오늘 뽑힌 사람:"));
    list.forEach((p) => {
      const c = el("span", "h");
      c.appendChild(el("small", null, new Date(p.t).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })));
      c.appendChild(document.createTextNode(p.ids.map(nameOf).join(", ")));
      h.appendChild(c);
    });
  }

  // 대기 화면(마지막 결과가 있으면 그대로 둠)
  let lastShown = null;
  function drawIdle() {
    const v = $("draw-view");
    if (cardState && cardState.cls === cur.id && cur.draw.effect === "card") { layoutCards(); return; }
    if (lastShown && lastShown.cls === cur.id && cur.draw.effect !== "wheel") { showNames(lastShown.ids.map(nameOf), true); return; }
    v.textContent = "";
    if (cur.draw.effect === "wheel" && cur.students.length) { buildWheel(wheelSegments()); return; }
    const p = el("div", "pk-placeholder");
    if (!cur.students.length) p.textContent = "먼저 📋 명단 탭에서 학생을 넣어 주세요.";
    else if (!presentIds().length) p.textContent = "출석한 학생이 없어요.";
    else p.textContent = cur.draw.effect === "card" ? "뽑기를 누르면 카드를 나눠요. 카드를 골라 뒤집어 보세요!" : "뽑기를 눌러 보세요";
    v.appendChild(p);
  }

  function layoutDraw() {
    if (busy) return;
    if (cur.draw.effect === "card" && cardState) layoutCards();
    else if (cur.draw.effect === "wheel") { const w = $("draw-view").querySelector(".pk-wheel-wrap"); if (w) sizeWheel(w); }
    else if (lastShown && lastShown.cls === cur.id) showNames(lastShown.ids.map(nameOf), true);
  }

  function showNames(names, final, maxChars) {
    const v = $("draw-view");
    let wrap = v.querySelector(".pk-names");
    if (!wrap || wrap.children.length !== names.length) {
      v.textContent = "";
      wrap = el("div", "pk-names");
      names.forEach(() => wrap.appendChild(el("div", "pk-name")));
      v.appendChild(wrap);
    }
    const mc = maxChars || Math.max(...names.map(charLen));
    const f = fitGrid(v, names.length, mc, { max: presentEl ? 320 : 200 });
    wrap.style.gridTemplateColumns = "repeat(" + f.cols + ", " + Math.floor(f.cw) + "px)";
    [...wrap.children].forEach((n, i) => {
      n.textContent = names[i];
      n.style.fontSize = f.font + "px";
      n.style.height = Math.floor(f.ch) + "px";
      n.classList.toggle("final", !!final);
      n.classList.toggle("rolling", !final);
    });
  }

  function tick() { if (SK && SK.sound) SK.sound.tone(660, 0.04, "triangle", 0.05); }
  function ding() { if (SK && SK.sound) SK.sound.play("done"); }

  function computeDraw(k) {
    const { pool, cand } = eligible();
    if (!pool.length) return null;
    k = Math.min(k, pool.length);
    if (!cur.draw.fair) return { ids: sample(pool, k), oldPart: [], newPart: [], newRound: false };
    if (cand.length >= k) { const ids = sample(cand, k); return { ids, oldPart: ids, newPart: [], newRound: false }; }
    const oldPart = shuffle(cand);
    const rest = pool.filter((id) => !oldPart.includes(id));
    const newPart = sample(rest, k - oldPart.length);
    return { ids: oldPart.concat(newPart), oldPart, newPart, newRound: true };
  }

  function commitDraw(res) {
    lastDraw = { cls: cur.id, picked: cur.picked.slice(), picksLen: cur.picks.length, shown: lastShown };
    if (cur.draw.fair) cur.picked = res.newRound ? res.newPart.slice() : cur.picked.concat(res.ids);
    cur.picks.push({ t: Date.now(), ids: res.ids.slice() });
    if (cur.picks.length > MAX_PICKS) cur.picks = cur.picks.slice(-MAX_PICKS);
    lastShown = { cls: cur.id, ids: res.ids.slice() };
    save();
    if (res.newRound) toast("모두 한 번씩 뽑혔어요. 새 바퀴를 시작했어요");
    announce(res.ids.map(nameOf).join(", ") + " 뽑혔어요");
  }

  function cancelRun() {
    runToken++;
    if (busy) { busy = false; const g = $("dr-go"); if (g) g.disabled = false; }
  }

  async function goDraw() {
    if (!cur || busy) return;
    if (!cur.students.length) { toast("먼저 명단을 넣어 주세요"); setTab("roster"); return; }
    if (!presentIds().length) { toast("출석한 학생이 없어요"); return; }
    const eff = cur.draw.effect;
    if (eff === "card") return dealCards();
    if (eff === "wheel") return spinWheel();
    const res = computeDraw(cur.draw.count);
    if (!res) return;
    const my = ++runToken;
    busy = true; $("dr-go").disabled = true;
    const poolNames = presentIds().map(nameOf);
    const mc = Math.max(...poolNames.map(charLen));
    if (!reduceMotion()) {
      const dur = 1500, t0 = performance.now();
      let el2 = 0;
      while (el2 < dur) {
        showNames(res.ids.map(() => poolNames[randInt(poolNames.length)]), false, mc);
        tick();
        const p = el2 / dur;
        await sleep(45 + p * p * 230);
        if (my !== runToken) return;
        el2 = performance.now() - t0;
      }
    }
    if (my !== runToken) return;
    busy = false;
    commitDraw(res);
    showNames(res.ids.map(nameOf), true);
    ding();
    renderDraw();
  }

  /* 카드 */
  function dealCards() {
    const res = computeDraw(cur.draw.count);
    if (!res) return;
    const { pool, cand } = eligible();
    const base = cur.draw.fair && cand.length >= res.ids.length ? cand.length : pool.length;
    const n = Math.max(res.ids.length, Math.min(CARD_MAX, base));
    cardState = { cls: cur.id, res, n, opened: [], committed: false };
    lastShown = null;
    const v = $("draw-view");
    v.textContent = "";
    const grid = el("div", "pk-cards");
    for (let i = 0; i < n; i++) {
      const b = el("button", "pk-flip");
      b.type = "button";
      b.setAttribute("aria-label", (i + 1) + "번 카드 뒤집기");
      const inn = el("span", "in");
      inn.append(el("span", "bc", String(i + 1)), el("span", "fc"));
      b.appendChild(inn);
      b.addEventListener("click", () => flipCard(b));
      grid.appendChild(b);
    }
    v.appendChild(grid);
    layoutCards();
    announce(n + "장의 카드를 나눴어요. " + res.ids.length + "장을 골라 뒤집어 보세요.");
    renderDrawInfoOnly();
  }
  function renderDrawInfoOnly() { $("dr-undo").disabled = !lastDraw || lastDraw.cls !== cur.id; }
  function layoutCards() {
    const v = $("draw-view");
    let grid = v.querySelector(".pk-cards");
    if (!grid && cardState) {
      // 탭을 다녀온 뒤: 다시 그리기
      const st = cardState; cardState = null;
      v.textContent = "";
      grid = el("div", "pk-cards");
      for (let i = 0; i < st.n; i++) {
        const b = el("button", "pk-flip"); b.type = "button";
        b.setAttribute("aria-label", (i + 1) + "번 카드 뒤집기");
        const inn = el("span", "in"); inn.append(el("span", "bc", String(i + 1)), el("span", "fc")); b.appendChild(inn);
        b.addEventListener("click", () => flipCard(b));
        grid.appendChild(b);
      }
      v.appendChild(grid);
      cardState = st;
      st.opened.forEach((o) => { const b = grid.children[o.i]; b.classList.add("open"); b.querySelector(".fc").textContent = nameOf(o.id); b.setAttribute("aria-label", nameOf(o.id)); });
      if (st.opened.length >= st.res.ids.length) [...grid.children].forEach((b) => { b.disabled = true; });
    }
    if (!grid) return;
    const n = grid.children.length;
    const r = v.getBoundingClientRect();
    const W = r.width - 32, H = r.height - 32, gap = 10;
    let best = { c: 1, w: 40 };
    for (let c = 1; c <= n; c++) {
      const rows = Math.ceil(n / c);
      const w = Math.min((W - gap * (c - 1)) / c, ((H - gap * (rows - 1)) / rows) * 0.75);
      if (w > best.w) best = { c, w };
    }
    const w = Math.floor(Math.min(best.w, 220));
    grid.style.gridTemplateColumns = "repeat(" + best.c + ", " + w + "px)";
    const mc = Math.max(...presentIds().map(nameOf).map(charLen));
    [...grid.children].forEach((b) => {
      b.style.width = w + "px"; b.style.height = Math.floor(w / 0.75) + "px";
      b.querySelector(".bc").style.fontSize = Math.max(14, w * 0.32) + "px";
      b.querySelector(".fc").style.fontSize = Math.max(12, Math.min(w * 0.3, (w - 8) / (mc * 1.02))) + "px";
    });
  }
  function flipCard(b) {
    const st = cardState;
    if (!st || b.classList.contains("open") || st.opened.length >= st.res.ids.length) return;
    const grid = b.parentElement;
    const i = [...grid.children].indexOf(b);
    const id = st.res.ids[st.opened.length];
    st.opened.push({ i, id });
    b.querySelector(".fc").textContent = nameOf(id);
    b.setAttribute("aria-label", nameOf(id));
    b.classList.add("open");
    if (st.opened.length >= st.res.ids.length) {
      [...grid.children].forEach((x) => { x.disabled = true; });
      if (!st.committed) { st.committed = true; commitDraw(st.res); lastShown = null; }
      ding();
      renderDrawInfo();
    } else tick();
  }
  function renderDrawInfo() {
    // 카드 화면은 그대로 두고 안내·기록만 갱신
    const keep = cardState;
    paintDrawOpts();
    const { pool, cand } = eligible();
    $("dr-left").innerHTML = cur.draw.fair ? "이번 바퀴에서 아직 안 뽑힌 사람 <b>" + cand.length + "</b>명 / 출석 " + pool.length + "명" : "출석 <b>" + pool.length + "</b>명 중에서 뽑아요";
    $("dr-undo").disabled = !lastDraw || lastDraw.cls !== cur.id;
    $("dr-reset").disabled = !cur.picked.length;
    renderHistory();
    cardState = keep;
  }

  /* 룰렛 */
  function wheelSegments() {
    const { pool, cand } = eligible();
    const ids = cur.draw.fair && cand.length ? cand : pool;
    return ids.slice(0, 400);
  }
  function buildWheel(ids, rot) {
    const v = $("draw-view");
    v.textContent = "";
    if (ids.length > WHEEL_MAX) {
      const p = el("div", "pk-placeholder", "룰렛은 " + WHEEL_MAX + "명까지 쓸 수 있어요. 지금은 " + ids.length + "명이라 슬롯이나 카드를 써 주세요.");
      v.appendChild(p);
      return null;
    }
    if (!ids.length) { v.appendChild(el("div", "pk-placeholder", "출석한 학생이 없어요.")); return null; }
    const wrap = el("div", "pk-wheel-wrap");
    wrap.appendChild(el("div", "pointer"));
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "-110 -110 220 220");
    s.setAttribute("class", "wheel");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", ids.length + "명이 있는 룰렛");
    const n = ids.length, a = (Math.PI * 2) / n;
    const fs = Math.max(4.5, Math.min(13, 260 / n / 1.6));
    ids.forEach((id, i) => {
      const a0 = -Math.PI / 2 + i * a, a1 = a0 + a;
      const p = document.createElementNS(NS, n === 1 ? "circle" : "path");
      if (n === 1) { p.setAttribute("r", "100"); }
      else p.setAttribute("d", "M0 0 L" + (100 * Math.cos(a0)).toFixed(2) + " " + (100 * Math.sin(a0)).toFixed(2) + " A100 100 0 " + (a > Math.PI ? 1 : 0) + " 1 " + (100 * Math.cos(a1)).toFixed(2) + " " + (100 * Math.sin(a1)).toFixed(2) + " Z");
      p.setAttribute("fill", GROUP_COLORS[i % GROUP_COLORS.length]);
      p.setAttribute("opacity", i % 2 ? "0.82" : "0.95");
      p.setAttribute("stroke", "rgba(255,255,255,.7)");
      p.setAttribute("stroke-width", "0.6");
      s.appendChild(p);
      const t = document.createElementNS(NS, "text");
      const mid = a0 + a / 2;
      t.setAttribute("x", (60 * Math.cos(mid)).toFixed(2));
      t.setAttribute("y", (60 * Math.sin(mid)).toFixed(2));
      t.setAttribute("transform", "rotate(" + (mid * 180 / Math.PI).toFixed(2) + " " + (60 * Math.cos(mid)).toFixed(2) + " " + (60 * Math.sin(mid)).toFixed(2) + ")");
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      t.setAttribute("font-size", fs.toFixed(1));
      t.setAttribute("font-weight", "800");
      t.setAttribute("fill", "#fff");
      const nm = nameOf(id);
      t.textContent = [...nm].length > 6 ? [...nm].slice(0, 6).join("") + "…" : nm;
      s.appendChild(t);
    });
    const hub = document.createElementNS(NS, "circle");
    hub.setAttribute("r", "9"); hub.setAttribute("fill", "#fff"); hub.setAttribute("stroke", "rgba(0,0,0,.2)");
    s.appendChild(hub);
    s.style.transition = "none";
    s.style.transform = "rotate(" + (rot != null ? rot : wheelRot) + "deg)";
    wrap.appendChild(s);
    v.appendChild(wrap);
    sizeWheel(wrap);
    return s;
  }
  function sizeWheel(wrap) {
    const v = $("draw-view").getBoundingClientRect();
    const d = Math.max(160, Math.min(v.width - 32, v.height - 32));
    wrap.style.width = d + "px"; wrap.style.height = d + "px";
  }
  async function spinWheel() {
    const ids = wheelSegments();
    if (ids.length > WHEEL_MAX) { toast("룰렛은 " + WHEEL_MAX + "명까지예요. 슬롯으로 뽑을게요"); cur.draw.effect = "slot"; save(); paintDrawOpts(); return goDraw(); }
    // 룰렛은 한 번에 한 명
    const { pool, cand } = eligible();
    let res;
    const idx = randInt(ids.length);
    const id = ids[idx];
    if (!cur.draw.fair) res = { ids: [id], oldPart: [], newPart: [], newRound: false };
    else if (cand.length) res = { ids: [id], oldPart: [id], newPart: [], newRound: false };
    else res = { ids: [id], oldPart: [], newPart: [id], newRound: true };
    void pool;
    const my = ++runToken;
    busy = true; $("dr-go").disabled = true;
    const s = buildWheel(ids, wheelRot);
    if (!s) { busy = false; $("dr-go").disabled = false; return; }
    const seg = 360 / ids.length;
    const center = idx * seg + seg / 2;
    const jitter = (randInt(1000) / 1000 - 0.5) * seg * 0.6;
    const base = wheelRot - (wheelRot % 360);
    const target = base + 360 * 5 + ((360 - center - jitter) % 360 + 360) % 360;
    wheelRot = target;
    // 강제 리플로 후 회전 시작
    void s.getBoundingClientRect();
    s.style.transition = "";
    s.style.transform = "rotate(" + target + "deg)";
    let lastTickAngle = 0;
    const t0 = performance.now();
    const ticker = setInterval(() => {
      if (my !== runToken) { clearInterval(ticker); return; }
      const m = new DOMMatrixReadOnly(getComputedStyle(s).transform);
      const ang = Math.atan2(m.b, m.a) * 180 / Math.PI;
      if (Math.abs(ang - lastTickAngle) >= seg) { lastTickAngle = ang; tick(); }
      if (performance.now() - t0 > 4000) clearInterval(ticker);
    }, 40);
    await new Promise((r) => {
      let done = false;
      const fin = () => { if (!done) { done = true; r(); } };
      s.addEventListener("transitionend", fin, { once: true });
      setTimeout(fin, reduceMotion() ? 50 : 4000);
    });
    clearInterval(ticker);
    if (my !== runToken) return;
    busy = false;
    commitDraw(res);
    lastShown = null;
    const wrap = $("draw-view").querySelector(".pk-wheel-wrap");
    if (wrap) {
      const r = el("div", "pk-wheel-result", nameOf(id));
      r.style.fontSize = Math.max(22, Math.min(90, wrap.offsetWidth / (charLen(nameOf(id)) * 1.3 + 1))) + "px";
      wrap.appendChild(r);
    }
    ding();
    paintDrawOpts();
    const { cand: c2, pool: p2 } = eligible();
    $("dr-left").innerHTML = cur.draw.fair ? "이번 바퀴에서 아직 안 뽑힌 사람 <b>" + c2.length + "</b>명 / 출석 " + p2.length + "명" : "출석 <b>" + p2.length + "</b>명 중에서 뽑아요";
    $("dr-undo").disabled = false; $("dr-reset").disabled = !cur.picked.length; $("dr-go").disabled = false;
    renderHistory();
  }

  $("dr-go").addEventListener("click", goDraw);
  $("dr-dec").addEventListener("click", () => { cur.draw.count = Math.max(1, cur.draw.count - 1); save(); cardState = null; lastShown = null; renderDraw(); });
  $("dr-inc").addEventListener("click", () => {
    cur.draw.count = Math.min(10, cur.draw.count + 1); save(); cardState = null; lastShown = null; renderDraw();
  });
  $("seg-fair").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || busy) return; cur.draw.fair = b.dataset.v === "fair"; save(); cardState = null; renderDraw(); });
  $("seg-effect").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || busy) return;
    cur.draw.effect = b.dataset.v; save(); cardState = null; lastShown = null; renderDraw();
    if (cur.draw.effect === "wheel" && cur.draw.count > 1) toast("룰렛은 한 번에 한 명씩 돌려요");
  });
  $("dr-undo").addEventListener("click", () => {
    if (!lastDraw || lastDraw.cls !== cur.id) return;
    cancelRun();
    cur.picked = lastDraw.picked;
    cur.picks = cur.picks.slice(0, lastDraw.picksLen);
    lastShown = lastDraw.shown && lastDraw.shown.cls === cur.id ? lastDraw.shown : null;
    lastDraw = null; cardState = null;
    save();
    toast("방금 뽑기를 취소했어요. 다시 뽑을 수 있어요");
    renderDraw();
  });
  $("dr-reset").addEventListener("click", async () => {
    if (!(await confirmDlg("새 바퀴 시작", "이번 바퀴 기록을 지우고 모두 다시 뽑힐 수 있게 할까요?", "새 바퀴"))) return;
    cur.picked = []; lastDraw = null; save(); toast("새 바퀴를 시작했어요"); renderDraw();
  });
  if (SK && SK.sound) { SK.sound.useKey("vives:picker-muted"); SK.sound.bindButton("#dr-sound"); }
  else $("dr-sound").hidden = true;

  /* ───── 순서 ───── */
  function renderOrder() {
    const o = cur.order;
    const list = $("or-list");
    list.textContent = "";
    const ab = absentSet();
    o.list.forEach((id, i) => {
      const b = el("button", "pk-ochip");
      b.type = "button";
      b.appendChild(el("span", "n", String(i + 1)));
      b.appendChild(el("span", null, nameOf(id) + (ab.has(id) ? " (결석)" : "")));
      if (o.done.includes(id)) b.classList.add("done");
      if (i === o.cur) { b.classList.add("cur"); b.setAttribute("aria-current", "step"); }
      b.addEventListener("click", () => { o.cur = i; o.done = o.list.slice(0, i); save(); renderOrder(); });
      list.appendChild(b);
    });
    $("or-prev").disabled = !o.list.length || o.cur <= 0;
    $("or-next").disabled = !o.list.length || o.cur >= o.list.length;
    $("or-shuffle").querySelector("span").textContent = o.list.length ? "다시 섞기" : "순서 섞기";
    layoutOrder();
  }
  function layoutOrder() {
    const v = $("order-view");
    const o = cur.order;
    v.textContent = "";
    if (!o.list.length) {
      v.appendChild(el("div", "pk-placeholder", cur.students.length ? "순서 섞기를 누르면 출석한 학생의 발표 순서를 정해요." : "먼저 📋 명단 탭에서 학생을 넣어 주세요."));
      return;
    }
    const box = el("div", "pk-order-now");
    const r = v.getBoundingClientRect();
    if (o.cur >= o.list.length) {
      const nm = el("div", "nm", "모두 끝났어요 👏");
      nm.style.fontSize = Math.max(24, Math.min(r.height * 0.25, r.width / 9)) + "px";
      box.appendChild(nm);
    } else {
      const name = nameOf(o.list[o.cur]);
      const big = Math.max(28, Math.min(r.height * 0.42, (r.width - 40) / (charLen(name) * 1.02), presentEl ? 360 : 180));
      const no = el("div", "no", (o.cur + 1) + "번째 / " + o.list.length + "명");
      no.style.fontSize = Math.max(14, big * 0.18) + "px";
      const nm = el("div", "nm", name);
      nm.style.fontSize = big + "px";
      box.append(no, nm);
      if (o.cur + 1 < o.list.length) { const nx = el("div", "nx", "다음: " + nameOf(o.list[o.cur + 1])); nx.style.fontSize = Math.max(14, big * 0.2) + "px"; box.appendChild(nx); }
    }
    v.appendChild(box);
  }
  function orderNext() {
    const o = cur.order;
    if (o.cur >= o.list.length) return;
    if (!o.done.includes(o.list[o.cur])) o.done.push(o.list[o.cur]);
    o.cur++; save(); renderOrder();
    if (o.cur < o.list.length) announce((o.cur + 1) + "번째 " + nameOf(o.list[o.cur])); else announce("모두 끝났어요");
  }
  function orderPrev() {
    const o = cur.order;
    if (o.cur <= 0) return;
    o.cur--; o.done = o.done.filter((id) => id !== o.list[o.cur]); save(); renderOrder();
    announce((o.cur + 1) + "번째 " + nameOf(o.list[o.cur]));
  }
  $("or-next").addEventListener("click", orderNext);
  $("or-prev").addEventListener("click", orderPrev);
  $("or-shuffle").addEventListener("click", async () => {
    const pool = presentIds();
    if (!pool.length) { toast(cur.students.length ? "출석한 학생이 없어요" : "먼저 명단을 넣어 주세요"); return; }
    const o = cur.order;
    if (o.list.length && o.cur > 0 && o.cur < o.list.length && !(await confirmDlg("다시 섞기", "지금 순서를 버리고 새로 섞을까요?", "다시 섞기"))) return;
    o.list = shuffle(pool); o.cur = 0; o.done = [];
    save(); renderOrder();
    if (SK && SK.sound) SK.sound.play("star");
    announce("순서를 정했어요. 첫째는 " + nameOf(o.list[0]));
  });

  /* ───── 모둠 ───── */
  function groupSizes(N) {
    const g = cur.groups;
    let G;
    if (g.mode === "count") G = Math.min(g.count, N);
    else G = g.rem === "add" ? Math.max(1, Math.floor(N / g.size)) : Math.ceil(N / g.size);
    G = Math.max(1, Math.min(G, N, 40));
    const base = Math.floor(N / G), extra = N % G;
    return Array.from({ length: G }, (_, i) => base + (i < extra ? 1 : 0));
  }
  const pairKey = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

  function scoreGroups(groups, ctx) {
    let s = 0;
    for (const gr of groups) {
      const set = new Set(gr);
      for (const [a, b] of ctx.pairs) if (set.has(a) && set.has(b)) s += 1000;
      if (ctx.prev.size) for (let i = 0; i < gr.length; i++) for (let j = i + 1; j < gr.length; j++) s += (ctx.prev.get(pairKey(gr[i], gr[j])) || 0) * 10;
      if (ctx.gender) {
        let m = 0, f = 0;
        for (const id of gr) { const g = ctx.gmap.get(id); if (g === "M") m++; else if (g === "F") f++; }
        const n = m + f;
        if (n) { const d = m - n * ctx.ratio; s += d * d * 4; }
      }
    }
    return s;
  }

  function makeGroups() {
    const g = cur.groups;
    const pool = presentIds();
    const N = pool.length;
    if (!N) return null;
    const sizes = groupSizes(N);
    const G = sizes.length;
    const gmap = new Map(cur.students.map((s) => [s.id, s.gender]));
    const genders = pool.map((id) => gmap.get(id)).filter(Boolean);
    const ctx = {
      pairs: cur.pairs.filter(([a, b]) => pool.includes(a) && pool.includes(b)),
      prev: new Map(), gender: g.gender && genders.length > 0,
      ratio: genders.length ? genders.filter((x) => x === "M").length / genders.length : 0.5, gmap,
    };
    if (g.avoidPrev) for (const h of g.history) for (const gr of h) for (let i = 0; i < gr.length; i++) for (let j = i + 1; j < gr.length; j++) { const k = pairKey(gr[i], gr[j]); ctx.prev.set(k, (ctx.prev.get(k) || 0) + 1); }
    // 고정 학생 먼저
    const fixed = Array.from({ length: G }, () => []);
    const pinnedIds = new Set();
    for (const id of pool) {
      const gi = g.pins[id];
      if (gi != null && gi < G && fixed[gi].length < sizes[gi]) { fixed[gi].push(id); pinnedIds.add(id); }
    }
    const free = pool.filter((id) => !pinnedIds.has(id));
    let best = null, bestScore = Infinity;
    const tries = 260;
    for (let t = 0; t < tries; t++) {
      const order = shuffle(free);
      const groups = fixed.map((f) => f.slice());
      let k = 0;
      for (let gi = 0; gi < G; gi++) while (groups[gi].length < sizes[gi]) groups[gi].push(order[k++]);
      // 짧은 교환 개선
      let sc = scoreGroups(groups, ctx);
      for (let it = 0; it < 120 && sc > 0; it++) {
        const a = randInt(G), b = randInt(G);
        if (a === b) continue;
        const ia = randInt(groups[a].length), ib = randInt(groups[b].length);
        const x = groups[a][ia], y = groups[b][ib];
        if (pinnedIds.has(x) || pinnedIds.has(y)) continue;
        groups[a][ia] = y; groups[b][ib] = x;
        const ns = scoreGroups(groups, ctx);
        if (ns <= sc) sc = ns; else { groups[a][ia] = x; groups[b][ib] = y; }
      }
      if (sc < bestScore) { bestScore = sc; best = groups; if (sc === 0) break; }
    }
    return best.map((gr) => shuffle(gr));
  }

  function pickLeaders() {
    const g = cur.groups;
    g.leaders = g.lead && g.cur ? g.cur.map((gr) => gr.length ? gr[randInt(gr.length)] : null).filter((x) => x != null) : [];
  }

  function pushGroupUndo() {
    const g = cur.groups;
    groupUndo.push(JSON.stringify({ cur: g.cur, leaders: g.leaders, pins: g.pins }));
    if (groupUndo.length > 20) groupUndo.shift();
  }

  function groupViolations() {
    const g = cur.groups;
    if (!g.cur) return [];
    const out = [];
    for (const gr of g.cur) { const s = new Set(gr); for (const [a, b] of cur.pairs) if (s.has(a) && s.has(b)) out.push([a, b]); }
    return out;
  }

  function paintGroupOpts() {
    const g = cur.groups;
    for (const b of $("seg-gmode").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.v === g.mode ? "true" : "false");
    for (const b of $("seg-grem").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.v === g.rem ? "true" : "false");
    $("gr-rem-wrap").hidden = g.mode !== "size";
    const v = g.mode === "count" ? g.count : g.size;
    $("gr-val").textContent = v + (g.mode === "count" ? "모둠" : "명");
    $("gr-dec").disabled = v <= (g.mode === "count" ? 1 : 2);
    $("gr-inc").disabled = v >= 20;
    $("gr-gender").checked = g.gender; $("gr-prev").checked = g.avoidPrev; $("gr-lead").checked = g.lead;
    $("gr-pairs").textContent = "떨어뜨릴 쌍 " + cur.pairs.length + "개";
    $("gr-undo").disabled = !groupUndo.length;
    $("gr-keep").disabled = !g.cur;
    $("gr-print").disabled = !g.cur;
    $("gr-go").querySelector("span").textContent = g.cur ? "다시 나누기" : "모둠 나누기";
  }

  function renderGroups() {
    paintGroupOpts();
    const g = cur.groups;
    const v = $("groups-view");
    v.textContent = "";
    const st = $("gr-status");
    st.textContent = "";
    if (!g.cur) {
      v.style.alignItems = "center";
      v.appendChild(el("div", "pk-placeholder", cur.students.length ? "모둠 나누기를 누르면 출석한 학생으로 모둠을 만들어요." : "먼저 📋 명단 탭에서 학생을 넣어 주세요."));
      $("gr-selbar").hidden = true;
      return;
    }
    v.style.alignItems = "stretch";
    const wrap = el("div", "pk-groups");
    const viol = groupViolations();
    const bad = new Set(viol.flat());
    const ab = absentSet();
    const leaders = new Set(g.leaders);
    g.cur.forEach((gr, gi) => {
      const box = el("div", "pk-group");
      box.dataset.g = gi;
      const head = el("div", "pk-ghead");
      const dot = el("span", "dot"); dot.style.background = GROUP_COLORS[gi % GROUP_COLORS.length];
      head.append(dot, el("span", null, (gi + 1) + "모둠"), el("span", "cnt", gr.length + "명"));
      box.appendChild(head);
      gr.forEach((id) => {
        const s = stu(id);
        const m = el("button", "pk-mem");
        m.type = "button";
        m.dataset.id = id;
        const gd = el("span", "g" + (s && s.gender ? " " + s.gender : ""));
        m.append(gd, el("span", "nm", nameOf(id) + (ab.has(id) ? " (결석)" : "")));
        if (leaders.has(id)) m.appendChild(el("span", "tag lead", "모둠장"));
        if (g.pins[id] === gi) m.appendChild(el("span", "tag pin", "📌"));
        if (bad.has(id)) m.classList.add("bad");
        if (selMem === id) m.classList.add("sel");
        m.setAttribute("aria-label", nameOf(id) + ", " + (gi + 1) + "모둠" + (leaders.has(id) ? ", 모둠장" : "") + (g.pins[id] === gi ? ", 고정" : "") + (selMem === id ? ", 선택됨" : ""));
        box.appendChild(m);
      });
      if (selMem != null && !gr.includes(selMem)) {
        // 모둠 상자 어디를 눌러도 옮겨지고(터치), 키보드는 머리말의 버튼으로
        box.classList.add("target");
        const mv = el("button", "pk-btn sm", "여기로");
        mv.type = "button";
        mv.dataset.move = gi;
        mv.setAttribute("aria-label", (SK && SK.josa ? SK.josa(nameOf(selMem), "을/를") : nameOf(selMem) + "을(를)") + " " + (gi + 1) + "모둠으로 옮기기");
        mv.style.marginLeft = "6px";
        head.appendChild(mv);
      }
      wrap.appendChild(box);
    });
    v.appendChild(wrap);
    // 상태
    const sizes = g.cur.map((x) => x.length);
    st.appendChild(el("span", null, g.cur.length + "모둠 · " + Math.min(...sizes) + (Math.min(...sizes) !== Math.max(...sizes) ? "~" + Math.max(...sizes) : "") + "명씩"));
    if (viol.length) st.appendChild(el("span", "pk-warnline", "떨어뜨릴 쌍이 같은 모둠: " + viol.map(([a, b]) => nameOf(a) + "·" + nameOf(b)).join(", ")));
    else if (cur.pairs.length) st.appendChild(el("span", "pk-okline", "떨어뜨릴 쌍 모두 지킴"));
    const inGroups = new Set(g.cur.flat());
    const missing = presentIds().filter((id) => !inGroups.has(id));
    if (missing.length) st.appendChild(el("span", "pk-warnline", "모둠에 없는 출석 학생 " + missing.length + "명 — 다시 나누기를 누르세요"));
    // 선택 막대
    const sb = $("gr-selbar");
    if (selMem != null && inGroups.has(selMem)) {
      sb.hidden = false;
      const gi = g.cur.findIndex((x) => x.includes(selMem));
      $("gr-seltext").textContent = nameOf(selMem) + " 선택 — 바꿀 학생이나 옮길 모둠을 누르세요";
      const pinned = g.pins[selMem] === gi;
      $("gr-pin").querySelector("span").textContent = pinned ? "고정 풀기" : (gi + 1) + "모둠에 고정";
    } else { sb.hidden = true; if (selMem != null) selMem = null; }
    layoutGroups();
  }

  function layoutGroups() {
    const wrap = $("groups-view").querySelector(".pk-groups");
    if (!wrap || !cur.groups.cur) return;
    const G = cur.groups.cur.length;
    const maxM = Math.max(1, ...cur.groups.cur.map((x) => x.length));
    const r = $("groups-view").getBoundingClientRect();
    if (presentEl === $("groups-display")) {
      const W = r.width - 32, H = r.height - 32, gap = 12;
      const mc = Math.max(...cur.groups.cur.flat().map((id) => charLen(nameOf(id))), 2);
      let best = { c: 1, fs: 10 };
      for (let c = 1; c <= G; c++) {
        const rows = Math.ceil(G / c);
        const cw = (W - gap * (c - 1)) / c, ch = (H - gap * (rows - 1)) / rows;
        const line = (ch - 20) / (maxM + 1.4);
        const fs = Math.min(line * 0.55, (cw - 60) / (mc + 3));
        if (fs > best.fs) best = { c, fs, line };
      }
      wrap.style.gridTemplateColumns = "repeat(" + best.c + ", minmax(0, 1fr))";
      const fs = Math.max(14, Math.min(64, best.fs));
      wrap.style.setProperty("font-size", fs + "px");
      for (const m of wrap.querySelectorAll(".pk-mem")) { m.style.fontSize = fs + "px"; m.style.minHeight = Math.max(44, fs * 1.7) + "px"; }
      for (const h of wrap.querySelectorAll(".pk-ghead")) h.style.fontSize = Math.max(15, fs * 0.9) + "px";
    } else {
      const cols = Math.max(1, Math.min(G, Math.floor((r.width - 32 + 12) / 190)));
      wrap.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
      wrap.style.removeProperty("font-size");
      for (const m of wrap.querySelectorAll(".pk-mem")) { m.style.fontSize = ""; m.style.minHeight = ""; }
      for (const h of wrap.querySelectorAll(".pk-ghead")) h.style.fontSize = "";
    }
  }

  function groupOf(id) { return cur.groups.cur ? cur.groups.cur.findIndex((x) => x.includes(id)) : -1; }
  function swapMembers(a, b) {
    const g = cur.groups, ga = groupOf(a), gb = groupOf(b);
    if (ga < 0 || gb < 0 || a === b) return;
    pushGroupUndo();
    const ia = g.cur[ga].indexOf(a), ib = g.cur[gb].indexOf(b);
    g.cur[ga][ia] = b; g.cur[gb][ib] = a;
    if (g.pins[a] != null) g.pins[a] = gb;
    if (g.pins[b] != null) g.pins[b] = ga;
    save(); announce(nameOf(a) + "·" + nameOf(b) + " 자리를 바꿨어요");
  }
  function moveMember(id, gi) {
    const g = cur.groups, from = groupOf(id);
    if (from < 0 || from === gi) return;
    pushGroupUndo();
    g.cur[from] = g.cur[from].filter((x) => x !== id);
    g.cur[gi].push(id);
    if (g.pins[id] != null) g.pins[id] = gi;
    if (g.leaders.includes(id) && g.lead) { pickLeaders(); }
    save(); announce(nameOf(id) + " → " + (gi + 1) + "모둠");
  }

  $("gr-go").addEventListener("click", async () => {
    if (!cur.students.length) { toast("먼저 명단을 넣어 주세요"); setTab("roster"); return; }
    if (!presentIds().length) { toast("출석한 학생이 없어요"); return; }
    if (cur.groups.cur) pushGroupUndo();
    const res = makeGroups();
    if (!res) return;
    cur.groups.cur = res;
    selMem = null;
    pickLeaders();
    save();
    renderGroups();
    if (!reduceMotion()) for (const m of $("groups-view").querySelectorAll(".pk-mem")) { m.style.animation = "pkPop .3s " + (randInt(250)) + "ms both cubic-bezier(.2,1.4,.4,1)"; }
    if (SK && SK.sound) SK.sound.play("star");
    const v = groupViolations();
    announce(res.length + "모둠으로 나눴어요" + (v.length ? ". 떨어뜨릴 쌍 " + v.length + "개를 지키지 못했어요" : ""));
  });
  $("gr-undo").addEventListener("click", () => {
    const s = groupUndo.pop();
    if (!s) return;
    const o = JSON.parse(s);
    cur.groups.cur = o.cur; cur.groups.leaders = o.leaders || []; cur.groups.pins = o.pins || {};
    selMem = null; save(); renderGroups();
  });
  $("gr-keep").addEventListener("click", () => {
    const g = cur.groups;
    if (!g.cur) return;
    g.history.push(g.cur.map((x) => x.slice()));
    g.history = g.history.slice(-GROUP_HISTORY);
    save();
    toast("기억했어요. 다음에 ‘지난 모둠과 덜 겹치게’가 이 모둠을 피해요");
  });
  $("gr-print").addEventListener("click", () => {
    if (!cur.groups.cur) return;
    const d = new Date();
    $("groups-print-title").textContent = cur.name + " 모둠 · " + d.getFullYear() + ". " + (d.getMonth() + 1) + ". " + d.getDate() + ".";
    exitPresent();
    document.body.classList.add("pk-printing");
    const done = () => { document.body.classList.remove("pk-printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
  });
  $("seg-gmode").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; cur.groups.mode = b.dataset.v; save(); paintGroupOpts(); });
  $("seg-grem").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; cur.groups.rem = b.dataset.v; save(); paintGroupOpts(); });
  $("gr-dec").addEventListener("click", () => { const g = cur.groups; if (g.mode === "count") g.count = Math.max(1, g.count - 1); else g.size = Math.max(2, g.size - 1); save(); paintGroupOpts(); });
  $("gr-inc").addEventListener("click", () => { const g = cur.groups; if (g.mode === "count") g.count = Math.min(20, g.count + 1); else g.size = Math.min(20, g.size + 1); save(); paintGroupOpts(); });
  $("gr-gender").addEventListener("change", () => { cur.groups.gender = $("gr-gender").checked; save(); });
  $("gr-prev").addEventListener("change", () => { cur.groups.avoidPrev = $("gr-prev").checked; save(); if (cur.groups.avoidPrev && !cur.groups.history.length) toast("모둠을 나눈 뒤 ‘이대로 쓰기’를 누르면 그 모둠을 기억해요"); });
  $("gr-lead").addEventListener("change", () => { cur.groups.lead = $("gr-lead").checked; pickLeaders(); save(); renderGroups(); });
  $("gr-pairs").addEventListener("click", openPairs);
  $("gr-unsel").addEventListener("click", () => { selMem = null; renderGroups(); });
  $("gr-pin").addEventListener("click", () => {
    if (selMem == null) return;
    const gi = groupOf(selMem);
    if (cur.groups.pins[selMem] === gi) delete cur.groups.pins[selMem]; else cur.groups.pins[selMem] = gi;
    save(); renderGroups();
  });

  // 모둠: 누르기(선택→바꾸기/옮기기)와 끌어 놓기
  let drag = null;
  const view = $("groups-view");
  view.addEventListener("pointerdown", (e) => {
    const m = e.target.closest(".pk-mem");
    if (!m || e.button > 0) return;
    drag = { id: +m.dataset.id, el: m, x: e.clientX, y: e.clientY, pid: e.pointerId, on: false, ghost: null, over: null };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      drag.on = true;
      drag.el.classList.add("dragging");
      drag.ghost = el("div", "pk-ghost", nameOf(drag.id));
      document.body.appendChild(drag.ghost);
    }
    e.preventDefault();
    drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const over = t && (t.closest(".pk-mem") || t.closest(".pk-group"));
    if (drag.over && drag.over !== over) drag.over.classList.remove("drop", "sel");
    if (over && over !== drag.el) over.classList.add(over.classList.contains("pk-group") ? "drop" : "sel");
    drag.over = over;
  }, { passive: false });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove("dragging");
    if (d.over) d.over.classList.remove("drop");
    if (!d.on) return; // 누르기는 click에서
    suppressClick = Date.now() + 300;
    const over = d.over;
    if (!over || over === d.el) { renderGroups(); return; }
    if (over.classList.contains("pk-mem")) swapMembers(d.id, +over.dataset.id);
    else if (over.classList.contains("pk-group")) moveMember(d.id, +over.dataset.g);
    selMem = null;
    renderGroups();
  }
  let suppressClick = 0;
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", (e) => { if (drag && e.pointerId === drag.pid) { const d = drag; drag = null; if (d.ghost) d.ghost.remove(); d.el.classList.remove("dragging"); if (d.over) d.over.classList.remove("drop", "sel"); } });
  view.addEventListener("click", (e) => {
    if (Date.now() < suppressClick) return;
    const m = e.target.closest(".pk-mem");
    if (m) {
      const id = +m.dataset.id;
      if (selMem == null) selMem = id;
      else if (selMem === id) selMem = null;
      else { swapMembers(selMem, id); selMem = null; }
      renderGroups();
      const again = view.querySelector('.pk-mem[data-id="' + id + '"]');
      if (again) again.focus();
      return;
    }
    const gbox = e.target.closest(".pk-group.target");
    if (gbox && selMem != null) { moveMember(selMem, +gbox.dataset.g); selMem = null; renderGroups(); }
  });
  view.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selMem != null) { e.stopPropagation(); selMem = null; renderGroups(); }
  });

  /* ───── 명단 탭 ───── */
  function renderRoster() {
    const ab = absentSet();
    const s = cur.students;
    const m = s.filter((x) => x.gender === "M").length, f = s.filter((x) => x.gender === "F").length;
    $("ro-sum").textContent = s.length
      ? "학생 " + s.length + "명" + (m || f ? " (남 " + m + " · 여 " + f + ")" : "") + " · 오늘 결석 " + ab.size + "명 — 이름을 누르면 오늘 결석으로 표시돼요(내일이면 자동으로 풀려요)."
      : "아직 학생이 없어요. 명단 편집을 눌러 이름을 넣거나 번호만으로 시작하세요.";
    $("ro-seating").hidden = !seatingClasses().length;
    $("ro-pairs").textContent = "떨어뜨릴 쌍 " + cur.pairs.length + "개";
    $("ro-clear-absent").disabled = !ab.size;
    const list = $("ro-list");
    list.textContent = "";
    s.forEach((st) => {
      const b = el("button", "pk-stu");
      b.type = "button";
      b.setAttribute("aria-pressed", ab.has(st.id) ? "true" : "false");
      b.setAttribute("aria-label", st.name + (ab.has(st.id) ? ", 결석" : ", 출석"));
      b.append(el("span", "g" + (st.gender ? " " + st.gender : "")), el("span", "nm", st.name), el("span", "st", ab.has(st.id) ? "결석" : ""));
      b.addEventListener("click", () => { toggleAbsent(st.id); renderClass(); const again = [...list.children][s.indexOf(st)]; if (again) again.focus(); });
      list.appendChild(b);
    });
  }
  $("ro-edit").addEventListener("click", openRosterModal);
  $("ro-seating").addEventListener("click", async () => {
    if (cur.students.length && !(await confirmDlg("명단 바꾸기", "자리 배치 학급의 명단으로 지금 명단을 바꿀까요?", "고르기"))) return;
    openSeatingModal(cur);
  });
  $("ro-pairs").addEventListener("click", openPairs);
  $("ro-clear-absent").addEventListener("click", () => { cur.absent = { date: todayStr(), ids: [] }; save(); renderClass(); });

  /* ───── 키보드 ───── */
  document.addEventListener("keydown", (e) => {
    if (!cur) return;
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (typing || document.querySelector(".pk-modal.open")) return;
    if (e.key === "Escape" && presentEl) { exitPresent(); return; }
    const onButton = t && t.closest && t.closest("button, [role=button], a, label");
    if (tab === "draw" && (e.key === " " || e.key === "Enter") && !onButton) { e.preventDefault(); goDraw(); return; }
    if (tab === "order" && !onButton) {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); orderNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); orderPrev(); }
    }
  });

  /* ───── 시작 ───── */
  if (!VUI) toast("저장 기능을 불러오지 못했어요");
  renderList();
})();
