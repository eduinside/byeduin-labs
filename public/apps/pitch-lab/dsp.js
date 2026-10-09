/* ================================================================
   음높이 실험실 — 소리 계산 (pitch-lab/dsp.js)
   - 음높이 찾기: YIN (de Cheveigné & Kawahara 2002) 차이 함수 + 누적 평균 정규화 + 포물선 보간
   - 음 보정: 프레임마다 가장 가까운 음계 음으로 옮기는 비율 → TD-PSOLA로 길이는 그대로 두고 높이만 바꿈
   - 예시 노래: 음이 조금씩 어긋난 "학교 종" 합성음
   브라우저(window.PitchDSP)와 node(module.exports) 둘 다에서 쓴다. 계획: docs/pitch-lab-plan.md
   ================================================================ */
(function (root) {
  "use strict";

  const A4 = 440;
  const midiOf = (f) => 69 + 12 * Math.log2(f / A4);
  const freqOf = (m) => A4 * Math.pow(2, (m - 69) / 12);

  const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    penta: [0, 2, 4, 7, 9],
  };
  /** 음계에서 m(소수 미디 번호)에 가장 가까운 음 번호 */
  function snap(m, scale) {
    const set = SCALES[scale] || SCALES.chromatic;
    const r = Math.round(m);
    let best = r, bd = Infinity;
    for (let k = -3; k <= 3; k++) {
      const n = r + k, pc = ((n % 12) + 12) % 12;
      if (set.indexOf(pc) < 0) continue;
      const d = Math.abs(n - m);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /* ───────── YIN ───────── */
  let dBuf = null;
  /**
   * buf[off .. off+2W) 에서 음높이 찾기. 없으면 null.
   * @returns {{f:number, conf:number}|null}
   */
  function yin(buf, sr, opts) {
    opts = opts || {};
    const minF = opts.minF || 70, maxF = opts.maxF || 1100, thr = opts.thr || 0.15;
    const off = opts.off || 0;
    const W = opts.W || Math.floor((buf.length - off) / 2);
    const tMin = Math.max(2, Math.floor(sr / maxF));
    const tMax = Math.min(W - 2, Math.ceil(sr / minF));
    if (tMax <= tMin + 2) return null;
    if (!dBuf || dBuf.length < tMax + 2) dBuf = new Float32Array(tMax + 2);
    const d = dBuf;
    d[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const x = buf[off + i] - buf[off + i + tau]; s += x * x; }
      run += s;
      d[tau] = run > 0 ? (s * tau) / run : 1;
    }
    let tau = -1;
    for (let t = tMin; t <= tMax; t++) {
      if (d[t] < thr) {
        while (t + 1 <= tMax && d[t + 1] < d[t]) t++;
        tau = t; break;
      }
    }
    if (tau < 0) {
      // 문턱 아래가 없으면 가장 낮은 곳(그래도 꽤 낮을 때만)
      let bt = -1, bv = 1;
      for (let t = tMin; t <= tMax; t++) if (d[t] < bv) { bv = d[t]; bt = t; }
      if (bt < 0 || bv > 0.35) return null;
      tau = bt;
    }
    let bt = tau;
    if (tau > 1 && tau < tMax) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1];
      const den = a - 2 * b + c;
      if (den > 0) bt = tau + (a - c) / (2 * den);
    }
    const f = sr / bt;
    if (!(f >= minF * 0.95 && f <= maxF * 1.05)) return null;
    return { f, conf: 1 - d[tau] };
  }

  function rms(buf, off, n) {
    off = off || 0; n = n || buf.length - off;
    let s = 0;
    for (let i = 0; i < n; i++) { const v = buf[off + i]; s += v * v; }
    return Math.sqrt(s / Math.max(1, n));
  }

  /* ───────── 녹음 전체 음높이 ───────── */
  /**
   * @returns {{hop:number, sr:number, f:Float32Array, rms:Float32Array}} f[i]=0 이면 무성음/조용함
   */
  function track(x, sr) {
    // 계산을 줄이려고 반으로 줄여(간단한 저역 통과 후) 찾는다. 사람 목소리 음높이(<1100Hz)에는 충분.
    const dec = sr > 30000 ? 2 : 1;
    const ds = dec === 1 ? x : (() => {
      const n = Math.floor(x.length / 2), y = new Float32Array(n);
      for (let i = 0; i < n; i++) { const j = 2 * i; y[i] = 0.25 * (x[j - 1] || 0) + 0.5 * x[j] + 0.25 * (x[j + 1] || 0); }
      return y;
    })();
    const dsr = sr / dec;
    const hop = Math.round(sr * 0.005); // 원래 표본 단위 5ms
    const W = Math.round(dsr * 0.0214); // 약 21ms (70Hz 주기 14ms보다 길게)
    const nF = Math.max(1, Math.ceil(x.length / hop));
    const f = new Float32Array(nF), lv = new Float32Array(nF);
    let peak = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
    const gate = Math.max(0.008, peak * 0.06);
    for (let k = 0; k < nF; k++) {
      const c = Math.floor((k * hop) / dec);
      const off = c - W;
      if (off < 0 || off + 2 * W >= ds.length) { f[k] = 0; continue; }
      const r = rms(ds, off, 2 * W);
      lv[k] = r;
      if (r < gate) { f[k] = 0; continue; }
      const p = yin(ds, dsr, { off, W, thr: 0.15 });
      f[k] = p && p.conf > 0.6 ? p.f : 0;
    }
    // 튀는 값 정리: 5칸 중앙값(유성음끼리) + 아주 짧은 유성음 조각 지우기
    const g = new Float32Array(nF), win = [];
    for (let k = 0; k < nF; k++) {
      if (!f[k]) { g[k] = 0; continue; }
      win.length = 0;
      for (let j = -2; j <= 2; j++) { const v = f[k + j]; if (v) win.push(v); }
      win.sort((a, b) => a - b);
      const med = win[win.length >> 1];
      g[k] = Math.abs(midiOf(f[k]) - midiOf(med)) > 1 ? med : f[k];
    }
    for (let k = 0; k < nF;) {
      if (!g[k]) { k++; continue; }
      let e = k; while (e < nF && g[e]) e++;
      if (e - k < 6) for (let j = k; j < e; j++) g[j] = 0; // 30ms보다 짧으면 잡음
      k = e;
    }
    return { hop, sr, f: g, rms: lv };
  }

  /* ───────── 보정 목표 ───────── */
  /**
   * @param tr track() 결과
   * @param o { scale, strength(0~1), speed(ms, 0=즉시), shift(반음) }
   * @returns {{ratio:Float32Array, target:Float32Array}}
   */
  function plan(tr, o) {
    const n = tr.f.length, ratio = new Float32Array(n), target = new Float32Array(n);
    const hopSec = tr.hop / tr.sr;
    const a = o.speed > 0 ? 1 - Math.exp(-hopSec / (o.speed / 1000)) : 1;
    const st = Math.max(0, Math.min(1, o.strength));
    const sh = (o.shift || 0) * 100;
    let sm = null;
    for (let i = 0; i < n; i++) {
      const f = tr.f[i];
      if (!f) { ratio[i] = Math.pow(2, sh / 1200); target[i] = 0; sm = null; continue; }
      const m = midiOf(f);
      const want = (snap(m, o.scale) - m) * 100 * st;
      sm = sm === null ? want : sm + (want - sm) * a;
      const cents = sm + sh;
      ratio[i] = Math.pow(2, cents / 1200);
      target[i] = f * ratio[i];
    }
    return { ratio, target };
  }

  /** 고친 곡선이 음계 음에서 평균 몇 센트 떨어졌나(유성음만) */
  function meanError(target, scale) {
    let s = 0, c = 0;
    for (let i = 0; i < target.length; i++) {
      const f = target[i]; if (!f) continue;
      const m = midiOf(f); s += Math.abs(m - snap(m, scale)) * 100; c++;
    }
    return c ? s / c : 0;
  }

  /* ───────── TD-PSOLA ───────── */
  function psola(x, tr, ratio) {
    const N = x.length, sr = tr.sr, hop = tr.hop, nF = tr.f.length;
    const fAt = (p) => tr.f[Math.max(0, Math.min(nF - 1, Math.round(p / hop)))];
    const UV = Math.round(sr * 0.01);
    // 1) 분석 표지: 유성음은 한 주기마다(가장 큰 값 근처로 맞춤), 무성음은 10ms마다
    const pos = [], per = [], voi = [];
    let p = 0, prevV = false;
    while (p < N) {
      const f = fAt(p), v = f > 0, T = v ? sr / f : UV;
      let m = Math.round(p);
      if (v) {
        const r = Math.round(T * (prevV ? 0.25 : 0.5));
        const lo = Math.max(0, m - (prevV ? r : 0)), hi = Math.min(N - 1, m + r);
        let bv = -Infinity;
        for (let q = lo; q <= hi; q++) if (x[q] > bv) { bv = x[q]; m = q; }
        if (pos.length && m <= pos[pos.length - 1]) m = pos[pos.length - 1] + 1;
      }
      pos.push(m); per.push(T); voi.push(v);
      prevV = v;
      p = m + T;
    }
    // 2) 합성: 목표 주기 간격으로 가장 가까운 분석 조각(두 주기 길이 Hann 창)을 겹쳐 더함
    const y = new Float32Array(N), w = new Float32Array(N);
    let ts = 0, k = 0;
    const M = pos.length;
    while (ts < N) {
      while (k + 1 < M && Math.abs(pos[k + 1] - ts) <= Math.abs(pos[k] - ts)) k++;
      const T = per[k], L = Math.max(2, Math.round(T));
      const r = ratio[Math.max(0, Math.min(nF - 1, Math.round(pos[k] / hop)))] || 1;
      const c = pos[k], d = Math.round(ts);
      for (let j = -L; j <= L; j++) {
        const si = c + j, di = d + j;
        if (si < 0 || si >= N || di < 0 || di >= N) continue;
        const wv = 0.5 + 0.5 * Math.cos((Math.PI * j) / L);
        y[di] += x[si] * wv; w[di] += wv;
      }
      ts += voi[k] ? T / r : T;
    }
    for (let i = 0; i < N; i++) if (w[i] > 1) y[i] /= w[i];
    return y;
  }

  /* ───────── 예시 노래 ───────── */
  // 학교 종이 땡땡땡: 솔솔라라 솔솔미 솔솔미미 레 (다장조), 박 = 0.4초
  const SONG = [
    [67, 1, 0], [67, 1, 35], [69, 1, -40], [69, 1, 0], [67, 1, 25], [67, 1, -45], [64, 2, 55],
    [67, 1, -30], [67, 1, 0], [64, 1, 40], [64, 1, -35], [62, 3, 45],
  ];
  const SONG_BEAT = 0.4;
  /** 모음 "아"에 가까운 배음 세기(두 봉우리 약 750Hz·1200Hz) */
  function vowelAmp(fh) {
    const g = (c, w) => Math.exp(-Math.pow((fh - c) / w, 2));
    return 0.18 + 1.0 * g(750, 260) + 0.7 * g(1200, 300) + 0.25 * g(2600, 500);
  }
  function demoSong(sr) {
    const lead = 0.25, tail = 0.35;
    const total = SONG.reduce((s, n) => s + n[1], 0) * SONG_BEAT;
    const N = Math.round((lead + total + tail) * sr);
    const y = new Float32Array(N);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    // 음별 시작 시각
    const starts = []; let t = lead;
    for (const n of SONG) { starts.push(t); t += n[1] * SONG_BEAT; }
    let ph = 0, prevM = null;
    const H = 24;
    for (let i = 0; i < N; i++) {
      const tt = i / sr;
      let k = -1;
      for (let j = 0; j < SONG.length; j++) if (tt >= starts[j]) k = j;
      if (k < 0 || tt > lead + total) continue;
      const [nm, beats, dev] = SONG[k];
      const nt = tt - starts[k], dur = beats * SONG_BEAT;
      const goal = nm + dev / 100;
      const from = k > 0 ? SONG[k - 1][0] + SONG[k - 1][2] / 100 : goal;
      const glide = Math.min(1, nt / 0.06);
      let m = from + (goal - from) * (glide * glide * (3 - 2 * glide));
      if (nt > 0.15) m += (12 / 100) * Math.sin(2 * Math.PI * 5.5 * (nt - 0.15)) * Math.min(1, (nt - 0.15) / 0.2);
      const f = freqOf(m);
      ph += (2 * Math.PI * f) / sr;
      if (ph > 2 * Math.PI * 1000) ph -= 2 * Math.PI * 1000;
      // 세기: 음마다 살짝 들어가고, 끝에서 살짝 빠짐(완전히 끊지는 않음)
      const env = Math.min(1, nt / 0.03) * (nt > dur - 0.05 ? 0.55 + 0.45 * Math.max(0, (dur - nt) / 0.05) : 1);
      let s = 0;
      for (let h = 1; h <= H; h++) { const fh = f * h; if (fh > sr * 0.45) break; s += (vowelAmp(fh) / h) * Math.sin(h * ph); }
      y[i] = 0.22 * env * s + 0.003 * rnd();
      prevM = m;
    }
    void prevM;
    // 끝을 부드럽게
    const fade = Math.round(0.04 * sr), end = Math.round((lead + total) * sr);
    for (let i = 0; i < fade; i++) { const j = end - fade + i; if (j >= 0 && j < N) y[j] *= 1 - i / fade; }
    let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(y[i]));
    if (pk > 0) for (let i = 0; i < N; i++) y[i] *= 0.7 / pk;
    return y;
  }

  /* ───────── 발생기 음색(배음 몇 개) ───────── */
  const GEN_HARM = [0, 1, 0.32, 0.16, 0.08];

  const api = { A4, midiOf, freqOf, SCALES, snap, yin, rms, track, plan, meanError, psola, demoSong, GEN_HARM };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PitchDSP = api;
})(typeof window !== "undefined" ? window : globalThis);
