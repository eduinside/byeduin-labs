/* ================================================================
   태양과 그림자 — sun-shadow (eduin VIVES)
   - 태양 위치: The Astronomical Almanac 저정밀식(약 0.01°). PyEphem과 대조해
     대구·서울·제주의 일출·일몰·남중 시각 1분, 남중 고도 0.1° 이내(2026-10-06).
   - 기온: 기상청 평년값(1991~2020) 월별 최고·최저로 만든 하루 곡선(보기 자료) — climate.json
   - 모드: 하루 관찰 / 계절 비교(+빛 실험) / 계절의 원인(자전축 0°) / 미션 8개
   계획: docs/sun-shadow-plan.md
   ================================================================ */
(function () {
  "use strict";

  const SK = window.SimKit, VUI = window.VUI, VG = window.VGraph;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const mod = (a, n) => ((a % n) + n) % n;
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const reduceMotion = () => (SK.motion ? SK.motion.reduced() : !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));
  const LAB = SK.LABELS || {};
  const el = (tag, a, p, text) => VG.el(tag, a, p, text);

  const PLACES = {
    daegu: { name: "대구", lat: 35.87, lon: 128.60 },
    seoul: { name: "서울", lat: 37.57, lon: 126.97 },
    jeju: { name: "제주", lat: 33.51, lon: 126.53 },
  };
  let CLIMATE = null; // climate.json 불러오면 채움

  /* ═════════ 천문 계산 ═════════ */
  function jdOf(d, minKST) { return Date.UTC(d.y, d.m - 1, d.d) / 864e5 + 2440587.5 + (minKST - 540) / 1440; }
  function sunCoord(jd) {
    const n = jd - 2451545.0;
    const L = mod(280.460 + 0.9856474 * n, 360);
    const g = mod(357.528 + 0.9856003 * n, 360) * RAD;
    const lamDeg = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
    const lam = lamDeg * RAD;
    const eps = (23.439 - 0.0000004 * n) * RAD;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = mod(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * DEG, 360);
    const eot = (mod(L - ra + 180, 360) - 180) * 4; // 분
    const r = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g); // AU
    return { dec, eot, r, lam: mod(lamDeg, 360) };
  }
  function sunPos(d, min, p) {
    const { dec, eot } = sunCoord(jdOf(d, min));
    const H = ((min + 4 * (p.lon - 135) + eot) / 4 - 180) * RAD, phi = p.lat * RAD;
    const h = Math.asin(Math.max(-1, Math.min(1, Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))));
    let A = Math.acos(Math.max(-1, Math.min(1, (Math.sin(dec) - Math.sin(h) * Math.sin(phi)) / (Math.cos(h) * Math.cos(phi))))) * DEG;
    if (Math.sin(H) > 0) A = 360 - A;
    return { alt: h * DEG, az: A };
  }
  function halfDay(decRad, lat) {
    const phi = lat * RAD;
    const c = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(decRad)) / (Math.cos(phi) * Math.cos(decRad));
    return Math.acos(Math.max(-1, Math.min(1, c))) * DEG * 4; // 분
  }
  function sunTimes(d, p) {
    let noon = 720;
    for (let k = 0; k < 2; k++) noon = 720 - 4 * (p.lon - 135) - sunCoord(jdOf(d, noon)).eot;
    let rise = noon - halfDay(sunCoord(jdOf(d, noon)).dec, p.lat), set = noon + halfDay(sunCoord(jdOf(d, noon)).dec, p.lat);
    rise = noon - halfDay(sunCoord(jdOf(d, rise)).dec, p.lat); set = noon + halfDay(sunCoord(jdOf(d, set)).dec, p.lat);
    return { noon, rise, set, dayLen: set - rise, noonAlt: sunPos(d, noon, p).alt };
  }

  /* ═════════ 날짜·글자 ═════════ */
  const today = new Date();
  const YEAR = today.getFullYear();
  const dateFromDoy = (doy) => { const t = new Date(Date.UTC(YEAR, 0, doy)); return { y: YEAR, m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const doyOf = (d) => Math.round((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(d.y, 0, 0)) / 864e5);
  const dateStr = (d) => d.y + "-" + String(d.m).padStart(2, "0") + "-" + String(d.d).padStart(2, "0");
  const dateKo = (d) => d.m + "월 " + d.d + "일";
  const hm = (min) => { min = mod(Math.round(min), 1440); const h = Math.floor(min / 60), m = min % 60; return h + ":" + String(m).padStart(2, "0"); };
  const hmKo = (min) => { min = mod(Math.round(min), 1440); const h = Math.floor(min / 60), m = min % 60; return (h < 12 ? "오전 " : "오후 ") + (h % 12 === 0 ? 12 : h % 12) + "시" + (m ? " " + m + "분" : ""); };
  const durKo = (min) => Math.floor(min / 60) + "시간 " + Math.round(min % 60) + "분";
  const DIRS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  const dirKo = (az) => DIRS[Math.round(mod(az, 360) / 45) % 8] + "쪽";
  function seasonDates() {
    return [
      { key: "spring", name: "춘분", d: { y: YEAR, m: 3, d: 20 } },
      { key: "summer", name: "하지", d: { y: YEAR, m: 6, d: 21 } },
      { key: "autumn", name: "추분", d: { y: YEAR, m: 9, d: 23 } },
      { key: "winter", name: "동지", d: { y: YEAR, m: 12, d: 22 } },
    ];
  }

  /* ═════════ 기온(평년값으로 만든 보기 자료) ═════════ */
  function monthNormals(pk, d) {
    const c = CLIMATE && CLIMATE.places[pk];
    if (!c) return null;
    // 각 달 15일을 그 달 평년값으로 보고 사이를 직선으로 이음
    const t = Date.UTC(d.y, d.m - 1, d.d);
    let m0 = d.m - 1, y0 = d.y;
    if (d.d < 15) { m0 -= 1; if (m0 < 0) { m0 = 11; y0 -= 1; } }
    const a = Date.UTC(y0, m0, 15), b = Date.UTC(m0 === 11 ? y0 + 1 : y0, (m0 + 1) % 12, 15);
    const k = (t - a) / (b - a);
    const i0 = m0, i1 = (m0 + 1) % 12;
    return { max: c.tmax[i0] + (c.tmax[i1] - c.tmax[i0]) * k, min: c.tmin[i0] + (c.tmin[i1] - c.tmin[i0]) * k };
  }
  const T_PEAK = 14.5 * 60; // 오후 2시 30분 무렵 최고
  function tempAt(pk, d, min) {
    const N = monthNormals(pk, d);
    if (!N) return null;
    const rise = sunTimes(d, PLACES[pk]).rise;
    if (min >= rise && min <= T_PEAK) return N.min + (N.max - N.min) * (1 - Math.cos(Math.PI * (min - rise) / (T_PEAK - rise))) / 2;
    const t = min < rise ? min + 1440 : min;
    return N.min + (N.max - N.min) * (1 + Math.cos(Math.PI * (t - T_PEAK) / (rise + 1440 - T_PEAK))) / 2;
  }

  /* ═════════ 상태·저장 ═════════ */
  const store = SK.store("sun-shadow:v1", {
    defaults: { progress: {}, place: "daegu", rec: null },
    validate(raw, d) {
      if (!isObj(raw)) return null;
      const out = { progress: isObj(raw.progress) ? raw.progress : {}, place: PLACES[raw.place] ? raw.place : d.place, rec: null };
      if (isObj(raw.rec) && typeof raw.rec.date === "string" && Array.isArray(raw.rec.rows)) {
        out.rec = { date: raw.rec.date.slice(0, 10), place: PLACES[raw.rec.place] ? raw.rec.place : out.place, rows: raw.rec.rows.filter((m) => Number.isFinite(m) && m >= 0 && m < 1440).slice(0, 24) };
      }
      return out;
    },
  });
  const saved = store.load();
  const state = {
    place: saved.place,
    date: { y: YEAR, m: today.getMonth() + 1, d: today.getDate() },
    min: 570,
    mode: "day",
    graph: "alt",
    sGraph: "alt",
    light: false,
    lightAng: 30,
    tilt: 23.5,
    oDoy: doyOf({ y: YEAR, m: today.getMonth() + 1, d: today.getDate() }),
    rec: saved.rec && saved.rec.date === dateStr({ y: YEAR, m: today.getMonth() + 1, d: today.getDate() }) ? saved.rec.rows.slice() : [],
  };
  function persist() { store.save({ progress: saved.progress, place: state.place, rec: { date: dateStr(state.date), place: state.place, rows: state.rec } }); }
  const P = () => PLACES[state.place];
  const timers = SK.timers();

  /* ═════════ 색 ═════════ */
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function vgColors() { return { bg: cssVar("--ss-panel"), text: cssVar("--ss-text"), muted: cssVar("--ss-muted"), grid: cssVar("--ss-border"), axis: cssVar("--ss-muted"), bar: cssVar("--ss-primary"), line: cssVar("--ss-primary"), point: cssVar("--ss-primary"), avg: "#0ea5e9", wave: cssVar("--ss-muted") }; }
  function mix(a, b, k) {
    const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16)), pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
    return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, "0")).join("");
  }

  /* ═════════ 무대 공통 ═════════ */
  const scene = $("scene");
  let svg = null, geo = null;
  function freshSvg() {
    const r = scene.getBoundingClientRect();
    const W = Math.max(280, Math.floor(r.width)), H = Math.max(260, Math.floor(r.height));
    if (!svg || svg.parentNode !== scene) { scene.textContent = ""; svg = document.createElementNS(NS, "svg"); scene.appendChild(svg); }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("font-family", "-apple-system, 'Pretendard', 'Malgun Gothic', sans-serif");
    return { W, H };
  }
  function caption(items) {
    let c = scene.querySelector(".scene-cap");
    if (!c) { c = document.createElement("div"); c.className = "scene-cap"; scene.appendChild(c); }
    c.textContent = "";
    items.forEach((t) => { const s = document.createElement("span"); s.textContent = t; c.appendChild(s); });
  }

  // 하늘·땅(남쪽을 보고 선 모습: 왼쪽 동, 오른쪽 서, 먼 쪽 남, 가까운 쪽 북)
  // inset: 왼쪽 아래 측정기 그림 {w, h}. 폰(360px)·낮은 화면(844×390)에서 측정기가 '동' 글자·지평선·오전 태양 길을 가리지 않게 자리를 옮긴다.
  const STAGE_TOP = 64; // 규약 v2 --sk-stage-top(위 공용 버튼 줄) + 여유
  function skyLayout(W, H, inset) {
    let cx = W / 2, hy = H * 0.64, R = Math.min(W * 0.44 - 20, H * 0.56); // 동·서 글자 자리 남김
    // 하늘 꼭대기(고도 90°·해 크기)가 위 공용 버튼 줄 밑에 들어가지 않게
    if (hy - R * 0.95 - 14 < STAGE_TOP) R = Math.max(50, (hy - STAGE_TOP - 14) / 0.95);
    if (!inset) return { cx, hy, R };
    const top = H - inset.h - 12, right = 12 + inset.w + 8;
    const collide = (cx, hy, R) => {
      if (top < hy + 14 && cx - R - 32 < right) return true; // '동' 글자·지평선 왼쪽 끝
      const dy = top - hy, ry = R * 0.28 + 4;
      if (dy < ry) { const hw = R * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))); if (cx - hw < right) return true; }
      return false;
    };
    if (!collide(cx, hy, R)) return { cx, hy, R };
    // 1) 넓은 화면: 그림을 옆으로 옮겨 측정기 옆을 비운다
    const cx2 = right + 34 + R;
    if (cx2 + R + 34 <= W) return { cx: cx2, hy, R };
    // 2) 좁은 화면: 땅(타원)·'북' 글자를 측정기 위로 올리고 필요하면 조금 작게
    hy = Math.min(hy, top - 4 - R * 0.28);
    if (hy - R * 0.95 - 14 < STAGE_TOP) { R = Math.max(50, (top - 4 - STAGE_TOP - 14) / 1.23); hy = top - 4 - R * 0.28; }
    return { cx, hy, R };
  }
  function skyGround(W, H, alt, inset) {
    const { cx, hy, R } = skyLayout(W, H, inset);
    const k = Math.max(0, Math.min(1, (alt + 8) / 16)); // 밤 0 ~ 낮 1
    const top = mix(cssVar("--ss-sky-night"), cssVar("--ss-sky-day"), k), bot = mix(cssVar("--ss-sky-night2"), cssVar("--ss-sky-day2"), k);
    const defs = el("defs", {}, svg);
    const lg = el("linearGradient", { id: "skyg", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": top }, lg); el("stop", { offset: "1", "stop-color": bot }, lg);
    el("rect", { x: 0, y: 0, width: W, height: hy, fill: "url(#skyg)" }, svg);
    el("rect", { x: 0, y: hy, width: W, height: H - hy, fill: mix(cssVar("--ss-ground").replace("#", "#"), "#000000", (1 - k) * 0.45) }, svg);
    el("ellipse", { cx, cy: hy, rx: R, ry: R * 0.28, fill: mix(cssVar("--ss-ground"), "#ffffff", 0.18 * k), stroke: cssVar("--ss-ground-edge"), "stroke-width": 2 }, svg);
    const lab = (x, y, t) => el("text", { x, y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 16, "font-weight": 900, fill: k > 0.5 ? "#1f2937" : "#f1f5f9" }, svg, t);
    lab(Math.max(10, cx - R - 18), hy, "동"); lab(Math.min(W - 10, cx + R + 18), hy, "서"); lab(cx, hy - R * 0.28 - 14, "남"); lab(cx, hy + R * 0.28 + 16, "북");
    return { cx, hy, R, k };
  }
  // 하늘 반구를 그림으로: 가로는 동서, 높이는 고도에 비례(높은 고도끼리도 차이가 보이게)
  function proj(g, alt, az) {
    const h = alt * RAD, A = az * RAD;
    const E = Math.sin(A) * Math.cos(h), N = Math.cos(A) * Math.cos(h);
    return [g.cx - E * g.R, g.hy + N * g.R * 0.28 - (Math.max(-5, alt) / 90) * g.R * 0.95];
  }
  function sunDot(x, y, r) {
    el("circle", { cx: x, cy: y, r: r * 1.9, fill: cssVar("--ss-sun"), opacity: 0.18 }, svg);
    el("circle", { cx: x, cy: y, r, fill: cssVar("--ss-sun"), stroke: "#fff7d6", "stroke-width": 2 }, svg);
  }
  function pathOf(g, d, from, to, step) {
    let s = "", on = false;
    for (let m = from; m <= to; m += step) {
      const sp = sunPos(d, m, P());
      if (sp.alt < -1) { on = false; continue; }
      const [x, y] = proj(g, sp.alt, sp.az);
      s += (on ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); on = true;
    }
    return s;
  }
  function stickShadow(g, alt, az, opts = {}) {
    const L = g.R * 0.26; // 1 m 막대
    const base = [g.cx, g.hy];
    if (alt > 0.5) {
      const len = 1 / Math.tan(alt * RAD); // m
      const shown = Math.min(len, 3.4);
      const A = (az + 180) * RAD; // 그림자 방향
      const tip = [g.cx - Math.sin(A) * shown * L, g.hy + Math.cos(A) * shown * L * 0.28];
      el("line", { x1: base[0], y1: base[1], x2: tip[0], y2: tip[1], stroke: cssVar("--ss-shadow"), "stroke-width": 9, "stroke-linecap": "round", opacity: len > 3.4 ? 0.55 : 1 }, svg);
      if (opts.string) el("line", { x1: base[0], y1: base[1] - L, x2: tip[0], y2: tip[1], stroke: cssVar("--ss-string"), "stroke-width": 2, "stroke-dasharray": "5 4" }, svg);
    }
    el("line", { x1: base[0], y1: base[1], x2: base[0], y2: base[1] - L, stroke: cssVar("--ss-stick"), "stroke-width": 7, "stroke-linecap": "round" }, svg);
    el("circle", { cx: base[0], cy: base[1] - L, r: 5, fill: cssVar("--ss-stick") }, svg);
  }
  // 옆에서 본 태양 고도 측정기(작은 그림)
  function inset(x, y, w, h, alt) {
    const g = el("g", {}, svg);
    el("rect", { x, y, width: w, height: h, rx: 14, fill: cssVar("--ss-panel"), stroke: cssVar("--ss-border"), "stroke-width": 1.5, opacity: 0.96 }, g);
    el("text", { x: x + 12, y: y + 20, "font-size": 13, "font-weight": 800, fill: cssVar("--ss-muted") }, g, w < 220 ? "옆에서 본 모습" : "옆에서 본 태양 고도 측정기");
    const gy = y + h - 26, sx = x + w - 34, stickH = Math.min(70, h - 60);
    el("line", { x1: x + 12, y1: gy, x2: x + w - 12, y2: gy, stroke: cssVar("--ss-muted"), "stroke-width": 2 }, g);
    el("line", { x1: sx, y1: gy, x2: sx, y2: gy - stickH, stroke: cssVar("--ss-stick"), "stroke-width": 5, "stroke-linecap": "round" }, g);
    if (alt > 0.5) {
      const len = stickH / Math.tan(alt * RAD);
      const tipX = Math.max(x + 16, sx - len);
      const cut = sx - len < x + 16;
      el("line", { x1: sx, y1: gy, x2: tipX, y2: gy, stroke: cssVar("--ss-shadow"), "stroke-width": 7, "stroke-linecap": "round" }, g);
      if (!cut) {
        el("line", { x1: sx, y1: gy - stickH, x2: tipX, y2: gy, stroke: cssVar("--ss-string"), "stroke-width": 2 }, g);
        const r = 26, a = alt * RAD;
        el("path", { d: "M" + (tipX + r) + " " + gy + " A" + r + " " + r + " 0 0 0 " + (tipX + r * Math.cos(a)).toFixed(1) + " " + (gy - r * Math.sin(a)).toFixed(1), fill: "none", stroke: cssVar("--ss-primary"), "stroke-width": 2.5 }, g);
        el("text", { x: tipX + r + 6, y: gy - 10, "font-size": 15, "font-weight": 900, fill: cssVar("--ss-primary") }, g, Math.round(alt) + "°");
      } else el("text", { x: x + 16, y: gy - 10, "font-size": 13, "font-weight": 800, fill: cssVar("--ss-muted") }, g, "← 그림자가 아주 길어요");
    } else el("text", { x: x + 16, y: gy - 12, "font-size": 14, "font-weight": 800, fill: cssVar("--ss-muted") }, g, "해가 떠 있지 않아요");
  }

  /* ═════════ 하루 관찰 ═════════ */
  function drawDay() {
    const { W, H } = freshSvg();
    const sp = sunPos(state.date, state.min, P());
    const iw = Math.min(260, W * 0.42), ih = H < 480 ? 116 : 150;
    const g = skyGround(W, H, sp.alt, { w: iw, h: ih });
    const st = sunTimes(state.date, P());
    el("path", { d: pathOf(g, state.date, 0, 1440, 5), fill: "none", stroke: cssVar("--ss-path"), "stroke-width": 3, "stroke-dasharray": "2 7", "stroke-linecap": "round" }, svg);
    // 남중 표시
    const noonP = sunPos(state.date, st.noon, P());
    const [nx, ny] = proj(g, noonP.alt, noonP.az);
    el("line", { x1: nx, y1: ny + 10, x2: nx, y2: ny + 22, stroke: cssVar("--ss-path"), "stroke-width": 2 }, svg);
    stickShadow(g, sp.alt, sp.az, { string: true });
    if (sp.alt > -1) { const [x, y] = proj(g, sp.alt, sp.az); sunDot(x, y, Math.max(14, g.R * 0.06)); }
    else el("text", { x: g.cx, y: g.hy - g.R * 0.55, "text-anchor": "middle", "font-size": 22, "font-weight": 900, fill: "#e2e8f0" }, svg, "🌙 밤이에요");
    inset(12, H - ih - 12, iw, ih, sp.alt);
    geo = { kind: "day", g };
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", dateKo(state.date) + " " + hmKo(state.min) + ", 태양 고도 " + Math.max(0, Math.round(sp.alt)) + "도" + (sp.alt > 0.5 ? ", 그림자 " + Math.round(100 / Math.tan(sp.alt * RAD)) + "센티미터, " + dirKo(sp.az + 180) + "으로" : ""));
  }

  function dayReadouts() {
    const sp = sunPos(state.date, state.min, P());
    const st = sunTimes(state.date, P());
    const T = tempAt(state.place, state.date, state.min);
    const up = sp.alt > 0.5;
    const box = $("dReadouts"); box.textContent = "";
    const add = (label, val) => { const d = document.createElement("div"); const s = document.createElement("small"); s.textContent = label; const b = document.createElement("b"); b.textContent = val; d.append(s, b); box.appendChild(d); };
    add("태양 고도", up ? Math.round(sp.alt * 10) / 10 + "°" : "—");
    add("그림자 길이 (1m 막대)", up ? (1 / Math.tan(sp.alt * RAD) > 9.99 ? "10m 넘음" : Math.round(100 / Math.tan(sp.alt * RAD)) + "cm") : "—");
    add("기온 (평소 이맘때 어림)", T == null ? "…" : (Math.round(T * 10) / 10) + "°C");
    add("그림자 방향", up ? dirKo(sp.az + 180) : "—");
    add("해 뜸 · 해 짐", hm(st.rise) + " · " + hm(st.set));
    add("남중 시각", hm(st.noon));
    $("dTime").textContent = hmKo(state.min);
    $("dSlider").value = Math.round(state.min / 10) * 10;
    $("dDate").value = dateStr(state.date);
    paintSeasonChips();
  }

  function renderRecords() {
    const rows = state.rec.slice().sort((a, b) => a - b);
    const box = $("dTable"); box.textContent = "";
    if (rows.length) {
      const t = document.createElement("table"); t.className = "rec";
      const h = t.insertRow(); ["시각", "태양 고도", "그림자", "기온"].forEach((x) => { const th = document.createElement("th"); th.textContent = x; h.appendChild(th); });
      rows.forEach((m) => {
        const sp = sunPos(state.date, m, P()), T = tempAt(state.place, state.date, m);
        const r = t.insertRow();
        [hm(m), sp.alt > 0.5 ? Math.round(sp.alt) + "°" : "—", sp.alt > 0.5 ? Math.round(100 / Math.tan(sp.alt * RAD)) + "cm" : "—", T == null ? "…" : (Math.round(T * 10) / 10) + "°C"].forEach((v) => { r.insertCell().textContent = v; });
      });
      box.appendChild(t);
    }
    const tabs = $("dGraphTabs"); tabs.textContent = "";
    [["alt", "태양 고도"], ["sh", "그림자 길이"], ["temp", "기온"]].forEach(([k, lab]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = lab;
      b.setAttribute("aria-pressed", state.graph === k ? "true" : "false");
      b.addEventListener("click", () => { state.graph = k; renderRecords(); });
      tabs.appendChild(b);
    });
    const gb = $("dGraph"); gb.textContent = "";
    $("dTempNote").textContent = CLIMATE ? "기온은 " + P().name + "의 기상청 평년값(1991~2020)으로 만든 보기 자료예요. 실제 날씨와는 달라요." : "";
    if (rows.length < 2) { const p = document.createElement("p"); p.className = "hint-text"; p.style.padding = "12px"; p.textContent = "측정을 2번 이상 하면 꺾은선그래프가 그려져요."; gb.appendChild(p); return; }
    const gs = document.createElementNS(NS, "svg");
    gb.appendChild(gs);
    const items = rows.map((m) => {
      const sp = sunPos(state.date, m, P());
      const v = state.graph === "alt" ? Math.max(0, Math.round(sp.alt)) : state.graph === "sh" ? (sp.alt > 0.5 ? Math.min(999, Math.round(100 / Math.tan(sp.alt * RAD))) : 0) : Math.round((tempAt(state.place, state.date, m) || 0) * 10) / 10;
      return { label: hm(m), value: v };
    });
    const unit = state.graph === "alt" ? "°" : state.graph === "sh" ? "cm" : "°C";
    const vals = items.map((i) => i.value);
    const mn = Math.min(...vals);
    VG.line(gs, { width: 360, height: 230, title: state.graph === "alt" ? "태양 고도" : state.graph === "sh" ? "그림자 길이" : "기온", unit, items, colors: vgColors(), showValues: items.length <= 7, wave: state.graph === "temp" && mn > 6 ? { from: Math.floor((mn - 2) / 2) * 2 } : null, fontSize: 12 });
    gs.removeAttribute("width"); gs.removeAttribute("height");
  }
  function record(min) {
    if (!state.rec.includes(min)) state.rec.push(min);
    state.rec = state.rec.slice(-24);
    persist(); renderRecords();
  }

  /* ═════════ 계절 비교 ═════════ */
  function drawSeason() {
    if (state.light) return drawLight();
    const { W, H } = freshSvg();
    const d = state.date;
    const st = sunTimes(d, P());
    const noon = sunPos(d, st.noon, P());
    const g = skyGround(W, H, 40);
    const paths = [["하지", seasonDates()[1].d, "#ef4444"], ["춘·추분", seasonDates()[0].d, "#22c55e"], ["동지", seasonDates()[3].d, "#3b82f6"]];
    paths.forEach(([name, dd, col]) => {
      el("path", { d: pathOf(g, dd, 0, 1440, 5), fill: "none", stroke: col, "stroke-width": 2.5, opacity: 0.8 }, svg);
      const t = sunTimes(dd, P()), sp = sunPos(dd, t.noon, P());
      const [x, y] = proj(g, sp.alt, sp.az);
      el("text", { x: x + 10, y: y - 6, "font-size": 14, "font-weight": 900, fill: col }, svg, name);
    });
    el("path", { d: pathOf(g, d, 0, 1440, 5), fill: "none", stroke: cssVar("--ss-sun"), "stroke-width": 5, "stroke-linecap": "round" }, svg);
    // 남중 고도 각
    const [sx, sy] = proj(g, noon.alt, noon.az);
    const [hx, hyy] = proj(g, 0, 180);
    el("line", { x1: g.cx, y1: g.hy, x2: sx, y2: sy, stroke: cssVar("--ss-sun"), "stroke-width": 2, "stroke-dasharray": "6 5" }, svg);
    el("line", { x1: g.cx, y1: g.hy, x2: hx, y2: hyy, stroke: "#334155", "stroke-width": 2, "stroke-dasharray": "6 5" }, svg);
    stickShadow(g, noon.alt, noon.az);
    sunDot(sx, sy, Math.max(13, g.R * 0.055));
    el("text", { x: sx + 18, y: sy + 22, "font-size": 16, "font-weight": 900, fill: "#1f2937", stroke: "#fff", "stroke-width": 4, "paint-order": "stroke" }, svg, "남중 고도 " + noon.alt.toFixed(1) + "°");
    geo = { kind: "season", g };
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", dateKo(d) + " 태양이 지나는 길. 남중 고도 " + noon.alt.toFixed(1) + "도, 낮의 길이 " + durKo(st.dayLen));
    caption([dateKo(d) + " · 낮의 길이 " + durKo(st.dayLen)]);
  }
  function drawLight() {
    const { W, H } = freshSvg();
    el("rect", { x: 0, y: 0, width: W, height: H, fill: cssVar("--ss-bg") }, svg);
    const ang = state.lightAng;
    const n = 24, gy = H * 0.72, gx0 = W * 0.08, cw = (W * 0.84) / n;
    const beam = cw * 4; // 빛줄기 폭(수직일 때 4칸)
    const span = beam / Math.sin(ang * RAD);
    const cxm = W / 2;
    const a0 = cxm - span / 2, a1 = cxm + span / 2;
    let lit = 0;
    for (let i = 0; i < n; i++) {
      const x = gx0 + i * cw;
      const cover = Math.max(0, Math.min(x + cw, a1) - Math.max(x, a0)) / cw;
      if (cover > 0.5) lit++;
      // 빛이 좁게 모일수록(칸 수가 적을수록) 진한 색
      el("rect", { x, y: gy, width: cw - 2, height: 26, rx: 4, fill: cover > 0 ? mix("#fef3c7", "#f59e0b", Math.min(1, 4 / (span / cw))) : cssVar("--ss-btn"), opacity: cover > 0 ? 0.35 + 0.65 * cover : 1, stroke: cssVar("--ss-border") }, svg);
    }
    // 전등과 빛줄기
    const L = Math.min(W, H) * 0.5;
    const dx = -Math.cos(ang * RAD), dy = -Math.sin(ang * RAD); // 바닥에서 전등 쪽
    const ox = cxm + dx * L, oy = gy + dy * L;
    const px = -dy, py = dx; // 빛줄기 폭 방향
    const half = beam / 2;
    el("polygon", { points: [[ox + px * half, oy + py * half], [ox - px * half, oy - py * half], [a1, gy], [a0, gy]].map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), fill: "#fde68a", opacity: 0.55 }, svg);
    el("rect", { x: ox - 26, y: oy - 18, width: 52, height: 36, rx: 8, fill: "#475569", transform: "rotate(" + (ang) + " " + ox + " " + oy + ")" }, svg);
    // 제목: 좁은 무대(360px)에서 양옆이 잘리지 않게 넓으면 한 줄, 좁으면 두 줄로. 위 공용 버튼 줄(--sk-stage-top) 아래에서 시작
    const narrow = W < 620;
    const f1 = Math.max(14, Math.min(20, W / 20)), f2 = Math.max(12, Math.min(15, W / 26));
    const t1 = ["빛이 " + ang + "°로 비출 때", "같은 빛이 약 " + (span / cw).toFixed(1) + "칸에 퍼져요"];
    const t2 = ["수직(90°)일 때는 4칸에 모여요", "한 칸이 받는 빛은 " + Math.round(Math.sin(ang * RAD) * 100) + "%"];
    let ty = Math.max(STAGE_TOP + f1, H * 0.12);
    const line = (txt, fs, w, col) => { el("text", { x: W / 2, y: ty, "text-anchor": "middle", "font-size": fs, "font-weight": w, fill: col }, svg, txt); ty += fs * 1.45; };
    if (narrow) { t1.forEach((t) => line(t, f1, 900, cssVar("--ss-text"))); t2.forEach((t) => line(t, f2, 700, cssVar("--ss-muted"))); }
    else { line(t1.join(" · "), f1, 900, cssVar("--ss-text")); line(t2.join(" → "), f2, 700, cssVar("--ss-muted")); }
    geo = { kind: "light" };
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "빛 실험: " + ang + "도로 비출 때 빛이 " + (span / cw).toFixed(1) + "칸에 퍼짐");
  }
  function seasonPanel() {
    const d = state.date, st = sunTimes(d, P());
    $("sSlider").value = doyOf(d);
    $("sDateLbl").textContent = dateKo(d);
    const box = $("sReadouts"); box.textContent = "";
    const add = (l, v) => { const x = document.createElement("div"); const s = document.createElement("small"); s.textContent = l; const b = document.createElement("b"); b.textContent = v; x.append(s, b); box.appendChild(x); };
    add("남중 고도", st.noonAlt.toFixed(1) + "°"); add("낮의 길이", durKo(st.dayLen));
    add("남중 시각", hm(st.noon)); add("남중 때 그림자", Math.round(100 / Math.tan(st.noonAlt * RAD)) + "cm");
    // 절기 표
    const tb = document.createElement("table"); tb.className = "rec";
    const h = tb.insertRow(); ["", "남중 고도", "낮의 길이", "그림자(1m)"].forEach((x) => { const th = document.createElement("th"); th.textContent = x; h.appendChild(th); });
    seasonDates().forEach((s) => { const t = sunTimes(s.d, P()); const r = tb.insertRow(); [s.name + " " + s.d.m + "/" + s.d.d, t.noonAlt.toFixed(1) + "°", durKo(t.dayLen), Math.round(100 / Math.tan(t.noonAlt * RAD)) + "cm"].forEach((v) => { r.insertCell().textContent = v; }); });
    $("sTable").textContent = ""; $("sTable").appendChild(tb);
    // 달마다 그래프
    const tabs = $("sGraphTabs"); tabs.textContent = "";
    [["alt", "남중 고도"], ["len", "낮의 길이"]].forEach(([k, lab]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = lab;
      b.setAttribute("aria-pressed", state.sGraph === k ? "true" : "false");
      b.addEventListener("click", () => { state.sGraph = k; seasonPanel(); });
      tabs.appendChild(b);
    });
    const items = [];
    for (let m = 1; m <= 12; m++) { const t = sunTimes({ y: YEAR, m, d: 15 }, P()); items.push({ label: m + "월", value: state.sGraph === "alt" ? Math.round(t.noonAlt) : Math.round(t.dayLen / 6) / 10 }); }
    const gb = $("sGraph"); gb.textContent = "";
    const gs = document.createElementNS(NS, "svg"); gb.appendChild(gs);
    VG.line(gs, { width: 360, height: 230, title: state.sGraph === "alt" ? "남중 고도" : "낮의 길이", unit: state.sGraph === "alt" ? "°" : "시간", items, colors: vgColors(), showValues: false, wave: state.sGraph === "alt" ? { from: 20 } : { from: 8 }, step: state.sGraph === "alt" ? 10 : 1, fontSize: 12 });
    gs.removeAttribute("width"); gs.removeAttribute("height");
    $("sLight").setAttribute("aria-pressed", state.light ? "true" : "false");
    $("sLightRow").hidden = !state.light;
    $("sLightLbl").textContent = state.lightAng + "°";
    paintSeasonChips();
  }

  /* ═════════ 계절의 원인 ═════════ */
  function orbitInfo(doy) {
    const d = dateFromDoy(doy);
    const c = sunCoord(jdOf(d, 720));
    const decDeg = Math.asin(Math.sin(state.tilt * RAD) * Math.sin(c.lam * RAD)) * DEG;
    const noonAlt = 90 - P().lat + decDeg;
    const dayLen = 2 * halfDay(decDeg * RAD, P().lat);
    return { d, lam: c.lam, r: c.r, decDeg, noonAlt, dayLen };
  }
  function drawOrbit() {
    const { W, H } = freshSvg();
    el("rect", { x: 0, y: 0, width: W, height: H, fill: cssVar("--ss-bg") }, svg);
    const info = orbitInfo(state.oDoy);
    const wide = W > H * 1.15;
    // 위에서 본 공전
    const ow = wide ? W * 0.55 : W, oh = wide ? H : H * 0.55;
    const ocx = ow / 2, ocy = oh / 2 + 10, Ro = Math.min(ow, oh) * 0.36;
    el("text", { x: ocx, y: 26, "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: cssVar("--ss-muted") }, svg, "위에서 본 지구의 공전");
    el("ellipse", { cx: ocx, cy: ocy, rx: Ro, ry: Ro * 0.98, fill: "none", stroke: cssVar("--ss-border"), "stroke-width": 2, "stroke-dasharray": "6 6" }, svg);
    el("circle", { cx: ocx, cy: ocy, r: Ro * 0.14, fill: cssVar("--ss-sun") }, svg);
    el("text", { x: ocx, y: ocy, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 13, "font-weight": 900, fill: "#7c2d12" }, svg, "태양");
    const posOf = (lam) => { const th = (lam + 180) * RAD; return [ocx + Math.cos(th) * Ro, ocy - Math.sin(th) * Ro * 0.98]; };
    [[0, "춘분"], [90, "하지"], [180, "추분"], [270, "동지"]].forEach(([lam, name]) => {
      const [x, y] = posOf(lam);
      el("circle", { cx: x, cy: y, r: 7, fill: cssVar("--ss-border") }, svg);
      el("text", { x, y: y + (y > ocy ? 24 : -16), "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: cssVar("--ss-muted") }, svg, name);
    });
    const [ex, ey] = posOf(info.lam);
    el("circle", { cx: ex, cy: ey, r: 16, fill: "#2563eb", stroke: "#fff", "stroke-width": 2 }, svg);
    if (state.tilt) { el("line", { x1: ex, y1: ey + 4, x2: ex, y2: ey - 30, stroke: "#dc2626", "stroke-width": 3, "stroke-linecap": "round" }, svg); el("text", { x: ex + 6, y: ey - 30, "font-size": 12, "font-weight": 800, fill: "#dc2626" }, svg, "북극 쪽"); }
    // 옆에서 본 지구와 햇빛
    const sx0 = wide ? ow : 0, sy0 = wide ? 0 : oh, sw = wide ? W - ow : W, sh = wide ? H : H - oh;
    const ecx = sx0 + sw * 0.6, ecy = sy0 + sh * 0.52, Re = Math.min(sw, sh) * 0.3;
    el("text", { x: sx0 + sw / 2, y: sy0 + 26, "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: cssVar("--ss-muted") }, svg, "옆에서 본 지구 (" + dateKo(info.d) + ")");
    for (let k = -2; k <= 2; k++) el("line", { x1: sx0 + 10, y1: ecy + k * Re * 0.45, x2: ecx - Re * 1.05, y2: ecy + k * Re * 0.45, stroke: cssVar("--ss-sun"), "stroke-width": 2, opacity: 0.7, "marker-end": "" }, svg);
    el("text", { x: sx0 + 12, y: ecy - Re * 1.05, "font-size": 13, "font-weight": 800, fill: cssVar("--ss-sun") }, svg, "햇빛 →");
    el("circle", { cx: ecx, cy: ecy, r: Re, fill: "#3b82f6", stroke: "#1e3a8a", "stroke-width": 2 }, svg);
    // 밤쪽 그늘
    el("path", { d: "M" + ecx + " " + (ecy - Re) + " A" + Re + " " + Re + " 0 0 1 " + ecx + " " + (ecy + Re) + " Z", fill: "#0f172a", opacity: 0.45 }, svg);
    const dl = info.decDeg * RAD;
    const a = [-Math.sin(dl), -Math.cos(dl)]; // 자전축(북극)
    const e = [-Math.cos(dl), Math.sin(dl)];  // 낮쪽 적도
    el("line", { x1: ecx - a[0] * Re * 1.3, y1: ecy - a[1] * Re * 1.3, x2: ecx + a[0] * Re * 1.3, y2: ecy + a[1] * Re * 1.3, stroke: "#dc2626", "stroke-width": 3 }, svg);
    el("line", { x1: ecx - e[0] * Re, y1: ecy - e[1] * Re, x2: ecx + e[0] * Re, y2: ecy + e[1] * Re, stroke: "#e2e8f0", "stroke-width": 1.5, "stroke-dasharray": "4 4" }, svg);
    const phi = P().lat * RAD;
    const nrm = [Math.cos(phi) * e[0] + Math.sin(phi) * a[0], Math.cos(phi) * e[1] + Math.sin(phi) * a[1]];
    const kx = ecx + nrm[0] * Re, ky = ecy + nrm[1] * Re;
    // 우리나라 지점과 지평선
    const tan = [-nrm[1], nrm[0]];
    el("line", { x1: kx - tan[0] * Re * 0.55, y1: ky - tan[1] * Re * 0.55, x2: kx + tan[0] * Re * 0.55, y2: ky + tan[1] * Re * 0.55, stroke: "#16a34a", "stroke-width": 3 }, svg);
    el("line", { x1: kx - Re * 0.9, y1: ky, x2: kx, y2: ky, stroke: cssVar("--ss-sun"), "stroke-width": 3 }, svg);
    el("circle", { cx: kx, cy: ky, r: 6, fill: "#facc15", stroke: "#1f2937", "stroke-width": 1.5 }, svg);
    el("text", { x: kx - Re * 0.95, y: ky - 10, "font-size": 14, "font-weight": 900, fill: cssVar("--ss-text") }, svg, "우리나라 남중 고도 " + info.noonAlt.toFixed(1) + "°");
    geo = { kind: "orbit" };
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "자전축 " + state.tilt + "도. " + dateKo(info.d) + " 남중 고도 " + info.noonAlt.toFixed(1) + "도");
  }
  function orbitPanel() {
    const info = orbitInfo(state.oDoy);
    $("oSlider").value = state.oDoy; $("oDateLbl").textContent = dateKo(info.d);
    for (const b of $("oTilt").querySelectorAll("[data-tilt]")) b.setAttribute("aria-pressed", Number(b.dataset.tilt) === state.tilt ? "true" : "false");
    const box = $("oReadouts"); box.textContent = "";
    const add = (l, v) => { const x = document.createElement("div"); const s = document.createElement("small"); s.textContent = l; const b = document.createElement("b"); b.textContent = v; x.append(s, b); box.appendChild(x); };
    add("남중 고도", info.noonAlt.toFixed(1) + "°"); add("낮의 길이", durKo(info.dayLen));
    add("태양까지 거리", (info.r * 1.496).toFixed(3) + "억 km"); add("자전축", state.tilt + "°");
    const items = []; for (let m = 1; m <= 12; m++) items.push({ label: m + "월", value: Math.round(orbitInfo(doyOf({ y: YEAR, m, d: 15 })).noonAlt) });
    const gb = $("oGraph"); gb.textContent = "";
    const gs = document.createElementNS(NS, "svg"); gb.appendChild(gs);
    VG.line(gs, { width: 360, height: 220, title: "남중 고도 (자전축 " + state.tilt + "°)", unit: "°", items, colors: vgColors(), showValues: false, step: 10, wave: { from: 20 }, fontSize: 12 });
    gs.removeAttribute("width"); gs.removeAttribute("height");
  }

  /* ═════════ 공통 그리기·조작 ═════════ */
  function render() {
    const cap = scene.querySelector(".scene-cap"); if (cap) cap.remove(); // 계절 비교만 다시 붙임
    if (state.mode === "day" || (state.mode === "mission" && missionScene() === "day")) drawDay();
    else if (state.mode === "season" || (state.mode === "mission" && missionScene() === "season")) drawSeason();
    else if (state.mode === "mission" && missionScene() === "light") { state.light = true; drawLight(); }
    else drawOrbit();
    if (state.mode === "day") dayReadouts();
  }
  function setTime(min) { state.min = mod(Math.round(min), 1440); render(); if (state.mode === "mission") missionTick(); }
  function setDate(d) { state.date = d; render(); if (state.mode === "day") renderRecords(); if (state.mode === "season") seasonPanel(); if (state.mode === "mission") missionTick(); }

  // 하늘의 해를 끌어 시각 바꾸기
  let dragSun = null;
  scene.addEventListener("pointerdown", (e) => {
    if (!geo || geo.kind !== "day" || e.button > 0) return;
    if (state.mode === "mission" && !missionAllowsTime()) return;
    const m = svg.getScreenCTM(); if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const sp = sunPos(state.date, state.min, P());
    const [sx, sy] = proj(geo.g, sp.alt, sp.az);
    if (Math.hypot(p.x - sx, p.y - sy) > 60 && !nearPath(p)) return;
    e.preventDefault();
    try { scene.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    dragSun = e.pointerId; stopPlay();
    moveSun(p);
  });
  function nearPath(p) { const st = sunTimes(state.date, P()); for (let m = st.rise; m <= st.set; m += 10) { const s = sunPos(state.date, m, P()); const [x, y] = proj(geo.g, s.alt, s.az); if (Math.hypot(p.x - x, p.y - y) < 36) return true; } return false; }
  function moveSun(p) {
    const st = sunTimes(state.date, P());
    let best = state.min, bd = Infinity;
    for (let m = Math.ceil(st.rise / 5) * 5; m <= st.set; m += 5) { const s = sunPos(state.date, m, P()); const [x, y] = proj(geo.g, s.alt, s.az); const dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; best = m; } }
    setTime(Math.round(best / 10) * 10 === best ? best : best);
  }
  scene.addEventListener("pointermove", (e) => { if (dragSun !== e.pointerId || !geo || geo.kind !== "day") return; const m = svg.getScreenCTM(); if (!m) return; moveSun(new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())); });
  const endSun = (e) => { if (dragSun === e.pointerId) dragSun = null; };
  scene.addEventListener("pointerup", endSun); scene.addEventListener("pointercancel", endSun);

  // 재생
  let playId = 0;
  function stopPlay() { if (playId) { timers.clear(playId); playId = 0; } $("dPlay").setAttribute("aria-pressed", "false"); $("dPlay").innerHTML = SK.icon("play") + (LAB.play || "재생"); }
  $("dPlay").addEventListener("click", () => {
    if (playId) return stopPlay();
    const st = sunTimes(state.date, P());
    if (state.min >= st.set - 10 || state.min < st.rise) state.min = Math.ceil(st.rise / 10) * 10;
    $("dPlay").setAttribute("aria-pressed", "true"); $("dPlay").innerHTML = SK.icon("pause") + (LAB.pause || "멈춤");
    playId = timers.interval(() => {
      const s = sunTimes(state.date, P());
      if (state.min + 10 > s.set) { stopPlay(); return; }
      setTime(state.min + 10);
    }, reduceMotion() ? 600 : 330);
  });

  /* ═════════ 패널 이벤트 ═════════ */
  function renderPlaces() {
    const box = $("places"); box.textContent = "";
    Object.keys(PLACES).forEach((k) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = PLACES[k].name;
      b.setAttribute("aria-pressed", k === state.place ? "true" : "false");
      b.addEventListener("click", () => { state.place = k; persist(); renderPlaces(); refreshMode(); });
      box.appendChild(b);
    });
  }
  function paintSeasonChips() {
    for (const box of document.querySelectorAll("[data-season-chips]")) {
      if (!box.children.length) {
        seasonDates().concat([{ key: "today", name: "오늘", d: { y: YEAR, m: today.getMonth() + 1, d: today.getDate() } }]).forEach((s) => {
          const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.key = s.key; b.textContent = s.name + (s.key === "today" ? "" : " " + s.d.m + "/" + s.d.d);
          b.addEventListener("click", () => { stopPlay(); setDate(s.d); if (state.mode === "day") dayReadouts(); });
          box.appendChild(b);
        });
      }
      const cur = dateStr(state.date);
      const all = seasonDates().concat([{ key: "today", d: { y: YEAR, m: today.getMonth() + 1, d: today.getDate() } }]);
      for (const b of box.children) { const s = all.find((x) => x.key === b.dataset.key); b.setAttribute("aria-pressed", s && dateStr(s.d) === cur ? "true" : "false"); }
    }
  }
  $("dSlider").addEventListener("input", () => { stopPlay(); setTime(Number($("dSlider").value)); });
  $("dMinus").addEventListener("click", () => { stopPlay(); setTime(state.min - 10); });
  $("dPlus").addEventListener("click", () => { stopPlay(); setTime(state.min + 10); });
  $("dDate").addEventListener("change", () => { const v = $("dDate").value.split("-").map(Number); if (v.length === 3 && v.every(Number.isFinite)) { state.date = { y: YEAR, m: v[1], d: v[2] }; state.rec = []; persist(); setDate(state.date); dayReadouts(); } });
  $("dRecord").addEventListener("click", () => { record(state.min); if (SK.sound) SK.sound.play("move"); });
  $("dAuto").addEventListener("click", () => { for (let m = 570; m <= 930; m += 60) if (!state.rec.includes(m)) state.rec.push(m); persist(); renderRecords(); if (SK.sound) SK.sound.play("star"); });
  $("dClear").addEventListener("click", () => {
    if (!state.rec.length) return;
    const prev = state.rec.slice();
    state.rec = []; persist(); renderRecords();
    const undo = () => { state.rec = prev; persist(); renderRecords(); };
    if (VUI && VUI.toast) VUI.toast("측정 기록을 지웠어요.", { duration: 6000, action: { label: "되돌리기", onClick: undo } });
  });
  $("sSlider").addEventListener("input", () => { setDate(dateFromDoy(Number($("sSlider").value))); });
  $("sMinus").addEventListener("click", () => setDate(dateFromDoy(Math.max(1, doyOf(state.date) - 1))));
  $("sPlus").addEventListener("click", () => setDate(dateFromDoy(Math.min(365, doyOf(state.date) + 1))));
  $("sLight").addEventListener("click", () => { state.light = !state.light; seasonPanel(); render(); });
  $("sLightAng").addEventListener("input", () => { state.lightAng = Number($("sLightAng").value); $("sLightLbl").textContent = state.lightAng + "°"; render(); });
  $("oSlider").addEventListener("input", () => { state.oDoy = Number($("oSlider").value); orbitPanel(); render(); });
  $("oMinus").addEventListener("click", () => { state.oDoy = mod(state.oDoy - 11, 365) + 1; orbitPanel(); render(); });
  $("oPlus").addEventListener("click", () => { state.oDoy = mod(state.oDoy + 9, 365) + 1; orbitPanel(); render(); });
  $("oTilt").addEventListener("click", (e) => { const b = e.target.closest("[data-tilt]"); if (!b) return; state.tilt = Number(b.dataset.tilt); orbitPanel(); render(); if (SK.sound) SK.sound.play("move"); });

  /* ═════════ 모드 ═════════ */
  function setMode(m) {
    stopPlay();
    if (state.mode === "mission" && m !== "mission" && mc) mc.stop();
    state.mode = m;
    if (m !== "season") state.light = false;
    if (m === "orbit") state.tilt = 23.5;
    for (const b of document.querySelectorAll(".mode-tab")) { const on = b.dataset.mode === m; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    $("paneDay").hidden = m !== "day"; $("paneSeason").hidden = m !== "season"; $("paneOrbit").hidden = m !== "orbit"; $("paneMission").hidden = m !== "mission";
    scene.textContent = ""; svg = null;
    refreshMode();
  }
  function refreshMode() {
    const m = state.mode;
    if (m === "day") { dayReadouts(); renderRecords(); }
    if (m === "season") seasonPanel();
    if (m === "orbit") orbitPanel();
    if (m === "mission") { const i = mc.current(); if (i < 0) { mc.start(); return; } }
    render();
  }
  document.querySelector(".mode-tabs").addEventListener("click", (e) => { const b = e.target.closest(".mode-tab"); if (b) setMode(b.dataset.mode); });
  let rz = 0;
  if (window.ResizeObserver) new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(render); }).observe(scene);

  /* ═════════ 미션 ═════════ */
  const fb = SK.feedback("#mFeedback");
  let mc = null, cur = null; // cur: 지금 미션 { i, def, attempt, answered }
  const todayD = () => ({ y: YEAR, m: today.getMonth() + 1, d: today.getDate() });
  const MISSIONS = [
    { id: "m1", title: "그림자가 가장 짧은 때", scene: "day", control: "time",
      setup() { setDateQuiet(todayD()); state.min = 570; return "오늘 " + P().name + "에서 그림자가 가장 짧아지는 시각을 찾아 ‘확인하기’를 눌러요."; },
      check() { const st = sunTimes(state.date, P()); // 남중 앞뒤 20분은 그림자 길이 차이가 1cm도 안 돼 눈으로 구별하기 어려우므로 ±20분까지 정답
        return { ok: Math.abs(state.min - st.noon) <= 20, msg: "그림자가 가장 짧은 때는 태양이 남쪽 하늘 가장 높이 뜬 남중 때, " + hm(st.noon) + "쯤이에요. 낮 12시가 아니라 조금 늦어요(경도 때문).", reveal() { setTime(Math.round(st.noon / 10) * 10); } }; } },
    { id: "m2", title: "그림자 길이 = 막대 길이", scene: "day", control: "time",
      setup() { let d = todayD(); if (sunTimes(d, P()).noonAlt < 50) d = { y: YEAR, m: 5, d: 15 }; setDateQuiet(d); state.min = 480; return dateKo(d) + ", 1m 막대의 그림자가 1m가 되는 시각을 찾아요. (오전이나 오후 중 하나)"; },
      check() { const a = sunPos(state.date, state.min, P()).alt; const ok = Math.abs(a - 45) <= 1.6; let best = 0, bd = 99; for (let m = 300; m < 1200; m += 10) { const x = Math.abs(sunPos(state.date, m, P()).alt - 45); if (x < bd) { bd = x; best = m; } } return { ok, msg: "태양 고도가 45°일 때 그림자 길이와 막대 길이가 같아요. 지금 고도 " + Math.round(a) + "°.", reveal() { setTime(best); } }; } },
    { id: "m3", title: "기온이 가장 높은 때", scene: "day", control: null,
      setup() { setDateQuiet(todayD()); state.min = 720; return "맑은 날 하루 중 기온이 가장 높은 때는 언제일까요? 먼저 예측해 보세요."; },
      opts: ["낮 12시 무렵 (태양 고도가 가장 높을 때)", "오후 2시 무렵", "오후 5시 무렵"], answer: 1,
      after() { tempGraphInto($("mControls")); setTime(870); },
      explain: "땅이 데워지고 그 열로 공기가 데워지는 데 시간이 걸려서, 기온은 남중보다 늦은 오후 2시 무렵에 가장 높아요." },
    { id: "m4", title: "오후 3시의 그림자", scene: "day", control: null,
      // 날짜를 추분으로 고정: 대구·서울·제주 모두 오후 3시 태양이 남서쪽(방위 약 230~236°)이라 그림자는 북동쪽.
      // 오늘 날짜로 풀면 5~8월에는 태양이 거의 서쪽이라 문제("남서쪽")와 화면 그림자가 어긋났다.
      setup() { const d = seasonDates()[2]; setDateQuiet(d.d); state.min = 900; return d.name + "(" + dateKo(d.d) + ") 오후 3시에 막대의 그림자는 어느 쪽으로 생길까요? (태양은 남서쪽 하늘에 있어요)"; },
      opts: ["북동쪽", "북서쪽", "남동쪽", "남서쪽"], answer: 0, two: true,
      after() { setTime(900); },
      explain: "그림자는 태양의 반대쪽에 생겨요. 오전에는 서쪽, 남중 때는 북쪽, 오후에는 동쪽으로 돌아가요." },
    { id: "m5", title: "하지와 동지의 남중 고도", scene: "season", control: null,
      setup() { setDateQuiet(seasonDates()[1].d); return "하지(6월 21일 무렵)와 동지(12월 22일 무렵) 중 남중 고도가 더 높은 날은?"; },
      opts: ["하지", "동지", "둘이 같아요"], answer: 0,
      after() { const a = sunTimes(seasonDates()[1].d, P()).noonAlt, b = sunTimes(seasonDates()[3].d, P()).noonAlt; this.explain = "하지 " + a.toFixed(1) + "°, 동지 " + b.toFixed(1) + "°. 여름에는 태양이 높이 떠서 그림자가 짧고 기온이 높아요."; },
      explain: "" },
    { id: "m6", title: "낮이 가장 긴 날", scene: "season", control: "date",
      setup() { setDateQuiet({ y: YEAR, m: 3, d: 1 }); return "날짜를 움직여 낮의 길이가 가장 긴 날을 찾고 ‘확인하기’를 눌러요."; },
      check() { let best = 1, bl = 0; for (let k = 1; k <= 365; k++) { const l = sunTimes(dateFromDoy(k), P()).dayLen; if (l > bl) { bl = l; best = k; } } const ok = Math.abs(doyOf(state.date) - best) <= 3; return { ok, msg: "낮이 가장 긴 날은 하지(" + dateKo(dateFromDoy(best)) + " 무렵) — " + durKo(bl) + ". 남중 고도도 가장 높아요.", reveal() { setDate(dateFromDoy(best)); } }; } },
    { id: "m7", title: "빛이 비추는 각도", scene: "light", control: null,
      setup() { state.lightAng = 30; return "손전등을 바닥에 수직에 가깝게 세울수록(태양 고도가 높을수록), 같은 빛이 닿는 칸의 수는?"; },
      opts: ["적어져요 (한 칸에 빛이 많이 모여요)", "많아져요", "그대로예요"], answer: 0,
      after() { lightSlider($("mControls")); },
      explain: "빛이 좁은 곳에 모이면 한 칸이 받는 에너지가 많아 더 따뜻해져요. 그래서 남중 고도가 높은 여름이 더워요." },
    { id: "m8", title: "자전축이 기울지 않았다면", scene: "orbit", control: null,
      setup() { state.tilt = 23.5; state.oDoy = doyOf(seasonDates()[1].d); return "지구의 자전축이 기울지 않은 채 공전한다면 우리나라는 어떻게 될까요?"; },
      opts: ["1년 내내 남중 고도와 낮의 길이가 같아 계절의 변화가 없어요", "여름이 더 더워져요", "낮과 밤이 생기지 않아요"], answer: 0,
      after() { state.tilt = 0; render(); tiltButtons($("mControls")); },
      explain: "자전축이 기울어진 채 공전하기 때문에 계절마다 남중 고도와 낮의 길이가 달라지고, 그래서 계절이 생겨요." },
  ];
  function setDateQuiet(d) { state.date = d; }
  function missionScene() { return cur ? cur.def.scene : "day"; }
  function missionAllowsTime() { return cur && cur.def.control === "time" && !cur.answered; }

  function buildMissions() {
    mc = SK.missions({
      ids: MISSIONS.map((m) => m.id), format: "full", progress: saved.progress || {}, keepBest: true, nav: "#missionNav", feedback: fb,
      onEnter: (i) => enterMission(i),
      onChange: (p) => { saved.progress = p; persist(); },
      onAllDone: () => { $("mResult").hidden = false; },
      onFinish: () => showResult(),
    });
  }
  function enterMission(i) {
    const def = MISSIONS[i];
    cur = { i, def, attempt: 0, answered: false };
    state.light = def.scene === "light";
    $("mTitle").textContent = "미션 " + (i + 1) + " · " + def.title;
    $("mQ").textContent = def.setup();
    fb.hide();
    $("mNextMission").hidden = true;
    $("mResult").hidden = !mc.allDone();
    const ctr = $("mControls"); ctr.textContent = "";
    if (def.control === "time") timeSlider(ctr);
    if (def.control === "date") dateSlider(ctr);
    const ab = $("mAnswer"); ab.textContent = "";
    if (def.opts) {
      const g = document.createElement("div"); g.className = "opts" + (def.two ? " two" : "");
      def.opts.forEach((t, ix) => { const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = t; b.addEventListener("click", () => answerOpt(ix, b)); g.appendChild(b); });
      ab.appendChild(g);
      $("mCheck").hidden = true;
    } else { $("mCheck").hidden = false; }
    scene.textContent = ""; svg = null;
    render();
  }
  function timeSlider(box) {
    const row = document.createElement("div"); row.className = "slider-row";
    const m = document.createElement("button"); m.type = "button"; m.className = "sq"; m.textContent = "−10분";
    const r = document.createElement("input"); r.type = "range"; r.min = 0; r.max = 1430; r.step = 10; r.value = state.min; r.setAttribute("aria-label", "시각");
    const p = document.createElement("button"); p.type = "button"; p.className = "sq"; p.textContent = "+10분";
    m.addEventListener("click", () => setTime(state.min - 10)); p.addEventListener("click", () => setTime(state.min + 10));
    r.addEventListener("input", () => setTime(Number(r.value)));
    row.append(m, r, p);
    const lab = document.createElement("div"); lab.className = "big-val"; lab.id = "mTimeLbl"; lab.style.margin = "4px 0 8px";
    box.append(lab, row);
    missionTick();
  }
  function dateSlider(box) {
    const row = document.createElement("div"); row.className = "slider-row";
    const m = document.createElement("button"); m.type = "button"; m.className = "sq"; m.textContent = "−1일";
    const r = document.createElement("input"); r.type = "range"; r.min = 1; r.max = 365; r.step = 1; r.value = doyOf(state.date); r.setAttribute("aria-label", "날짜");
    const p = document.createElement("button"); p.type = "button"; p.className = "sq"; p.textContent = "+1일";
    m.addEventListener("click", () => setDate(dateFromDoy(Math.max(1, doyOf(state.date) - 1)))); p.addEventListener("click", () => setDate(dateFromDoy(Math.min(365, doyOf(state.date) + 1))));
    r.addEventListener("input", () => setDate(dateFromDoy(Number(r.value))));
    row.append(m, r, p);
    const lab = document.createElement("div"); lab.className = "big-val"; lab.id = "mTimeLbl"; lab.style.margin = "4px 0 8px";
    box.append(lab, row);
    missionTick();
  }
  function missionTick() {
    const lab = $("mTimeLbl"); if (!lab || !cur) return;
    const r = $("mControls").querySelector("input[type=range]");
    if (cur.def.control === "time") {
      const sp = sunPos(state.date, state.min, P());
      lab.textContent = hmKo(state.min) + " · 그림자 " + (sp.alt > 0.5 ? (Math.round(1000 / Math.tan(sp.alt * RAD)) / 10).toFixed(1) + "cm" : "없음");
      if (r) r.value = state.min;
    } else if (cur.def.control === "date") {
      lab.textContent = dateKo(state.date) + " · 낮의 길이 " + durKo(sunTimes(state.date, P()).dayLen);
      if (r) r.value = doyOf(state.date);
    }
  }
  function tempGraphInto(box) {
    box.textContent = "";
    const items = []; for (let h = 6; h <= 20; h += 2) items.push({ label: h + "시", value: Math.round((tempAt(state.place, state.date, h * 60) || 0) * 10) / 10 });
    const gb = document.createElement("div"); gb.className = "graph-box"; const gs = document.createElementNS(NS, "svg"); gb.appendChild(gs); box.appendChild(gb);
    const mn = Math.min(...items.map((x) => x.value));
    VG.line(gs, { width: 360, height: 220, title: dateKo(state.date) + " 기온(평소 이맘때 어림)", unit: "°C", items, colors: vgColors(), showValues: true, wave: mn > 4 ? { from: Math.floor((mn - 2) / 2) * 2 } : null, fontSize: 12 });
    gs.removeAttribute("width"); gs.removeAttribute("height");
  }
  function lightSlider(box) {
    box.textContent = "";
    const row = document.createElement("div"); row.className = "slider-row";
    const l = document.createElement("span"); l.className = "hint-text"; l.style.fontWeight = "800"; l.textContent = "각도";
    const r = document.createElement("input"); r.type = "range"; r.min = 15; r.max = 90; r.step = 5; r.value = state.lightAng; r.setAttribute("aria-label", "빛이 비추는 각도");
    const v = document.createElement("span"); v.className = "big-val"; v.textContent = state.lightAng + "°";
    r.addEventListener("input", () => { state.lightAng = Number(r.value); v.textContent = r.value + "°"; render(); });
    row.append(l, r, v); box.appendChild(row);
  }
  function tiltButtons(box) {
    box.textContent = "";
    const row = document.createElement("div"); row.className = "row";
    [[23.5, "지금 지구 (23.5°)"], [0, "기울지 않았다면 (0°)"]].forEach(([t, lab]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "sk-btn sk-btn--sm"; b.textContent = lab; b.setAttribute("aria-pressed", state.tilt === t ? "true" : "false");
      b.addEventListener("click", () => { state.tilt = t; for (const x of row.children) x.setAttribute("aria-pressed", x === b ? "true" : "false"); render(); });
      row.appendChild(b);
    });
    const p = document.createElement("p"); p.className = "hint-text"; p.style.marginTop = "6px"; p.textContent = "날짜를 바꿔 보려면 ‘원인’ 탭에서 해 보세요. 0°이면 1년 내내 남중 고도가 " + (90 - P().lat).toFixed(1) + "°예요.";
    box.append(row, p);
  }
  function finish(stars, msg, tone) {
    cur.answered = true;
    mc.complete({ stars, message: msg + "  — 미션 완료! " + SK.stars.text(stars, 3), tone });
    if (SK.sound) SK.sound.play(stars === 3 ? "star" : "done");
    if (mc.current() < MISSIONS.length - 1 || mc.firstIncomplete() >= 0) { $("mNextMission").hidden = false; $("mNextMission").focus(); }
    $("mResult").hidden = !mc.allDone();
    $("mCheck").hidden = true;
  }
  const starsFor = (a) => (a === 0 ? 3 : a === 1 ? 2 : 1);
  function answerOpt(ix, btn) {
    if (!cur || cur.answered) return;
    const def = cur.def;
    if (ix === def.answer) {
      btn.classList.add("right");
      for (const b of $("mAnswer").querySelectorAll(".opt")) b.disabled = true;
      if (def.after) def.after.call(def);
      finish(starsFor(cur.attempt), "맞았어요! " + def.explain, "ok");
      return;
    }
    btn.classList.add("wrong"); btn.disabled = true;
    cur.attempt++;
    if (SK.sound) SK.sound.play("wrong");
    if (cur.attempt === 1) { fb.show("warn", "다시 생각해 볼까요?"); return; }
    const right = $("mAnswer").querySelectorAll(".opt")[def.answer]; right.classList.add("right");
    for (const b of $("mAnswer").querySelectorAll(".opt")) b.disabled = true;
    if (def.after) def.after.call(def);
    finish(1, "정답은 ‘" + def.opts[def.answer] + "’. " + def.explain, "warn");
  }
  $("mCheck").addEventListener("click", () => {
    if (!cur || cur.answered || !cur.def.check) return;
    const r = cur.def.check();
    if (r.ok) { finish(starsFor(cur.attempt), "맞았어요! " + r.msg, "ok"); return; }
    cur.attempt++;
    if (SK.sound) SK.sound.play("wrong");
    if (cur.attempt === 1) { fb.show("warn", cur.def.control === "date" ? "아직 아니에요. 낮의 길이 숫자가 가장 커지는 날을 찾아보세요." : cur.def.id === "m2" ? "아직 아니에요. 그림자 길이가 100cm에 가까워지도록 시각을 바꿔 보세요." : "아직 아니에요. 그림자 길이 숫자가 가장 작아지는 시각을 찾아보세요."); return; }
    r.reveal();
    finish(1, r.msg, "warn");
  });
  $("mNextMission").addEventListener("click", () => { const c = mc.current(); if (c < MISSIONS.length - 1) mc.go(c + 1); else { const n = mc.firstIncomplete(); if (n >= 0) mc.go(n); else showResult(); } });
  $("mResult").addEventListener("click", showResult);
  $("mExit").addEventListener("click", () => setMode("day"));

  /* ═════════ 결과 ═════════ */
  const screens = SK.screens({});
  function showResult() {
    if (mc) mc.stop();
    const grid = $("resultGrid"); grid.textContent = "";
    let tot = 0;
    MISSIONS.forEach((M, i) => {
      const s = mc.starsOf(i); tot += s;
      const c = document.createElement("div"); c.className = "result-cell"; c.setAttribute("role", "listitem");
      const a = document.createElement("span"); a.textContent = (i + 1) + ". " + M.title;
      const b = document.createElement("span"); b.className = "stars"; b.textContent = SK.stars.text(s, 3, "—"); b.setAttribute("aria-label", "별 3개 중 " + s + "개");
      c.append(a, b); grid.appendChild(c);
    });
    $("resultSub").textContent = P().name + " 기준 · 별 " + tot + " / " + MISSIONS.length * 3;
    screens.show("screenResult");
  }
  $("btnRetry").addEventListener("click", () => { screens.show("screenMain"); setMode("mission"); mc.go(0); });
  $("btnToDay").addEventListener("click", () => { screens.show("screenMain"); setMode("day"); });

  /* ═════════ 공유·시작 ═════════ */
  SK.share.bind(() => ({ v: 1, place: state.place, date: dateStr(state.date), min: state.min, mode: state.mode === "mission" ? "day" : state.mode }), { title: "태양과 그림자" });
  let opened = false;
  (function readShare() {
    const p = SK.share.read({ version: 1 });
    if (!p) return;
    if (PLACES[p.place]) state.place = p.place;
    if (typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) { const [, m, d] = p.date.split("-").map(Number); if (m >= 1 && m <= 12 && d >= 1 && d <= 31) state.date = { y: YEAR, m, d }; }
    const mn = Number(p.min); if (Number.isFinite(mn) && mn >= 0 && mn < 1440) state.min = Math.round(mn / 10) * 10;
    if (["day", "season", "orbit"].includes(p.mode)) state.mode = p.mode;
    opened = true;
  })();
  function start() { screens.show("screenMain"); renderPlaces(); setMode(state.mode); }
  $("btnStart").addEventListener("click", start);
  buildMissions();
  fetch("/apps/sun-shadow/climate.json").then((r) => r.ok ? r.json() : null).then((j) => {
    if (j && isObj(j.places)) { CLIMATE = j; if ($("screenMain").classList.contains("active")) refreshMode(); }
  }).catch(() => { /* 기온 없이 동작 */ });
  if (opened) start();
})();
