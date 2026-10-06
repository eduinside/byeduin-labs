/* ================================================================
   그래프 그리기 — graph-maker (eduin VIVES)
   - 같은 표를 ○그래프·그림그래프·막대·꺾은선·띠·원그래프로 바로 바꿔 본다.
   - 막대·꺾은선은 공용 VGraph(/common/vgraph.js), 나머지는 여기서 SVG로 그림.
   - 조사하기(손들기 집계) → 표 → 그래프, 직접 그리기, 평균 고르게 하기, 미션 10개.
   - localStorage `graph-maker:v1`, 공유는 #share=(표·종류·설정만, 개인정보 없음)
   - 두 모드: 그래프 만들기(표·그래프 / 조사하기) ↔ 그래프 공부하기(미션). 인트로에서 고르고 조작판 위에서 바꾼다.
   - 아이콘: SimKit.icon(lucide). 동적 이름 @icons chart-column trophy arrow-left-right
   계획: docs/graph-maker-plan.md
   ================================================================ */
(function () {
  "use strict";

  const SK = window.SimKit, VUI = window.VUI, VG = window.VGraph;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const IC = (n) => SK.icon(n);
  const starIcons = (n) => Array.from({ length: n }, () => IC("star")).join("");
  // 시간 기준 애니메이션 하나(SimKit.loop: 화면 재생률과 무관, 탭을 숨기면 멈춤, 움직임 줄이기면 바로 끝)
  const tween = (() => {
    let onFrame = null, onDone = null, el = 0, dur = 1;
    const lp = SK.loop((dt) => {
      el += dt * 1000;
      const k = Math.min(1, el / dur);
      const fn = onFrame;
      if (fn && fn(k) === false) { lp.stop(); onFrame = onDone = null; return; }
      if (k >= 1) { lp.stop(); const d = onDone; onFrame = onDone = null; if (d) d(); }
    });
    return {
      run(ms, frame, done) {
        lp.stop(); onFrame = onDone = null;
        if (!ms || SK.motion.reduced()) { frame(1); if (done) done(); return; }
        onFrame = frame; onDone = done; el = 0; dur = ms; lp.start();
      },
      stop() { lp.stop(); onFrame = onDone = null; },
    };
  })();
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const randInt = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[randInt(a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtN = (v) => VG.fmtNum(v);
  function hasBatchim(w) { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; }
  const ieyo = (w) => w + (hasBatchim(w) ? "이에요" : "예요");
  const wa = (w) => w + (hasBatchim(w) ? "과" : "와");
  const eun = (w) => w + (hasBatchim(w) ? "은" : "는");
  const eul = (w) => w + (hasBatchim(w) ? "을" : "를");

  const PALETTE = ["#6d28d9", "#f97316", "#16a34a", "#0ea5e9", "#e11d48", "#ca8a04", "#14b8a6", "#db2777", "#4f46e5", "#65a30d", "#ea580c", "#0891b2"];
  const TYPES = [
    { id: "symbol", name: "○ 그래프", grade: "1~2학년" },
    { id: "picto", name: "그림그래프", grade: "3~4학년" },
    { id: "bar", name: "막대그래프", grade: "3~4학년" },
    { id: "line", name: "꺾은선그래프", grade: "3~4학년" },
    { id: "band", name: "띠그래프", grade: "5~6학년" },
    { id: "pie", name: "원그래프", grade: "5~6학년" },
  ];
  const TYPE_IDS = TYPES.map((t) => t.id);
  const PRESETS = [
    { name: "좋아하는 계절", type: "bar", t: { title: "좋아하는 계절", unit: "명", rows: [["봄", 7], ["여름", 9], ["가을", 6], ["겨울", 4]] } },
    { name: "생일 달", type: "bar", t: { title: "우리 반 생일 달", unit: "명", rows: [["1월", 2], ["2월", 1], ["3월", 3], ["4월", 2], ["5월", 4], ["6월", 1], ["7월", 2], ["8월", 3], ["9월", 2], ["10월", 1], ["11월", 2], ["12월", 3]] } },
    { name: "하루 기온", type: "line", t: { title: "하루 동안의 기온", unit: "°C", rows: [["9시", 18], ["10시", 20], ["11시", 22], ["12시", 24], ["13시", 25], ["14시", 26], ["15시", 24]] } },
    { name: "줄넘기 횟수", type: "bar", t: { title: "일주일 줄넘기 횟수", unit: "회", rows: [["월", 42], ["화", 35], ["수", 50], ["목", 38], ["금", 45]] } },
    { name: "텃밭 넓이", type: "band", t: { title: "학교 텃밭 넓이", unit: "m²", rows: [["상추", 30], ["고추", 20], ["토마토", 25], ["오이", 15], ["기타", 10]] } },
    { name: "사과 생산량", type: "picto", t: { title: "마을별 사과 생산량", unit: "상자", rows: [["가 마을", 32], ["나 마을", 25], ["다 마을", 41], ["라 마을", 18]] } },
    { name: "좋아하는 동물", type: "symbol", t: { title: "좋아하는 동물", unit: "명", rows: [["강아지", 5], ["고양이", 4], ["토끼", 2], ["햄스터", 3]] } },
  ];

  /* ───── 상태·저장 ───── */
  const DEFAULT_OPTS = {
    symbol: { mark: "○" },
    picto: { icon: "🍎", big: 10 },
    bar: { horizontal: false, step: 0, values: true, avg: false },
    line: { wave: false, from: 0, step: 0, values: true, avg: false },
    band: { dec: 0, fix: false },
    pie: { dec: 0, fix: false },
  };
  function cleanTable(t) {
    if (!isObj(t)) return null;
    const rows = (Array.isArray(t.rows) ? t.rows : []).slice(0, 12).map((r) => {
      const label = String(Array.isArray(r) ? r[0] : r && r.label || "").trim().slice(0, 20);
      let v = Number(Array.isArray(r) ? r[1] : r && r.value);
      if (!Number.isFinite(v) || v < 0) v = 0;
      v = Math.min(9999, Math.round(v * 10) / 10);
      return { label: label || "항목", value: v };
    });
    if (!rows.length) return null;
    return { title: String(t.title || "").slice(0, 30), unit: String(t.unit || "").slice(0, 6), rows };
  }
  function cleanOpts(o) {
    const out = JSON.parse(JSON.stringify(DEFAULT_OPTS));
    if (!isObj(o)) return out;
    if (isObj(o.symbol) && ["○", "×", "/"].includes(o.symbol.mark)) out.symbol.mark = o.symbol.mark;
    if (isObj(o.picto)) { if (typeof o.picto.icon === "string" && [...o.picto.icon].length <= 2) out.picto.icon = o.picto.icon; if ([5, 10, 100].includes(o.picto.big)) out.picto.big = o.picto.big; }
    for (const k of ["bar", "line"]) if (isObj(o[k])) {
      out[k].step = [0, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].includes(o[k].step) ? o[k].step : 0;
      out[k].values = o[k].values !== false; out[k].avg = !!o[k].avg;
    }
    if (isObj(o.bar)) out.bar.horizontal = !!o.bar.horizontal;
    if (isObj(o.line)) { out.line.wave = !!o.line.wave; const f = Number(o.line.from); out.line.from = Number.isFinite(f) && f >= 0 ? Math.min(9999, f) : 0; }
    for (const k of ["band", "pie"]) if (isObj(o[k])) { out[k].dec = o[k].dec === 1 ? 1 : 0; out[k].fix = !!o[k].fix; }
    return out;
  }
  const store = SK.store("graph-maker:v1", {
    defaults: { table: null, type: "bar", opts: null, progress: {}, survey: null },
    validate(raw, d) {
      if (!isObj(raw)) return null;
      return {
        table: cleanTable(raw.table), type: TYPE_IDS.includes(raw.type) ? raw.type : d.type, opts: cleanOpts(raw.opts),
        progress: isObj(raw.progress) ? raw.progress : {},
        survey: isObj(raw.survey) && Array.isArray(raw.survey.items) ? { items: raw.survey.items.slice(0, 8).map((x) => ({ name: String(x && x.name || "").slice(0, 12) || "항목", n: Math.max(0, Math.min(999, Math.round(Number(x && x.n) || 0))) })) } : null,
      };
    },
  });
  const saved = store.load();
  const state = {
    table: saved.table || cleanTable(PRESETS[0].t),
    type: saved.type || "bar",
    opts: cleanOpts(saved.opts),
    mode: "make",
    draw: null,       // { vals: [], checked: false }
    level: null,      // 평균 고르게 하기 애니메이션 값
    survey: saved.survey || { items: [{ name: "봄", n: 0 }, { name: "여름", n: 0 }, { name: "가을", n: 0 }, { name: "겨울", n: 0 }] },
    surveyHist: [],
  };
  if (!saved.table) state.type = PRESETS[0].type;
  let saveT = 0;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => store.save({ table: state.table, type: state.type, opts: state.opts, progress: saved.progress, survey: state.survey }), 200);
  }

  /* ───── 색 ───── */
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function themeColors() {
    return { bg: cssVar("--gm-paper"), text: cssVar("--gm-text"), muted: cssVar("--gm-muted"), grid: cssVar("--gm-grid"), axis: cssVar("--gm-axis"), bar: cssVar("--gm-bar"), line: cssVar("--gm-line"), point: cssVar("--gm-line"), avg: cssVar("--gm-avg"), wave: cssVar("--gm-axis"), ok: cssVar("--gm-ok"), no: cssVar("--gm-no") };
  }
  const LIGHT = { bg: "#ffffff", text: "#1e1b2e", muted: "#6b6880", grid: "#e5e3ee", axis: "#4b4860", bar: "#6d28d9", line: "#e11d48", point: "#e11d48", avg: "#d97706", wave: "#4b4860", ok: "#15803d", no: "#c2410c" };

  /* ───── 계산 ───── */
  function total(t) { return t.rows.reduce((s, r) => s + r.value, 0); }
  function pcts(t, dec, fix) {
    const tot = total(t);
    if (!tot) return t.rows.map(() => 0);
    const f = Math.pow(10, dec);
    const raw = t.rows.map((r) => (r.value / tot) * 100 * f);
    let out = raw.map((x) => Math.round(x));
    if (fix) {
      out = raw.map((x) => Math.floor(x));
      let left = 100 * f - out.reduce((a, b) => a + b, 0);
      const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
      for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k][1]]++;
    }
    return out.map((x) => x / f);
  }
  const avgOf = (t) => t.rows.length ? total(t) / t.rows.length : 0;

  /* ═══════════════ 그리기 ═══════════════ */
  function svgEl(tag, a, p, text) { return VG.el(tag, a, p, text); }
  function clearSvg(svg, W, H, C) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.setAttribute("font-family", "-apple-system, 'Pretendard', 'Malgun Gothic', sans-serif");
    svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: C.bg }, svg);
  }
  function fsOf(W, H) { return Math.max(13, Math.min(20, Math.round(Math.min(W, H) / 28))); }
  function titleOf(svg, t, W, fs, C) { if (t.title) svgEl("text", { x: W / 2, y: fs * 1.5, "text-anchor": "middle", "font-size": fs * 1.15, "font-weight": 800, fill: C.text }, svg, t.title); }
  function a11y(svg, t, kind, extra) {
    svgEl("title", null, svg, (t.title || "") + " " + kind);
    svgEl("desc", null, svg, t.rows.map((r, i) => r.label + " " + fmtN(r.value) + (t.unit || "") + (extra ? " " + extra[i] : "")).join(", "));
    svg.setAttribute("role", "img");
  }

  // ○그래프: 항목마다 세로 칸, 아래부터 기호
  function drawSymbol(svg, t, o, W, H, C, vals) {
    clearSvg(svg, W, H, C);
    const fs = fsOf(W, H), n = t.rows.length;
    const values = vals || t.rows.map((r) => r.value);
    const maxV = Math.max(5, ...t.rows.map((r) => Math.ceil(r.value)), ...values.map((v) => Math.ceil(v || 0)));
    const rows = Math.min(20, maxV);
    titleOf(svg, t, W, fs, C);
    const top = fs * 3, bottom = fs * 2.6, left = fs * 2.4, right = 16;
    const cell = Math.max(14, Math.min((W - left - right) / n, (H - top - bottom) / rows, 90));
    const gw = cell * n, gh = cell * rows;
    const x0 = left + (W - left - right - gw) / 2, y0 = top + (H - top - bottom - gh) / 2;
    const g = svgEl("g", {}, svg);
    for (let c = 0; c < n; c++) for (let r = 0; r < rows; r++) {
      svgEl("rect", { x: x0 + c * cell, y: y0 + gh - (r + 1) * cell, width: cell, height: cell, fill: "none", stroke: C.grid, "stroke-width": 1.5, "data-c": c, "data-r": r + 1 }, g);
    }
    for (let r = 1; r <= rows; r++) svgEl("text", { x: x0 - 8, y: y0 + gh - (r - 0.5) * cell, "text-anchor": "end", "dominant-baseline": "central", "font-size": fs * 0.85, fill: C.muted }, g, r);
    for (let c = 0; c < n; c++) {
      const v = Math.min(rows, Math.round(values[c] || 0));
      for (let r = 0; r < v; r++) svgEl("text", { x: x0 + (c + 0.5) * cell, y: y0 + gh - (r + 0.5) * cell, "text-anchor": "middle", "dominant-baseline": "central", "font-size": cell * 0.62, "font-weight": 800, fill: PALETTE[c % PALETTE.length], "pointer-events": "none" }, g, o.mark);
      svgEl("text", { x: x0 + (c + 0.5) * cell, y: y0 + gh + fs * 1.3, "text-anchor": "middle", "font-size": fs, "font-weight": 800, fill: C.text }, g, t.rows[c].label);
    }
    svgEl("line", { x1: x0, y1: y0 + gh, x2: x0 + gw, y2: y0 + gh, stroke: C.axis, "stroke-width": 2 }, g);
    if (t.unit) svgEl("text", { x: x0 - 8, y: y0 - fs * 0.6, "text-anchor": "end", "font-size": fs * 0.8, fill: C.muted }, g, "(" + t.unit + ")");
    a11y(svg, t, "○그래프");
    return { x0, y0, gw, gh, cell, n, rows, over: t.rows.some((r) => r.value > 20 || r.value % 1) };
  }

  // 그림그래프: 큰 그림 + 작은 그림
  function drawPicto(svg, t, o, W, H, C) {
    clearSvg(svg, W, H, C);
    const fs = fsOf(W, H), n = t.rows.length, big = o.big;
    titleOf(svg, t, W, fs, C);
    const top = fs * 3, bottom = fs * 3.4;
    const labW = Math.max(...t.rows.map((r) => [...r.label].length)) * fs * 1.05 + 24;
    const rowH = Math.max(34, Math.min(96, (H - top - bottom) / n));
    const areaW = W - labW - 24;
    const counts = t.rows.map((r) => ({ b: Math.floor(r.value / big), s: Math.round(r.value % big) }));
    let bigS = rowH * 0.7, smS = rowH * 0.42;
    const need = Math.max(...counts.map((c) => c.b * bigS * 1.02 + c.s * smS * 1.02)) + 10;
    if (need > areaW) { const k = areaW / need; bigS *= k; smS *= k; }
    const y0 = top + (H - top - bottom - rowH * n) / 2;
    const g = svgEl("g", {}, svg);
    svgEl("line", { x1: 12, y1: y0, x2: W - 12, y2: y0, stroke: C.axis, "stroke-width": 1.5 }, g);
    t.rows.forEach((r, i) => {
      const cy = y0 + rowH * (i + 0.5);
      svgEl("text", { x: labW - 14, y: cy, "text-anchor": "end", "dominant-baseline": "central", "font-size": fs, "font-weight": 800, fill: C.text }, g, r.label);
      let x = labW;
      for (let k = 0; k < counts[i].b; k++) { svgEl("text", { x: x + bigS / 2, y: cy, "text-anchor": "middle", "dominant-baseline": "central", "font-size": bigS * 0.86 }, g, o.icon); x += bigS * 1.02; }
      for (let k = 0; k < counts[i].s; k++) { svgEl("text", { x: x + smS / 2, y: cy + (bigS - smS) * 0.18, "text-anchor": "middle", "dominant-baseline": "central", "font-size": smS * 0.86 }, g, o.icon); x += smS * 1.02; }
      svgEl("line", { x1: 12, y1: y0 + rowH * (i + 1), x2: W - 12, y2: y0 + rowH * (i + 1), stroke: C.grid, "stroke-width": 1.5 }, g);
    });
    svgEl("line", { x1: labW - 4, y1: y0, x2: labW - 4, y2: y0 + rowH * n, stroke: C.grid, "stroke-width": 1.5 }, g);
    // 범례
    const ly = H - fs * 1.6;
    const lg = svgEl("g", {}, svg);
    svgEl("text", { x: W / 2 - fs * 7, y: ly, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs * 1.6 }, lg, o.icon);
    svgEl("text", { x: W / 2 - fs * 5.8, y: ly, "dominant-baseline": "central", "font-size": fs * 0.95, "font-weight": 800, fill: C.text }, lg, big + (t.unit || ""));
    svgEl("text", { x: W / 2 + fs * 1.6, y: ly, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs * 0.95 }, lg, o.icon);
    svgEl("text", { x: W / 2 + fs * 2.6, y: ly, "dominant-baseline": "central", "font-size": fs * 0.95, "font-weight": 800, fill: C.text }, lg, "1" + (t.unit || ""));
    a11y(svg, t, "그림그래프");
    return { over: t.rows.some((r) => r.value % 1), many: counts.some((c) => c.b > 12) };
  }

  // 띠그래프
  function drawBand(svg, t, o, W, H, C, hideIdx) {
    clearSvg(svg, W, H, C);
    const fs = fsOf(W, H);
    titleOf(svg, t, W, fs, C);
    const P = pcts(t, o.dec, o.fix);
    const l = 24, r = W - 24, bh = Math.max(56, Math.min(110, H * 0.24));
    const by = Math.max(fs * 4, (H - bh) / 2 - fs);
    const g = svgEl("g", {}, svg);
    let x = l;
    const tot = P.reduce((a, b) => a + b, 0) || 1;
    t.rows.forEach((row, i) => {
      const w = (P[i] / Math.max(100, tot)) * (r - l);
      svgEl("rect", { x, y: by, width: Math.max(0, w), height: bh, fill: PALETTE[i % PALETTE.length], stroke: C.bg, "stroke-width": 2 }, g);
      const label = row.label, pct = hideIdx === i ? "?" : fmtN(P[i]) + "%";
      const tw = Math.max([...label].length * fs * 0.95, pct.length * fs * 0.6);
      if (w >= tw + 6) {
        svgEl("text", { x: x + w / 2, y: by + bh / 2 - fs * 0.55, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs * 0.95, "font-weight": 800, fill: "#fff" }, g, label);
        svgEl("text", { x: x + w / 2, y: by + bh / 2 + fs * 0.65, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs, "font-weight": 900, fill: "#fff" }, g, pct);
      } else if (w > 0) {
        const up = i % 2 === 0;
        const ty = up ? by - fs * 0.8 : by + bh + fs * 2.6;
        svgEl("line", { x1: x + w / 2, y1: up ? by : by + bh, x2: x + w / 2, y2: up ? ty + fs * 0.3 : ty - fs * 1.1, stroke: C.muted }, g);
        svgEl("text", { x: x + w / 2, y: ty, "text-anchor": "middle", "font-size": fs * 0.85, "font-weight": 800, fill: C.text }, g, label + " " + pct);
      }
      x += w;
    });
    // 눈금(5%마다, 10%마다 숫자)
    const sy = by + bh + 4;
    for (let k = 0; k <= 20; k++) {
      const xx = l + (k / 20) * (r - l);
      svgEl("line", { x1: xx, y1: sy, x2: xx, y2: sy + (k % 2 ? 6 : 11), stroke: C.axis, "stroke-width": 1.2 }, g);
      if (k % 2 === 0) svgEl("text", { x: xx, y: sy + 11 + fs * 0.9, "text-anchor": "middle", "font-size": fs * 0.8, fill: C.muted }, g, (k * 5) + "");
    }
    svgEl("text", { x: r, y: sy + 11 + fs * 2, "text-anchor": "end", "font-size": fs * 0.8, fill: C.muted }, g, "(%)");
    a11y(svg, t, "띠그래프", P.map((p, i) => (i === hideIdx ? "?" : p + "%")));
    return { sum: P.reduce((a, b) => a + b, 0) };
  }

  // 원그래프 (12시 방향에서 시계 방향)
  function drawPie(svg, t, o, W, H, C, hideIdx) {
    clearSvg(svg, W, H, C);
    const fs = fsOf(W, H);
    titleOf(svg, t, W, fs, C);
    const P = pcts(t, o.dec, o.fix);
    const top = fs * 3;
    const R = Math.max(60, Math.min(W * 0.5 - fs * 5, (H - top - fs * 2.5) / 2 - 14));
    const cx = W / 2, cy = top + (H - top) / 2;
    const g = svgEl("g", {}, svg);
    const pt = (rr, pct) => { const a = (pct / 100) * Math.PI * 2; return [cx + rr * Math.sin(a), cy - rr * Math.cos(a)]; };
    const tot = Math.max(100, P.reduce((a, b) => a + b, 0));
    let acc = 0;
    t.rows.forEach((row, i) => {
      const p = (P[i] / tot) * 100;
      if (p <= 0) return;
      const [x0, y0] = pt(R, acc), [x1, y1] = pt(R, acc + p);
      const d = p >= 99.999 ? "M" + cx + " " + (cy - R) + " A" + R + " " + R + " 0 1 1 " + (cx - 0.01) + " " + (cy - R) + " Z"
        : "M" + cx + " " + cy + " L" + x0.toFixed(2) + " " + y0.toFixed(2) + " A" + R + " " + R + " 0 " + (p > 50 ? 1 : 0) + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2) + " Z";
      svgEl("path", { d, fill: PALETTE[i % PALETTE.length], stroke: C.bg, "stroke-width": 2 }, g);
      const mid = acc + p / 2;
      const label = row.label, pct = hideIdx === i ? "?" : fmtN(P[i]) + "%";
      if (p >= 7) {
        const [lx, ly] = pt(R * 0.62, mid);
        svgEl("text", { x: lx, y: ly - fs * 0.55, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs * 0.95, "font-weight": 800, fill: "#fff" }, g, label);
        svgEl("text", { x: lx, y: ly + fs * 0.65, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs, "font-weight": 900, fill: "#fff" }, g, pct);
      } else {
        const [ax, ay] = pt(R + 4, mid), [bx, by2] = pt(R + 22, mid);
        svgEl("line", { x1: ax, y1: ay, x2: bx, y2: by2, stroke: C.muted }, g);
        svgEl("text", { x: bx + (bx >= cx ? 4 : -4), y: by2, "text-anchor": bx >= cx ? "start" : "end", "dominant-baseline": "central", "font-size": fs * 0.85, "font-weight": 800, fill: C.text }, g, label + " " + pct);
      }
      acc += p;
    });
    // 바깥 눈금(5%마다)
    for (let k = 0; k < 20; k++) { const [x0, y0] = pt(R, k * 5), [x1, y1] = pt(R + (k % 5 ? 6 : 12), k * 5); svgEl("line", { x1: x0, y1: y0, x2: x1, y2: y1, stroke: C.axis, "stroke-width": 1.2 }, g); }
    svgEl("circle", { cx, cy, r: R, fill: "none", stroke: C.axis, "stroke-width": 1.5 }, g);
    a11y(svg, t, "원그래프", P.map((p, i) => (i === hideIdx ? "?" : p + "%")));
    return { sum: P.reduce((a, b) => a + b, 0) };
  }

  function vgOpts(t, o, W, H, C, extra) {
    return Object.assign({ width: W, height: H, title: t.title, unit: t.unit, items: t.rows.map((r) => ({ label: r.label, value: r.value })), colors: C, step: o.step || 0, showValues: o.values }, extra || {});
  }

  // 종류별로 그리기. 반환값: 그리기 정보(직접 그리기·미션에서 사용)
  function renderChart(svg, type, t, opts, W, H, C, extra) {
    extra = extra || {};
    const o = opts[type];
    if (type === "bar") return { kind: "bar", info: VG.bar(svg, vgOpts(t, o, W, H, C, { horizontal: o.horizontal, avg: o.avg ? avgOf(t) : null, drawValues: extra.drawValues, barColors: extra.barColors, showValues: extra.hideValues ? false : o.values })) };
    if (type === "line") return { kind: "line", info: VG.line(svg, vgOpts(t, o, W, H, C, { wave: o.wave && o.from > 0 ? { from: o.from } : null, avg: o.avg ? avgOf(t) : null, drawValues: extra.drawValues, showValues: extra.hideValues ? false : o.values })) };
    if (type === "symbol") return { kind: "symbol", info: drawSymbol(svg, t, o, W, H, C, extra.drawValues) };
    if (type === "picto") return { kind: "picto", info: drawPicto(svg, t, o, W, H, C) };
    if (type === "band") return { kind: "band", info: drawBand(svg, t, o, W, H, C, extra.hideIdx) };
    return { kind: "pie", info: drawPie(svg, t, o, W, H, C, extra.hideIdx) };
  }

  /* ═══════════════ 무대 ═══════════════ */
  const stage = $("stage");
  let stageSvg = null;
  let lastRender = null;
  function stageSize() { const r = stage.getBoundingClientRect(); return { W: Math.max(240, Math.floor(r.width)), H: Math.max(200, Math.floor(r.height)) }; }
  function ensureSvg() {
    if (!stageSvg || stageSvg.parentNode !== stage) { stage.textContent = ""; stageSvg = document.createElementNS(NS, "svg"); stage.appendChild(stageSvg); }
    return stageSvg;
  }
  function note(text, warn) {
    let n = stage.querySelector(".stage-note");
    if (!text) { if (n) n.remove(); return; }
    if (!n) { n = document.createElement("div"); n.className = "stage-note"; stage.appendChild(n); }
    n.textContent = text; n.classList.toggle("warn", !!warn);
  }

  function renderMake() {
    if (state.mode !== "make") return;
    const svg = ensureSvg();
    const { W, H } = stageSize();
    const t = state.table, type = state.type;
    const extra = {};
    if (state.draw && (type === "bar" || type === "line")) {
      extra.drawValues = state.draw.vals;
      if (state.draw.checked) extra.barColors = state.draw.vals.map((v, i) => v === t.rows[i].value ? cssVar("--gm-ok") : cssVar("--gm-no"));
      extra.hideValues = !state.draw.checked;
    } else if (state.level && type === "bar") extra.drawValues = state.level;
    lastRender = renderChart(svg, type, t, state.opts, W, H, themeColors(), extra);
    lastRender.type = type;
    // 안내
    let msg = "", warn = false;
    if (type === "symbol" && lastRender.info.over) { msg = "○그래프는 20 이하의 자연수 자료에 알맞아요. 큰 수는 막대그래프로 나타내 보세요."; warn = true; }
    else if (type === "picto" && lastRender.info.many) { msg = "그림이 너무 많아요. 큰 그림 단위를 크게 바꿔 보세요."; warn = true; }
    else if ((type === "band" || type === "pie")) {
      const s = Math.round(lastRender.info.sum * 10) / 10;
      if (total(t) === 0) { msg = "값을 넣으면 백분율을 계산해요."; }
      else if (s !== 100) { msg = "반올림해서 백분율의 합계가 " + fmtN(s) + "%예요. ‘합계 100으로 맞추기’를 켤 수 있어요."; warn = true; }
      else msg = "백분율의 합계: 100%";
    } else if (state.draw && !state.draw.checked) msg = "막대 끝(꺾은선은 점)을 누르거나 끌어 표의 값만큼 그려 보세요.";
    else if (state.level && state.levelText) msg = state.levelText;
    note(msg, warn);
  }

  /* ───── 직접 그리기(막대·꺾은선) ───── */
  let drag = null;
  function drawTarget() {
    if (state.mode === "make" && state.draw && lastRender && (lastRender.kind === "bar" || lastRender.kind === "line")) return { vals: state.draw.vals, render: lastRender, rerender: renderMake, snap: drawSnap(state.table), onEdit: () => { state.draw.checked = false; } };
    if (state.mode === "mission" && mDraw) return mDraw;
    return null;
  }
  // 표 값이 정수면 1, 0.5 단위면 0.5, 그 밖의 소수(예: 22.3)면 0.1 — 어떤 표 값이든 그려서 맞출 수 있게
  function drawSnap(t) {
    if (t.rows.every((r) => Number.isInteger(r.value))) return 1;
    if (t.rows.every((r) => Number.isInteger(r.value * 2))) return 0.5;
    return 0.1;
  }
  const snapTo = (v, snap) => Math.round(Math.round(v / snap) * snap * 10) / 10;
  function eventToSvg(svg, e) { const m = svg.getScreenCTM(); if (!m) return null; return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); }
  function colAt(info, kind, p) {
    const f = info.frame, pl = f.plot, n = f.items.length;
    if (kind === "bar" && f.horizontal) { const i = Math.floor((p.y - pl.t) / ((pl.b - pl.t) / n)); return i >= 0 && i < n ? i : -1; }
    const i = Math.floor((p.x - pl.l) / ((pl.r - pl.l) / n));
    return i >= 0 && i < n ? i : -1;
  }
  function valueAt(info, kind, p, snap) {
    const f = info.frame, S = info.scale;
    let v = kind === "bar" && f.horizontal ? S.inv(p.x) : S.inv(p.y);
    v = Math.max(f.from || 0, Math.min(f.top, v));
    return snapTo(v, snap);
  }
  function bubble(text, x, y) {
    let b = stage.querySelector(".draw-bubble");
    if (text == null) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.className = "draw-bubble"; stage.appendChild(b); }
    const r = stage.getBoundingClientRect();
    b.textContent = text; b.style.left = (x - r.left) + "px"; b.style.top = (y - r.top) + "px";
  }
  stage.addEventListener("pointerdown", (e) => {
    const svg = stage.querySelector("svg");
    if (!svg || e.button > 0) return;
    // ○그래프 미션: 칸 누르기
    if (state.mode === "mission" && mSymbol) { symbolTap(e, svg); return; }
    const T = drawTarget();
    if (!T) return;
    const p = eventToSvg(svg, e); if (!p) return;
    const kind = T.render.kind, info = T.render.info;
    const i = colAt(info, kind, p);
    if (i < 0) return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    drag = { pid: e.pointerId, i, T, kind };
    moveDraw(e);
  });
  function moveDraw(e) {
    const d = drag; if (!d) return;
    const svg = stage.querySelector("svg");
    const p = eventToSvg(svg, e); if (!p) return;
    const info = d.T.render.info;
    const v = valueAt(info, d.kind, p, d.T.snap);
    if (d.T.vals[d.i] !== v) { d.T.vals[d.i] = v; if (d.T.onEdit) d.T.onEdit(); d.T.rerender(); }
    bubble(fmtN(v), e.clientX, e.clientY);
  }
  stage.addEventListener("pointermove", (e) => { if (drag && e.pointerId === drag.pid) moveDraw(e); });
  function endDraw(e) { if (!drag || (e && e.pointerId !== drag.pid)) return; drag = null; bubble(null); if (SK.sound) SK.sound.play("move"); }
  stage.addEventListener("pointerup", endDraw);
  stage.addEventListener("pointercancel", endDraw);
  // 키보드: 직접 그리기 칸 고르기·값 바꾸기
  stage.tabIndex = 0;
  let kbCol = 0;
  stage.addEventListener("keydown", (e) => {
    const T = drawTarget();
    if (!T) return;
    const n = T.vals.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); kbCol = (kbCol + (e.key === "ArrowRight" ? 1 : n - 1)) % n; liveSay((kbCol + 1) + "번째 항목, " + fmtN(T.vals[kbCol] || 0)); }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const f = T.render.info.frame;
      const cur = T.vals[kbCol] == null ? (f.from || 0) : T.vals[kbCol];
      T.vals[kbCol] = snapTo(Math.max(f.from || 0, Math.min(f.top, cur + (e.key === "ArrowUp" ? T.snap : -T.snap))), T.snap);
      if (T.onEdit) T.onEdit(); T.rerender(); liveSay(fmtN(T.vals[kbCol]));
    }
  });
  function liveSay(msg) { stage.setAttribute("aria-label", msg); }

  /* ═══════════════ 만들기: 종류·표·설정 ═══════════════ */
  function renderTypeBar() {
    const bar = $("typeBar");
    bar.textContent = "";
    for (const ty of TYPES) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "type-btn"; b.dataset.type = ty.id;
      b.setAttribute("aria-pressed", ty.id === state.type ? "true" : "false");
      const n = document.createElement("b"); n.textContent = ty.name;
      const s = document.createElement("small"); s.textContent = ty.grade;
      b.append(n, s);
      b.addEventListener("click", () => setType(ty.id));
      bar.appendChild(b);
    }
  }
  function setType(id) {
    tween.stop();
    state.type = id; state.draw = null; state.level = null;
    for (const b of $("typeBar").children) b.setAttribute("aria-pressed", b.dataset.type === id ? "true" : "false");
    persist(); renderOpts(); renderMake();
    if (SK.sound) SK.sound.play("move");
  }

  function renderPresets() {
    const box = $("presets"); box.textContent = "";
    PRESETS.forEach((p) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = p.name;
      // 예시 자료는 지금 표를 덮어쓰므로 되돌리기 토스트
      b.addEventListener("click", () => {
        const before = { table: JSON.parse(JSON.stringify(state.table)), type: state.type };
        state.table = cleanTable(p.t); state.draw = null; state.level = null; renderTable(); setType(p.type);
        undoToast("예시 자료 '" + p.name + "'로 바꿨어요.", () => { state.table = before.table; state.draw = null; state.level = null; renderTable(); setType(before.type); });
      });
      box.appendChild(b);
    });
  }

  function renderTable() {
    const t = state.table;
    $("tTitle").value = t.title; $("tUnit").value = t.unit;
    const box = $("rows"); box.textContent = "";
    t.rows.forEach((r, i) => {
      const row = document.createElement("div"); row.className = "trow";
      const name = document.createElement("input"); name.className = "inp"; name.value = r.label; name.maxLength = 20; name.setAttribute("aria-label", (i + 1) + "번째 항목 이름");
      name.addEventListener("input", () => { r.label = name.value.slice(0, 20) || ""; persist(); renderMake(); });
      name.addEventListener("change", () => { if (!r.label.trim()) { r.label = "항목"; name.value = r.label; } });
      const minus = sqIcon("minus", () => { r.value = Math.max(0, Math.round((r.value - 1) * 10) / 10); onTableChange(); }, r.label + " 1 줄이기");
      const val = document.createElement("button"); val.type = "button"; val.className = "val"; val.textContent = fmtN(r.value);
      val.setAttribute("aria-label", r.label + " 값 " + fmtN(r.value) + ", 눌러서 입력");
      val.addEventListener("click", () => openKeypad(val, r.label, r.value, (v) => { r.value = v; onTableChange(); }));
      const plus = sqIcon("plus", () => { r.value = Math.min(9999, Math.round((r.value + 1) * 10) / 10); onTableChange(); }, r.label + " 1 늘리기");
      const del = sqIcon("x", () => {
        if (t.rows.length <= 1) return;
        const [gone] = t.rows.splice(i, 1); onTableChange();
        undoToast("'" + gone.label + "' 항목을 뺐어요.", () => { t.rows.splice(Math.min(i, t.rows.length), 0, gone); onTableChange(); });
      }, r.label + " 빼기");
      del.classList.add("del"); del.disabled = t.rows.length <= 1;
      row.append(name, minus, val, plus, del);
      box.appendChild(row);
    });
    $("btnAddRow").disabled = t.rows.length >= 12;
    $("tTotal").textContent = fmtN(total(t)) + (t.unit || "");
  }
  function sq(text, fn, label) { const b = document.createElement("button"); b.type = "button"; b.className = "sq"; b.textContent = text; b.setAttribute("aria-label", label); b.addEventListener("click", fn); return b; }
  function sqIcon(name, fn, label) { const b = sq("", fn, label); b.innerHTML = IC(name); return b; }
  // 덮어쓰기·지우기 뒤 되돌리기(공용 VUI.toast action)
  function undoToast(msg, restore) {
    if (VUI && VUI.toast) VUI.toast(msg, { action: { label: "되돌리기", onClick: restore } });
    else SK.toast(msg);
  }
  function onTableChange() {
    tween.stop();
    if (state.draw) state.draw = { vals: state.table.rows.map(() => null), checked: false };
    state.level = null;
    persist(); renderTable(); renderOpts(); renderMake();
  }
  $("tTitle").addEventListener("input", () => { state.table.title = $("tTitle").value.slice(0, 30); persist(); renderMake(); });
  $("tUnit").addEventListener("input", () => { state.table.unit = $("tUnit").value.slice(0, 6); persist(); renderMake(); $("tTotal").textContent = fmtN(total(state.table)) + state.table.unit; });
  $("btnAddRow").addEventListener("click", () => { if (state.table.rows.length >= 12) return; state.table.rows.push({ label: "항목 " + (state.table.rows.length + 1), value: 0 }); onTableChange(); const ins = $("rows").querySelectorAll("input"); if (ins.length) ins[ins.length - 1].select(); });

  // 값 입력판(화면 키보드 대신)
  let kp = null;
  function openKeypad(anchor, label, value, onOk) {
    const pop = $("kpPop");
    kp = { anchor, onOk, text: fmtN(value), fresh: true }; // 첫 입력은 기존 값을 바꿔 씀
    $("kpLabel").textContent = label;
    $("kpVal").textContent = kp.text || "0";
    for (const b of document.querySelectorAll("#rows .val")) b.classList.toggle("focus", b === anchor);
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = Math.min(innerWidth - pw - 8, Math.max(8, r.left + r.width / 2 - pw / 2));
    let y = r.bottom + 6; if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
    pop.style.left = x + "px"; pop.style.top = y + "px";
    pop.querySelector("button").focus();
  }
  function closeKeypad(apply) {
    if (!kp) return;
    const k = kp; kp = null;
    $("kpPop").hidden = true;
    for (const b of document.querySelectorAll("#rows .val")) b.classList.remove("focus");
    if (apply) { let v = parseFloat(k.text || "0"); if (!Number.isFinite(v)) v = 0; v = Math.min(9999, Math.max(0, Math.round(v * 10) / 10)); k.onOk(v); }
  }
  (function buildKeypad() {
    const box = $("kpKeys");
    ["7", "8", "9", "⌫", "4", "5", "6", ".", "1", "2", "3", "0", "취소", "확인"].forEach((k) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = k;
      if (k === "⌫") { b.innerHTML = IC("delete"); b.setAttribute("aria-label", "지우기"); }
      if (k === "확인") { b.className = "ok"; b.style.gridColumn = "span 2"; }
      if (k === "취소") b.style.gridColumn = "span 2";
      b.addEventListener("click", () => kpKey(k));
      box.appendChild(b);
    });
  })();
  function kpKey(k) {
    if (!kp) return;
    if (k === "확인") return closeKeypad(true);
    if (k === "취소") return closeKeypad(false);
    if (kp.fresh && k !== "⌫") kp.text = "";
    kp.fresh = false;
    if (k === "⌫") kp.text = kp.text.slice(0, -1);
    else if (k === ".") { if (!kp.text.includes(".")) kp.text = (kp.text || "0") + "."; }
    else if (kp.text.replace(".", "").length < 5 && !(kp.text.includes(".") && kp.text.split(".")[1].length >= 1)) kp.text = (kp.text === "0" ? "" : kp.text) + k;
    $("kpVal").textContent = kp.text || "0";
  }
  document.addEventListener("keydown", (e) => {
    if (!kp) return;
    if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); kpKey(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); kpKey("⌫"); }
    else if (e.key === "Enter") { e.preventDefault(); kpKey("확인"); }
    else if (e.key === "Escape") { e.preventDefault(); closeKeypad(false); }
  });
  document.addEventListener("pointerdown", (e) => { if (kp && !e.target.closest("#kpPop") && e.target !== kp.anchor) closeKeypad(true); });

  // 종류별 설정
  function chipGroup(label, values, cur, fmt, onPick) {
    const wrap = document.createElement("div"); wrap.className = "row";
    const l = document.createElement("span"); l.className = "hint-text"; l.style.fontWeight = "800"; l.style.minWidth = "72px"; l.textContent = label;
    const set = document.createElement("div"); set.className = "chipset"; set.style.flex = "1";
    values.forEach((v) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = fmt ? fmt(v) : v;
      b.setAttribute("aria-pressed", v === cur ? "true" : "false");
      b.addEventListener("click", () => onPick(v));
      set.appendChild(b);
    });
    wrap.append(l, set);
    return wrap;
  }
  function toggleBtn(label, on, fn, icon) {
    const b = document.createElement("button"); b.type = "button"; b.className = "sk-btn sk-btn--sm";
    b.textContent = label; if (icon) b.insertAdjacentHTML("afterbegin", IC(icon) + " ");
    b.setAttribute("aria-pressed", on ? "true" : "false"); b.addEventListener("click", fn); return b;
  }
  function renderOpts() {
    const box = $("opts"); box.textContent = "";
    const type = state.type, o = state.opts[type];
    const ty = TYPES.find((x) => x.id === type);
    $("optTitle").textContent = ty.name + " 설정 (" + ty.grade + ")";
    const upd = () => { persist(); renderOpts(); renderMake(); };
    if (type === "symbol") box.appendChild(chipGroup("기호", ["○", "×", "/"], o.mark, null, (v) => { o.mark = v; upd(); }));
    if (type === "picto") {
      box.appendChild(chipGroup("그림", ["🍎", "📦", "🐟", "📚", "🚗", "🌳", "⭐", "🙂"], o.icon, null, (v) => { o.icon = v; upd(); }));
      box.appendChild(chipGroup("큰 그림", [5, 10, 100], o.big, (v) => v + (state.table.unit || ""), (v) => { o.big = v; upd(); }));
      const h = document.createElement("p"); h.className = "hint-text"; h.style.marginTop = "8px"; h.textContent = "큰 그림 하나는 " + o.big + (state.table.unit || "") + ", 작은 그림 하나는 1" + (state.table.unit || "") + "이에요.";
      box.appendChild(h);
    }
    if (type === "bar" || type === "line") {
      const steps = [0, 1, 2, 5, 10, 20, 50, 100];
      box.appendChild(chipGroup("눈금 한 칸", steps, o.step, (v) => v === 0 ? "자동" : String(v), (v) => { o.step = v; upd(); }));
      if (type === "bar") box.appendChild(chipGroup("방향", [false, true], o.horizontal, (v) => v ? "가로" : "세로", (v) => { o.horizontal = v; state.draw = null; state.level = null; upd(); }));
      if (type === "line") {
        const mn = Math.min(...state.table.rows.map((r) => r.value));
        const wrap = document.createElement("div"); wrap.className = "row";
        wrap.appendChild(toggleBtn("물결선", o.wave, () => { o.wave = !o.wave; if (o.wave && !o.from) o.from = suggestFrom(state.table, o.step); upd(); }));
        if (o.wave) {
          const lab = document.createElement("span"); lab.className = "hint-text"; lab.style.fontWeight = "800"; lab.textContent = "시작값";
          const minus = sqIcon("minus", () => { o.from = Math.max(0, o.from - (o.step || 1)); upd(); }, "시작값 줄이기");
          const v = document.createElement("span"); v.style.fontWeight = "900"; v.style.minWidth = "40px"; v.style.textAlign = "center"; v.textContent = fmtN(o.from);
          const plus = sqIcon("plus", () => { o.from = Math.min(mn, o.from + (o.step || 1)); upd(); }, "시작값 늘리기");
          minus.style.width = plus.style.width = "44px";
          wrap.append(lab, minus, v, plus);
        }
        box.appendChild(wrap);
      }
      const row = document.createElement("div"); row.className = "row";
      row.appendChild(toggleBtn("값 표시", o.values, () => { o.values = !o.values; upd(); }));
      row.appendChild(toggleBtn("평균선", o.avg, () => { o.avg = !o.avg; state.level = null; upd(); }));
      box.appendChild(row);
      const row2 = document.createElement("div"); row2.className = "row";
      row2.appendChild(toggleBtn("직접 그리기", !!state.draw, () => {
        state.level = null;
        state.draw = state.draw ? null : { vals: state.table.rows.map(() => (type === "bar" ? 0 : null)), checked: false };
        renderOpts(); renderMake(); stage.focus();
      }, "pencil"));
      if (state.draw) {
        const chk = document.createElement("button"); chk.type = "button"; chk.className = "sk-btn sk-btn--sm sk-btn--primary"; chk.innerHTML = IC("circle-check") + " 맞게 그렸나 확인하기";
        chk.addEventListener("click", checkDraw);
        row2.appendChild(chk);
      } else if (type === "bar" && o.avg && !o.horizontal) {
        row2.appendChild(state.level ? toggleBtn("원래대로", false, levelOff, "rotate-ccw") : toggleBtn("고르게 하기", false, levelOff, "scale"));
      }
      box.appendChild(row2);
    }
    if (type === "band" || type === "pie") {
      box.appendChild(chipGroup("반올림", [0, 1], o.dec, (v) => v ? "소수 첫째 자리까지" : "일의 자리까지", (v) => { o.dec = v; upd(); }));
      const row = document.createElement("div"); row.className = "row";
      row.appendChild(toggleBtn("합계 100으로 맞추기", o.fix, () => { o.fix = !o.fix; upd(); }));
      box.appendChild(row);
      const h = document.createElement("p"); h.className = "hint-text"; h.style.marginTop = "8px";
      h.textContent = "백분율 = 항목의 값 ÷ 합계 × 100. 합계 맞추기를 켜면 반올림으로 생긴 차이를 버린 부분이 큰 항목부터 " + (o.dec ? "0.1" : "1") + "씩 더해요.";
      box.appendChild(h);
    }
  }
  function suggestFrom(t, step) {
    const mn = Math.min(...t.rows.map((r) => r.value));
    const st = step || VG.niceStep(Math.max(1, Math.max(...t.rows.map((r) => r.value)) - mn), 8, 1);
    return Math.max(0, Math.floor((mn - st) / st) * st);
  }
  function checkDraw() {
    const d = state.draw; if (!d) return;
    d.checked = true;
    const wrong = state.table.rows.filter((r, i) => d.vals[i] !== r.value).map((r) => r.label);
    renderMake();
    if (!wrong.length) { SK.toast("모두 맞게 그렸어요!"); if (SK.sound) SK.sound.play("done"); note("모두 맞게 그렸어요!"); }
    else { SK.toast("다시 볼까요? " + wrong.join(", "), "no"); if (SK.sound) SK.sound.play("wrong"); note("주황색 항목을 다시 그려 보세요: " + wrong.join(", "), true); }
  }

  // 평균: 막대 고르게 하기
  function levelOff() {
    if (state.level) { tween.stop(); state.level = null; state.levelText = ""; renderOpts(); renderMake(); return; }
    const t = state.table, avg = avgOf(t);
    const from = t.rows.map((r) => r.value);
    state.levelText = "평균 = (" + t.rows.map((r) => fmtN(r.value)).join(" + ") + ") ÷ " + t.rows.length + " = " + fmtN(total(t)) + " ÷ " + t.rows.length + " = " + fmtN(Math.round(avg * 100) / 100);
    tween.run(1100, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      state.level = from.map((v) => v + (avg - v) * e);
      renderMake();
    }, () => { renderOpts(); if (SK.sound) SK.sound.play("done"); });
  }

  // 붙여넣기
  const pasteModal = VUI ? VUI.modal.bind("#pasteModal", { className: "open", backdropClose: true, initialFocus: "#pasteText" }) : null;
  $("btnPaste").addEventListener("click", () => { $("pasteText").value = state.table.rows.map((r) => r.label + "\t" + fmtN(r.value)).join("\n"); if (pasteModal) pasteModal.open(); });
  $("pasteApply").addEventListener("click", () => {
    const rows = $("pasteText").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.split(/\t|,|\s{2,}/).map((x) => x.trim()).filter((x) => x !== "");
      if (m.length < 2) { const mm = l.match(/^(.*\S)\s+(-?[\d.,]+)$/); return mm ? [mm[1], mm[2]] : null; }
      return [m[0], m[m.length - 1]];
    }).filter(Boolean).map(([a, b]) => [a, parseFloat(String(b).replace(/,/g, ""))]).filter(([, v]) => Number.isFinite(v));
    const t = cleanTable({ title: state.table.title, unit: state.table.unit, rows });
    if (!t) { SK.toast("항목과 값을 찾지 못했어요. ‘항목, 값’처럼 한 줄에 하나씩 적어 주세요.", "no"); return; }
    state.table = t; state.draw = null; state.level = null;
    if (pasteModal) pasteModal.close();
    persist(); renderTable(); renderOpts(); renderMake();
    SK.toast(t.rows.length + "개 항목을 넣었어요");
  });

  /* ───── 내보내기 ───── */
  function exportSvg(W, H) {
    const svg = document.createElementNS(NS, "svg");
    renderChart(svg, state.type, state.table, state.opts, W, H, LIGHT, state.level && state.type === "bar" ? { drawValues: state.level } : {});
    return svg;
  }
  $("btnPng").addEventListener("click", () => {
    const W = 1200, H = 760;
    const svg = exportSvg(W, H);
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2;
      const ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, W, H);
      c.toBlob((blob) => {
        if (!blob) { SK.toast("그림을 만들지 못했어요", "no"); return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = (state.table.title || "그래프").replace(/[\\/:*?"<>|]/g, "_") + ".png";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      }, "image/png");
    };
    img.onerror = () => SK.toast("그림을 만들지 못했어요", "no");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data);
  });
  $("btnPrint").addEventListener("click", () => {
    const area = $("printArea"); area.textContent = "";
    area.appendChild(exportSvg(1100, 680));
    const tb = document.createElement("table"); tb.className = "mtable"; tb.style.marginTop = "6mm";
    const h = tb.insertRow(), v = tb.insertRow();
    const th0 = document.createElement("th"); th0.textContent = "항목"; h.appendChild(th0);
    const td0 = document.createElement("th"); td0.textContent = "값" + (state.table.unit ? "(" + state.table.unit + ")" : ""); v.appendChild(td0);
    state.table.rows.forEach((r) => { const a = document.createElement("th"); a.textContent = r.label; h.appendChild(a); const b = v.insertCell(); b.textContent = fmtN(r.value); });
    area.appendChild(tb);
    setTimeout(() => window.print(), 50);
  });
  SK.share.bind(() => ({ v: 1, table: { title: state.table.title, unit: state.table.unit, rows: state.table.rows.map((r) => [r.label, r.value]) }, type: state.type, opts: state.opts }), { title: "그래프 그리기 — " + (state.table.title || "내 그래프") });
  $("btnShare").addEventListener("click", () => window.shareCurrentPage && window.shareCurrentPage());

  /* ═══════════════ 조사하기 ═══════════════ */
  function tallyMarks(n) { return "正".repeat(Math.floor(n / 5)) + (n % 5 ? " " + "/".repeat(n % 5) : ""); }
  function renderSurveyStage() {
    stage.textContent = ""; stageSvg = null;
    const items = state.survey.items, n = items.length;
    const g = document.createElement("div"); g.className = "tally-grid";
    const { W } = stageSize();
    const cols = n <= 2 ? n : n <= 4 ? (W > 700 ? n : 2) : n <= 6 ? 3 : 4;
    g.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    items.forEach((it, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "tally";
      b.style.borderColor = PALETTE[i % PALETTE.length];
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = it.name;
      const ct = document.createElement("span"); ct.className = "ct"; ct.textContent = it.n; ct.style.color = PALETTE[i % PALETTE.length];
      const mk = document.createElement("span"); mk.className = "marks"; mk.textContent = tallyMarks(it.n);
      b.append(nm, ct, mk);
      b.setAttribute("aria-label", it.name + " " + it.n + ", 누르면 1 늘어요");
      // 누른 뒤 떼었을 때(click) 센다 — 태블릿에서 단추 위로 화면을 밀어 스크롤하면 세지 않는다
      // (예전: pointerdown에서 세어 스크롤을 시작하기만 해도 수가 올라감). 키보드·화면 낭독기도 click.
      b.addEventListener("click", () => bump(i));
      g.appendChild(b);
    });
    stage.appendChild(g);
  }
  function bump(i) {
    state.survey.items[i].n = Math.min(999, state.survey.items[i].n + 1);
    state.surveyHist.push(i);
    if (SK.sound) SK.sound.play("move");
    persist(); renderSurveyStage();
    const btn = stage.querySelectorAll(".tally")[i]; if (btn) btn.focus({ preventScroll: true });
  }
  function renderSurveyPanel() {
    const box = $("sItems"); box.textContent = "";
    state.survey.items.forEach((it, i) => {
      const row = document.createElement("div"); row.className = "row";
      const inp = document.createElement("input"); inp.className = "inp"; inp.style.flex = "1"; inp.value = it.name; inp.maxLength = 12; inp.setAttribute("aria-label", (i + 1) + "번째 항목 이름");
      inp.addEventListener("input", () => { it.name = inp.value.slice(0, 12); persist(); renderSurveyStage(); });
      const del = sqIcon("x", () => {
        if (state.survey.items.length <= 1) return;
        const [gone] = state.survey.items.splice(i, 1); state.surveyHist = []; persist(); renderSurveyPanel(); renderSurveyStage();
        undoToast("'" + gone.name + "' 항목을 뺐어요.", () => { state.survey.items.splice(Math.min(i, state.survey.items.length), 0, gone); persist(); renderSurveyPanel(); renderSurveyStage(); });
      }, it.name + " 빼기");
      del.style.width = "44px"; del.disabled = state.survey.items.length <= 1;
      row.append(inp, del);
      box.appendChild(row);
    });
    $("sAdd").disabled = state.survey.items.length >= 8;
  }
  $("sAdd").addEventListener("click", () => { if (state.survey.items.length >= 8) return; state.survey.items.push({ name: "항목 " + (state.survey.items.length + 1), n: 0 }); persist(); renderSurveyPanel(); renderSurveyStage(); });
  $("sUndo").addEventListener("click", () => { const i = state.surveyHist.pop(); if (i == null || !state.survey.items[i]) return; state.survey.items[i].n = Math.max(0, state.survey.items[i].n - 1); persist(); renderSurveyStage(); });
  // 모두 0으로: 센 수가 사라지므로 되돌리기 토스트
  $("sReset").addEventListener("click", () => {
    const before = state.survey.items.map((x) => x.n), hist = state.surveyHist.slice();
    if (!before.some((n) => n > 0)) return;
    state.survey.items.forEach((x) => { x.n = 0; }); state.surveyHist = []; persist(); renderSurveyStage();
    undoToast("모두 0으로 바꿨어요.", () => { state.survey.items.forEach((x, k) => { if (before[k] != null) x.n = before[k]; }); state.surveyHist = hist; persist(); renderSurveyStage(); });
  });
  $("sToTable").addEventListener("click", () => {
    const t = cleanTable({ title: "우리 반 조사", unit: "명", rows: state.survey.items.map((x) => [x.name, x.n]) });
    if (!t) return;
    state.table = t; state.draw = null; state.level = null;
    setMode("make"); renderTable(); setType("bar");
    SK.toast("표로 정리했어요. 여러 그래프로 바꿔 보세요!");
  });

  /* ═══════════════ 모드 ═══════════════ */
  // 큰 모드 두 가지: 그래프 만들기(make·survey) / 그래프 공부하기(mission)
  let lastMake = "make";
  function renderModeHead() {
    const learn = state.mode === "mission";
    $("modeBadge").innerHTML = learn
      ? IC("trophy") + " 그래프 공부하기 <small>미션</small>"
      : IC("chart-column") + " 그래프 만들기 <small>내 자료로</small>";
    $("btnSwitchMode").innerHTML = IC("arrow-left-right") + (learn ? " 그래프 만들기로" : " 그래프 공부하기로");
    $("btnSwitchMode").setAttribute("aria-label", "모드 바꾸기: " + (learn ? "그래프 만들기로" : "그래프 공부하기로"));
    $("makeTabs").hidden = learn;
  }
  function setMode(m) {
    if (state.mode === "mission" && m !== "mission" && mc) mc.stop();
    if (m !== "mission") lastMake = m;
    state.mode = m;
    closeKeypad(false);
    tween.stop();
    for (const b of document.querySelectorAll(".mode-tab")) { const on = b.dataset.mode === m; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    $("paneMake").hidden = m !== "make"; $("paneSurvey").hidden = m !== "survey"; $("paneMission").hidden = m !== "mission";
    $("typeBar").hidden = m !== "make";
    renderModeHead();
    stage.textContent = ""; stageSvg = null; mDraw = null; mSymbol = null; mStage = null;
    if (m === "make") { renderOpts(); renderMake(); }
    else if (m === "survey") { renderSurveyPanel(); renderSurveyStage(); }
    else { const i = mc.current(); mc.start(i >= 0 ? i : undefined); }
  }
  $("makeTabs").addEventListener("click", (e) => { const b = e.target.closest(".mode-tab"); if (b) setMode(b.dataset.mode); });
  // 모드 바꾸기(미션 기록은 그대로)
  $("btnSwitchMode").addEventListener("click", () => setMode(state.mode === "mission" ? lastMake : "mission"));
  let rz = 0;
  function rerender() { if (state.mode === "make") renderMake(); else if (state.mode === "survey") renderSurveyStage(); else if (mStage) mStage(); }
  if (window.ResizeObserver) new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(rerender); }).observe(stage);
  window.addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(rerender); });

  /* ═══════════════ 미션 ═══════════════ */
  const MISSIONS = [
    { id: "m1", title: "분류해서 표 만들기", grade: "1~2학년", qn: 1 },
    { id: "m2", title: "○그래프 그리기", grade: "1~2학년", qn: 1 },
    { id: "m3", title: "그림그래프 읽기", grade: "3~4학년", qn: 3 },
    { id: "m4", title: "눈금 한 칸 읽기", grade: "3~4학년", qn: 3 },
    { id: "m5", title: "막대그래프 그리기", grade: "3~4학년", qn: 1 },
    { id: "m6", title: "꺾은선그래프 읽기", grade: "3~4학년", qn: 3 },
    { id: "m7", title: "띠그래프와 백분율", grade: "5~6학년", qn: 3 },
    { id: "m8", title: "원그래프 해석하기", grade: "5~6학년", qn: 3 },
    { id: "m9", title: "평균 구하기", grade: "5~6학년", qn: 3 },
    { id: "m10", title: "알맞은 그래프 고르기", grade: "5~6학년", qn: 3 },
  ];
  const fb = SK.feedback("#mFeedback");
  let mc = null, mq = null, mDraw = null, mSymbol = null, mStage = null, ans = null;

  function missionTableHtml(t) {
    const tb = document.createElement("table"); tb.className = "mtable";
    const h = tb.insertRow(), v = tb.insertRow();
    const a = document.createElement("th"); a.textContent = "항목"; h.appendChild(a);
    const b = document.createElement("th"); b.textContent = t.unit ? "(" + t.unit + ")" : "값"; v.appendChild(b);
    t.rows.forEach((r) => { const x = document.createElement("th"); x.textContent = r.label; h.appendChild(x); const y = v.insertCell(); y.textContent = fmtN(r.value); });
    return tb;
  }
  function chartStage(type, t, opts, extra) {
    return () => { const svg = ensureSvg(); const { W, H } = stageSize(); return renderChart(svg, type, t, opts, W, H, themeColors(), extra && extra()); };
  }
  function optsWith(type, o) { const all = cleanOpts(null); Object.assign(all[type], o || {}); return all; }
  function distinctNames(pool, n) { return shuffle(pool).slice(0, n); }

  const M_BUILDERS = {
    m1() {
      const kinds = shuffle([["🍎", "사과"], ["🍌", "바나나"], ["🍇", "포도"], ["🍓", "딸기"], ["🍊", "귤"]]).slice(0, 3);
      const counts = kinds.map(() => 2 + randInt(5));
      const cards = shuffle(kinds.flatMap((k, i) => Array(counts[i]).fill(k[0])));
      return {
        q: "과일 카드를 종류별로 세어 표를 완성해요.",
        stage: () => { stage.textContent = ""; stageSvg = null; const box = document.createElement("div"); box.className = "cards"; box.setAttribute("aria-label", "과일 카드 " + cards.length + "장"); cards.forEach((c) => { const s = document.createElement("span"); s.textContent = c; box.appendChild(s); }); stage.appendChild(box); },
        answer: { type: "counts", kinds: kinds.map((k, i) => ({ emoji: k[0], name: k[1], correct: counts[i] })) },
        explain: kinds.map((k, i) => k[1] + " " + counts[i] + "개").join(", "),
      };
    },
    m2() {
      const names = distinctNames(["강아지", "고양이", "토끼", "햄스터", "앵무새"], 4);
      const t = { title: "좋아하는 동물", unit: "명", rows: names.map((n) => ({ label: n, value: 1 + randInt(6) })) };
      mSymbol = { vals: t.rows.map(() => 0), t };
      const o = optsWith("symbol", { mark: "○" });
      return {
        info: missionTableHtml(t),
        q: "표를 보고 ○그래프를 그려요. 칸을 누르면 그 높이까지 ○가 그려져요.",
        // 격자는 6칸 높이(정답 최대 6), ○는 학생이 누른 만큼
        stage: () => { const svg = ensureSvg(); const { W, H } = stageSize(); const tt = { title: t.title, unit: t.unit, rows: t.rows.map((r) => ({ label: r.label, value: 6 })) }; mSymbol.geo = drawSymbol(svg, tt, o.symbol, W, H, themeColors(), mSymbol.vals); },
        answer: { type: "symbol", correct: t.rows.map((r) => r.value) },
        explain: t.rows.map((r) => r.label + " " + r.value + "명").join(", "),
      };
    },
    m3() {
      const big = 10;
      const t = { title: "마을별 사과 생산량", unit: "상자", rows: ["가", "나", "다", "라"].map((x) => ({ label: x + " 마을", value: 11 + randInt(38) })) };
      const i = randInt(4);
      return {
        q: t.rows[i].label + "의 사과 생산량은 몇 상자일까요? (큰 그림 🍎 하나는 10상자, 작은 그림 하나는 1상자)",
        stage: chartStage("picto", t, optsWith("picto", { icon: "🍎", big })),
        answer: { type: "num", unit: "상자", correct: t.rows[i].value },
        explain: "큰 그림 " + Math.floor(t.rows[i].value / 10) + "개(" + Math.floor(t.rows[i].value / 10) * 10 + "상자)와 작은 그림 " + (t.rows[i].value % 10) + "개를 더해 " + t.rows[i].value + "상자",
      };
    },
    m4(n, prev) {
      let t = prev && prev.t;
      if (!t) {
        const names = distinctNames(["사과", "포도", "딸기", "수박", "귤"], 4);
        let vals; do { vals = names.map(() => 5 * (2 + randInt(8))); } while (new Set(vals).size < 4);
        t = { title: "좋아하는 과일", unit: "명", rows: names.map((x, k) => ({ label: x, value: vals[k] })) };
      }
      const st = 5;
      const opts = optsWith("bar", { step: st, values: false });
      const max = t.rows.reduce((a, b) => (b.value > a.value ? b : a));
      const [a, b] = shuffle(t.rows).slice(0, 2);
      const qs = [
        { q: "세로 눈금 한 칸은 몇 명을 나타낼까요?", correct: st, explain: "0과 첫 눈금 사이가 " + st + "명이에요." },
        { q: "가장 많은 학생이 좋아하는 과일은 " + ieyo(max.label) + ". 몇 명일까요?", correct: max.value, explain: "막대 끝이 " + max.value + "에 닿아요." },
        { q: wa(a.label) + " " + b.label + "의 학생 수 차이는 몇 명일까요?", correct: Math.abs(a.value - b.value), explain: Math.max(a.value, b.value) + " − " + Math.min(a.value, b.value) + " = " + Math.abs(a.value - b.value) },
      ];
      const Q = qs[n];
      return { t, q: Q.q, stage: chartStage("bar", t, opts), answer: { type: "num", unit: "명", correct: Q.correct }, explain: Q.explain };
    },
    m5() {
      const DAYS = ["월", "화", "수", "목", "금"];
      const names = distinctNames(DAYS, 4).sort((x, y) => DAYS.indexOf(x) - DAYS.indexOf(y)); // 요일 순서 유지
      const t = { title: "요일별 읽은 책 수", unit: "권", rows: names.map((x) => ({ label: x + "요일", value: 1 + randInt(9) })) };
      const opts = optsWith("bar", { step: 1, values: false });
      const vals = t.rows.map(() => 0);
      const draw = { vals, render: null, snap: 1, rerender: null, colors: null };
      draw.onEdit = () => { draw.colors = null; };
      draw.rerender = () => { const svg = ensureSvg(); const { W, H } = stageSize(); const tt = { title: t.title, unit: t.unit, rows: t.rows.map((r) => ({ label: r.label, value: 10 })) }; draw.render = renderChart(svg, "bar", tt, opts, W, H, themeColors(), { drawValues: vals, hideValues: true, barColors: draw.colors }); };
      mDraw = draw;
      return {
        info: missionTableHtml(t),
        q: "표를 보고 막대그래프를 그려요. 막대 자리를 누르거나 끌어 올리세요.",
        stage: () => draw.rerender(),
        answer: { type: "draw", correct: t.rows.map((r) => r.value) },
        explain: t.rows.map((r) => r.label + " " + r.value + "권").join(", "),
      };
    },
    m6(n, prev) {
      let t = prev && prev.t;
      // 가장 높은 기온·가장 많이 오른 구간이 하나뿐인 자료만 쓴다(동점이면 같은 값인데 하나만 정답이 되던 문제)
      const uniqueMax = (arr) => arr.filter((x) => x === Math.max(...arr)).length === 1;
      while (!t) {
        const base = 14 + 2 * randInt(4);
        const hours = ["9시", "10시", "11시", "12시", "13시"];
        let v = base; const rows = [];
        hours.forEach((h, k) => { rows.push({ label: h, value: v }); v += k === 3 ? -2 * randInt(2) : 2 * (1 + randInt(3)); });
        const vals = rows.map((r) => r.value), rises = vals.slice(1).map((x, k) => x - vals[k]);
        if (uniqueMax(vals) && uniqueMax(rises)) t = { title: "하루 동안의 기온", unit: "°C", rows };
      }
      const from = Math.floor((Math.min(...t.rows.map((r) => r.value)) - 4) / 2) * 2;
      const opts = optsWith("line", { wave: true, from, step: 2, values: false });
      const hiIdx = t.rows.reduce((bi, r, k, a) => (r.value > a[bi].value ? k : bi), 0);
      let qObj;
      if (n === 0) qObj = { q: "기온이 가장 높았던 때는 몇 시일까요?", opts: t.rows.map((r) => r.label), correct: t.rows[hiIdx].label, explain: "가장 높은 점은 " + t.rows[hiIdx].label + "예요." };
      else if (n === 1) {
        const k = randInt(t.rows.length - 1);
        const mid = (t.rows[k].value + t.rows[k + 1].value) / 2;
        const label = t.rows[k].label.replace("시", "시 30분");
        const cand = shuffle([mid, mid - 2, mid + 2, mid + 4]).map(fmtN);
        qObj = { q: label + "의 기온은 약 몇 °C였을까요? (두 점 사이의 가운데를 보세요)", opts: cand.map((x) => x + "°C"), correct: fmtN(mid) + "°C", explain: t.rows[k].label + "(" + t.rows[k].value + "°C)과 " + t.rows[k + 1].label + "(" + t.rows[k + 1].value + "°C)의 가운데쯤이라 약 " + fmtN(mid) + "°C" };
      } else {
        let best = 0; for (let k = 1; k < t.rows.length - 1; k++) if (t.rows[k + 1].value - t.rows[k].value > t.rows[best + 1].value - t.rows[best].value) best = k; // 자료 만들 때 가장 큰 상승은 하나뿐
        const pairs = t.rows.slice(0, -1).map((r, k) => r.label + "~" + t.rows[k + 1].label);
        qObj = { q: "기온이 가장 많이 오른 때는 언제와 언제 사이일까요? (선이 가장 가파른 곳)", opts: pairs, correct: pairs[best], explain: pairs[best] + "에 " + (t.rows[best + 1].value - t.rows[best].value) + "°C 올랐어요." };
      }
      return { t, q: qObj.q, info: n === 0 ? note2("세로축 아래의 〰 물결선은 0부터 " + from + "까지를 줄여서 그렸다는 뜻이에요.") : null, stage: chartStage("line", t, opts), answer: { type: "opts", opts: qObj.opts.map((x) => ({ label: x, ok: x === qObj.correct })) }, explain: qObj.explain };
    },
    m7() {
      // 백분율이 5의 배수가 되도록
      let ps; do { ps = [5 * (2 + randInt(7)), 5 * (2 + randInt(6)), 5 * (1 + randInt(5))]; } while (ps.reduce((a, b) => a + b, 0) >= 95);
      ps.push(100 - ps.reduce((a, b) => a + b, 0));
      const tot = pick([20, 40, 60]);
      const names = distinctNames(["축구", "피구", "줄넘기", "배드민턴", "수영"], 4);
      const t = { title: "좋아하는 운동", unit: "명", rows: names.map((x, k) => ({ label: x, value: (ps[k] * tot) / 100 })) };
      const i = randInt(4);
      return {
        info: missionTableHtml(t),
        q: eun(t.rows[i].label) + " 전체의 몇 %일까요? (합계 " + tot + "명)",
        stage: chartStage("band", t, optsWith("band", {}), () => ({ hideIdx: i })),
        answer: { type: "num", unit: "%", correct: ps[i] },
        explain: t.rows[i].value + " ÷ " + tot + " × 100 = " + ps[i] + "%",
      };
    },
    m8(n, prev) {
      let ctx = prev && prev.ctx;
      if (!ctx) {
        // 네 항목의 비율이 모두 달라야 '가장 적은 간식'의 정답이 하나뿐
        let ps; do { ps = [5 * (4 + randInt(6)), 5 * (2 + randInt(5)), 5 * (1 + randInt(4))]; ps.push(100 - ps.reduce((a, b) => a + b, 0)); } while (ps[3] < 5 || new Set(ps).size < 4);
        const names = distinctNames(["떡볶이", "김밥", "라면", "피자", "치킨"], 4);
        ctx = { ps, total: pick([200, 300, 400]), t: { title: "좋아하는 간식", unit: "%", rows: names.map((x, k) => ({ label: x, value: ps[k] })) } };
      }
      const t = ctx.t, ps = ctx.ps;
      const opts = optsWith("pie", {});
      let Q;
      if (n === 0) { const i = randInt(4); Q = { q: "전체 학생이 " + ctx.total + "명일 때 " + eul(t.rows[i].label) + " 좋아하는 학생은 몇 명일까요?", a: { type: "num", unit: "명", correct: (ps[i] * ctx.total) / 100 }, explain: ctx.total + " × " + ps[i] + " ÷ 100 = " + (ps[i] * ctx.total) / 100 + "명" }; }
      else if (n === 1) { const mi = ps.indexOf(Math.min(...ps)); Q = { q: "가장 적은 학생이 좋아하는 간식은 무엇일까요?", a: { type: "opts", opts: shuffle(t.rows.map((r, k) => ({ label: r.label, ok: k === mi }))) }, explain: t.rows[mi].label + (hasBatchim(t.rows[mi].label) ? "이 " : "가 ") + ps[mi] + "%로 가장 적어요." }; }
      else { const [a, b] = shuffle([0, 1, 2, 3]).slice(0, 2); Q = { q: wa(t.rows[a].label) + " " + eul(t.rows[b].label) + " 합하면 전체의 몇 %일까요?", a: { type: "num", unit: "%", correct: ps[a] + ps[b] }, explain: ps[a] + " + " + ps[b] + " = " + (ps[a] + ps[b]) + "%" }; }
      return { ctx, q: Q.q, stage: chartStage("pie", t, opts), answer: Q.a, explain: Q.explain };
    },
    m9(n, prev) {
      let t = prev && n === 1 ? prev.t : null;
      if (!t) {
        const m = 20 + randInt(21), k = 5;
        let devs; do { devs = Array.from({ length: k - 1 }, () => randInt(13) - 6); } while (Math.abs(devs.reduce((a, b) => a + b, 0)) > 6);
        devs.push(-devs.reduce((a, b) => a + b, 0));
        t = { title: "요일별 줄넘기 횟수", unit: "회", rows: ["월", "화", "수", "목", "금"].map((d, i) => ({ label: d, value: m + devs[i] })) };
      }
      const avg = avgOf(t);
      const opts = optsWith("bar", { values: true, avg: false });
      if (n === 1) {
        const cnt = t.rows.filter((r) => r.value > avg).length;
        return { t, q: "평균은 " + fmtN(avg) + "회예요. 평균보다 많이 한 날은 며칠일까요?", stage: chartStage("bar", t, optsWith("bar", { values: true, avg: true })), answer: { type: "num", unit: "일", correct: cnt }, explain: "평균선보다 높은 막대가 " + cnt + "개예요." };
      }
      return { t, q: "줄넘기 횟수의 평균은 몇 회일까요? (평균 = 합계 ÷ 날수)", stage: chartStage("bar", t, opts), answer: { type: "num", unit: "회", correct: avg }, explain: "(" + t.rows.map((r) => r.value).join(" + ") + ") ÷ 5 = " + total(t) + " ÷ 5 = " + fmtN(avg) + "회", level: true };
    },
    m10(n) {
      const POOL = [
        ["하루 동안 교실 기온이 어떻게 변하는지 알아보려고 해요.", "꺾은선그래프"],
        ["내 키가 1학년부터 6학년까지 어떻게 자랐는지 보려고 해요.", "꺾은선그래프"],
        ["반별 학생 수를 한눈에 비교하려고 해요.", "막대그래프"],
        ["모둠별로 모은 빈 병의 수를 비교하려고 해요.", "막대그래프"],
        ["우리 반 학생들이 좋아하는 운동이 전체에서 차지하는 비율을 보려고 해요.", "원그래프"],
        ["용돈을 어디에 얼마만큼의 비율로 썼는지 보려고 해요.", "원그래프"],
      ];
      if (!mq || !mq.pool) { mq = mq || {}; mq.pool = shuffle(POOL); }
      const [q, a] = mq.pool[n % mq.pool.length];
      return {
        q: q + " 어떤 그래프가 가장 알맞을까요?",
        stage: () => { stage.textContent = ""; stageSvg = null; const d = document.createElement("div"); d.className = "stage-msg"; d.innerHTML = IC("chart-line") + " 변화는 꺾은선 · " + IC("chart-column") + " 크기 비교는 막대 · " + IC("chart-pie") + " 부분과 전체는 원(띠)"; stage.appendChild(d); },
        answer: { type: "opts", opts: ["막대그래프", "꺾은선그래프", "원그래프"].map((x) => ({ label: x, ok: x === a })) },
        explain: a === "꺾은선그래프" ? "시간에 따른 변화는 꺾은선그래프가 잘 보여 줘요." : a === "막대그래프" ? "여러 항목의 크기를 비교할 때는 막대그래프가 좋아요." : "전체에 대한 부분의 비율은 원그래프(띠그래프)가 잘 보여 줘요.",
      };
    },
  };
  function note2(text) { const p = document.createElement("p"); p.className = "hint-text"; p.innerHTML = IC("lightbulb") + " "; p.appendChild(document.createTextNode(text)); return p; }

  function buildMissions() {
    mc = SK.missions({
      ids: MISSIONS.map((m) => m.id), format: "full", progress: saved.progress || {}, keepBest: true,
      nav: "#missionNav", feedback: fb,
      onEnter: (i) => enterMission(i),
      onChange: (p) => { saved.progress = p; persist(); },
      onAllDone: () => { $("mResult").hidden = false; },
      onFinish: () => showResult(),
    });
  }
  function enterMission(i) {
    const M = MISSIONS[i];
    $("mTitle").innerHTML = "";
    $("mTitle").append("미션 " + (i + 1) + " · " + M.title);
    const g = document.createElement("span"); g.className = "m-grade"; g.textContent = M.grade; $("mTitle").appendChild(g);
    mq = { i, n: 0, res: [], prev: null };
    $("mNextMission").hidden = true;
    $("mResult").hidden = !mc.allDone();
    showQ();
  }
  function showQ() {
    const M = MISSIONS[mq.i];
    mDraw = null; mSymbol = null;
    const Q = M_BUILDERS[M.id](mq.n, mq.prev);
    mq.prev = Q; mq.Q = Q; mq.attempt = 0; mq.answered = false;
    fb.hide();
    // 진행 표시
    const st = $("mStep"); st.textContent = "";
    if (M.qn > 1) {
      for (let k = 0; k < M.qn; k++) { const d = document.createElement("span"); d.className = "dot" + (mq.res[k] === "ok" ? " ok" : mq.res[k] ? " no" : k === mq.n ? " cur" : ""); st.appendChild(d); }
      const tx = document.createElement("span"); tx.textContent = "문제 " + (mq.n + 1) + " / " + M.qn; st.appendChild(tx);
    }
    const info = $("mInfo"); info.textContent = "";
    if (Q.info) info.appendChild(Q.info);
    $("mQ").textContent = Q.q;
    mStage = Q.stage; mStage();
    renderAns(Q);
    $("mNextQ").hidden = true;
  }
  function renderAns(Q) {
    const box = $("mAnswer"); box.textContent = "";
    const a = Q.answer;
    ans = { a, val: "", opt: null, counts: null };
    $("mCheck").hidden = false;
    if (a.type === "num") {
      const row = document.createElement("div"); row.className = "num-answer";
      const b = document.createElement("div"); b.className = "box"; b.id = "numBox"; b.setAttribute("aria-live", "polite");
      const u = document.createElement("span"); u.className = "unit"; u.textContent = a.unit || "";
      row.append(b, u); box.appendChild(row);
      const kpd = document.createElement("div"); kpd.className = "keypad";
      ["7", "8", "9", "⌫", "4", "5", "6", ".", "1", "2", "3", "0"].forEach((k) => {
        const btn = document.createElement("button"); btn.type = "button"; btn.textContent = k;
        if (k === "⌫") { btn.innerHTML = IC("delete"); btn.setAttribute("aria-label", "지우기"); }
        btn.addEventListener("click", () => { if (k === "⌫") ans.val = ans.val.slice(0, -1); else if (k === ".") { if (!ans.val.includes(".")) ans.val = (ans.val || "0") + "."; } else if (ans.val.length < 6) ans.val = (ans.val === "0" ? "" : ans.val) + k; b.textContent = ans.val; });
        kpd.appendChild(btn);
      });
      box.appendChild(kpd);
    } else if (a.type === "opts") {
      const g = document.createElement("div"); g.className = "opts";
      a.opts.forEach((o, ix) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = o.label;
        b.addEventListener("click", () => { if (mq.answered) return; ans.opt = ix; check(); });
        g.appendChild(b);
      });
      box.appendChild(g);
      $("mCheck").hidden = true;
    } else if (a.type === "counts") {
      ans.counts = a.kinds.map(() => 0);
      a.kinds.forEach((k, ix) => {
        const row = document.createElement("div"); row.className = "counter-row";
        const l = document.createElement("span"); l.className = "lbl"; l.textContent = k.emoji + " " + k.name;
        const v = document.createElement("span"); v.className = "v"; v.textContent = "0";
        const m = sqIcon("minus", () => { ans.counts[ix] = Math.max(0, ans.counts[ix] - 1); v.textContent = ans.counts[ix]; }, k.name + " 줄이기");
        const p = sqIcon("plus", () => { ans.counts[ix] = Math.min(20, ans.counts[ix] + 1); v.textContent = ans.counts[ix]; }, k.name + " 늘리기");
        row.append(l, m, v, p); box.appendChild(row);
      });
    } else {
      const p = document.createElement("p"); p.className = "hint-text";
      p.textContent = a.type === "symbol" ? "칸을 누르면 그 높이까지 ○가 채워져요. 맨 위 ○를 다시 누르면 하나 빠져요." : "막대 자리를 누르거나 위아래로 끌어 높이를 맞춰요. (키보드: 화살표 키로 막대를 고르고 높이를 바꿔요)";
      box.appendChild(p);
    }
  }
  function symbolTap(e, svg) {
    const g = mSymbol && mSymbol.geo; if (!g || mq.answered) return;
    const p = eventToSvg(svg, e); if (!p) return;
    const c = Math.floor((p.x - g.x0) / g.cell), r = Math.ceil((g.y0 + g.gh - p.y) / g.cell);
    if (c < 0 || c >= g.n || r < 1 || r > g.rows) return;
    e.preventDefault();
    mSymbol.vals[c] = mSymbol.vals[c] === r ? r - 1 : r;
    if (SK.sound) SK.sound.play("move");
    mStage();
  }
  function readAns() {
    const a = ans.a;
    if (a.type === "num") { if (ans.val === "" || ans.val === ".") return null; return { ok: Math.abs(parseFloat(ans.val) - a.correct) < 1e-9 }; }
    if (a.type === "opts") { if (ans.opt == null) return null; return { ok: !!a.opts[ans.opt].ok }; }
    if (a.type === "counts") return { ok: a.kinds.every((k, i) => ans.counts[i] === k.correct) };
    if (a.type === "symbol") return { ok: a.correct.every((v, i) => mSymbol.vals[i] === v) };
    if (a.type === "draw") return { ok: a.correct.every((v, i) => mDraw.vals[i] === v), wrong: a.correct.map((v, i) => mDraw.vals[i] !== v) };
    return null;
  }
  function check() {
    if (!mq || mq.answered) return;
    const Q = mq.Q, r = readAns();
    if (!r) { fb.show("info", "답을 넣어 주세요."); return; }
    const M = MISSIONS[mq.i];
    if (r.ok) {
      mq.answered = true;
      mq.res[mq.n] = mq.attempt === 0 ? "ok" : "late";
      fb.show("ok", pick(["맞았어요!", "정확해요!", "그래프 박사네요!"]) + " " + Q.explain);
      if (SK.sound) SK.sound.play("done");
      markOpts(true);
      if (Q.level) playLevel(Q.t);
      if (mDraw) { mDraw.colors = mDraw.vals.map(() => cssVar("--gm-ok")); mStage(); }
      after(M);
      return;
    }
    mq.attempt++;
    if (SK.sound) SK.sound.play("wrong");
    if (mDraw && r.wrong) { mDraw.colors = r.wrong.map((w) => (w ? cssVar("--gm-no") : cssVar("--gm-ok"))); mStage(); }
    if (mq.attempt === 1) { fb.show("warn", "다시 해 볼까요? " + hintOf(Q)); markOpts(false); return; }
    mq.answered = true; mq.res[mq.n] = "no";
    markOpts(true);
    if (mSymbol) { mSymbol.vals = Q.answer.correct.slice(); mStage(); }
    if (mDraw) { Q.answer.correct.forEach((v, i) => { mDraw.vals[i] = v; }); mDraw.colors = mDraw.vals.map(() => cssVar("--gm-ok")); mStage(); }
    fb.show("no", "정답: " + Q.explain);
    after(M);
  }
  function hintOf(Q) {
    const t = Q.answer.type;
    if (t === "counts") return "같은 과일끼리 하나씩 짚으며 세어 보세요.";
    if (t === "symbol" || t === "draw") return "표의 수와 그래프 높이를 하나씩 맞춰 보세요." + (t === "draw" ? " 주황색 막대가 아직 달라요." : "");
    if (Q.answer.unit === "%") return "백분율 = 항목 ÷ 합계 × 100 이에요.";
    return "눈금 한 칸이 얼마인지 먼저 확인해 보세요.";
  }
  function markOpts(reveal) {
    if (ans.a.type !== "opts") return;
    const g = $("mAnswer").querySelector(".opts"); if (!g) return;
    [...g.children].forEach((b, ix) => {
      const o = ans.a.opts[ix];
      if (ix === ans.opt && !o.ok) b.classList.add("wrong");
      if (reveal && o.ok) b.classList.add("right");
      if (reveal) b.disabled = true;
    });
    ans.opt = null;
  }
  function playLevel(t) {
    // 평균 정답 뒤: 막대를 평균 높이로 고르게
    const opts = optsWith("bar", { values: true, avg: true });
    const avg = avgOf(t), from = t.rows.map((r) => r.value);
    const myQ = mq && mq.Q;
    tween.run(1100, (k) => {
      if (state.mode !== "mission" || !mq || mq.Q !== myQ) return false; // 다음 문제로 넘어가면 멈춤
      const e = 1 - Math.pow(1 - k, 3);
      const vals = from.map((v) => v + (avg - v) * e);
      mStage = chartStage("bar", t, opts, () => ({ drawValues: vals })); mStage();
    });
  }
  function after(M) {
    $("mCheck").hidden = true;
    if (mq.n < M.qn - 1) { $("mNextQ").hidden = false; $("mNextQ").focus(); return; }
    let stars;
    if (M.qn === 1) stars = mq.res[0] === "ok" ? 3 : mq.res[0] === "late" ? 2 : 1;
    else { const first = mq.res.filter((x) => x === "ok").length; stars = first >= 3 ? 3 : first === 2 ? 2 : 1; }
    const last = $("mFeedback").textContent;
    mc.complete({ stars, message: (last ? last + "  " : "") + "— 미션 완료! (별 " + stars + "개)", tone: mq.res[mq.n] === "no" ? "warn" : "ok" });
    if (SK.sound) SK.sound.play("star");
    if (mc.current() < MISSIONS.length - 1 || mc.firstIncomplete() >= 0) { $("mNextMission").hidden = false; $("mNextMission").focus(); }
    $("mResult").hidden = !mc.allDone();
  }
  $("mCheck").addEventListener("click", check);
  document.addEventListener("keydown", (e) => {
    if (state.mode !== "mission" || !ans || ans.a.type !== "num" || mq.answered) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const box = $("numBox"); if (!box) return;
    if (/^[0-9]$/.test(e.key) && ans.val.length < 6) { ans.val = (ans.val === "0" ? "" : ans.val) + e.key; }
    else if (e.key === "." && !ans.val.includes(".")) ans.val = (ans.val || "0") + ".";
    else if (e.key === "Backspace") ans.val = ans.val.slice(0, -1);
    else if (e.key === "Enter") { e.preventDefault(); check(); return; }
    else return;
    e.preventDefault(); box.textContent = ans.val;
  });
  $("mNextQ").addEventListener("click", () => { mq.n++; showQ(); });
  $("mNextMission").addEventListener("click", () => {
    const cur = mc.current();
    if (cur < MISSIONS.length - 1) mc.go(cur + 1);
    else { const n = mc.firstIncomplete(); if (n >= 0) mc.go(n); else showResult(); }
  });
  $("mResult").addEventListener("click", showResult);

  /* ───── 결과 ───── */
  const screens = SK.screens({});
  function showResult() {
    if (mc) mc.stop();
    const grid = $("resultGrid"); grid.textContent = "";
    let tot = 0;
    MISSIONS.forEach((M, i) => {
      const s = mc.starsOf(i); tot += s;
      const c = document.createElement("div"); c.className = "result-cell"; c.setAttribute("role", "listitem");
      const a = document.createElement("span"); a.textContent = (i + 1) + ". " + M.title;
      const b = document.createElement("span"); b.className = "stars"; if (s > 0) b.innerHTML = starIcons(s); else b.textContent = "—"; b.setAttribute("aria-label", "별 3개 중 " + s + "개");
      c.append(a, b); grid.appendChild(c);
    });
    $("resultSub").textContent = "별 " + tot + " / " + MISSIONS.length * 3;
    screens.show("screenResult");
  }
  $("btnRetry").addEventListener("click", () => { start("mission"); mc.go(0); });
  $("btnToMake").addEventListener("click", () => start("make"));

  /* ───── 시작 ───── */
  let shared = false;
  (function readShare() {
    const p = SK.share.read({ version: 1 });
    if (!p) return;
    const t = cleanTable(p.table);
    if (!t) return;
    state.table = t; state.type = TYPE_IDS.includes(p.type) ? p.type : "bar"; state.opts = cleanOpts(p.opts);
    shared = true;
  })();
  let started = false;
  function start(mode) {
    screens.show("screenMain");
    if (!started) { renderTypeBar(); renderPresets(); renderTable(); started = true; }
    setMode(mode || "make");
  }
  // 인트로에서 모드 고르기: ① 그래프 만들기(내 자료) ② 그래프 공부하기(미션)
  $("btnStartMake").addEventListener("click", () => start("make"));
  $("btnStartLearn").addEventListener("click", () => start("mission"));
  buildMissions();
  if (shared) start("make");
})();
