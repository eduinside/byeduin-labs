/* ================================================================
   시계 보기 — clock (eduin VIVES)
   - immersive 셸 + SimKit(미션·피드백·저장·공유·읽어주기·효과음)
   - 학년별 단위 제한(정각·30분 / 10분 / 5분 / 1분 / 1초) 하나가 끌기 맞춤·버튼·미션 문제·입력판에 모두 적용
   - 잠금 링크(#share= {v:1, unit, lock:true})로 연 화면은 단위를 바꿀 수 없음(이번 방문만)
   - localStorage `clock:v1`만 사용, 학생 정보 없음
   계획: docs/clock-plan.md
   ================================================================ */
(function () {
  "use strict";

  const SK = window.SimKit;
  const VUI = window.VUI;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const DAY = 86400, HALF = 43200;

  const UNITS = {
    h30: { u: "정각·30분", grade: "1학년", step: 1800 },
    m10: { u: "10분", grade: "2학년", step: 600 },
    m5: { u: "5분", grade: "2학년", step: 300 },
    m1: { u: "1분", grade: "2학년", step: 60 },
    s1: { u: "1초", grade: "3학년", step: 1 },
  };
  const UNIT_KEYS = Object.keys(UNITS);
  const SHOW_KEYS = ["minuteNums", "ticks", "hourZone", "dayBar", "second"];
  const SHOW_DEFAULT = {
    h30: { minuteNums: false, ticks: false, hourZone: true, dayBar: false, second: false },
    m10: { minuteNums: true, ticks: false, hourZone: false, dayBar: false, second: false },
    m5: { minuteNums: true, ticks: true, hourZone: false, dayBar: false, second: false },
    m1: { minuteNums: true, ticks: true, hourZone: false, dayBar: false, second: false },
    s1: { minuteNums: true, ticks: true, hourZone: false, dayBar: false, second: true },
  };

  /* ───── 저장 ───── */
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const store = SK.store("clock:v1", {
    defaults: { unit: "m5", progress: {}, show: null },
    validate(raw, d) {
      if (!isObj(raw)) return null;
      const out = { unit: UNIT_KEYS.includes(raw.unit) ? raw.unit : d.unit, progress: {}, show: null };
      if (isObj(raw.progress)) for (const k of UNIT_KEYS) if (isObj(raw.progress[k])) out.progress[k] = raw.progress[k];
      if (isObj(raw.show)) { out.show = {}; for (const k of SHOW_KEYS) out.show[k] = !!raw.show[k]; }
      return out;
    },
  });
  const saved = store.load();
  function persist() { store.save(saved); }

  /* ───── 상태 ───── */
  const state = {
    t: 3 * 3600,
    unit: saved.unit,
    lock: false,
    show: Object.assign({}, SHOW_DEFAULT[saved.unit], saved.show || {}),
    hideReading: false,
    mode: "play",
  };

  /* ───── 시각 글 ───── */
  const mod = (a, n) => ((a % n) + n) % n;
  function parts(t) {
    t = mod(Math.round(t), DAY);
    const h24 = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return { h24, h: h24 % 12 === 0 ? 12 : h24 % 12, m, s, pm: h24 >= 12 };
  }
  function fmt(t, unit = state.unit, opts = {}) {
    const p = parts(t);
    let str = p.h + "시";
    if (unit === "s1" && (p.s || opts.forceSec)) str += " " + p.m + "분 " + p.s + "초";
    else if (p.m) str += " " + p.m + "분";
    if (opts.ampm) str = (p.pm ? "오후 " : "오전 ") + str;
    return str;
  }
  function digital(t, unit = state.unit) {
    const p = parts(t);
    return p.h + ":" + String(p.m).padStart(2, "0") + (unit === "s1" ? ":" + String(p.s).padStart(2, "0") : "");
  }
  function fmtDur(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const out = [];
    if (h) out.push(h + "시간");
    if (m) out.push(m + "분");
    if (s) out.push(s + "초");
    return out.join(" ") || "0분";
  }
  // 받침 따라 '이에요/예요'
  function hasBatchim(w) { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; }
  const ieyo = (w) => w + (hasBatchim(w) ? "이에요" : "예요");
  const eulreul = (w) => w + (hasBatchim(w) ? "을" : "를");
  const snap = (t, unit = state.unit) => { const st = UNITS[unit].step; return mod(Math.round(t / st) * st, DAY); };
  const randInt = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[randInt(a.length)];

  /* ───── 시계 그림 ───── */
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return [200 + r * Math.sin(a), 200 - r * Math.cos(a)]; };
  const LEN = { hour: 92, minute: 148, second: 158 };

  function makeClock(host, opts = {}) {
    const svg = svgEl("svg", { viewBox: "-6 -6 412 412", class: "clock", role: "group" });
    svg.setAttribute("aria-label", opts.label || "시계");
    svgEl("circle", { cx: 200, cy: 200, r: 170, class: "face" }, svg);
    const zone = svgEl("path", { class: "zone" }, svg); // 시침 자리 색칠(문자판 위, 숫자·바늘 아래)
    // 바깥 고리: 분 숫자
    const minG = svgEl("g", { "aria-hidden": "true" }, svg);
    for (let i = 0; i < 12; i++) { const [x, y] = pt(190, i * 30); svgEl("text", { x, y, class: "minnum" }, minG).textContent = String(i * 5); }
    // 눈금
    const tickG = svgEl("g", { "aria-hidden": "true" }, svg);
    const smallG = svgEl("g", {}, tickG);
    for (let i = 0; i < 60; i++) {
      const five = i % 5 === 0;
      const [x1, y1] = pt(five ? 150 : 158, i * 6), [x2, y2] = pt(166, i * 6);
      svgEl("line", { x1, y1, x2, y2, class: "tick" + (five ? " five" : "") }, five ? tickG : smallG);
    }
    const nums = [];
    const numG = svgEl("g", { "aria-hidden": "true" }, svg);
    for (let i = 1; i <= 12; i++) { const [x, y] = pt(130, i * 30); const n = svgEl("text", { x, y, class: "num" }, numG); n.textContent = String(i); nums.push(n); }
    function hand(kind) {
      const g = svgEl("g", { class: "grab" }, svg);
      const tail = kind === "second" ? 24 : 14;
      svgEl("line", { x1: 200, y1: 200 + tail, x2: 200, y2: 200 - LEN[kind], class: "hand " + kind }, g);
      return g;
    }
    const gHour = hand("hour"), gMin = hand("minute"), gSec = hand("second");
    svgEl("circle", { cx: 200, cy: 200, r: 10, class: "cap" }, svg);
    const bubble = svgEl("g", { class: "bubble", "aria-hidden": "true", visibility: "hidden" }, svg);
    const bRect = svgEl("rect", { rx: 12, height: 40 }, bubble);
    const bText = svgEl("text", {}, bubble);
    host.textContent = "";
    host.appendChild(svg);

    const c = {
      svg, t: 0, show: {}, unit: state.unit, interactive: false, drag: null,
      onChange: opts.onChange || null, onRelease: opts.onRelease || null,
    };
    c.draw = function (t, show) {
      if (t != null) c.t = t;
      if (show) c.show = show;
      const s = c.show, T = c.t;
      const hourDeg = (mod(T, HALF)) / 120, minDeg = mod(T, 3600) / 10, secDeg = mod(Math.round(T), 60) * 6;
      gHour.setAttribute("transform", "rotate(" + hourDeg.toFixed(2) + " 200 200)");
      gMin.setAttribute("transform", "rotate(" + minDeg.toFixed(2) + " 200 200)");
      gSec.setAttribute("transform", "rotate(" + secDeg + " 200 200)");
      gSec.style.display = s.second ? "" : "none";
      minG.style.display = s.minuteNums ? "" : "none";
      smallG.style.display = s.ticks ? "" : "none";
      const hi = Math.floor(mod(T, HALF) / 3600); // 0 = 12시대
      if (s.hourZone) {
        const [x0, y0] = pt(166, hi * 30), [x1, y1] = pt(166, hi * 30 + 30);
        zone.setAttribute("d", "M200 200 L" + x0.toFixed(1) + " " + y0.toFixed(1) + " A166 166 0 0 1 " + x1.toFixed(1) + " " + y1.toFixed(1) + " Z");
        zone.style.display = "";
      } else zone.style.display = "none";
      nums.forEach((n, i) => n.classList.toggle("zone-on", !!s.hourZone && (i + 1) % 12 === hi % 12));
      const read = fmt(snap(T, c.unit), c.unit);
      if (c.interactive) {
        gMin.setAttribute("aria-valuetext", read); gHour.setAttribute("aria-valuetext", read); gSec.setAttribute("aria-valuetext", read);
      }
      if (c.drag && c.drag.on) {
        const kind = c.drag.kind;
        const deg = kind === "hour" ? hourDeg : kind === "minute" ? minDeg : secDeg;
        const [tx, ty] = pt(LEN[kind] * 0.72, deg);
        const w = Math.max(90, [...read].length * 19 + 24);
        const bx = Math.max(w / 2, Math.min(400 - w / 2, tx)), by = Math.max(24, ty - 46);
        bRect.setAttribute("x", (bx - w / 2).toFixed(1)); bRect.setAttribute("y", (by - 20).toFixed(1)); bRect.setAttribute("width", w);
        bText.setAttribute("x", bx.toFixed(1)); bText.setAttribute("y", by.toFixed(1));
        bText.textContent = read;
        bubble.setAttribute("visibility", "visible");
      } else bubble.setAttribute("visibility", "hidden");
    };
    c.size = function (px) { svg.setAttribute("width", Math.round(px)); svg.setAttribute("height", Math.round(px)); };
    c.setInteractive = function (on) {
      c.interactive = on;
      svg.classList.toggle("live", on);
      [[gHour, "시침"], [gMin, "분침"], [gSec, "초침"]].forEach(([g, name]) => {
        if (on) { g.setAttribute("tabindex", "0"); g.setAttribute("role", "slider"); g.setAttribute("aria-label", name + " — 화살표 키로 돌리기"); }
        else { g.removeAttribute("tabindex"); g.removeAttribute("role"); g.removeAttribute("aria-label"); g.removeAttribute("aria-valuetext"); }
      });
    };

    // 끌기: 손가락 위치의 각도에 가장 가까운 바늘을 잡는다(바깥쪽은 분침·초침, 안쪽은 시침도 후보)
    const K = { hour: 120, minute: 10, second: 1 / 6 };
    function local(e) {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const dx = p.x - 200, dy = p.y - 200;
      return { r: Math.hypot(dx, dy), a: mod((Math.atan2(dx, -dy) * 180) / Math.PI, 360) };
    }
    const angDiff = (a, b) => Math.abs(mod(a - b + 180, 360) - 180);
    svg.addEventListener("pointerdown", (e) => {
      if (!c.interactive || e.button > 0) return;
      const L = local(e);
      if (!L || L.r < 14 || L.r > 205) return;
      const T = c.t;
      const cands = [
        { kind: "minute", deg: mod(T, 3600) / 10, tol: 30 },
        { kind: "hour", deg: mod(T, HALF) / 120, tol: 34 },
      ];
      if (c.show.second) cands.push({ kind: "second", deg: mod(Math.round(T), 60) * 6, tol: 22 });
      let best = null;
      for (const cd of cands) {
        if (L.r > LEN[cd.kind] + 40) continue;
        const d = angDiff(L.a, cd.deg);
        if (d <= cd.tol && (!best || d < best.d)) best = { kind: cd.kind, d };
      }
      if (!best) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      c.drag = { kind: best.kind, last: L.a, tf: c.t, pid: e.pointerId, on: true };
      svg.classList.add("dragging");
      c.draw();
    });
    svg.addEventListener("pointermove", (e) => {
      const d = c.drag;
      if (!d || e.pointerId !== d.pid) return;
      const L = local(e);
      if (!L) return;
      const delta = mod(L.a - d.last + 180, 360) - 180;
      d.last = L.a;
      d.tf += delta * K[d.kind];
      c.t = mod(d.tf, DAY);
      c.draw();
      if (c.onChange) c.onChange(snap(c.t, c.unit), true);
    });
    function endDrag(e) {
      const d = c.drag;
      if (!d || (e && e.pointerId !== d.pid)) return;
      c.drag = null;
      svg.classList.remove("dragging");
      c.t = snap(c.t, c.unit);
      c.draw();
      if (c.onRelease) c.onRelease(c.t);
      if (SK.sound) SK.sound.play("move");
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("lostpointercapture", endDrag);
    // 키보드
    svg.addEventListener("keydown", (e) => {
      if (!c.interactive) return;
      const g = e.target.closest(".grab");
      if (!g) return;
      const up = e.key === "ArrowRight" || e.key === "ArrowUp", down = e.key === "ArrowLeft" || e.key === "ArrowDown";
      if (!up && !down) return;
      e.preventDefault();
      const st = UNITS[c.unit].step;
      const amount = g === gHour ? 3600 : g === gSec ? 1 : Math.max(60, st === 1 ? 60 : st);
      c.t = snap(c.t + (up ? amount : -amount), c.unit);
      c.draw();
      if (c.onRelease) c.onRelease(c.t);
    });
    return c;
  }

  /* ───── 화면·요소 ───── */
  const screens = SK.screens({ focus: false });
  const main = makeClock($("clockA"), {
    label: "시계",
    onChange: (t) => { state.t = t; renderReadout(); },
    onRelease: (t) => { state.t = t; renderReadout(); },
  });
  const second = makeClock($("clockB"), { label: "끝난 시각 시계" });

  function showNow() { return Object.assign({}, state.show, { second: state.show.second && state.unit === "s1" }); }

  function renderReadout() {
    const t = state.t;
    $("digital").textContent = digital(t);
    const reading = $("reading");
    const hidden = state.mode === "big" ? !bigReveal : state.hideReading;
    reading.textContent = fmt(t, state.unit, { ampm: state.show.dayBar });
    reading.classList.toggle("hidden-text", hidden);
    $("digital").style.visibility = hidden ? "hidden" : "";
    reading.setAttribute("aria-hidden", hidden ? "true" : "false");
    const p = parts(t);
    $("before").textContent = !hidden && state.unit !== "h30" && p.m >= 50 && !p.s ? "(" + ((p.h % 12) + 1) + "시 " + (60 - p.m) + "분 전)" : "";
    $("btnHide").setAttribute("aria-pressed", state.hideReading ? "true" : "false");
    $("btnHide").textContent = state.hideReading ? "🙉" : "🙈";
    $("daybar").hidden = !(state.show.dayBar && state.mode !== "mission");
    $("dayMark").style.left = (mod(t, DAY) / DAY) * 100 + "%";
    for (const b of document.querySelectorAll("#ampm [data-ampm]")) b.setAttribute("aria-pressed", (b.dataset.ampm === "pm") === p.pm ? "true" : "false");
  }

  function layout() {
    const zone = $("clockZone");
    const zr = zone.getBoundingClientRect();
    const cs = getComputedStyle(zone);
    const padT = parseFloat(cs.paddingTop) || 0, padB = parseFloat(cs.paddingBottom) || 0;
    let H = zr.height - padT - padB;
    const W = zr.width - 32;
    const ro = $("readout"), db = $("daybar"), bn = $("qBanner");
    if (ro.offsetParent) H -= ro.offsetHeight + 10;
    if (!db.hidden) H -= db.offsetHeight + 10;
    if (!bn.hidden) H -= bn.offsetHeight + 8;
    const two = !$("boxB").hidden;
    const capH = two ? 30 : 0;
    let size = two ? Math.min((W - 18) / 2, H - capH) : Math.min(W, H);
    size = Math.max(150, Math.min(900, size));
    main.size(size);
    if (two) second.size(size);
  }
  let rz = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); });
  if (window.ResizeObserver) new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); }).observe($("clockZone"));

  function drawMain() { main.unit = state.unit; second.unit = state.unit; main.draw(state.t, showNow()); renderReadout(); }

  /* ───── 단위 고르기 ───── */
  function renderUnitGrids() {
    for (const grid of document.querySelectorAll("[data-unit-grid]")) {
      grid.textContent = "";
      for (const k of UNIT_KEYS) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "unit-btn"; b.dataset.unit = k;
        b.setAttribute("aria-pressed", k === state.unit ? "true" : "false");
        const g = document.createElement("span"); g.className = "g"; g.textContent = UNITS[k].grade;
        const u = document.createElement("span"); u.className = "u"; u.textContent = UNITS[k].u;
        b.append(g, u);
        b.setAttribute("aria-label", UNITS[k].grade + " " + UNITS[k].u + " 단위");
        grid.appendChild(b);
      }
    }
    const chip = $("unitChip");
    chip.textContent = UNITS[state.unit].u + " 단위" + (state.lock ? " 🔒" : "");
    chip.disabled = state.lock;
    chip.title = state.lock ? "선생님이 정한 단위예요" : "단위 바꾸기";
    $("introUnits").hidden = state.lock;
    const ln = $("introLock");
    ln.hidden = !state.lock;
    ln.textContent = "선생님이 " + UNITS[state.unit].u + " 단위로 정했어요 (" + UNITS[state.unit].grade + ")";
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".unit-btn");
    if (!b || state.lock) return;
    setUnit(b.dataset.unit);
  });
  function setUnit(u) {
    if (!UNITS[u] || state.lock && u !== state.unit) return;
    const changed = u !== state.unit;
    state.unit = u;
    if (changed) { state.show = Object.assign({}, SHOW_DEFAULT[u]); saved.show = null; }
    state.t = snap(state.t, u);
    saved.unit = u; persist();
    renderUnitGrids();
    renderSteps();
    renderToggles();
    if (changed) buildMissions();
    if (state.mode === "mission") setMode("mission");
    else drawMain();
    layout();
  }
  const unitModal = VUI ? VUI.modal.bind("#unitModal", { className: "open", backdropClose: true }) : null;
  $("unitChip").addEventListener("click", () => { if (!state.lock && unitModal) unitModal.open(); });
  $("btnLockLink").addEventListener("click", () => {
    const url = SK.share.link({ v: 1, unit: state.unit, lock: true });
    SK.share.send(url, { shorten: true, title: "시계 보기 — " + UNITS[state.unit].u + " 단위" });
  });

  /* ───── 놀이터 ───── */
  function stepButtons() {
    switch (state.unit) {
      case "h30": return [[-3600, "−1시간"], [-1800, "−30분"], [1800, "+30분"], [3600, "+1시간"]];
      case "m10": return [[-3600, "−1시간"], [-600, "−10분"], [600, "+10분"], [3600, "+1시간"]];
      case "m5": return [[-3600, "−1시간"], [-300, "−5분"], [300, "+5분"], [3600, "+1시간"]];
      case "m1": return [[-3600, "−1시간"], [-300, "−5분"], [-60, "−1분"], [60, "+1분"], [300, "+5분"], [3600, "+1시간"]];
      default: return [[-3600, "−1시간"], [-60, "−1분"], [-10, "−10초"], [-1, "−1초"], [1, "+1초"], [10, "+10초"], [60, "+1분"], [3600, "+1시간"]];
    }
  }
  function renderSteps() {
    const g = $("stepGrid");
    g.textContent = "";
    const list = stepButtons();
    g.style.gridTemplateColumns = "repeat(" + (list.length === 6 ? 3 : 4) + ", 1fr)";
    for (const [d, label] of list) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ck-btn"; b.textContent = label;
      b.addEventListener("click", () => { state.t = snap(state.t + d); drawMain(); if (SK.sound) SK.sound.play("move"); });
      g.appendChild(b);
    }
    const sm = stepButtons().find(([d]) => d > 0 && d < 3600) || [UNITS[state.unit].step, ""];
    $("bigMinusLbl").textContent = sm[1].replace("+", "");
    $("bigPlusLbl").textContent = sm[1].replace("+", "");
  }
  function renderToggles() {
    for (const b of document.querySelectorAll(".tog[data-show]")) {
      const k = b.dataset.show;
      b.hidden = k === "second" && state.unit !== "s1";
      b.setAttribute("aria-pressed", state.show[k] ? "true" : "false");
    }
    $("ampm").hidden = !state.show.dayBar;
  }
  document.querySelector(".toggles").addEventListener("click", (e) => {
    const b = e.target.closest(".tog");
    if (!b) return;
    const k = b.dataset.show;
    state.show[k] = !state.show[k];
    saved.show = Object.assign({}, state.show); persist();
    renderToggles(); drawMain(); layout();
  });
  $("ampm").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ampm]");
    if (!b) return;
    const pm = b.dataset.ampm === "pm";
    if (parts(state.t).pm !== pm) state.t = mod(state.t + HALF, DAY);
    drawMain();
  });
  $("btnNow").addEventListener("click", () => {
    const d = new Date();
    state.t = snap(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() - (state.unit === "s1" ? 0 : (UNITS[state.unit].step / 2 - 0.5)));
    drawMain();
  });
  $("btnSay").addEventListener("click", () => SK.speak(fmt(state.t, state.unit, { ampm: state.show.dayBar })));
  $("btnHide").addEventListener("click", () => { state.hideReading = !state.hideReading; renderReadout(); });

  /* ───── 모드 ───── */
  let bigReveal = false;
  function setMode(m) {
    if (state.mode === "mission" && m !== "mission" && mc) mc.stop();
    state.mode = m;
    document.body.classList.toggle("big", m === "big");
    for (const b of document.querySelectorAll(".mode-tab")) { const on = b.dataset.mode === m; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    $("panePlay").hidden = m !== "play";
    $("paneMission").hidden = m !== "mission";
    $("paneBig").hidden = true;
    const showRead = m !== "mission";
    $("readout").style.display = showRead ? "" : "none";
    if (m !== "mission") {
      $("qBanner").hidden = true; $("boxB").hidden = true; $("capA").hidden = true;
      main.setInteractive(true);
      bigReveal = false; $("bigReveal").setAttribute("aria-pressed", "false"); $("bigReveal").textContent = "👁 정답 보기";
      drawMain();
    } else {
      if (!mc) buildMissions();
      const i = mc.current();
      mc.start(i >= 0 ? i : undefined);
    }
    layout();
  }
  document.querySelector(".mode-tabs").addEventListener("click", (e) => { const b = e.target.closest(".mode-tab"); if (b) setMode(b.dataset.mode); });

  /* ───── 큰 시계 ───── */
  function bigStep(sign) { const sm = stepButtons().find(([d]) => d > 0 && d < 3600); state.t = snap(state.t + sign * (sm ? sm[0] : 3600)); drawMain(); }
  $("bigMinus").addEventListener("click", () => bigStep(-1));
  $("bigPlus").addEventListener("click", () => bigStep(1));
  $("bigRandom").addEventListener("click", () => {
    state.t = randTime(state.unit) + (state.show.dayBar && Math.random() < 0.5 ? HALF : 0);
    bigReveal = false; $("bigReveal").setAttribute("aria-pressed", "false"); $("bigReveal").textContent = "👁 정답 보기";
    drawMain();
    if (SK.sound) SK.sound.play("star");
  });
  $("bigReveal").addEventListener("click", () => {
    bigReveal = !bigReveal;
    $("bigReveal").setAttribute("aria-pressed", bigReveal ? "true" : "false");
    $("bigReveal").textContent = bigReveal ? "🙈 가리기" : "👁 정답 보기";
    renderReadout();
    if (bigReveal) SK.speak(fmt(state.t, state.unit, { ampm: state.show.dayBar }));
  });
  $("bigShare").addEventListener("click", () => window.shareCurrentPage && window.shareCurrentPage());
  $("bigExit").addEventListener("click", () => setMode("play"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.mode === "big" && !document.querySelector(".ck-modal.open")) setMode("play"); });

  /* ═══════════════ 미션 ═══════════════ */
  function randTime(unit, o = {}) {
    const h = 1 + randInt(12);
    let m, s = 0;
    if (unit === "h30") m = o.trap ? 30 : pick([0, 30]);
    else {
      const st = UNITS[unit].step >= 60 ? UNITS[unit].step / 60 : 1;
      const lo = o.trap ? 40 : 0;
      const opts = []; for (let x = lo; x < 60; x += st) opts.push(x);
      m = pick(opts.length ? opts : [0]);
      if (unit === "s1") s = randInt(60);
    }
    return mod(h, 12) * 3600 + m * 60 + s;
  }

  const MISSIONS = [
    { id: "m1", title: "시각 읽기", desc: "시계가 가리키는 시각을 읽어요." },
    { id: "m2", title: "바늘 맞추기", desc: "말한 시각이 되도록 바늘을 돌려요. 다 되면 ‘확인’을 눌러요." },
    { id: "m3", title: "헷갈리는 시침", desc: "시침이 다음 숫자에 가까워도 지나온 숫자를 읽어요." },
    { id: "m4", title: "걸린 시간", desc: "시작한 시각과 끝난 시각을 보고 걸린 시간을 구해요." },
    { id: "m5", title: "오전일까 오후일까", desc: "하루 중 언제 하는 일인지 생각해 오전·오후를 골라요." },
    { id: "m6", title: "시간 더하고 빼기", desc: "시계를 돌려 보며 몇 분 뒤·몇 분 전의 시각을 구해요." },
  ];
  const DAY_EVENTS = [
    { e: "🐓", text: "새벽에 닭이 울어요", h: [5], pm: false },
    { e: "🌅", text: "아침에 일어나요", h: [6, 7], pm: false },
    { e: "🍚", text: "아침밥을 먹어요", h: [7, 8], pm: false },
    { e: "🏫", text: "학교에 가요", h: [8], pm: false },
    { e: "📚", text: "학교에서 공부를 해요", h: [9, 10], pm: false },
    { e: "⚽", text: "방과 후에 공을 차요", h: [3, 4], pm: true },
    { e: "🎨", text: "미술 학원에 가요", h: [4, 5], pm: true },
    { e: "🍲", text: "저녁밥을 먹어요", h: [6, 7], pm: true },
    { e: "🛁", text: "씻고 잠옷을 입어요", h: [8], pm: true },
    { e: "😴", text: "잠을 자요", h: [9, 10], pm: true },
  ];

  let mc = null;
  let mq = null; // 지금 미션 방문 { i, n, qs:[...], res:[...], attempt, answered }
  const fb = SK.feedback("#mFeedback");

  function buildMissions() {
    if (mc) mc.destroy();
    mc = SK.missions({
      ids: MISSIONS.map((m) => m.id),
      format: "full",
      progress: saved.progress[state.unit] || {},
      keepBest: true,
      nav: "#missionNav",
      navText: (i) => String(i + 1),
      feedback: fb,
      onEnter: (i) => enterMission(i),
      onChange: (p) => { saved.progress[state.unit] = p; persist(); },
      onAllDone: () => { $("mResult").hidden = false; },
      onFinish: () => showResult(),
    });
  }

  function minuteValues() {
    const st = state.unit === "h30" ? 30 : state.unit === "m10" ? 10 : state.unit === "m5" ? 5 : 0;
    if (!st) return null; // 숫자판
    const v = []; for (let x = 0; x < 60; x += st) v.push(x);
    return v;
  }
  function timeOptions(t, trap) {
    const p = parts(t), u = state.unit;
    const mk = (h, m, s) => mod(mod(h, 12) * 3600 + m * 60 + (s || 0), HALF);
    const cands = [];
    cands.push(mk(p.h + 1, p.m, p.s)); // 시침을 다음 숫자로 읽음
    if (!trap) cands.push(mk(p.h - 1, p.m, p.s));
    if (u !== "h30" && p.m % 5 === 0) { const mm = p.m / 5; const hh = Math.round(mod(t, HALF) / 3600) || 12; if (mm !== p.m) cands.push(mk(p.h, mm, p.s)); if (mm >= 1) cands.push(mk(mm, hh * 5 % 60, p.s)); } // 분침 숫자 그대로, 바늘 바꿔 읽기
    if (u === "h30") cands.push(mk(p.h, (p.m + 30) % 60));
    else { const st = UNITS[u].step >= 60 ? UNITS[u].step / 60 : 1; cands.push(mk(p.h, mod(p.m + st, 60), p.s)); cands.push(mk(p.h, mod(p.m - st, 60), p.s)); }
    cands.push(mk(p.h + 2, p.m, p.s));
    const right = mod(t, HALF);
    const seen = new Set([right]);
    const out = [];
    for (const c of cands) if (!seen.has(c)) { seen.add(c); out.push(c); if (out.length === 3) break; }
    while (out.length < 3) { const r = mod(randTime(u), HALF); if (!seen.has(r)) { seen.add(r); out.push(r); } }
    const all = out.concat([right]).sort(() => Math.random() - 0.5);
    return all.map((v) => ({ label: fmt(v, u), ok: v === right }));
  }

  function makeQuestion(i) {
    const u = state.unit;
    if (i === 0) { // 읽기
      const t = randTime(u);
      const useOpts = u === "h30" || u === "m10";
      return { kind: "read", t, text: "시계가 가리키는 시각은 몇 시 몇 분일까요?", say: "시계가 가리키는 시각은 몇 시 몇 분일까요?", answer: useOpts ? { type: "opts", opts: timeOptions(t) } : { type: "time" } };
    }
    if (i === 1) { // 맞추기
      let t; do { t = randTime(u); } while (mod(t, HALF) === 0);
      return { kind: "set", t, text: eulreul(fmt(t, u)) + " 만들어 보세요", say: eulreul(fmt(t, u)) + " 만들어 보세요", answer: { type: "set" } };
    }
    if (i === 2) { // 헷갈리는 시침
      const t = randTime(u, { trap: true });
      return { kind: "read", t, text: "시침을 잘 보세요. 몇 시 몇 분일까요?", say: "시침을 잘 보세요. 몇 시 몇 분일까요?", answer: { type: "opts", opts: timeOptions(t, true) }, trap: true };
    }
    if (i === 3) { // 걸린 시간
      let start, dur;
      if (u === "h30") { start = randTime(u); dur = pick([1800, 3600, 5400, 7200]); }
      else if (u === "s1") { start = randTime(u); dur = 10 + randInt(290); }
      else { const st = UNITS[u].step; start = randTime(u); dur = st * (1 + randInt(Math.floor(7200 / st) - 1)); }
      const end = mod(start + dur, DAY);
      const q = { kind: "elapsed", t: start, end, dur, text: "시작부터 끝까지 걸린 시간은 얼마일까요?", say: "시작부터 끝까지 걸린 시간은 얼마일까요?" };
      if (u === "h30") {
        const set = [1800, 3600, 5400, 7200];
        q.answer = { type: "opts", opts: set.map((d) => ({ label: fmtDur(d), ok: d === dur })) };
      } else q.answer = { type: "dur" };
      return q;
    }
    if (i === 4) { // 오전·오후
      const ev = pick(DAY_EVENTS);
      const h = pick(ev.h);
      let m = 0;
      if (u !== "h30") { const st = UNITS[u].step >= 60 ? UNITS[u].step / 60 : 1; m = st * randInt(Math.floor(60 / st)); } else m = pick([0, 30]);
      const t = mod(h, 12) * 3600 + m * 60 + (ev.pm ? HALF : 0);
      const label = fmt(t, u);
      return { kind: "ampm", t, ev, text: ev.e + " " + ev.text + ". 시계는 " + ieyo(label) + ". 오전일까요, 오후일까요?", say: ev.text + ". 시계는 " + ieyo(label) + ". 오전일까요, 오후일까요?",
        answer: { type: "opts", big: true, opts: [{ label: "🌅 오전", ok: !ev.pm }, { label: "🌙 오후", ok: ev.pm }] } };
    }
    // 더하고 빼기
    const base = randTime(u);
    let d;
    if (u === "h30") d = pick([1800, 3600, 5400]);
    else if (u === "s1") d = 5 + randInt(55);
    else { const st = UNITS[u].step; d = st * (1 + randInt(Math.max(1, Math.floor(3600 / st) - 1))); }
    const after = Math.random() < 0.6;
    const target = mod(base + (after ? d : -d), HALF);
    const dText = fmtDur(d);
    const q = { kind: "calc", t: base, target, text: fmt(base, u) + "에서 " + dText + " " + (after ? "뒤" : "전") + "는 몇 시 몇 분일까요?", say: fmt(base, u) + "에서 " + dText + " " + (after ? "뒤" : "전") + "는 몇 시 몇 분일까요?" };
    if (u === "h30") {
      const right = target;
      const set = new Set([right]);
      const opts = [{ label: fmt(right, u), ok: true }];
      for (const c of [base + (after ? -d : d), right + 3600, right - 3600, right + 1800]) { const v = mod(c, HALF); if (!set.has(v)) { set.add(v); opts.push({ label: fmt(v, u), ok: false }); } if (opts.length === 4) break; }
      q.answer = { type: "opts", opts: opts.sort(() => Math.random() - 0.5) };
    } else q.answer = { type: "time" };
    return q;
  }

  function enterMission(i) {
    const M = MISSIONS[i];
    const s1 = state.unit === "s1";
    $("mTitle").textContent = "미션 " + (i + 1) + " · " + (s1 && i === 3 ? "걸린 시간(분·초)" : s1 && i === 5 ? "초 더하고 빼기" : M.title);
    $("mDesc").textContent = M.desc + " (" + UNITS[state.unit].u + " 단위)";
    mq = { i, n: 0, qs: [makeQuestion(i), makeQuestion(i), makeQuestion(i)], res: [], attempt: 0, answered: false };
    $("mResult").hidden = !mc.allDone();
    $("mNextMission").hidden = true;
    showQuestion();
  }

  // 미션 중 시계 표시: 도움 표시는 단위 기본값, 틀리면 힌트로 켬
  let hintOn = false;
  function missionShow() {
    const s = Object.assign({}, SHOW_DEFAULT[state.unit]);
    s.dayBar = false;
    if (hintOn) { s.hourZone = true; s.minuteNums = true; }
    return s;
  }

  function showQuestion() {
    const q = mq.qs[mq.n];
    mq.attempt = 0; mq.answered = false; hintOn = false;
    fb.hide();
    $("qText").textContent = q.text;
    $("qBanner").hidden = false;
    renderSteps2();
    $("capA").hidden = q.kind !== "elapsed";
    $("boxB").hidden = q.kind !== "elapsed";
    if (q.kind === "elapsed") { $("capA").textContent = "🏁 시작"; $("capB").textContent = "🎯 끝"; }
    main.setInteractive(q.kind === "set" || q.kind === "calc");
    const st = q.kind === "set" ? 0 : q.t;
    main.draw(st, missionShow());
    if (q.kind === "elapsed") second.draw(q.end, missionShow());
    $("mCheck").hidden = false; $("mCheck").disabled = false;
    renderAnswer(q); // 보기형은 여기서 확인 버튼을 숨김
    $("mNextQ").hidden = true;
    layout();
  }
  function renderSteps2() {
    const box = $("mStep");
    box.textContent = "";
    for (let k = 0; k < 3; k++) {
      const d = document.createElement("span");
      d.className = "dot" + (mq.res[k] === "ok" ? " ok" : mq.res[k] ? " no" : k === mq.n ? " cur" : "");
      box.appendChild(d);
    }
    const tx = document.createElement("span");
    tx.textContent = "문제 " + (mq.n + 1) + " / 3";
    box.appendChild(tx);
  }

  // 답 입력판
  let answerState = null;
  function chipRow(label, key, values, fmtV) {
    const row = document.createElement("div"); row.className = "field-row";
    const l = document.createElement("span"); l.className = "lbl"; l.textContent = label;
    const chips = document.createElement("div"); chips.className = "chips";
    if (values.length <= 4) chips.style.gridTemplateColumns = "repeat(" + values.length + ", 1fr)";
    for (const v of values) {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = fmtV ? fmtV(v) : v;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        answerState.vals[key] = v;
        for (const x of chips.children) x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      chips.appendChild(b);
    }
    row.append(chips, l);
    return row;
  }
  function padRow(label, key, max) {
    const row = document.createElement("div"); row.className = "field-row";
    const f = document.createElement("button"); f.type = "button"; f.className = "pad-field"; f.dataset.key = key;
    f.setAttribute("aria-label", label + " 칸");
    const l = document.createElement("span"); l.className = "lbl"; l.textContent = label;
    f.addEventListener("click", () => focusPad(key));
    answerState.pads[key] = { el: f, max };
    row.append(f, l);
    return row;
  }
  function focusPad(key) {
    answerState.focus = key;
    for (const k in answerState.pads) answerState.pads[k].el.classList.toggle("focus", k === key);
  }
  function keypad() {
    const kp = document.createElement("div"); kp.className = "keypad";
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "⌫", "다음 칸"].forEach((k) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = k;
      if (k === "다음 칸") b.style.gridColumn = "span 4";
      b.addEventListener("click", () => {
        const keys = Object.keys(answerState.pads);
        if (!answerState.focus) focusPad(keys[0]);
        const key = answerState.focus;
        const P = answerState.pads[key];
        const ix = keys.indexOf(key);
        if (k === "다음 칸") { focusPad(keys[(ix + 1) % keys.length]); return; }
        if (k === "⌫") P.el.textContent = P.el.textContent.slice(0, -1);
        else if (P.el.textContent.length < 2) P.el.textContent += k;
        // 값을 먼저 적고, 두 자리가 차면 다음 칸으로
        answerState.vals[key] = P.el.textContent === "" ? null : Number(P.el.textContent);
        if (k !== "⌫" && P.el.textContent.length === 2 && ix < keys.length - 1) focusPad(keys[ix + 1]);
      });
      kp.appendChild(b);
    });
    return kp;
  }
  function renderAnswer(q) {
    const box = $("mAnswer");
    box.textContent = "";
    answerState = { vals: {}, pads: {}, focus: null, opt: null };
    const a = q.answer;
    if (a.type === "opts") {
      const g = document.createElement("div"); g.className = "opts";
      a.opts.forEach((o, ix) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "opt" + (a.big ? " big" : ""); b.textContent = o.label;
        b.addEventListener("click", () => {
          if (mq.answered) return;
          answerState.opt = ix;
          for (const x of g.children) x.classList.toggle("sel", x === b);
          check();
        });
        g.appendChild(b);
      });
      box.appendChild(g);
      $("mCheck").hidden = true;
      return;
    }
    if (a.type === "set") { box.appendChild(Object.assign(document.createElement("p"), { className: "hint-text", textContent: "👉 시계의 바늘을 손가락으로 끌어 돌린 뒤 ‘확인’을 눌러요. 분침을 돌리면 시침도 따라 움직여요." })); return; }
    const fields = document.createElement("div"); fields.className = "fields";
    const u = state.unit;
    if (a.type === "time") {
      if (q.kind === "calc") fields.appendChild(Object.assign(document.createElement("p"), { className: "hint-text", textContent: "👉 시계를 돌려 보며 생각해도 좋아요." }));
      fields.appendChild(chipRow("시", "h", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
      const mv = minuteValues();
      if (mv) fields.appendChild(chipRow("분", "m", mv));
      else fields.appendChild(padRow("분", "m", 59));
      if (u === "s1") fields.appendChild(padRow("초", "s", 59));
    } else if (a.type === "dur") {
      if (u === "s1") { fields.appendChild(chipRow("분", "m", [0, 1, 2, 3, 4])); fields.appendChild(padRow("초", "s", 59)); }
      else {
        fields.appendChild(chipRow("시간", "h", [0, 1, 2]));
        const mv = minuteValues();
        if (mv) fields.appendChild(chipRow("분", "m", mv)); else fields.appendChild(padRow("분", "m", 99));
      }
    }
    box.appendChild(fields);
    if (Object.keys(answerState.pads).length) { box.appendChild(keypad()); focusPad(Object.keys(answerState.pads)[0]); }
  }

  function readAnswer(q) {
    const v = answerState.vals;
    const a = q.answer;
    if (a.type === "opts") return answerState.opt == null ? null : { ok: !!a.opts[answerState.opt].ok };
    if (a.type === "set") {
      const want = parts(q.t), got = parts(snap(main.t));
      return { ok: want.h === got.h && want.m === got.m && (state.unit !== "s1" || want.s === got.s) };
    }
    if (a.type === "time") {
      const target = q.kind === "calc" ? q.target : q.t;
      const p = parts(target);
      if (v.h == null || v.m == null || (state.unit === "s1" && v.s == null)) return null;
      return { ok: v.h === p.h && v.m === p.m && (state.unit !== "s1" || v.s === p.s) };
    }
    if (a.type === "dur") {
      if (state.unit === "s1") {
        if (v.m == null || v.s == null) return null;
        return { ok: v.m * 60 + v.s === q.dur && v.s < 60, over: v.s >= 60 };
      }
      if (v.h == null || v.m == null) return null;
      return { ok: v.h * 3600 + v.m * 60 === q.dur && v.m < 60, over: v.m >= 60 };
    }
    return null;
  }

  function hintFor(q, r) {
    if (r && r.over) return state.unit === "s1" ? "60초는 1분이에요. 분과 초로 나누어 적어 볼까요?" : "60분은 1시간이에요. 시간과 분으로 나누어 적어 볼까요?";
    if (q.kind === "set") return "아직 아니에요. 분침(긴 바늘)을 먼저 맞추고, 시침(짧은 바늘)이 맞는 숫자 사이에 있는지 보세요.";
    if (q.kind === "elapsed") return "다시 해 볼까요? 시작 시계의 분침이 끝 시계까지 몇 바퀴, 몇 칸 돌았는지 세어 보세요.";
    if (q.kind === "ampm") return "다시 생각해 볼까요? 오전은 밤 12시부터 낮 12시까지, 오후는 낮 12시부터 밤 12시까지예요.";
    if (q.kind === "calc") return "다시 해 볼까요? 시계의 분침을 직접 돌려 보세요. 12를 지나면 시침도 다음 숫자로 가요.";
    return "다시 해 볼까요? 시침이 어느 두 숫자 사이에 있는지 색칠해 두었어요. 지나온 숫자를 읽어요.";
  }
  function answerText(q) {
    if (q.kind === "elapsed") return fmtDur(q.dur);
    if (q.kind === "ampm") return q.ev.pm ? "오후" : "오전";
    if (q.kind === "calc") return fmt(q.target, state.unit);
    return fmt(q.t, state.unit);
  }

  function check() {
    if (!mq || mq.answered) return;
    const q = mq.qs[mq.n];
    const r = readAnswer(q);
    if (!r) { fb.show("info", q.answer.type === "opts" ? "답을 골라 주세요." : "빈칸을 모두 채워 주세요."); return; }
    if (r.ok) {
      mq.answered = true;
      mq.res[mq.n] = mq.attempt === 0 ? "ok" : "late";
      fb.show("ok", pick(["맞았어요! 👏", "정확해요! 🎉", "좋아요! 시계 박사네요 ⭐"]) + " " + ieyo(answerText(q)) + ".");
      if (SK.sound) SK.sound.play("done");
      markOpts(q, true);
      if (q.kind === "ampm") { main.draw(q.t, Object.assign(missionShow(), {})); }
      afterAnswer();
      return;
    }
    mq.attempt++;
    if (SK.sound) SK.sound.play("wrong");
    if (mq.attempt === 1) {
      hintOn = true;
      main.draw(null, missionShow());
      if (q.kind === "elapsed") second.draw(null, missionShow());
      fb.show("warn", hintFor(q, r));
      markOpts(q, false);
      return;
    }
    // 두 번째도 틀림 → 정답 보여 주기
    mq.answered = true;
    mq.res[mq.n] = "no";
    if (q.kind === "set") { main.draw(q.t, missionShow()); }
    markOpts(q, true);
    fb.show("no", "정답은 " + ieyo(answerText(q)) + ". 다음 문제에서 다시 해 봐요!");
    afterAnswer();
  }
  function markOpts(q, reveal) {
    if (q.answer.type !== "opts") return;
    const g = $("mAnswer").querySelector(".opts");
    if (!g) return;
    [...g.children].forEach((b, ix) => {
      const o = q.answer.opts[ix];
      b.classList.remove("sel");
      if (ix === answerState.opt && !o.ok) b.classList.add("wrong");
      if (reveal && o.ok) b.classList.add("right");
      if (reveal) b.disabled = true;
    });
    answerState.opt = null;
  }
  function afterAnswer() {
    renderSteps2();
    $("mCheck").hidden = true;
    if (mq.n < 2) { $("mNextQ").hidden = false; $("mNextQ").focus(); return; }
    // 미션 끝
    const first = mq.res.filter((x) => x === "ok").length;
    const stars = first >= 3 ? 3 : first === 2 ? 2 : 1;
    const msg = (stars === 3 ? "🌟 세 문제 모두 한 번에 맞혔어요!" : "미션 완료! 처음에 맞힌 문제 " + first + "개") + " " + SK.stars.text(stars, 3);
    mc.complete({ stars, message: msg, tone: "ok" });
    if (SK.sound) SK.sound.play("star");
    const next = mc.firstIncomplete();
    if (mc.current() < MISSIONS.length - 1 || next >= 0) { $("mNextMission").hidden = false; $("mNextMission").focus(); }
    $("mResult").hidden = !mc.allDone();
  }
  $("mCheck").addEventListener("click", check);
  $("mNextQ").addEventListener("click", () => { mq.n++; showQuestion(); });
  $("mNextMission").addEventListener("click", () => {
    const cur = mc.current();
    if (cur < MISSIONS.length - 1) mc.go(cur + 1);
    else { const n = mc.firstIncomplete(); if (n >= 0) mc.go(n); else showResult(); }
  });
  $("mResult").addEventListener("click", showResult);
  $("qTts").addEventListener("click", () => { if (mq) SK.speak(mq.qs[mq.n].say); });

  /* ───── 결과 ───── */
  function showResult() {
    if (mc) mc.stop();
    const grid = $("resultGrid");
    grid.textContent = "";
    let total = 0;
    MISSIONS.forEach((M, i) => {
      const st = mc ? mc.starsOf(i) : 0;
      total += st;
      const c = document.createElement("div"); c.className = "result-cell"; c.setAttribute("role", "listitem");
      const n = document.createElement("div"); n.textContent = (i + 1) + ". " + M.title;
      const s = document.createElement("div"); s.className = "stars"; s.textContent = SK.stars.text(st, 3, "—");
      s.setAttribute("aria-label", "별 3개 중 " + st + "개");
      c.append(n, s);
      grid.appendChild(c);
    });
    $("resultSub").textContent = UNITS[state.unit].grade + " · " + UNITS[state.unit].u + " 단위 — 별 " + total + " / " + MISSIONS.length * 3;
    screens.show("screenResult");
    document.body.classList.remove("big");
  }
  $("btnRetry").addEventListener("click", () => { screens.show("screenMain"); setMode("mission"); mc.go(0); });
  $("btnToPlay").addEventListener("click", () => { screens.show("screenMain"); setMode("play"); });
  $("btnOtherUnit").addEventListener("click", () => {
    screens.show("screenMain"); setMode("mission");
    if (state.lock) return;
    if (unitModal) unitModal.open();
  });

  /* ───── 공유 ───── */
  SK.share.bind(() => ({ v: 1, t: Math.round(state.t), unit: state.unit }), { title: "시계 보기" });

  /* ───── 시작 ───── */
  let opened = false;
  (function readShare() {
    const p = SK.share.read({ version: 1, clear: false });
    if (!p) return;
    const unitOk = UNIT_KEYS.includes(p.unit);
    if (p.lock === true && unitOk) {
      state.lock = true;
      state.unit = p.unit;
      state.show = Object.assign({}, SHOW_DEFAULT[p.unit]);
      // 잠금 링크는 주소에 남겨 새로고침해도 유지
    } else {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* 무시 */ }
      if (unitOk) { state.unit = p.unit; state.show = Object.assign({}, SHOW_DEFAULT[p.unit]); }
    }
    const t = Number(p.t);
    if (Number.isInteger(t) && t >= 0 && t < DAY) { state.t = snap(t); opened = true; }
  })();

  function start() {
    screens.show("screenMain");
    setMode("play");
    layout();
  }
  $("btnStart").addEventListener("click", start);

  renderUnitGrids();
  renderSteps();
  renderToggles();
  buildMissions();
  main.setInteractive(true);
  drawMain();
  if (opened) start();
})();
