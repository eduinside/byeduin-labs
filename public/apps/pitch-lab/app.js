/* ================================================================
   음높이 실험실 — pitch-lab (eduin VIVES)
   - 관찰: 마이크·소리 발생기 → YIN 음높이 → 시간–음높이 그래프, 떨림 모양, 세기 막대
   - 음 보정: 녹음(최대 8초) 또는 예시 노래 → 가장 가까운 음계 음으로 옮김(TD-PSOLA) → 원래/고친 소리 듣기
   - 미션 6개. 마이크 없이도 모두 풀 수 있음(소리 발생기·예시 노래)
   - 마이크 소리는 기기 안에서만 계산. 저장·전송 없음
   계산: dsp.js (window.PitchDSP) · 계획: docs/pitch-lab-plan.md
   ================================================================ */
(function () {
  "use strict";

  const SK = window.SimKit, D = window.PitchDSP;
  const $ = (id) => document.getElementById(id);
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const ic = (name) => SK.icon(name);

  const SOLFA = ["도", "도♯", "레", "레♯", "미", "파", "파♯", "솔", "솔♯", "라", "라♯", "시"];
  const ABC = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const C4 = D.freqOf(60), C5 = D.freqOf(72), G4 = D.freqOf(67);
  const MAX_REC = 8;
  const COL = { primary: "#6d28d9", orig: "#ea580c", fix: "#2563eb", line: "#e4def3", faint: "#f1edf8", text: "#1f1a2e", muted: "#6b6382", ok: "#15803d", mid: "#a78bfa" };

  /* ═════════ 상태·저장 ═════════ */
  const SCALE_KEYS = ["chromatic", "major", "penta"];
  const cleanCfg = (r, d) => ({
    scale: SCALE_KEYS.includes(r.scale) ? r.scale : d.scale,
    strength: Number.isFinite(r.strength) ? clamp(Math.round(r.strength), 0, 100) : d.strength,
    speed: Number.isFinite(r.speed) ? clamp(Math.round(r.speed), 0, 200) : d.speed,
    shift: Number.isFinite(r.shift) ? clamp(Math.round(r.shift), -12, 12) : d.shift,
  });
  const DEF_CFG = { scale: "major", strength: 100, speed: 30, shift: 0 };
  const store = SK.store("pitch-lab:v1", {
    defaults: { progress: {}, names: "solfa", cfg: DEF_CFG },
    validate(raw, d) {
      if (!isObj(raw)) return null;
      return { progress: isObj(raw.progress) ? raw.progress : {}, names: raw.names === "abc" ? "abc" : "solfa", cfg: cleanCfg(isObj(raw.cfg) ? raw.cfg : {}, d.cfg) };
    },
  });
  const saved = store.load();
  const state = { mode: "live", names: saved.names, src: "off", genF: C4, genVol: 60 };
  // 음 보정 상황: 자유 탐험(fT)과 미션(mT)을 따로 둔다(미션이 내 녹음·설정을 덮지 않게)
  const fT = { cfg: Object.assign({}, saved.cfg), clip: null, fixed: null };
  const mT = { cfg: { scale: "major", strength: 0, speed: 100, shift: 0 }, clip: null, fixed: null };
  const tuneCtx = () => (state.mode === "mission" ? mT : fT);
  function persist() { store.save({ progress: saved.progress, names: state.names, cfg: fT.cfg }); }

  const noteName = (n) => (state.names === "abc" ? ABC[mod(n, 12)] + (Math.floor(n / 12) - 1) : SOLFA[mod(n, 12)]);
  const otherName = (n) => (state.names === "abc" ? SOLFA[mod(n, 12)] : ABC[mod(n, 12)] + (Math.floor(n / 12) - 1));

  /* ═════════ 소리 장치 ═════════ */
  let ac = null, an = null, anBuf = null, wave = null;
  let micStream = null, micNode = null, osc = null, oscGain = null;
  function audio() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) { SK.toast("이 브라우저는 소리 계산을 지원하지 않아요.", "no"); return null; }
      ac = new C();
      an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0;
      anBuf = new Float32Array(an.fftSize);
      const h = D.GEN_HARM;
      wave = ac.createPeriodicWave(new Float32Array(h.length), new Float32Array(h));
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  async function startMic() {
    if (micStream) return true;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      SK.toast("여기서는 마이크를 쓸 수 없어요. 소리 발생기로 해 보세요.", "no"); return false;
    }
    const a = audio(); if (!a) return false;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    } catch (e) {
      micStream = null;
      const n = e && e.name;
      SK.toast(n === "NotAllowedError" || n === "SecurityError" ? "마이크 사용이 막혀 있어요. 주소창 옆 설정에서 마이크를 허용하거나, 소리 발생기로 해 보세요."
        : n === "NotFoundError" ? "마이크를 찾지 못했어요. 소리 발생기로 해 보세요." : "마이크를 켜지 못했어요. 소리 발생기로 해 보세요.", "no");
      return false;
    }
    micNode = a.createMediaStreamSource(micStream);
    micNode.connect(an);
    return true;
  }
  function stopMic() {
    if (recording) stopRec(true);
    if (micNode) { try { micNode.disconnect(); } catch (e) { /* 이미 끊김 */ } micNode = null; }
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  }
  const genAmp = () => (state.genVol / 100) * 0.35;
  function startGen() {
    const a = audio(); if (!a || osc) return;
    osc = a.createOscillator(); osc.setPeriodicWave(wave); osc.frequency.value = state.genF;
    oscGain = a.createGain(); oscGain.gain.value = 0; oscGain.gain.setTargetAtTime(genAmp(), a.currentTime, 0.02);
    osc.connect(oscGain); oscGain.connect(an); oscGain.connect(a.destination);
    osc.start();
  }
  function stopGen() {
    if (!osc) return;
    const o = osc, g = oscGain; osc = null; oscGain = null;
    g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    setTimeout(() => { try { o.stop(); } catch (e) { /* 이미 멈춤 */ } o.disconnect(); g.disconnect(); }, 160);
  }
  function setGenF(f) {
    state.genF = clamp(f, 100, 1000);
    if (osc) osc.frequency.setTargetAtTime(state.genF, ac.currentTime, 0.012);
    syncGenUI();
  }
  function setGenVol(v) {
    state.genVol = clamp(v, 0, 100);
    if (oscGain) oscGain.gain.setTargetAtTime(genAmp(), ac.currentTime, 0.02);
    syncGenUI();
  }
  /** 짧은 소리 한 번 (미션 보기 소리) */
  function playTone(f, amp, dur) {
    const a = audio(); if (!a) return;
    stopPlay();
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.setPeriodicWave(wave); o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 0.4, t + 0.03);
    g.gain.setValueAtTime(amp * 0.4, t + dur - 0.08); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }

  /** 소리 고르기: off | mic | gen */
  async function setSource(src) {
    if (src === state.src) src = "off"; // 같은 버튼을 다시 누르면 끔
    stopPlay();
    if (state.src === "gen" && src !== "gen") stopGen();
    if (state.src === "mic" && src !== "mic") stopMic();
    state.src = "off";
    if (src === "mic") { if (await startMic()) state.src = "mic"; }
    if (src === "gen") { startGen(); if (osc) state.src = "gen"; }
    hist.length = 0; holdT = 0;
    syncSrcUI();
    dirty = true;
  }
  function syncSrcUI() {
    for (const b of document.querySelectorAll("[data-src]")) b.setAttribute("aria-pressed", b.dataset.src === state.src ? "true" : "false");
    $("genGroup").hidden = state.src !== "gen";
    $("srcHint").textContent = state.src === "gen" ? "높이 슬라이더를 움직여 보세요. 세기를 바꾸면 그래프의 높이는 그대로예요."
      : state.src === "mic" ? "\"아—\" 하고 길게 소리를 내 보세요. 높게, 낮게, 크게, 작게도 내 보세요."
      : "마이크를 켜고 \"아—\" 하고 길게 소리를 내 보세요. 마이크가 없으면 소리 발생기를 써요.";
    for (const g of document.querySelectorAll("[data-gen-only]")) g.hidden = state.src !== "gen";
  }

  /* ═════════ 실시간 분석 ═════════ */
  const hist = []; // { t, f, r }
  const live = { f: 0, r: 0, shown: 0 };
  let center = 64;
  function analyse(now) {
    an.getFloatTimeDomainData(anBuf);
    const r = D.rms(anBuf);
    let f = 0;
    if (r > 0.006) { const p = D.yin(anBuf, ac.sampleRate, { thr: 0.12 }); if (p && p.conf > 0.7) f = p.f; }
    live.f = f; live.r = r;
    hist.push({ t: now, f, r });
    while (hist.length && now - hist[0].t > 9) hist.shift();
    // 표시용 음높이: 최근 0.15초 유성음 중앙값(바늘이 덜 떨림)
    const rec = [];
    for (let i = hist.length - 1; i >= 0 && now - hist[i].t < 0.15; i--) if (hist[i].f) rec.push(hist[i].f);
    rec.sort((a, b) => a - b);
    live.shown = rec.length ? rec[rec.length >> 1] : 0;
  }
  function follow(now, dt) {
    const ms = [];
    for (let i = hist.length - 1; i >= 0 && now - hist[i].t < 1.2; i--) if (hist[i].f) ms.push(D.midiOf(hist[i].f));
    let goal = null;
    if (ms.length > 4) { ms.sort((a, b) => a - b); goal = ms[ms.length >> 1]; }
    else if (state.src === "gen") goal = D.midiOf(state.genF);
    if (goal === null) return;
    goal = clamp(goal, 42, 86);
    const k = Math.abs(goal - center) > 6 ? 3 : 0.8;
    center += (goal - center) * Math.min(1, dt * k);
  }

  /* ═════════ 그리기 ═════════ */
  const cv = $("cv"), g = cv.getContext("2d"), scene = $("scene");
  let W = 0, H = 0, dirty = true;
  function fit() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    W = r.width; H = r.height;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const TOP = 56, LEFT = 50;
  function font(px, w) { g.font = (w || 700) + " " + px + "px -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', sans-serif"; }
  /** 음 줄. 반환: midi → y */
  function noteGrid(x0, x1, y0, y1, lo, hi, opt) {
    opt = opt || {};
    const yOf = (m) => y1 - ((m - lo) / (hi - lo)) * (y1 - y0);
    const set = D.SCALES[opt.scale || "major"];
    const step = (y1 - y0) / (hi - lo);
    font(step < 13 ? 11 : 12.5); g.textBaseline = "middle"; g.textAlign = "right";
    for (let n = Math.ceil(lo); n <= Math.floor(hi); n++) {
      const pc = mod(n, 12), y = yOf(n), inS = set.indexOf(pc) >= 0;
      if (opt.target != null && pc === opt.target) {
        g.fillStyle = "rgba(21,128,61,.16)"; g.fillRect(x0, yOf(n + 0.4), x1 - x0, yOf(n - 0.4) - yOf(n + 0.4));
      }
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y);
      g.setLineDash(inS ? [] : [3, 4]);
      g.strokeStyle = n === 60 ? COL.mid : inS ? COL.line : COL.faint; g.lineWidth = n === 60 ? 2 : 1;
      g.stroke(); g.setLineDash([]);
      if (inS && (step >= 9 || pc === 0)) { g.fillStyle = n === 60 ? COL.primary : opt.target === pc ? COL.ok : COL.muted; g.fillText(noteName(n), x0 - 6, y); }
      if (n === 60) { g.textAlign = "left"; font(11); g.fillStyle = COL.primary; g.fillText(state.names === "abc" ? "가운데 도" : "가운데 도", x0 + 4, y - 8); g.textAlign = "right"; font(step < 13 ? 11 : 12.5); }
    }
    return yOf;
  }
  function curve(pts, color, width) {
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = "round"; g.lineCap = "round";
    let on = false;
    g.beginPath();
    for (const p of pts) {
      if (p === null) { on = false; continue; }
      if (!on) { g.moveTo(p[0], p[1]); on = true; } else g.lineTo(p[0], p[1]);
    }
    g.stroke();
  }
  function msg(text) { const m = $("sceneMsg"); m.hidden = !text; m.textContent = text || ""; }

  function view() {
    if (state.mode === "live") return "live";
    if (state.mode === "tune") return "clip";
    return cur ? cur.def.view : "live";
  }
  function draw(now) {
    fit();
    g.clearRect(0, 0, W, H);
    const v = view();
    $("readout").hidden = v !== "live";
    $("legend").hidden = v !== "clip" || !tuneCtx().clip || recording;
    if (v === "live") drawLive(now);
    else if (v === "clip") drawClip(now);
    else drawWaves();
  }

  function drawLive(now) {
    const stripH = clamp(H * 0.22, 64, 150);
    const x0 = LEFT, x1 = W - 12, y0 = TOP, y1 = H - stripH - 26;
    const span = H < 420 ? 7 : 10;
    const lo = center - span, hi = center + span;
    const tgt = cur && cur.def.target != null && state.mode === "mission" ? cur.def.target : null;
    const yOf = noteGrid(x0, x1, y0, y1, lo, hi, { scale: "major", target: tgt });
    const SPAN_T = 8;
    // 시간 눈금
    font(11); g.fillStyle = COL.muted; g.textAlign = "center"; g.textBaseline = "top";
    for (let s = 0; s <= SPAN_T; s += 2) { const x = x1 - (s / SPAN_T) * (x1 - x0); g.textAlign = s === 0 ? "right" : s === SPAN_T ? "left" : "center"; g.fillText(s === 0 ? "지금" : s + "초 전", x, y1 + 4); }
    // 음높이 곡선
    g.save(); g.beginPath(); g.rect(x0, y0 - 2, x1 - x0, y1 - y0 + 4); g.clip();
    const pts = []; let prev = null;
    for (const h of hist) {
      if (now - h.t > SPAN_T) continue;
      if (!h.f) { pts.push(null); prev = null; continue; }
      const m = D.midiOf(h.f), x = x1 - ((now - h.t) / SPAN_T) * (x1 - x0), y = yOf(m);
      if (prev && (h.t - prev.t > 0.12 || Math.abs(m - prev.m) > 2.5)) pts.push(null);
      pts.push([x, y]); prev = { t: h.t, m };
    }
    curve(pts, COL.primary, 4);
    if (live.shown) { g.fillStyle = COL.primary; g.beginPath(); g.arc(x1, yOf(D.midiOf(live.shown)), 7, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // 떨림 모양 띠
    const sy0 = H - stripH - 4, sy1 = H - 8, sx0 = 12, sx1 = W - 52;
    g.fillStyle = "#faf8ff"; g.strokeStyle = COL.line; g.lineWidth = 1;
    g.beginPath(); g.roundRect ? g.roundRect(sx0, sy0, W - 24, sy1 - sy0, 10) : g.rect(sx0, sy0, W - 24, sy1 - sy0); g.fill(); g.stroke();
    font(11.5); g.fillStyle = COL.muted; g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("떨림 모양 (0.02초 동안)", sx0 + 8, sy0 + 5);
    const mid = (sy0 + sy1) / 2 + 6, amp = (sy1 - sy0) / 2 - 12;
    g.beginPath(); g.moveTo(sx0 + 8, mid); g.lineTo(sx1, mid); g.strokeStyle = COL.line; g.stroke();
    if (an && state.src !== "off") {
      const sr = ac.sampleRate, n = Math.round(sr * 0.02);
      let st = 0;
      for (let i = 1; i < anBuf.length - n; i++) if (anBuf[i - 1] <= 0 && anBuf[i] > 0) { st = i; break; }
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = sx0 + 8 + (i / (n - 1)) * (sx1 - sx0 - 8), y = mid - clamp(anBuf[st + i] * 1.6, -1, 1) * amp;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.strokeStyle = COL.fix; g.lineWidth = 2; g.stroke();
    }
    // 세기 막대
    const bx = W - 40, bw = 18, by0 = sy0 + 20, by1 = sy1 - 6;
    const lv = live.r > 0 ? clamp((20 * Math.log10(live.r) + 50) / 46, 0, 1) : 0;
    g.fillStyle = COL.faint; g.fillRect(bx, by0, bw, by1 - by0);
    g.fillStyle = lv > 0.85 ? COL.orig : COL.ok; g.fillRect(bx, by1 - lv * (by1 - by0), bw, lv * (by1 - by0));
    font(11); g.fillStyle = COL.muted; g.textAlign = "center"; g.fillText("세기", bx + bw / 2, sy0 + 5);
    msg(state.src === "off" ? (state.mode === "mission" && cur && cur.def.id === "m4" ? "조작판에서 ‘소리 발생기’를 켜 보세요." : "조작판에서 ‘마이크’나 ‘소리 발생기’를 켜 보세요.") : "");
    readout();
  }
  let lastRo = "";
  function readout() {
    const f = live.shown;
    let key = f ? Math.round(f) + "|" + Math.round(D.midiOf(f) * 10) + state.names : "-" + state.src;
    if (key === lastRo) return; lastRo = key;
    const note = $("roNote"), hz = $("roHz"), nd = $("roNeedle"), tu = $("roTune");
    if (!f) {
      note.textContent = "—"; nd.style.left = "50%"; tu.textContent = " ";
      hz.textContent = state.src === "off" ? "소리를 켜 보세요" : "소리를 내 보세요";
      return;
    }
    const m = D.midiOf(f), n = Math.round(m), c = (m - n) * 100;
    note.textContent = noteName(n);
    const sm = document.createElement("small"); sm.textContent = otherName(n); note.appendChild(sm);
    hz.textContent = Math.round(f) + " Hz · 1초에 " + Math.round(f) + "번 떨려요";
    nd.style.left = (50 + clamp(c, -50, 50)) + "%";
    tu.textContent = Math.abs(c) <= 10 ? "딱 맞아요" : c < 0 ? "조금 낮아요 (" + Math.round(c) + ")" : "조금 높아요 (+" + Math.round(c) + ")";
  }

  function drawClip(now) {
    const c = tuneCtx();
    const x0 = LEFT, x1 = W - 14, y0 = TOP, y1 = H - 58;
    if (recording) {
      const span = 10, lo = center - span, hi = center + span;
      const yOf = noteGrid(x0, x1, y0, y1, lo, hi, { scale: c.cfg.scale });
      const pts = []; let prev = null;
      for (const h of hist) {
        if (h.t < recT0) continue;
        if (!h.f) { pts.push(null); prev = null; continue; }
        const m = D.midiOf(h.f), x = x0 + ((h.t - recT0) / MAX_REC) * (x1 - x0);
        if (prev && Math.abs(m - prev) > 2.5) pts.push(null);
        pts.push([x, yOf(m)]); prev = m;
      }
      g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); curve(pts, COL.orig, 3.5); g.restore();
      const px = x0 + clamp((now - recT0) / MAX_REC, 0, 1) * (x1 - x0);
      g.strokeStyle = COL.orig; g.lineWidth = 2; g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y1); g.stroke();
      timeAxis(x0, x1, y1, MAX_REC);
      msg("");
      return;
    }
    if (!c.clip) {
      noteGrid(x0, x1, y0, y1, 57, 76, { scale: c.cfg.scale });
      msg(state.mode === "mission" ? "예시 노래를 준비하고 있어요…" : "‘녹음하기’로 노래를 녹음하거나\n‘예시 노래’를 불러오세요.");
      return;
    }
    msg("");
    const tr = c.clip.tr, tgt = c.fixed ? c.fixed.target : null;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < tr.f.length; i++) {
      if (tr.f[i]) { const m = D.midiOf(tr.f[i]); mn = Math.min(mn, m); mx = Math.max(mx, m); }
      if (tgt && tgt[i]) { const m = D.midiOf(tgt[i]); mn = Math.min(mn, m); mx = Math.max(mx, m); }
    }
    if (!Number.isFinite(mn)) { mn = 60; mx = 72; }
    let lo = Math.floor(mn) - 2, hi = Math.ceil(mx) + 2;
    const minSpan = H < 420 ? 10 : 14;
    if (hi - lo < minSpan) { const cc = (lo + hi) / 2; lo = cc - minSpan / 2; hi = cc + minSpan / 2; }
    const yOf = noteGrid(x0, x1, y0, y1, lo, hi, { scale: c.cfg.scale });
    const dur = c.clip.dur, hopT = tr.hop / tr.sr;
    const xOf = (i) => x0 + ((i * hopT) / dur) * (x1 - x0);
    const pathOf = (arr) => {
      const pts = []; let pm = null;
      for (let i = 0; i < arr.length; i++) {
        if (!arr[i]) { pts.push(null); pm = null; continue; }
        const m = D.midiOf(arr[i]);
        if (pm !== null && Math.abs(m - pm) > 2.5) pts.push(null);
        pts.push([xOf(i), yOf(m)]); pm = m;
      }
      return pts;
    };
    g.save(); g.beginPath(); g.rect(x0, y0 - 2, x1 - x0, y1 - y0 + 4); g.clip();
    g.globalAlpha = tgt ? 0.75 : 1; curve(pathOf(tr.f), COL.orig, 3.5); g.globalAlpha = 1;
    if (tgt) curve(pathOf(tgt), COL.fix, 3.5);
    g.restore();
    timeAxis(x0, x1, y1, dur);
    if (player) {
      const t = clamp(ac.currentTime - player.t0, 0, player.dur);
      const px = x0 + (t / dur) * (x1 - x0);
      g.strokeStyle = player.which === "orig" ? COL.orig : COL.fix; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y1); g.stroke();
    }
  }
  function timeAxis(x0, x1, y1, dur) {
    font(11); g.fillStyle = COL.muted; g.textAlign = "center"; g.textBaseline = "top";
    for (let s = 0; s <= dur + 0.01; s += 1) g.fillText(s + "초", x0 + (s / dur) * (x1 - x0), y1 + 5);
  }

  function drawWaves() {
    const def = cur && cur.def;
    if (!def || !def.waves) return;
    if (!cur.answered) { msg("조작판의 소리 버튼을 눌러 들어 보세요."); return; }
    msg("");
    const ws = def.waves, n = ws.length, x0 = 16, x1 = W - 16, top = TOP, bot = H - 16;
    const ph = (bot - top) / n;
    const H_ = D.GEN_HARM;
    let peak = 0; for (let k = 0; k < 400; k++) { let s = 0; for (let h = 1; h < H_.length; h++) s += H_[h] * Math.sin((h * 2 * Math.PI * k) / 400); peak = Math.max(peak, Math.abs(s)); }
    ws.forEach((w, i) => {
      const py0 = top + i * ph + 6, py1 = top + (i + 1) * ph - 6, mid = (py0 + py1) / 2 + 8, amp = (py1 - py0) / 2 - 14;
      g.fillStyle = "#faf8ff"; g.strokeStyle = COL.line; g.lineWidth = 1;
      g.beginPath(); g.roundRect ? g.roundRect(x0, py0, x1 - x0, py1 - py0, 12) : g.rect(x0, py0, x1 - x0, py1 - py0); g.fill(); g.stroke();
      font(13.5, 800); g.fillStyle = COL.text; g.textAlign = "left"; g.textBaseline = "top";
      g.fillText(w.label, x0 + 10, py0 + 7);
      font(12.5); g.fillStyle = COL.muted; g.textAlign = "right";
      g.fillText("0.02초 동안 " + (Math.round(w.f * 0.02 * 10) / 10) + "번 떨려요", x1 - 10, py0 + 8);
      g.beginPath(); g.moveTo(x0 + 10, mid); g.lineTo(x1 - 10, mid); g.strokeStyle = COL.line; g.stroke();
      g.beginPath();
      const N = 600;
      for (let k = 0; k <= N; k++) {
        const t = (k / N) * 0.02; let s = 0;
        for (let h = 1; h < H_.length; h++) s += H_[h] * Math.sin(2 * Math.PI * w.f * h * t);
        const x = x0 + 10 + (k / N) * (x1 - x0 - 20), y = mid - (s / peak) * w.a * amp;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.strokeStyle = i ? COL.fix : COL.orig; g.lineWidth = 2.2; g.stroke();
    });
  }

  /* ═════════ 소리 발생기 조작 ═════════ */
  const centsOf = (f) => 1200 * Math.log2(f / 100);
  function genControls(box, opt) {
    opt = opt || {};
    const wrap = document.createElement("div");
    const val = document.createElement("div"); val.className = "big-val gen-val"; val.style.marginBottom = "4px";
    const row = document.createElement("div"); row.className = "slider-row";
    const m = document.createElement("button"); m.type = "button"; m.className = "sq"; m.textContent = "−반음"; m.setAttribute("aria-label", "반음 낮게");
    const r = document.createElement("input"); r.type = "range"; r.min = 0; r.max = 3986; r.step = 1; r.className = "gen-f"; r.setAttribute("aria-label", "높이");
    const p = document.createElement("button"); p.type = "button"; p.className = "sq"; p.textContent = "+반음"; p.setAttribute("aria-label", "반음 높게");
    m.addEventListener("click", () => setGenF(state.genF / Math.pow(2, 1 / 12)));
    p.addEventListener("click", () => setGenF(state.genF * Math.pow(2, 1 / 12)));
    r.addEventListener("input", () => setGenF(100 * Math.pow(2, Number(r.value) / 1200)));
    row.append(m, r, p);
    const vr = document.createElement("div"); vr.className = "slider-row lab";
    const vl = document.createElement("span"); vl.className = "lbl"; vl.textContent = "세기";
    const vi = document.createElement("input"); vi.type = "range"; vi.min = 0; vi.max = 100; vi.step = 1; vi.className = "gen-v"; vi.setAttribute("aria-label", "세기");
    const vv = document.createElement("span"); vv.className = "val gen-vv";
    vi.addEventListener("input", () => setGenVol(Number(vi.value)));
    vr.append(vl, vi, vv);
    wrap.append(val, row, vr);
    if (opt.notes) {
      const nb = document.createElement("div"); nb.className = "notes";
      [60, 62, 64, 65, 67, 69, 71, 72].forEach((n) => {
        const b = document.createElement("button"); b.type = "button"; b.dataset.midi = n; b.className = "note-btn";
        b.addEventListener("click", () => setGenF(D.freqOf(n)));
        nb.appendChild(b);
      });
      wrap.appendChild(nb);
    }
    box.appendChild(wrap);
    syncGenUI();
  }
  function syncGenUI() {
    const m = D.midiOf(state.genF), n = Math.round(m), off = Math.round((m - n) * 100);
    const txt = Math.round(state.genF) + " Hz · " + noteName(n) + (Math.abs(off) > 4 ? (off > 0 ? " +" : " ") + off : "");
    for (const e of document.querySelectorAll(".gen-val")) e.textContent = txt;
    for (const e of document.querySelectorAll("input.gen-f")) e.value = Math.round(centsOf(state.genF));
    for (const e of document.querySelectorAll("input.gen-v")) e.value = state.genVol;
    for (const e of document.querySelectorAll(".gen-vv")) e.textContent = state.genVol + "%";
    for (const b of document.querySelectorAll(".note-btn")) b.textContent = noteName(Number(b.dataset.midi)) + (Number(b.dataset.midi) === 72 && state.names !== "abc" ? "'" : "");
  }

  /* ═════════ 음 보정 ═════════ */
  const SCALE_LBL = { chromatic: "반음 모두", major: "도레미", penta: "도레미솔라" };
  const speedLbl = (ms) => (ms === 0 ? "즉시" : ms <= 40 ? "빠르게" : ms <= 110 ? "보통" : "천천히");
  function tuneControls(box, opt) {
    opt = opt || {};
    const c = tuneCtx();
    box.textContent = "";
    const t = document.createElement("div"); t.className = "group-title"; t.textContent = "고치는 방법"; box.appendChild(t);
    const chips = document.createElement("div"); chips.className = "chips"; chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "음계");
    SCALE_KEYS.forEach((k) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.scale = k; b.textContent = SCALE_LBL[k];
      b.setAttribute("aria-pressed", c.cfg.scale === k ? "true" : "false");
      b.addEventListener("click", () => { c.cfg.scale = k; for (const x of chips.children) x.setAttribute("aria-pressed", x === b ? "true" : "false"); changed(); });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    const slider = (label, min, max, get, set, fmt, aria) => {
      const row = document.createElement("div"); row.className = "slider-row lab"; row.style.marginTop = "8px";
      const l = document.createElement("span"); l.className = "lbl"; l.textContent = label;
      const r = document.createElement("input"); r.type = "range"; r.min = min; r.max = max; r.step = 1; r.value = get(); r.setAttribute("aria-label", aria || label);
      const v = document.createElement("span"); v.className = "val"; v.textContent = fmt(get());
      r.addEventListener("input", () => { set(Number(r.value)); v.textContent = fmt(get()); changed(); });
      row.append(l, r, v); box.appendChild(row);
    };
    slider("보정 세기", 0, 100, () => c.cfg.strength, (v) => { c.cfg.strength = v; }, (v) => v + "%");
    slider("고치는 속도", 0, 200, () => 200 - c.cfg.speed, (v) => { c.cfg.speed = 200 - v; }, () => speedLbl(c.cfg.speed));
    if (opt.shift !== false) slider("높이 옮기기", -12, 12, () => c.cfg.shift, (v) => { c.cfg.shift = v; }, (v) => (v > 0 ? "+" : "") + v + "반음", "높이 옮기기(반음)");
    const h = document.createElement("p"); h.className = "hint-text"; h.style.marginTop = "6px";
    h.textContent = "보정 세기 100%에 속도 ‘즉시’면 음이 계단처럼 딱딱 바뀌어 로봇 목소리처럼 들려요. 높이 옮기기 12반음 = 한 옥타브.";
    if (opt.shift === false) h.textContent = "보정 세기를 높이고 속도를 빠르게 할수록 파란 곡선이 음 줄에 더 딱 붙어요.";
    box.appendChild(h);
  }
  let procTimer = 0;
  function changed() {
    if (tuneCtx() === fT) persist();
    clearTimeout(procTimer);
    procTimer = setTimeout(() => { process(tuneCtx()); }, 90);
  }
  function process(c) {
    if (!c.clip) { c.fixed = null; syncTuneUI(); return; }
    const p = D.plan(c.clip.tr, { scale: c.cfg.scale, strength: c.cfg.strength / 100, speed: c.cfg.speed, shift: c.cfg.shift });
    const y = D.psola(c.clip.x, c.clip.tr, p.ratio);
    c.fixed = { y, target: p.target, err: D.meanError(p.target, c.cfg.scale), err0: D.meanError(c.clip.tr.f, c.cfg.scale) };
    if (player && player.which === "fix") stopPlay();
    syncTuneUI();
    dirty = true;
  }
  function syncTuneUI() {
    const c = tuneCtx();
    for (const b of document.querySelectorAll("[data-play]")) {
      const has = b.dataset.play === "orig" ? !!c.clip : !!c.fixed;
      b.disabled = !has || recording;
      const on = player && player.which === b.dataset.play;
      b.innerHTML = ic(on ? "pause" : "play") + (on ? "멈춤" : b.dataset.play === "orig" ? "원래 소리" : "고친 소리");
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    for (const e of document.querySelectorAll("[data-err]")) {
      if (!c.fixed) { e.hidden = true; continue; }
      e.hidden = false; e.textContent = "";
      if (c.cfg.shift) { e.textContent = "높이를 " + Math.abs(c.cfg.shift) + "반음 " + (c.cfg.shift > 0 ? "올렸어요." : "내렸어요.") + " (빠르기는 그대로)"; continue; }
      const b1 = document.createElement("b"); b1.textContent = Math.round(c.fixed.err0) + "센트";
      const b2 = document.createElement("b"); b2.textContent = Math.round(c.fixed.err) + "센트";
      e.append("음 줄에서 벗어난 정도: 원래 ", b1, " → 고친 뒤 ", b2);
      const s = document.createElement("div"); s.className = "hint-text"; s.textContent = "100센트 = 반음 하나. 0에 가까울수록 음이 딱 맞아요.";
      e.appendChild(s);
    }
    const st = $("tState");
    if (st && !recording) {
      const fc = fT.clip;
      st.textContent = fc ? (fc.src === "demo" ? "예시 노래 ‘학교 종’ (" : "내 녹음 (") + fc.dur.toFixed(1) + "초)" : "녹음하거나 예시 노래를 불러오세요.";
    }
    const rb = $("tRec");
    rb.innerHTML = recording ? ic("pause") + "녹음 멈추기" : ic("mic") + "녹음하기 (8초)";
    $("tDemo").disabled = recording;
  }

  let demoClip = null;
  function getDemo() {
    if (!demoClip) {
      const sr = 48000, x = D.demoSong(sr);
      demoClip = { x, sr, tr: D.track(x, sr), dur: x.length / sr, src: "demo" };
    }
    return demoClip;
  }
  function loadDemo(c, done) {
    msg("예시 노래를 만드는 중…");
    setTimeout(() => { c.clip = getDemo(); process(c); if (done) done(); }, 30);
  }

  /* 녹음: 마이크 → ScriptProcessor (메모리에만) */
  let recording = false, recT0 = 0, recNode = null, recSink = null, recChunks = [];
  async function startRec() {
    if (recording) return;
    stopPlay();
    if (state.src === "gen") stopGen();
    if (state.src !== "mic") { state.src = "off"; if (!(await startMic())) { syncSrcUI(); return; } state.src = "mic"; }
    const a = audio();
    recChunks = [];
    recNode = a.createScriptProcessor(4096, 1, 1);
    recSink = a.createGain(); recSink.gain.value = 0;
    recNode.onaudioprocess = (e) => { if (recording) recChunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    micNode.connect(recNode); recNode.connect(recSink); recSink.connect(a.destination);
    recording = true; recT0 = performance.now() / 1000; hist.length = 0;
    syncTuneUI(); dirty = true;
  }
  function stopRec(silent) {
    if (!recording) return;
    recording = false;
    try { micNode && micNode.disconnect(recNode); } catch (e) { /* 이미 끊김 */ }
    if (recNode) { recNode.onaudioprocess = null; recNode.disconnect(); recNode = null; }
    if (recSink) { recSink.disconnect(); recSink = null; }
    const sr = ac.sampleRate;
    let n = 0; for (const c of recChunks) n += c.length;
    const x = new Float32Array(n); let o = 0; for (const c of recChunks) { x.set(c, o); o += c.length; }
    recChunks = [];
    if (silent) { syncTuneUI(); return; }
    setTimeout(() => {
      // 마이크는 녹음이 끝나면 끈다(녹음 중 표시가 계속 뜨지 않게)
      if (state.mode === "tune") { stopMic(); state.src = "off"; syncSrcUI(); }
      const clip = makeClip(x, sr);
      if (!clip) { SK.toast("소리가 잘 들리지 않았어요. 마이크에 가까이 대고 다시 녹음해 보세요.", "no"); syncTuneUI(); dirty = true; return; }
      fT.clip = clip; process(fT);
      let v = 0; for (const f of clip.tr.f) if (f) v++;
      if (v < 20) SK.toast("음높이를 찾은 곳이 적어요. ‘아—’ 하고 길게 노래해 보세요.", "warn");
    }, 20);
    syncTuneUI();
  }
  function makeClip(x, sr) {
    let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
    if (pk < 0.01) return null;
    const gate = pk * 0.05, pad = Math.round(sr * 0.12);
    let a = 0, b = x.length - 1;
    while (a < b && Math.abs(x[a]) < gate) a++;
    while (b > a && Math.abs(x[b]) < gate) b--;
    a = Math.max(0, a - pad); b = Math.min(x.length, b + pad);
    if ((b - a) / sr < 0.4) return null;
    const y = x.slice(a, b), gain = Math.min(8, 0.8 / pk);
    for (let i = 0; i < y.length; i++) y[i] *= gain;
    return { x: y, sr, tr: D.track(y, sr), dur: y.length / sr, src: "rec" };
  }

  /* 듣기 */
  let player = null;
  function play(which) {
    const c = tuneCtx();
    if (player && player.which === which) { stopPlay(); return; }
    stopPlay();
    const data = which === "orig" ? c.clip && c.clip.x : c.fixed && c.fixed.y;
    if (!data) return;
    if (state.src === "gen") { stopGen(); state.src = "off"; syncSrcUI(); }
    const a = audio(); if (!a) return;
    const b = a.createBuffer(1, data.length, c.clip.sr); b.getChannelData(0).set(data);
    const s = a.createBufferSource(); s.buffer = b; s.connect(a.destination);
    s.onended = () => { if (player && player.node === s) { player = null; syncTuneUI(); dirty = true; } };
    s.start();
    player = { node: s, which, t0: a.currentTime, dur: data.length / c.clip.sr };
    syncTuneUI();
  }
  function stopPlay() {
    if (!player) return;
    const p = player; player = null;
    try { p.node.stop(); } catch (e) { /* 이미 멈춤 */ }
    syncTuneUI(); dirty = true;
  }

  /* 버튼 위임: [data-src] [data-play] */
  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-src]");
    if (s) { setSource(s.dataset.src); return; }
    const p = e.target.closest("[data-play]");
    if (p && !p.disabled) play(p.dataset.play);
  });
  $("tRec").addEventListener("click", () => { if (recording) stopRec(); else startRec(); });
  $("tDemo").addEventListener("click", () => { stopPlay(); loadDemo(fT); });

  /* ═════════ 모드 ═════════ */
  const tabs = SK.tabs(".mode-tab", { attr: "mode", initial: "live", onSelect: (v) => setMode(v) });
  function setMode(m) {
    if (recording) stopRec(true);
    stopPlay();
    if (state.src !== "off") setSource("off");
    if (state.mode === "mission" && m !== "mission" && mc) mc.stop();
    if (m !== "mission") cur = null;
    state.mode = m;
    tabs.select(m, { silent: true });
    $("paneLive").hidden = m !== "live";
    $("paneTune").hidden = m !== "tune";
    $("paneMission").hidden = m !== "mission";
    if (m === "tune") { tuneControls(document.querySelector("[data-tune-ctl]")); syncTuneUI(); }
    if (m === "mission") { mc.start(); }
    lastRo = ""; dirty = true;
  }
  for (const b of document.querySelectorAll("#names .chip")) {
    b.addEventListener("click", () => {
      state.names = b.dataset.names;
      for (const x of document.querySelectorAll("#names .chip")) x.setAttribute("aria-pressed", x === b ? "true" : "false");
      persist(); syncGenUI(); lastRo = ""; dirty = true;
    });
  }
  genControls(document.querySelector("[data-gen-ctl]"), { notes: true });

  /* ═════════ 미션 ═════════ */
  const fb = SK.feedback("#mFeedback");
  let mc = null, cur = null, holdT = 0;
  const btn = (icon, text, onClick, cls) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sk-btn" + (cls ? " " + cls : "");
    b.innerHTML = ic(icon) + text; b.addEventListener("click", onClick); return b;
  };
  const srcButtons = (withMic) => {
    const d = document.createElement("div"); d.className = "src-btns";
    if (withMic) { const m = btn("mic", "마이크", () => {}); m.dataset.src = "mic"; m.setAttribute("aria-pressed", "false"); d.appendChild(m); }
    const gb = btn("volume-2", "소리 발생기", () => {}); gb.dataset.src = "gen"; gb.setAttribute("aria-pressed", "false"); d.appendChild(gb);
    if (!withMic) d.style.gridTemplateColumns = "1fr";
    return d;
  };
  const MISSIONS = [
    { id: "m1", title: "더 높은 소리", view: "waves",
      q: "소리 ㉮와 ㉯를 들어 보세요. 어느 소리가 더 높나요?",
      controls(box) { const d = document.createElement("div"); d.className = "src-btns"; d.append(btn("volume-2", "㉮ 듣기", () => playTone(C4, 0.8, 1)), btn("volume-2", "㉯ 듣기", () => playTone(C5, 0.8, 1))); box.appendChild(d); },
      opts: ["㉮가 더 높아요", "㉯가 더 높아요", "둘이 같아요"], answer: 1,
      waves: [{ f: C4, a: 0.7, label: "㉮ 도 (262Hz)" }, { f: C5, a: 0.7, label: "㉯ 높은 도 (523Hz)" }],
      explain: "무대의 떨림 모양을 보세요. ㉯는 같은 시간 동안 두 배 더 많이 떨려요. 빠르게 떨릴수록 높은 소리예요." },
    { id: "m2", title: "목소리로 ‘솔’ 내기", view: "live", target: 7, auto: true,
      q: "마이크(또는 소리 발생기)로 ‘솔’ 소리를 내서 그래프의 초록 띠 안에 1초 동안 머물러요. 어느 높이의 솔이든 괜찮아요.",
      controls(box) {
        box.appendChild(srcButtons(true));
        box.appendChild(btn("volume-2", "솔 소리 들어 보기", () => playTone(G4, 0.7, 1.2), "sk-btn--sm"));
        const gw = document.createElement("div"); gw.dataset.genOnly = ""; gw.hidden = true; genControls(gw, { notes: false }); box.appendChild(gw);
        const hl = document.createElement("div"); hl.className = "hint-text"; hl.textContent = "머문 시간"; box.appendChild(hl);
        const h = document.createElement("div"); h.className = "hold"; h.innerHTML = "<i id=\"mHold\"></i>"; box.appendChild(h);
      },
      setup() { state.genF = C4; holdT = 0; } },
    { id: "m3", title: "크게 내면 높아질까?", view: "waves",
      q: "같은 ‘솔’ 소리를 작게, 크게 들어 보세요. 소리를 더 크게 내면 어떻게 될까요?",
      controls(box) { const d = document.createElement("div"); d.className = "src-btns"; d.append(btn("volume-2", "작은 솔", () => playTone(G4, 0.25, 1)), btn("volume-2", "큰 솔", () => playTone(G4, 1, 1))); box.appendChild(d); },
      opts: ["소리가 더 높아져요", "높이는 그대로이고 세기만 커져요", "소리가 더 낮아져요"], answer: 1,
      waves: [{ f: G4, a: 0.28, label: "작은 솔 (392Hz)" }, { f: G4, a: 0.95, label: "큰 솔 (392Hz)" }],
      explain: "큰 소리는 떨림의 폭(위아래)이 커요. 떨리는 빠르기(1초에 392번)는 같아서 높이는 그대로예요. 세기와 높낮이는 서로 달라요." },
    { id: "m4", title: "한 옥타브 위의 도", view: "live",
      q: "소리 발생기는 지금 도(262Hz)예요. 높이를 올려 한 옥타브 높은 ‘도’를 찾고 ‘확인하기’를 눌러요.",
      controls(box) { box.appendChild(srcButtons(false)); genControls(box, { notes: false }); },
      setup() { state.genF = C4; },
      check() {
        const c = 1200 * Math.log2(state.genF / C5);
        return { ok: Math.abs(c) <= 25, hint: c < 0 ? "아직 낮아요. 그래프에서 ‘도’ 줄을 하나 더 올라가 보세요." : "너무 높아요. 조금 내려 보세요.",
          msg: "한 옥타브 높은 도는 523Hz예요. 처음 도(262Hz)의 딱 2배! 1초에 떨리는 수가 2배가 되면 한 옥타브 높아져요.", reveal() { setGenF(C5); } };
      } },
    { id: "m5", title: "어긋난 음 고치기", view: "clip", tune: true,
      q: "예시 노래 ‘학교 종’의 음이 조금씩 어긋나 있어요. 음계를 ‘도레미’로 두고 보정 세기와 속도를 바꿔 파란 곡선이 음 줄에 딱 맞으면 ‘확인하기’를 눌러요.",
      controls(box) {
        const grp = document.createElement("div"); grp.className = "group"; box.appendChild(grp); tuneControls(grp, { shift: false });
        const d = document.createElement("div"); d.className = "src-btns";
        const o = btn("play", "원래 소리", () => {}); o.dataset.play = "orig";
        const f = btn("play", "고친 소리", () => {}, "sk-btn--primary"); f.dataset.play = "fix";
        d.append(o, f); box.appendChild(d);
        const e = document.createElement("div"); e.className = "err-box"; e.dataset.err = ""; e.hidden = true; box.appendChild(e);
      },
      setup() { Object.assign(mT.cfg, { scale: "major", strength: 0, speed: 120, shift: 0 }); mT.clip = null; mT.fixed = null; loadDemo(mT, () => syncTuneUI()); },
      check() {
        const er = mT.fixed ? D.meanError(mT.fixed.target, "major") : 99;
        const ok = mT.cfg.scale === "major" && er <= 12;
        return { ok, hint: mT.cfg.scale !== "major" ? "음계를 ‘도레미’로 바꿔 보세요. 이 노래는 도레미 음으로만 되어 있어요." : "아직 어긋난 곳이 있어요(" + Math.round(er) + "센트). 보정 세기를 올리고 속도를 빠르게 해 보세요.",
          msg: "파란 곡선이 음 줄에 맞았어요! 어긋난 음을 가장 가까운 도레미 음으로 옮긴 거예요. ‘고친 소리’를 들어 보세요.",
          reveal() { Object.assign(mT.cfg, { scale: "major", strength: 100, speed: 20 }); tuneControls(document.querySelector("#mControls .group"), { shift: false }); process(mT); } };
      } },
    { id: "m6", title: "오토튠의 원리", view: "clip", tune: true,
      q: "무대의 주황 곡선(원래 소리)과 파란 곡선(고친 소리)을 비교해 보세요. 오토튠(음 보정)은 어떻게 음을 고칠까요?",
      controls(box) {
        const d = document.createElement("div"); d.className = "src-btns";
        const o = btn("play", "원래 소리", () => {}); o.dataset.play = "orig";
        const f = btn("play", "고친 소리", () => {}, "sk-btn--primary"); f.dataset.play = "fix";
        d.append(o, f); box.appendChild(d);
      },
      setup() { Object.assign(mT.cfg, { scale: "major", strength: 100, speed: 20, shift: 0 }); mT.clip = null; mT.fixed = null; loadDemo(mT, () => syncTuneUI()); },
      opts: ["소리의 높이를 재서 가장 가까운 음 높이로 옮겨요", "소리를 더 크게 만들어요", "노래를 더 빠르게 만들어요"], answer: 0,
      explain: "곡선의 길이(빠르기)와 소리 크기는 그대로이고, 높이만 가장 가까운 음 줄로 옮겨졌어요." },
  ];

  function buildMissions() {
    mc = SK.missions({
      ids: MISSIONS.map((m) => m.id), format: "full", progress: saved.progress || {}, keepBest: true, nav: "#missionNav", feedback: fb,
      onEnter: (i) => enterMission(i),
      onLeave: () => { stopPlay(); if (state.src !== "off") setSource("off"); },
      onChange: (p) => { saved.progress = p; persist(); },
      onAllDone: () => { $("mResult").hidden = false; },
      onFinish: () => showResult(),
    });
  }
  function enterMission(i) {
    const def = MISSIONS[i];
    cur = { i, def, attempt: 0, answered: false };
    holdT = 0;
    if (def.setup) def.setup();
    $("mTitle").textContent = "미션 " + (i + 1) + " · " + def.title;
    $("mQ").textContent = def.q;
    fb.hide();
    $("mNextMission").hidden = true;
    $("mResult").hidden = !mc.allDone();
    const ctr = $("mControls"); ctr.textContent = "";
    if (def.controls) def.controls(ctr);
    syncSrcUI(); syncGenUI(); syncTuneUI();
    const ab = $("mAnswer"); ab.textContent = "";
    if (def.opts) {
      const gr = document.createElement("div"); gr.className = "opts";
      def.opts.forEach((t, ix) => { const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = t; b.addEventListener("click", () => answerOpt(ix, b)); gr.appendChild(b); });
      ab.appendChild(gr);
    }
    $("mCheck").hidden = !!def.opts || !!def.auto;
    center = 64; hist.length = 0; lastRo = "";
    dirty = true;
  }
  function finish(stars, text, tone) {
    cur.answered = true;
    mc.complete({ stars, message: text + "  — 미션 완료! " + SK.stars.text(stars, 3), tone });
    if (SK.sound) SK.sound.play(stars === 3 ? "star" : "done");
    if (mc.current() < MISSIONS.length - 1 || mc.firstIncomplete() >= 0) { $("mNextMission").hidden = false; $("mNextMission").focus(); }
    $("mResult").hidden = !mc.allDone();
    $("mCheck").hidden = true;
    dirty = true;
  }
  const starsFor = (a) => (a === 0 ? 3 : a === 1 ? 2 : 1);
  function answerOpt(ix, b) {
    if (!cur || cur.answered) return;
    const def = cur.def, all = $("mAnswer").querySelectorAll(".opt");
    if (ix === def.answer) {
      b.classList.add("right"); for (const x of all) x.disabled = true;
      finish(starsFor(cur.attempt), "맞았어요! " + def.explain, "ok");
      return;
    }
    b.classList.add("wrong"); b.disabled = true; cur.attempt++;
    if (SK.sound) SK.sound.play("wrong");
    if (cur.attempt === 1) { fb.show("warn", "다시 생각해 볼까요? 소리를 한 번 더 들어 보세요."); return; }
    all[def.answer].classList.add("right"); for (const x of all) x.disabled = true;
    finish(1, "정답은 ‘" + def.opts[def.answer] + "’. " + def.explain, "warn");
  }
  $("mCheck").addEventListener("click", () => {
    if (!cur || cur.answered || !cur.def.check) return;
    const r = cur.def.check();
    if (r.ok) { finish(starsFor(cur.attempt), "맞았어요! " + r.msg, "ok"); return; }
    cur.attempt++;
    if (SK.sound) SK.sound.play("wrong");
    if (cur.attempt < 3) { fb.show("warn", r.hint); return; }
    r.reveal();
    finish(1, r.msg, "warn");
  });
  function missionTick(dt) {
    if (!cur || cur.answered || cur.def.id !== "m2") return;
    const f = live.shown;
    let inBand = false;
    if (f) { const m = D.midiOf(f), c = (m - Math.round(m)) * 100; inBand = mod(Math.round(m), 12) === 7 && Math.abs(c) <= 40; }
    holdT = inBand ? holdT + dt : Math.max(0, holdT - dt * 0.6);
    const h = $("mHold"); if (h) h.style.width = Math.min(100, holdT * 100) + "%";
    if (holdT >= 1) {
      const how = state.src === "mic" ? "목소리로" : "소리 발생기로";
      finish(3, how + " 솔을 냈어요! 이 솔은 1초에 약 " + Math.round(f) + "번 떨리는 소리(" + Math.round(f) + "Hz)예요. 한 옥타브 높은 솔은 그 2배로 떨려요.", "ok");
      setSource("off");
    }
  }
  $("mNextMission").addEventListener("click", () => { const c = mc.current(); if (c < MISSIONS.length - 1) mc.go(c + 1); else { const n = mc.firstIncomplete(); if (n >= 0) mc.go(n); else showResult(); } });
  $("mResult").addEventListener("click", showResult);
  $("mExit").addEventListener("click", () => setMode("live"));

  /* ═════════ 결과 ═════════ */
  const screens = SK.screens({});
  function showResult() {
    stopPlay(); if (state.src !== "off") setSource("off");
    if (mc) mc.stop();
    lp.stop();
    const grid = $("resultGrid"); grid.textContent = "";
    let tot = 0;
    MISSIONS.forEach((M, i) => {
      const s = mc.starsOf(i); tot += s;
      const c = document.createElement("div"); c.className = "result-cell"; c.setAttribute("role", "listitem");
      const a = document.createElement("span"); a.textContent = (i + 1) + ". " + M.title;
      const b = document.createElement("span"); b.className = "stars"; b.textContent = SK.stars.text(s, 3, "—"); b.setAttribute("aria-label", "별 3개 중 " + s + "개");
      c.append(a, b); grid.appendChild(c);
    });
    $("resultSub").textContent = "별 " + tot + " / " + MISSIONS.length * 3;
    screens.show("screenResult");
  }
  $("btnRetry").addEventListener("click", () => { screens.show("screenMain"); lp.start(); setMode("mission"); mc.go(0); });
  $("btnToLive").addEventListener("click", () => { screens.show("screenMain"); lp.start(); setMode("live"); });

  /* ═════════ 반복 ═════════ */
  const lp = SK.loop((dt) => {
    const now = performance.now() / 1000;
    if (an && (state.src !== "off" || recording)) analyse(now); else { live.f = 0; live.r = 0; live.shown = 0; }
    follow(now, dt);
    if (recording) {
      const el = now - recT0;
      const st = $("tState"); if (st) st.textContent = "녹음 중… " + el.toFixed(1) + " / " + MAX_REC + "초 (노래를 불러 보세요)";
      if (el >= MAX_REC) stopRec();
    }
    if (state.mode === "mission") missionTick(dt);
    if (dirty || state.src !== "off" || player || recording) { draw(now); dirty = false; }
  });
  if (window.ResizeObserver) new ResizeObserver(() => { dirty = true; }).observe(scene);

  /* ═════════ 공유·시작 ═════════ */
  SK.share.bind(() => ({ v: 1, mode: state.mode === "mission" ? "live" : state.mode, cfg: fT.cfg }), { title: "음높이 실험실" });
  let opened = false, startMode = "live";
  (function readShare() {
    const p = SK.share.read({ version: 1 });
    if (!p) return;
    if (p.mode === "tune" || p.mode === "live") startMode = p.mode;
    if (isObj(p.cfg)) fT.cfg = cleanCfg(p.cfg, DEF_CFG);
    opened = true;
  })();
  for (const x of document.querySelectorAll("#names .chip")) x.setAttribute("aria-pressed", x.dataset.names === state.names ? "true" : "false");
  function start() { screens.show("screenMain"); lp.start(); setMode(startMode); syncSrcUI(); }
  $("btnStart").addEventListener("click", start);
  buildMissions();
  if (opened) start();
})();
