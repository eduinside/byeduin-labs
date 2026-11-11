/* ══════════════════════════════════════════════
   time-class — 시각과 시간
   계획: docs/time-class-plan.md · 공용 키트: /common/sim-kit.js (규약 v2)
   시각은 '하루를 넘어 이어지는 분'(정수)으로 들고 다니고, 보일 때 0~1439로 감는다.
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const SK = window.SimKit;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls) { const t = el('text', { x: x, y: y, class: cls || '' }, parent); t.textContent = s; return t; }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const norm = t => ((Math.round(t) % 1440) + 1440) % 1440;
  const pad = n => String(n).padStart(2, '0');
  const rand = n => Math.floor(Math.random() * n);
  const pick = arr => arr[rand(arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const reduced = () => !!(SK.motion && SK.motion.reduced());
  const josa = (w, pair) => SK.josa.pick(String(w), pair);
  const ieyo = w => w + josa(w, '이에요/예요');

  /* ───────────── 저장 ───────────── */
  const COLORS = ['#c7cffc', '#ffe08f', '#b5ebcf', '#ffc6b5', '#dcc8ff', '#bfe4ff', '#ffc4dc', '#e1efa4', '#ffd7ad', '#d6dce4'];
  const SAMPLE = [['잠자기', 1290, 420], ['아침 준비', 420, 490], ['등교', 490, 520], ['학교 공부', 520, 730], ['점심 식사', 730, 780], ['방과 후 활동', 780, 900], ['놀이', 900, 1020], ['저녁 식사', 1080, 1140], ['숙제·책 읽기', 1140, 1230], ['씻기', 1230, 1290]]
    .map((r, i) => ({ name: r[0], s: r[1], e: r[2], c: COLORS[i % COLORS.length] }));
  const sample = () => SAMPLE.map(x => Object.assign({}, x));
  const OPT_DEF = { minuteNums: true, ticks: true, handLabels: true, hourArc: false, minuteFill: false, nums24: false, explain: true, before: true, spoken: true };
  const FREE_MODES = ['read', 'elapsed', 'day', 'routine', 'cal'];
  const MISSION_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  const MAX_ITEMS = 16;
  const defaults = () => ({ mode24: false, tab: 'read', opts: Object.assign({}, OPT_DEF), disp: 'both', routine: sample(), rtView: 'both', marks: {}, progress: {} });
  function validate(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    d.mode24 = !!raw.mode24;
    if (FREE_MODES.indexOf(raw.tab) >= 0) d.tab = raw.tab;
    if (raw.opts && typeof raw.opts === 'object') for (const k in OPT_DEF) if (typeof raw.opts[k] === 'boolean') d.opts[k] = raw.opts[k];
    if (['analog', 'digital', 'both'].indexOf(raw.disp) >= 0) d.disp = raw.disp;
    if (['circle', 'bar', 'both'].indexOf(raw.rtView) >= 0) d.rtView = raw.rtView;
    if (Array.isArray(raw.routine)) {
      d.routine = raw.routine.slice(0, MAX_ITEMS).filter(x => x && typeof x === 'object').map(x => ({
        name: String(x.name == null ? '' : x.name).slice(0, 10),
        s: SK.clean.int(x.s, 0, 1439, 0), e: SK.clean.int(x.e, 0, 1439, 60),
        c: COLORS.indexOf(x.c) >= 0 ? x.c : COLORS[0]
      }));
    }
    if (raw.marks && typeof raw.marks === 'object') {
      Object.keys(raw.marks).slice(0, 300).forEach(k => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof raw.marks[k] === 'string' && raw.marks[k].trim()) d.marks[k] = raw.marks[k].slice(0, 12);
      });
    }
    d.progress = SK.clean.stars(raw.progress || {}, MISSION_IDS, 3);
    return d;
  }
  const store = SK.store('time-class:v1', { defaults: defaults(), validate: validate });
  let S = validate(store.load());
  const save = () => store.save(S);

  /* ───────────── 시각을 글로 ───────────── */
  const NAT = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두'];
  const DG = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const sino = n => { if (n === 0) return '영'; const t = Math.floor(n / 10), o = n % 10; return (t ? (t > 1 ? DG[t] : '') + '십' : '') + DG[o]; };
  const parts = t => { t = norm(t); return { h: Math.floor(t / 60), m: t % 60 }; };
  const ap = hh => (hh < 12 ? '오전' : '오후');
  const h12 = hh => hh % 12 || 12;
  function hourStr(hh, m24, withAp) {
    if (m24 === undefined) m24 = S.mode24;
    return m24 ? hh + '시' : (withAp === false ? '' : ap(hh) + ' ') + h12(hh) + '시';
  }
  function fmtHM(t, m24, withAp) { const p = parts(t); const hs = hourStr(p.h, m24, withAp); return p.m ? hs + ' ' + p.m + '분' : hs; }
  function digital(t, m24) {
    if (m24 === undefined) m24 = S.mode24;
    const p = parts(t);
    return m24 ? { ap: '', txt: pad(p.h) + ':' + pad(p.m) } : { ap: ap(p.h), txt: h12(p.h) + ':' + pad(p.m) };
  }
  function spoken(t) {
    const p = parts(t);
    const hs = S.mode24 ? sino(p.h) + ' 시' : ap(p.h) + ' ' + NAT[h12(p.h)] + ' 시';
    return p.m ? hs + ' ' + sino(p.m) + ' 분' : hs;
  }
  function beforeStr(t) { const m = parts(t).m; if (!m) return ''; return fmtHM(t + 60 - m) + ' ' + (60 - m) + '분 전'; }
  function fmtDur(d) { const hh = Math.floor(d / 60), m = d % 60; if (!hh) return m + '분'; return m ? hh + '시간 ' + m + '분' : hh + '시간'; }
  const durOf = (a, b) => ((norm(b) - norm(a)) % 1440 + 1440) % 1440;

  /* ───────────── 그리기 도구 ───────────── */
  function polar(a, r) { const t = a * Math.PI / 180; return [Math.sin(t) * r, -Math.cos(t) * r]; }
  function arcPath(r0, r1, a1, a2) {
    if (a2 - a1 >= 359.99) a2 = a1 + 359.98;
    const L = (a2 - a1) > 180 ? 1 : 0; const p1 = polar(a1, r1), p2 = polar(a2, r1);
    if (r0 <= 0) return 'M0 0 L' + p1[0] + ' ' + p1[1] + ' A' + r1 + ' ' + r1 + ' 0 ' + L + ' 1 ' + p2[0] + ' ' + p2[1] + ' Z';
    const p3 = polar(a2, r0), p4 = polar(a1, r0);
    return 'M' + p1[0] + ' ' + p1[1] + ' A' + r1 + ' ' + r1 + ' 0 ' + L + ' 1 ' + p2[0] + ' ' + p2[1] + ' L' + p3[0] + ' ' + p3[1] + ' A' + r0 + ' ' + r0 + ' 0 ' + L + ' 0 ' + p4[0] + ' ' + p4[1] + ' Z';
  }
  /* linear = 돌려보기(내용 자체가 움직임). 그 밖의 이동은 움직임 줄이기면 바로 끝낸다. */
  function tween(from, to, dur, frame, done, linear) {
    let id, t0 = null, stopped = false;
    if (reduced() && !linear) dur = 0;
    const ease = k => (linear ? k : (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2));
    const f = now => {
      if (stopped) return;
      if (t0 == null) t0 = now;
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      frame(from + (to - from) * ease(k));
      if (k < 1) id = requestAnimationFrame(f); else if (done) done();
    };
    id = requestAnimationFrame(f);
    return { stop() { stopped = true; cancelAnimationFrame(id); } };
  }
  function svgPoint(svg, e) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  const angleAt = (svg, e) => { const q = svgPoint(svg, e); return (Math.atan2(q.x, -q.y) * 180 / Math.PI + 360) % 360; };
  function segBind(seg, val, cb) {
    const set = v => $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    set(val);
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.v); cb(b.dataset.v); });
    return set;
  }
  function togBind(btn, val, cb) {
    btn.setAttribute('aria-pressed', String(!!val));
    btn.addEventListener('click', () => { const on = btn.getAttribute('aria-pressed') !== 'true'; btn.setAttribute('aria-pressed', String(on)); cb(on); });
  }
  function setPlayBtn(btn, playing, label) {
    btn.setAttribute('aria-pressed', String(playing));
    btn.innerHTML = (playing ? SK.icon('pause') : SK.icon('play')) + '<span></span>';
    btn.lastChild.textContent = playing ? '멈춤' : label;
  }
  function setMaskBtn(btn, masked, hideLabel, showLabel) {
    btn.setAttribute('aria-pressed', String(masked));
    btn.innerHTML = (masked ? SK.icon('eye') : SK.icon('eye-off')) + '<span></span>';
    btn.lastChild.textContent = masked ? showLabel : hideLabel;
  }
  const mask = (elm, on) => elm.classList.toggle('masked', on);

  /* ───────────── 바늘 시계 ───────────── */
  class Clock {
    constructor(svg, o) {
      this.svg = svg;
      this.o = Object.assign({ minuteNums: true, ticks: true, handLabels: false, hourArc: false, minuteFill: false, nums24: false, step: 1, locked: false, onChange() {} }, o);
      this.total = this.o.total != null ? this.o.total : 600;
      this.shown = this.total; this.raw = this.total; this.anim = null; this.drag = null;
      svg.setAttribute('viewBox', '-250 -250 500 500'); svg.classList.add('clock');
      this.build(); this.applyOpts(); this.bind();
    }
    build() {
      const s = this.svg; s.textContent = '';
      el('circle', { r: 240, class: 'ck-rim' }, s);
      el('circle', { r: 206, class: 'ck-face' }, s);
      this.arcMin = el('path', { class: 'ck-minfill' }, s);
      this.arcHour = el('path', { class: 'ck-hourarc' }, s);
      this.gSmall = el('g', {}, s); const gBig = el('g', {}, s);
      for (let i = 0; i < 60; i++) {
        const big = i % 5 === 0, p1 = polar(i * 6, big ? 180 : 191), p2 = polar(i * 6, 203);
        el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: big ? 'tk big' : 'tk' }, big ? gBig : this.gSmall);
      }
      const gN = el('g', {}, s);
      for (let i = 1; i <= 12; i++) { const p = polar(i * 30, 148); txt(gN, p[0], p[1], i, 'ck-num'); }
      this.gN24 = el('g', { class: 'ck-n24' }, s);
      for (let i = 1; i <= 12; i++) { const p = polar(i * 30, 104); txt(this.gN24, p[0], p[1], i + 12); }
      this.gMinNums = el('g', { class: 'ck-minnums' }, s);
      for (let i = 0; i < 12; i++) { const p = polar(i * 30, 223); txt(this.gMinNums, p[0], p[1], i * 5); }
      this.gMin = el('g', { class: 'hand minute', role: 'slider', 'aria-label': '긴바늘' }, s);
      el('path', { d: 'M-6.5 28 L-4.5 -166 Q0 -182 4.5 -166 L6.5 28 Z', class: 'hand-body' }, this.gMin);
      el('line', { x1: 0, y1: -40, x2: 0, y2: -188, class: 'hit', 'data-hand': 'm' }, this.gMin);
      this.gHour = el('g', { class: 'hand hour', role: 'slider', 'aria-label': '짧은바늘' }, s);
      el('path', { d: 'M-10 24 L-8 -96 Q0 -114 8 -96 L10 24 Z', class: 'hand-body' }, this.gHour);
      el('line', { x1: 0, y1: -30, x2: 0, y2: -118, class: 'hit', 'data-hand': 'h' }, this.gHour);
      el('circle', { r: 15, class: 'ck-cap' }, s); el('circle', { r: 5, class: 'ck-pin' }, s);
      this.lblH = txt(s, 0, 0, '짧은바늘', 'hand-lbl h'); this.lblM = txt(s, 0, 0, '긴바늘', 'hand-lbl m');
    }
    applyOpts() {
      const o = this.o, v = (e, b) => { e.style.display = b ? '' : 'none'; };
      v(this.gMinNums, o.minuteNums); v(this.gSmall, o.ticks); v(this.gN24, o.nums24); v(this.lblH, o.handLabels); v(this.lblM, o.handLabels);
      this.svg.classList.toggle('locked', !!o.locked);
      [this.gMin, this.gHour].forEach(g => g.setAttribute('tabindex', o.locked ? '-1' : '0'));
      this.render(this.shown);
    }
    render(v) {
      if (v === undefined) v = this.total;
      this.shown = v;
      const tm = ((v % 720) + 720) % 720, mm = ((v % 60) + 60) % 60, ha = tm / 2, ma = mm * 6, o = this.o;
      this.gHour.setAttribute('transform', 'rotate(' + ha + ')'); this.gMin.setAttribute('transform', 'rotate(' + ma + ')');
      if (o.hourArc) { const k = Math.floor(tm / 60 + 1e-9); this.arcHour.setAttribute('d', arcPath(62, 205, k * 30, k * 30 + 30)); this.arcHour.style.display = ''; } else this.arcHour.style.display = 'none';
      if (o.minuteFill && ma > 0.5) { this.arcMin.setAttribute('d', arcPath(0, 205, 0, ma)); this.arcMin.style.display = ''; } else this.arcMin.style.display = 'none';
      if (o.handLabels) {
        const p = polar(ha, 64), q = polar(ha + 90, 34), r = polar(ma, 128), w = polar(ma - 90, 32);
        this.lblH.setAttribute('x', p[0] + q[0]); this.lblH.setAttribute('y', p[1] + q[1]);
        this.lblM.setAttribute('x', r[0] + w[0]); this.lblM.setAttribute('y', r[1] + w[1]);
      }
      const iv = Math.round(v);
      if (iv !== this._aria) { this._aria = iv; const s = o.hideValue ? '' : fmtHM(iv, false, false); this.gMin.setAttribute('aria-valuetext', s); this.gHour.setAttribute('aria-valuetext', s); }
    }
    get value() { return Math.round(this.shown); }
    set(t, silent) { this.stopAnim(); this.total = Math.round(t); this.raw = this.total; this.render(t); if (!silent) this.o.onChange(this.total, 'set'); }
    animateTo(target, opt) {
      opt = opt || {};
      this.stopAnim();
      const from = this.shown; let dur = opt.dur; if (dur == null) dur = Math.min(1600, 260 + Math.abs(target - from) * 4);
      this.total = target; this.raw = target;
      this.anim = tween(from, target, dur, v => { this.render(v); this.o.onChange(Math.round(v), 'anim'); },
        () => { this.anim = null; this.render(target); this.o.onChange(target, 'end'); if (opt.done) opt.done(); }, opt.linear);
    }
    stopAnim() { if (this.anim) { this.anim.stop(); this.anim = null; this.total = Math.round(this.shown); this.raw = this.total; if (this.onStop) this.onStop(); } }
    bind() {
      const s = this.svg;
      s.addEventListener('pointerdown', e => {
        const hand = e.target.getAttribute && e.target.getAttribute('data-hand');
        if (!hand || this.o.locked) return;
        e.preventDefault(); this.stopAnim(); this.drag = hand; this.prevA = angleAt(s, e); this.raw = this.total;
        try { s.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
        s.classList.add('dragging');
      });
      s.addEventListener('pointermove', e => {
        if (!this.drag) return;
        const a = angleAt(s, e); let d = a - this.prevA; if (d > 180) d -= 360; if (d < -180) d += 360; this.prevA = a;
        this.raw += this.drag === 'm' ? d / 6 : d * 2;
        const st = this.o.step, nt = Math.round(this.raw / st) * st;
        if (nt !== this.total) { this.total = nt; this.render(); this.o.onChange(nt, 'drag'); }
      });
      const up = () => { if (!this.drag) return; this.drag = null; this.raw = this.total; s.classList.remove('dragging'); this.o.onChange(this.total, 'end'); };
      s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
      /* 키보드: 긴바늘 ←→ 한 단계, 짧은바늘 ←→ 1시간, ↑↓는 둘 다 1시간 */
      const key = (g, small) => g.addEventListener('keydown', e => {
        if (this.o.locked) return;
        let d = 0;
        if (e.key === 'ArrowRight') d = small; else if (e.key === 'ArrowLeft') d = -small;
        else if (e.key === 'ArrowUp') d = 60; else if (e.key === 'ArrowDown') d = -60;
        if (!d) return;
        e.preventDefault(); this.stopAnim();
        const st = this.o.step; this.total = Math.round((this.total + d) / st) * st; this.raw = this.total;
        this.render(); this.o.onChange(this.total, 'end');
      });
      key(this.gMin, 0); key(this.gHour, 60);
      this.gMin.addEventListener('keydown', e => {
        if (this.o.locked || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
        e.preventDefault(); this.stopAnim();
        const st = this.o.step; this.total = Math.round(this.total / st) * st + (e.key === 'ArrowRight' ? st : -st); this.raw = this.total;
        this.render(); this.o.onChange(this.total, 'end');
      });
    }
  }
  /* cur에서 가장 가까운 방향으로 target 시각까지 */
  function shortest(cur, target) { let d = ((norm(target) - norm(cur)) % 1440 + 1440) % 1440; if (d > 720) d -= 1440; return cur + d; }

  /* 가린 곳은 누르면 보인다 */
  document.addEventListener('click', e => {
    const m = e.target.closest('.maskable.masked');
    if (!m) return;
    m.classList.remove('masked');
    if (m.id === 'readOut' || m.id === 'readDigital') syncMaskBtn();
    if (m.id === 'elRes') setMaskBtn($('#elMask'), false, '가리기', '보이기');
  });

  /* ═════════════ 1. 시각 읽기 ═════════════ */
  const R = { quiz: null, qtype: 'read', play: null };
  const readClock = new Clock($('#readClock'), Object.assign({}, S.opts, { total: 610, onChange: updRead }));
  const qFb = SK.feedback('#qMsg', { reveal: false });
  function updRead(t) {
    const d = digital(t); $('#rdAp').textContent = d.ap; $('#rdAp').hidden = !d.ap; $('#rdTime').textContent = d.txt;
    if (R.quiz && R.quiz.type === 'place') return;
    const p = parts(t);
    $('#roMain').textContent = fmtHM(t) + (p.m === 0 ? ' 정각' : '');
    const alt = $('#roAlt'); alt.textContent = '';
    if (p.m === 30) alt.appendChild(h('div', '', '= ' + hourStr(p.h) + ' 반'));
    if (S.opts.before && p.m > 0) alt.appendChild(h('div', '', '= ' + beforeStr(t)));
    $('#roSpk').textContent = S.opts.spoken ? '읽기: ' + spoken(t) : '';
    const hint = $('#roHint'); hint.textContent = '';
    if (S.opts.explain) {
      const k = h12(p.h), n = k % 12 + 1, a = h('div'), b = h('div');
      a.innerHTML = '<span class="h">짧은바늘</span>이 ' + (p.m === 0 ? k + josa(k, '을/를') + ' 가리켜요 → ' + k + '시' : k + josa(k, '과/와') + ' ' + n + ' 사이 → ' + k + '시');
      const q = Math.floor(p.m / 5) || 12, r = p.m % 5;
      b.innerHTML = '<span class="m">긴바늘</span>이 ' + (r === 0 ? q + josa(q, '을/를') + ' 가리켜요 → ' + p.m + '분' : q + '에서 작은 눈금 ' + r + '칸 더 → ' + p.m + '분');
      hint.appendChild(a); hint.appendChild(b);
    }
  }
  $$('#readOpts .tog').forEach(b => togBind(b, S.opts[b.dataset.opt], on => {
    S.opts[b.dataset.opt] = on; save(); Object.assign(readClock.o, S.opts); readClock.applyOpts(); updRead(readClock.value);
  }));
  function applyDisp(v) {
    S.disp = v; save();
    $('#readClockWrap').hidden = v === 'digital'; $('#readDigital').hidden = v === 'analog';
    $('#viewRead').classList.toggle('digital-only', v === 'digital');
  }
  segBind($('#dispSeg'), S.disp, applyDisp); applyDisp(S.disp);
  function showReadPane(v) { $$('#paneRead [data-pane]').forEach(g => { g.hidden = g.dataset.pane !== v; }); }
  segBind($('#readPane'), 'move', showReadPane);
  segBind($('#snapSeg'), 1, v => { readClock.o.step = +v; if (+v === 5) readClock.set(Math.round(readClock.value / 5) * 5); });
  $$('#readSteps [data-add]').forEach(b => b.addEventListener('click', () => { stopReadPlay(); readClock.animateTo(readClock.total + +b.dataset.add); }));
  $('#btnAmPm').addEventListener('click', () => { stopReadPlay(); readClock.set(readClock.total + 720); });
  $('#btnNow').addEventListener('click', () => { stopReadPlay(); const n = new Date(); readClock.animateTo(shortest(readClock.total, n.getHours() * 60 + n.getMinutes())); });
  function stopReadPlay() {
    if (!R.play) return;
    R.play.stop(); R.play = null; readClock.total = readClock.value; readClock.raw = readClock.total;
    setPlayBtn($('#btnPlay'), false, '시계 흘러가기');
  }
  $('#btnPlay').addEventListener('click', () => {
    if (R.play) { stopReadPlay(); return; }
    readClock.stopAnim(); const start = readClock.value; setPlayBtn($('#btnPlay'), true, '시계 흘러가기');
    R.play = tween(start, start + 720, 72000, v => { readClock.render(v); updRead(Math.round(v)); },
      () => { R.play = null; readClock.total = start + 720; readClock.raw = readClock.total; setPlayBtn($('#btnPlay'), false, '시계 흘러가기'); }, true);
  });
  readClock.svg.addEventListener('pointerdown', stopReadPlay, true);
  function syncMaskBtn() { setMaskBtn($('#btnMask'), $('#readOut').classList.contains('masked'), '읽은 시각 가리기', '읽은 시각 보이기'); }
  $('#btnMask').addEventListener('click', () => { mask($('#readOut'), !$('#readOut').classList.contains('masked')); syncMaskBtn(); });
  $('#btnSpeak').addEventListener('click', () => SK.speak(R.quiz && R.quiz.type === 'place' ? fmtHM(R.quiz.target) : spoken(readClock.value), { rate: 0.85 }));

  /* 문제 내기(교사용): 답을 입력받지 않고 함께 확인한다 */
  segBind($('#qType'), 'read', v => { R.qtype = v; if (R.quiz) endQuiz(); });
  function pickTime(lvl) {
    const hh = rand(24); let m;
    if (lvl === 'hour') m = 0; else if (lvl === 'half') m = 30; else if (lvl === 'five') m = rand(12) * 5; else if (lvl === 'before') m = 40 + rand(4) * 5; else m = rand(60);
    return hh * 60 + m;
  }
  $('#qNew').addEventListener('click', () => {
    stopReadPlay(); const lvl = $('#qLevel').value; let target = pickTime(lvl);
    if (R.quiz && R.quiz.target === target) target = pickTime(lvl);
    R.quiz = { type: R.qtype, target: target, lvl: lvl }; $('#qCheck').hidden = false; $('#qEnd').hidden = false;
    if (R.qtype === 'read') {
      $('#qCheck').textContent = '정답 보기';
      readClock.animateTo(shortest(readClock.total, target)); mask($('#readOut'), true); mask($('#readDigital'), true); syncMaskBtn();
      qFb.show('info', lvl === 'before' ? '몇 시 몇 분 전인지 읽어 보세요.' : '시계를 보고 시각을 읽어 보세요.');
    } else {
      $('#qCheck').textContent = '확인하기';
      readClock.set(Math.floor(norm(target) / 720) * 720, true);
      mask($('#readOut'), false); mask($('#readDigital'), true); syncMaskBtn();
      $('#roMain').textContent = lvl === 'before' ? beforeStr(target) : fmtHM(target);
      $('#roAlt').textContent = '시계에 나타내 보세요'; $('#roSpk').textContent = ''; $('#roHint').textContent = '';
      qFb.show('info', '바늘을 움직인 뒤 [확인하기]를 눌러요.');
      const d = digital(readClock.total); $('#rdAp').textContent = d.ap; $('#rdTime').textContent = d.txt;
    }
  });
  $('#qCheck').addEventListener('click', () => {
    const q = R.quiz; if (!q) return;
    if (q.type === 'read') { mask($('#readOut'), false); mask($('#readDigital'), false); syncMaskBtn(); qFb.show('ok', '정답을 함께 확인해요.'); return; }
    const cur = norm(readClock.value) % 720, tg = norm(q.target) % 720;
    if (cur === tg) { qFb.show('ok', '잘했어요! 정답이에요.'); mask($('#readDigital'), false); }
    else if (cur % 60 !== tg % 60) qFb.show('no', '긴바늘을 다시 살펴봐요.');
    else qFb.show('no', '짧은바늘을 다시 살펴봐요.');
  });
  function endQuiz() {
    R.quiz = null; $('#qCheck').hidden = true; $('#qEnd').hidden = true; qFb.hide();
    mask($('#readOut'), false); mask($('#readDigital'), false); syncMaskBtn(); updRead(readClock.value);
  }
  $('#qEnd').addEventListener('click', endQuiz);

  /* ═════════════ 2. 걸린 시간 ═════════════ */
  const E = { playing: false, fullDur: 0 };
  E.a = new Clock($('#elA'), { total: 550, onChange: () => updEl() });
  E.b = new Clock($('#elB'), { total: 630, onChange: () => updEl() });
  function updEl() {
    const a = E.a.value, b = E.b.value, dur = durOf(a, b);
    $('#elADig').textContent = fmtHM(a); $('#elBDig').textContent = fmtHM(b);
    $('#elDur').textContent = fmtDur(dur);
    $('#elEq').textContent = dur >= 60 ? '= ' + dur + '분' : '';
    $('#elNote').textContent = norm(b) < norm(a) ? '끝난 시각이 시작한 시각보다 이르면 다음 날 끝난 것으로 세어요.' : '';
    drawStrip($('#elStrip'), norm(a), dur, E.playing ? E.fullDur : dur);
  }
  /* 시간 띠: 한 칸 10분. a에서 dur만큼 칠하고, 눈금은 full 길이에 맞춘다 */
  function drawStrip(s, a, dur, full) {
    s.setAttribute('viewBox', '0 0 1000 150'); s.textContent = '';
    const h0 = Math.floor(a / 60); let h1 = Math.ceil((a + Math.max(full, 1)) / 60); if (h1 - h0 < 2) h1 = h0 + 2;
    const n = h1 - h0, X0 = 40, W = 920, pxm = W / (n * 60), x = t => X0 + (t - h0 * 60) * pxm, Y = 48, H = 50;
    if (n <= 8) { for (let i = 0; i < n * 6; i++) el('rect', { x: X0 + i * 10 * pxm, y: Y, width: 10 * pxm, height: H, class: 'st-cell' }, s); }
    else el('rect', { x: X0, y: Y, width: W, height: H, class: 'st-cell' }, s);
    if (dur > 0) el('rect', { x: x(a), y: Y, width: dur * pxm, height: H, class: 'st-fill' }, s);
    const every = n > 12 ? 2 : 1;
    for (let i = 0; i <= n; i++) {
      const xx = X0 + i * 60 * pxm; el('line', { x1: xx, y1: Y - 6, x2: xx, y2: Y + H + 6, class: 'st-hour' }, s);
      const hh = (h0 + i) % 24;
      if (i % every === 0) txt(s, xx, Y + H + 32, S.mode24 ? hh + '시' : h12(hh) + '시', 'st-lbl');
      if (!S.mode24 && (i === 0 || hh === 0 || hh === 12)) txt(s, xx, Y + H + 52, ap(hh), 'st-min');
    }
    if (n <= 4) for (let i = 0; i < n; i++) for (let k = 1; k < 6; k++) txt(s, X0 + (i * 60 + k * 10) * pxm, Y - 10, k * 10 + '분', 'st-min');
    [[a, 'a', '시작'], [a + dur, 'b', '끝']].forEach(r => {
      const xx = x(r[0]); el('line', { x1: xx, y1: Y - 4, x2: xx, y2: Y + H + 4, class: 'st-mark ' + r[1] }, s);
      txt(s, xx, n <= 4 ? Y - 30 : Y - 14, r[2], 'st-tag ' + r[1]);
    });
  }
  $$('#paneElapsed .step-grid[data-for]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const c = E[g.dataset.for]; stopElPlay(); c.animateTo(c.total + +b.dataset.add);
  }));
  togBind($('#elMinNums'), true, on => { E.a.o.minuteNums = E.b.o.minuteNums = on; E.a.applyOpts(); E.b.applyOpts(); });
  togBind($('#elSnap5'), false, on => { E.a.o.step = E.b.o.step = on ? 5 : 1; });
  $('#elMask').addEventListener('click', () => { const on = !$('#elRes').classList.contains('masked'); mask($('#elRes'), on); setMaskBtn($('#elMask'), on, '가리기', '보이기'); });
  function stopElPlay() { if (E.playing) { E.playing = false; E.b.stopAnim(); setPlayBtn($('#elPlay'), false, '시작부터 돌려보기'); updEl(); } }
  $('#elPlay').addEventListener('click', () => {
    if (E.playing) { stopElPlay(); return; }
    const dur = durOf(E.a.value, E.b.value);
    if (!dur) { SK.toast('시작한 시각과 끝난 시각이 같아요. 끝난 시각을 옮겨 보세요.'); return; }
    E.playing = true; E.fullDur = dur; setPlayBtn($('#elPlay'), true, '시작부터 돌려보기');
    const target = E.b.total; E.b.set(target - dur, true); updEl();
    E.b.animateTo(target, { dur: Math.min(9000, Math.max(2000, dur * 40)), linear: true, done: () => { E.playing = false; setPlayBtn($('#elPlay'), false, '시작부터 돌려보기'); updEl(); } });
  });
  $('#elA').addEventListener('pointerdown', stopElPlay, true);
  E.b.onStop = () => { if (E.playing) { E.playing = false; setPlayBtn($('#elPlay'), false, '시작부터 돌려보기'); } };

  /* ═════════════ 3. 하루 ═════════════ */
  const DY = { t: 450, play: null, speed: 16000 };
  const dayClock = new Clock($('#dayClock'), { total: 450, minuteNums: false, handLabels: true, onChange: t => setDay(norm(t), 'clock') });
  const dial = $('#dial24');
  (function buildDial() {
    el('circle', { r: 240, class: 'd24-face' }, dial);
    el('path', { d: arcPath(0, 236, 180, 360), class: 'd24-pm' }, dial);
    for (let i = 0; i < 96; i++) { const big = i % 4 === 0, p1 = polar(i * 3.75, big ? 204 : 216), p2 = polar(i * 3.75, 228); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: big ? 'tk big' : 'tk' }, dial); }
    for (let i = 0; i < 24; i++) { const p = polar(i * 15, 178); txt(dial, p[0], p[1], i, 'd24-num'); }
    txt(dial, 96, 12, '오전', 'd24-lbl'); txt(dial, -96, 12, '오후', 'd24-lbl');
    DY.hand = el('g', { class: 'hand', role: 'slider', tabindex: '0', 'aria-label': '24시간 시계 바늘' }, dial);
    el('path', { d: 'M-9 24 L-7 -136 Q0 -152 7 -136 L9 24 Z', class: 'd24-hand hand-body' }, DY.hand);
    el('line', { x1: 0, y1: -30, x2: 0, y2: -150, class: 'hit', 'data-hand': 'd' }, DY.hand);
    el('circle', { r: 14, class: 'ck-cap' }, dial); el('circle', { r: 5, class: 'ck-pin' }, dial);
    let prev = null, raw = 0;
    dial.addEventListener('pointerdown', e => {
      if (!e.target.getAttribute('data-hand')) return;
      e.preventDefault(); stopDayPlay(); prev = angleAt(dial, e); raw = DY.t;
      try { dial.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
    });
    dial.addEventListener('pointermove', e => {
      if (prev == null) return;
      const a = angleAt(dial, e); let d = a - prev; if (d > 180) d -= 360; if (d < -180) d += 360; prev = a; raw += d * 4;
      setDay(norm(Math.round(raw / 5) * 5), 'dial');
    });
    const up = () => { prev = null; }; dial.addEventListener('pointerup', up); dial.addEventListener('pointercancel', up);
    DY.hand.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 10 : e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0;
      if (!d) return; e.preventDefault(); stopDayPlay(); setDay(norm(DY.t + d), 'dial');
    });
  })();
  /* 하루 띠. 돌려주는 place(t)로 표시를 옮긴다 */
  const SX = 40, SW = 920, sxOf = t => SX + t / 1440 * SW, SY = 86, SH = 70;
  function drawDayStrip(strip, knob) {
    strip.setAttribute('viewBox', '0 0 1000 250'); strip.textContent = '';
    [[0, 5, 'night'], [5, 7, 'dawn'], [7, 17, 'day'], [17, 19, 'dawn'], [19, 24, 'night']]
      .forEach(b => el('rect', { x: sxOf(b[0] * 60), y: SY, width: (b[1] - b[0]) * SW / 24, height: SH, class: 'ds-bg-' + b[2] }, strip));
    const pass = el('rect', { x: SX, y: SY, width: 0, height: SH, class: 'ds-pass' }, strip);
    el('circle', { cx: sxOf(720), cy: SY + SH / 2, r: 14, class: 'ds-sun' }, strip);
    [0, 1440].forEach(t => { const cx = sxOf(t) + (t ? -22 : 22); el('circle', { cx: cx, cy: SY + SH / 2, r: 12, class: 'ds-moon' }, strip); el('circle', { cx: cx + 6, cy: SY + SH / 2 - 4, r: 10, class: 'ds-bg-night' }, strip); });
    for (let i = 0; i <= 24; i++) {
      const x = sxOf(i * 60); el('line', { x1: x, y1: SY, x2: x, y2: SY + SH, class: 'ds-tick' }, strip);
      txt(strip, x, SY - 10, i === 0 || i === 24 ? 12 : h12(i), 'ds-n ' + (S.mode24 ? 'off' : 'on'));
      txt(strip, x, SY + SH + 24, i, 'ds-n ' + (S.mode24 ? 'on' : 'off'));
    }
    el('path', { d: 'M' + (sxOf(0) + 4) + ' 48 V40 H' + (sxOf(720) - 4) + ' V48', class: 'ds-br' }, strip);
    el('path', { d: 'M' + (sxOf(720) + 4) + ' 48 V40 H' + (sxOf(1440) - 4) + ' V48', class: 'ds-br' }, strip);
    txt(strip, sxOf(360), 30, '오전', 'ds-brt'); txt(strip, sxOf(1080), 30, '오후', 'ds-brt');
    txt(strip, sxOf(0) + 30, SY + SH + 50, '밤 12시(자정)', 'ds-word'); txt(strip, sxOf(720), SY + SH + 50, '낮 12시(정오)', 'ds-word'); txt(strip, sxOf(1440) - 30, SY + SH + 50, '밤 12시(자정)', 'ds-word');
    const mark = el('line', { x1: 0, y1: SY - 4, x2: 0, y2: SY + SH + 4, class: 'ds-mark' }, strip);
    const kn = knob ? el('circle', { cx: 0, cy: SY + SH + 4, r: 13, class: 'ds-knob' }, strip) : null;
    const tag = txt(strip, 0, 236, '', 'ds-tag');
    return {
      place(t) {
        const x = sxOf(t); mark.setAttribute('x1', x); mark.setAttribute('x2', x); if (kn) kn.setAttribute('cx', x);
        pass.setAttribute('width', Math.max(0, x - SX)); tag.setAttribute('x', Math.min(900, Math.max(100, x))); tag.textContent = fmtHM(t);
      }
    };
  }
  const dayStrip = $('#dayStrip');
  let dayDrag = false;
  const stripT = e => { const q = svgPoint(dayStrip, e); return Math.max(0, Math.min(1440, Math.round((q.x - SX) / SW * 1440 / 5) * 5)); };
  dayStrip.addEventListener('pointerdown', e => { stopDayPlay(); dayDrag = true; try { dayStrip.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } setDay(stripT(e), 'strip'); });
  dayStrip.addEventListener('pointermove', e => { if (dayDrag) setDay(stripT(e), 'strip'); });
  dayStrip.addEventListener('pointerup', () => { dayDrag = false; }); dayStrip.addEventListener('pointercancel', () => { dayDrag = false; });
  function setDay(t, src) {
    DY.t = t; const ti = Math.round(t) % 1440;
    if (src !== 'clock') { if (src === 'play') dayClock.render(t); else dayClock.set(t, true); }
    DY.hand.setAttribute('transform', 'rotate(' + (t % 1440) / 4 + ')'); DY.hand.setAttribute('aria-valuetext', fmtHM(ti, true));
    if (DY.strip) DY.strip.place(t);
    $('#dayMain').textContent = fmtHM(ti, false);
    $('#dayAlt').textContent = '24시간제로 ' + fmtHM(ti, true) + ' (' + digital(ti, true).txt + ')';
    $('#dayNote').textContent = ti === 0 ? '밤 12시(자정) · 하루가 시작돼요' : ti === 720 ? '낮 12시(정오) · 오전이 끝나고 오후가 시작돼요'
      : ti < 720 ? '밤 12시부터 ' + fmtDur(ti) + ' 지났어요' : '낮 12시부터 ' + fmtDur(ti - 720) + ' 지났어요';
    if (src !== 'play') { $('#cntH').textContent = '0바퀴'; $('#cntM').textContent = '0바퀴'; }
  }
  function stopDayPlay() { if (DY.play) { DY.play.stop(); DY.play = null; setPlayBtn($('#dayPlay'), false, '하루 돌려보기'); } }
  $('#dayPlay').addEventListener('click', () => {
    if (DY.play) { stopDayPlay(); return; }
    dayClock.stopAnim(); setPlayBtn($('#dayPlay'), true, '하루 돌려보기');
    DY.play = tween(0, 1440, DY.speed, v => {
      setDay(v, 'play'); $('#cntH').textContent = Math.floor(v / 720 + 1e-6) + '바퀴'; $('#cntM').textContent = Math.floor(v / 60 + 1e-6) + '바퀴';
    }, () => { DY.play = null; setPlayBtn($('#dayPlay'), false, '하루 돌려보기'); dayClock.set(1440, true); }, true);
  });
  segBind($('#daySpeed'), DY.speed, v => { DY.speed = +v; });
  dayClock.svg.addEventListener('pointerdown', stopDayPlay, true);

  /* ═════════════ 4. 일과 ═════════════ */
  const RT = { sel: -1, hide: false, drag: null };
  const rtDur = it => durOf(it.s, it.e);
  /* 하루(0~1440) 안의 구간들로 펼친다. 자정을 넘으면 둘로 */
  const pieces = it => { const d = rtDur(it); if (!d) return []; return it.s + d <= 1440 ? [[it.s, it.s + d]] : [[it.s, 1440], [0, it.s + d - 1440]]; };
  function rtStats() {
    const cover = new Uint8Array(1440), clash = [];
    S.routine.forEach((it, i) => pieces(it).forEach(p => { for (let t = p[0]; t < p[1]; t++) cover[t]++; }));
    for (let i = 0; i < S.routine.length; i++) for (let j = i + 1; j < S.routine.length; j++) {
      const hit = pieces(S.routine[i]).some(p => pieces(S.routine[j]).some(q => Math.min(p[1], q[1]) > Math.max(p[0], q[0])));
      if (hit) clash.push([i, j]);
    }
    let used = 0; for (let t = 0; t < 1440; t++) if (cover[t]) used++;
    return { used: used, free: 1440 - used, clash: clash };
  }
  function rtSummary() {
    const st = rtStats(), nm = i => "'" + (S.routine[i].name || '이름 없음') + "'";
    $('#rtSum').textContent = S.routine.length ? '정한 시간 ' + fmtDur(st.used) + ' · 비어 있는 시간 ' + fmtDur(st.free) : '';
    const w = $('#rtWarn'); w.hidden = !st.clash.length;
    if (st.clash.length) {
      w.innerHTML = SK.icon('triangle-alert') + '<span></span>';
      const c = st.clash[0];
      w.lastChild.textContent = nm(c[0]) + josa(S.routine[c[0]].name || '이름 없음', '과/와') + ' ' + nm(c[1]) + ' 시간이 겹쳐요.' + (st.clash.length > 1 ? ' 겹치는 곳이 ' + (st.clash.length - 1) + '곳 더 있어요.' : '') + ' 시각을 고쳐 보세요.';
    }
    const bad = {}; st.clash.forEach(c => { bad[c[0]] = bad[c[1]] = true; });
    $$('#rtList .rt-item').forEach((r, k) => { r.classList.toggle('warn', !!bad[k]); r.classList.toggle('sel', k === RT.sel); });
  }
  function rtInfo() {
    const it = S.routine[RT.sel];
    $('#rtInfo').textContent = it ? (RT.hide ? '?' : (it.name || '이름 없음')) + ' · ' + fmtHM(it.s) + ' ~ ' + fmtHM(it.e) + ' · ' + fmtDur(rtDur(it)) : '활동을 누르면 시각과 걸린 시간이 보여요';
  }
  const BX0 = 30, BW = 940, bx = t => BX0 + t / 1440 * BW, BY = 56, BH = 62;
  function drawRoutine() {
    const C = $('#rtCircle'), B = $('#rtBar'); C.textContent = ''; B.textContent = '';
    const v = S.rtView; C.style.display = v === 'bar' ? 'none' : ''; B.style.display = v === 'circle' ? 'none' : ''; $('#rtViews').classList.toggle('bar-only', v === 'bar');
    const sel = S.routine[RT.sel];
    /* 원 */
    el('path', { d: arcPath(236, 250, 0, 180), class: 'rt-am' }, C); el('path', { d: arcPath(236, 250, 180, 360), class: 'rt-pm' }, C);
    txt(C, polar(45, 268)[0] + 8, polar(45, 268)[1] - 8, '오전', 'rt-amt'); txt(C, polar(225, 268)[0] - 8, polar(225, 268)[1] + 8, '오후', 'rt-amt');
    el('circle', { r: 200, class: 'rt-empty' }, C);
    S.routine.forEach((it, i) => {
      const d = rtDur(it); if (!d) return; const a1 = it.s / 4, a2 = a1 + d / 4;
      const p = el('path', { d: arcPath(0, 200, a1, a2), class: 'rt-seg' + (i === RT.sel ? ' sel' : ''), fill: it.c }, C); p.addEventListener('click', () => selRt(i));
      if (!RT.hide && d / 4 >= 14) { const mid = (a1 + a2) / 2, q = polar(mid, d / 4 > 40 ? 135 : 150); txt(C, q[0], q[1] - (d / 4 >= 30 ? 9 : 0), it.name, 'rt-lbl'); if (d / 4 >= 30) txt(C, q[0], q[1] + 13, fmtDur(d), 'rt-sub'); }
    });
    for (let i = 0; i < 24; i++) { const p1 = polar(i * 15, 200), p2 = polar(i * 15, 210); el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: 'rt-tick' }, C); const q = polar(i * 15, 223); txt(C, q[0], q[1], S.mode24 ? i : h12(i), 'rt-hr'); }
    el('circle', { r: 44, class: 'rt-center' }, C); txt(C, 0, -10, '하루', 'rt-ctext'); txt(C, 0, 14, '24시간', 'rt-ctext').style.fontSize = '18px';
    if (sel && rtDur(sel)) [['s', sel.s], ['e', sel.e]].forEach(r => { const p = polar(r[1] / 4, 200); el('circle', { cx: p[0], cy: p[1], r: 15, class: 'rt-handle ' + r[0], 'data-h': r[0] }, C); });
    /* 막대 */
    el('rect', { x: BX0, y: BY, width: BW, height: BH, class: 'rt-empty' }, B);
    el('path', { d: 'M' + (bx(0) + 3) + ' 38 V30 H' + (bx(720) - 3) + ' V38', class: 'ds-br' }, B); el('path', { d: 'M' + (bx(720) + 3) + ' 38 V30 H' + (bx(1440) - 3) + ' V38', class: 'ds-br' }, B);
    txt(B, bx(360), 18, '오전', 'rt-amt'); txt(B, bx(1080), 18, '오후', 'rt-amt');
    S.routine.forEach((it, i) => pieces(it).forEach(pc => {
      const w = (pc[1] - pc[0]) / 1440 * BW, x = bx(pc[0]);
      const r = el('rect', { x: x, y: BY, width: w, height: BH, class: 'rt-seg' + (i === RT.sel ? ' sel' : ''), fill: it.c }, B); r.addEventListener('click', () => selRt(i));
      if (!RT.hide && w >= 34) { const t = txt(B, x + w / 2, BY + BH / 2, it.name, 'rt-lbl'); t.style.fontSize = (w < 70 ? 13 : w < 110 ? 15 : 18) + 'px'; if (w < 60) t.setAttribute('transform', 'rotate(-90 ' + (x + w / 2) + ' ' + (BY + BH / 2) + ')'); }
    }));
    for (let i = 0; i <= 24; i++) { const x = bx(i * 60); el('line', { x1: x, y1: BY + BH, x2: x, y2: BY + BH + (i % 6 ? 6 : 12), class: 'rt-tick' }, B); if (i % 2 === 0 || S.mode24) txt(B, x, BY + BH + 28, S.mode24 ? i : (i === 0 || i === 24 ? 12 : h12(i)), 'rt-hr').style.fontSize = S.mode24 ? '15px' : '18px'; }
    if (sel && rtDur(sel)) [['s', sel.s], ['e', sel.e || (sel.s ? 1440 : 0)]].forEach(r => el('circle', { cx: bx(r[1]), cy: BY + BH, r: 13, class: 'rt-handle ' + r[0], 'data-h': r[0] }, B));
    rtInfo(); rtSummary();
  }
  function selRt(i) { RT.sel = RT.sel === i ? -1 : i; drawRoutine(); }
  /* 손잡이 끌기: 5분 단위. 그림을 다시 그려도 끌기가 이어지게 svg에 붙인다 */
  function bindRtDrag(svg, toTime) {
    svg.addEventListener('pointerdown', e => {
      const k = e.target.getAttribute && e.target.getAttribute('data-h'); if (!k || RT.sel < 0) return;
      e.preventDefault(); RT.drag = { svg: svg, k: k }; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
    });
    svg.addEventListener('pointermove', e => {
      if (!RT.drag || RT.drag.svg !== svg) return;
      const it = S.routine[RT.sel]; if (!it) return;
      const t = toTime(e), other = RT.drag.k === 's' ? it.e : it.s;
      if (t === other || t === it[RT.drag.k]) return;
      it[RT.drag.k] = t; drawRoutine();
    });
    const up = () => { if (!RT.drag || RT.drag.svg !== svg) return; RT.drag = null; save(); buildRtList(); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  bindRtDrag($('#rtCircle'), e => norm(Math.round(angleAt($('#rtCircle'), e) * 4 / 5) * 5));
  bindRtDrag($('#rtBar'), e => { const q = svgPoint($('#rtBar'), e); return norm(Math.max(0, Math.min(1440, Math.round((q.x - BX0) / BW * 1440 / 5) * 5))); });
  function timeSelects(val, label, onc) {
    const wrap = h('span'); const hs = h('select'), ms = h('select');
    hs.setAttribute('aria-label', label + ' 시'); ms.setAttribute('aria-label', label + ' 분');
    for (let hh = 0; hh < 24; hh++) hs.add(new Option(S.mode24 ? hh + '시' : ap(hh) + ' ' + h12(hh) + '시', hh));
    for (let m = 0; m < 60; m += 5) ms.add(new Option(pad(m) + '분', m));
    hs.value = Math.floor(val / 60); ms.value = Math.round(val % 60 / 5) * 5 % 60;
    const ch = () => onc(+hs.value * 60 + +ms.value); hs.addEventListener('change', ch); ms.addEventListener('change', ch);
    wrap.style.display = 'contents'; wrap.appendChild(hs); wrap.appendChild(ms); return wrap;
  }
  function buildRtList() {
    const L = $('#rtList'); L.textContent = '';
    if (!S.routine.length) L.appendChild(h('p', 'hint-text', '활동이 없어요. [활동 더하기]로 첫 활동을 넣어 보세요.'));
    S.routine.forEach((it, i) => {
      const row = h('div', 'rt-item');
      const pickRow = () => { if (RT.sel !== i) { RT.sel = i; drawRoutine(); } };
      const sw = h('button', 'rt-sw'); sw.type = 'button'; sw.style.background = it.c; sw.setAttribute('aria-label', '색 바꾸기');
      sw.addEventListener('click', () => { it.c = COLORS[(COLORS.indexOf(it.c) + 1) % COLORS.length]; sw.style.background = it.c; save(); drawRoutine(); });
      const nm = h('input'); nm.type = 'text'; nm.value = it.name; nm.maxLength = 10; nm.id = 'rtName' + i; nm.setAttribute('aria-label', '활동 이름');
      nm.addEventListener('input', () => { it.name = nm.value.slice(0, 10); save(); drawRoutine(); }); nm.addEventListener('focus', pickRow);
      const del = h('button', 'sk-btn sk-btn--sm rt-del'); del.type = 'button'; del.innerHTML = SK.icon('x'); del.setAttribute('aria-label', '활동 빼기');
      del.addEventListener('click', () => { S.routine.splice(i, 1); RT.sel = -1; save(); buildRtList(); drawRoutine(); });
      const tm = h('div', 'rt-times');
      tm.appendChild(timeSelects(it.s, '시작', v => { it.s = v; save(); RT.sel = i; drawRoutine(); }));
      tm.appendChild(h('span', '', '~'));
      tm.appendChild(timeSelects(it.e, '끝', v => { it.e = v; save(); RT.sel = i; drawRoutine(); }));
      tm.addEventListener('focusin', pickRow);
      row.appendChild(sw); row.appendChild(nm); row.appendChild(del); row.appendChild(tm); L.appendChild(row);
    });
    $('#rtAdd').disabled = S.routine.length >= MAX_ITEMS;
  }
  segBind($('#rtView'), S.rtView, v => { S.rtView = v; save(); drawRoutine(); });
  togBind($('#rtHide'), false, on => { RT.hide = on; drawRoutine(); });
  $('#rtAdd').addEventListener('click', () => {
    if (S.routine.length >= MAX_ITEMS) return;
    const last = S.routine[S.routine.length - 1]; const s = last ? last.e : 720;
    S.routine.push({ name: '새 활동', s: s, e: (s + 60) % 1440, c: COLORS[S.routine.length % COLORS.length] });
    RT.sel = S.routine.length - 1; save(); buildRtList(); drawRoutine();
    const inp = $('#rtName' + RT.sel); if (inp) { inp.focus(); inp.select(); }
  });
  function ask(msg, opts) { return window.VUI && window.VUI.confirm ? window.VUI.confirm(msg, opts) : Promise.resolve(window.confirm(msg)); }
  $('#rtSample').addEventListener('click', () => ask('지금 일과를 예시 일과로 바꿀까요?', { ok: '바꾸기' }).then(ok => { if (!ok) return; S.routine = sample(); RT.sel = -1; save(); buildRtList(); drawRoutine(); }));
  $('#rtClear').addEventListener('click', () => ask('일과를 모두 지울까요?', { ok: '지우기', danger: true }).then(ok => { if (!ok) return; S.routine = []; RT.sel = -1; save(); buildRtList(); drawRoutine(); }));
  $('#rtPrint').addEventListener('click', () => {
    if (!S.routine.length) { SK.toast('인쇄할 활동이 없어요.'); return; }
    const keep = { sel: RT.sel, hide: RT.hide, view: S.rtView };
    RT.sel = -1; RT.hide = false; S.rtView = 'both'; drawRoutine();
    const P = $('#printSheet'); P.textContent = '';
    P.appendChild(h('h1', '', '나의 하루 일과')); P.appendChild(h('p', 'p-name', '이름: ____________________'));
    const c = $('#rtCircle').cloneNode(true), b = $('#rtBar').cloneNode(true);
    c.removeAttribute('id'); b.removeAttribute('id'); c.removeAttribute('style'); b.removeAttribute('style'); c.setAttribute('class', 'rt-views p-circle'); b.setAttribute('class', 'rt-views');
    P.appendChild(c); P.appendChild(b);
    const tb = h('table'), hr = h('tr'); ['활동', '시작한 시각', '끝난 시각', '걸린 시간'].forEach(s => hr.appendChild(h('th', '', s))); tb.appendChild(hr);
    S.routine.slice().sort((x, y) => x.s - y.s).forEach(it => { const tr = h('tr'); [it.name || '이름 없음', fmtHM(it.s), fmtHM(it.e), fmtDur(rtDur(it))].forEach(s => tr.appendChild(h('td', '', s))); tb.appendChild(tr); });
    P.appendChild(tb);
    RT.sel = keep.sel; RT.hide = keep.hide; S.rtView = keep.view; drawRoutine();
    window.print();
  });

  /* ═════════════ 5. 달력 ═════════════ */
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();
  const keyOf = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);
  const fromKey = k => { const a = k.split('-').map(Number); return { y: a[0], m: a[1] - 1, d: a[2] }; };
  const dayNum = k => { const p = fromKey(k); return Date.UTC(p.y, p.m, p.d) / 864e5; };
  const keyFromNum = n => { const t = new Date(n * 864e5); return keyOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const dowOf = k => { const p = fromKey(k); return new Date(p.y, p.m, p.d).getDay(); };
  const longDate = k => { const p = fromKey(k); return p.y + '년 ' + (p.m + 1) + '월 ' + p.d + '일 ' + DOW[dowOf(k)] + '요일'; };
  const shortDate = k => { const p = fromKey(k); return (p.m + 1) + '월 ' + p.d + '일'; };
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
  const CAL = { y: today.getFullYear(), m: today.getMonth(), mode: 'one', a: todayKey, b: null, hide: false, shown: {} };
  /* 달력 그리기(자유 탐험·미션 공용). o: y, m, sel[], lo, hi, base, marks, hide, shown, onPick(k, other) */
  function renderCal(G, o) {
    G.textContent = '';
    DOW.forEach((w, i) => G.appendChild(h('div', 'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), w)));
    const first = new Date(o.y, o.m, 1).getDay(), n = dim(o.y, o.m), weeks = Math.ceil((first + n) / 7);
    for (let i = 0; i < weeks * 7; i++) {
      const dt = new Date(o.y, o.m, 1 - first + i), k = keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate()), dn = dayNum(k);
      const other = dt.getMonth() !== o.m, wd = dt.getDay();
      const c = h('button', 'cal-cell' + (other ? ' other' : '') + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + (k === todayKey && !o.noToday ? ' today' : '')
        + (o.sel && o.sel.indexOf(k) >= 0 ? ' sel' : '') + (o.base === k ? ' base' : '') + (o.lo != null && dn > o.lo && dn < o.hi ? ' inrange' : '')
        + (o.hide && !o.shown[k] && !other ? ' hid' : ''));
      c.type = 'button'; c.appendChild(h('span', 'd', dt.getDate()));
      if (o.marks && o.marks[k]) c.appendChild(h('span', 'cal-mark', o.marks[k]));
      c.setAttribute('aria-label', longDate(k) + (o.marks && o.marks[k] ? ', ' + o.marks[k] : ''));
      c.addEventListener('click', () => o.onPick(k, other));
      G.appendChild(c);
    }
    G.style.gridTemplateRows = 'auto repeat(' + weeks + ', minmax(44px, 1fr))';
  }
  function drawCal() {
    $('#calTitle').textContent = CAL.y + '년 ' + (CAL.m + 1) + '월';
    const ys = $('#calYearSel');
    if (!ys.querySelector('option[value="' + CAL.y + '"]')) { ys.textContent = ''; for (let y = Math.min(1990, CAL.y); y <= Math.max(2060, CAL.y); y++) ys.add(new Option(y + '년', y)); }
    ys.value = CAL.y; $('#calMonthSel').value = CAL.m;
    let lo = null, hi = null; if (CAL.mode === 'range' && CAL.a && CAL.b) { lo = Math.min(dayNum(CAL.a), dayNum(CAL.b)); hi = Math.max(dayNum(CAL.a), dayNum(CAL.b)); }
    renderCal($('#calGrid'), {
      y: CAL.y, m: CAL.m, sel: [CAL.a, CAL.b].filter(Boolean), lo: lo, hi: hi, marks: S.marks, hide: CAL.hide, shown: CAL.shown,
      onPick(k, other) {
        if (CAL.hide) CAL.shown[k] = true;
        if (CAL.mode === 'one') { CAL.a = k; CAL.b = null; } else if (!CAL.a || CAL.b) { CAL.a = k; CAL.b = null; } else CAL.b = k;
        if (other) { const p = fromKey(k); CAL.y = p.y; CAL.m = p.m; }
        drawCal();
      }
    });
    calInfo(); drawMonths();
  }
  function calInfo() {
    const I = $('#calInfo'); I.textContent = '';
    const put = (main, sub) => { I.appendChild(document.createTextNode(main)); if (sub) I.appendChild(h('small', '', sub)); };
    if (CAL.mode === 'one') {
      if (!CAL.a) { put('날짜를 눌러 보세요'); return; }
      const p = fromKey(CAL.a), nth = Math.ceil(p.d / 7);
      put(longDate(CAL.a), (p.m + 1) + '월의 ' + nth + '번째 ' + DOW[dowOf(CAL.a)] + '요일' + (S.marks[CAL.a] ? ' · ' + S.marks[CAL.a] : '')); return;
    }
    if (!CAL.a) { put('첫 번째 날을 눌러요'); return; }
    if (!CAL.b) { put(shortDate(CAL.a), '두 번째 날을 눌러요'); return; }
    let x = CAL.a, y = CAL.b; if (dayNum(x) > dayNum(y)) { const t = x; x = y; y = t; }
    const diff = dayNum(y) - dayNum(x), w = Math.floor(diff / 7), r = diff % 7;
    put(shortDate(x) + ' → ' + shortDate(y), shortDate(x) + '에서 ' + diff + '일 뒤예요' + (diff >= 7 ? ' = ' + w + '주일' + (r ? ' ' + r + '일' : '') : ''));
  }
  function drawMonths() {
    const M = $('#calMonths'); M.textContent = '';
    for (let m = 0; m < 12; m++) { const n = dim(CAL.y, m), d = h('div', (n === 31 ? 'd31' : n === 30 ? 'd30' : 'd28') + (m === CAL.m ? ' cur' : ''), (m + 1) + '월'); d.appendChild(h('b', '', n + '일')); M.appendChild(d); }
    const leap = dim(CAL.y, 1) === 29; $('#calYearNote').textContent = CAL.y + '년 2월은 ' + (leap ? 29 : 28) + '일, 1년은 ' + (leap ? 366 : 365) + '일';
  }
  segBind($('#calMode'), 'one', v => { CAL.mode = v; CAL.b = null; drawCal(); });
  const calShift = d => { CAL.m += d; while (CAL.m < 0) { CAL.m += 12; CAL.y--; } while (CAL.m > 11) { CAL.m -= 12; CAL.y++; } drawCal(); };
  $('#calPrev').addEventListener('click', () => calShift(-1)); $('#calNext').addEventListener('click', () => calShift(1));
  $('#calPrevY').addEventListener('click', () => calShift(-12)); $('#calNextY').addEventListener('click', () => calShift(12));
  for (let m = 0; m < 12; m++) $('#calMonthSel').add(new Option((m + 1) + '월', m));
  $('#calYearSel').addEventListener('change', e => { CAL.y = +e.target.value; drawCal(); });
  $('#calMonthSel').addEventListener('change', e => { CAL.m = +e.target.value; drawCal(); });
  $('#calToday').addEventListener('click', () => { CAL.y = today.getFullYear(); CAL.m = today.getMonth(); CAL.a = todayKey; CAL.b = null; drawCal(); });
  const calTarget = () => (CAL.mode === 'range' && CAL.b ? CAL.b : CAL.a);
  $('#calMoves').addEventListener('click', e => {
    const b = e.target.closest('[data-mv]'); if (!b) return;
    const base = calTarget(); if (!base) { SK.toast('먼저 날짜를 눌러 보세요.'); return; }
    const nk = keyFromNum(dayNum(base) + +b.dataset.mv);
    if (CAL.mode === 'one') CAL.a = nk; else CAL.b = nk;
    const p = fromKey(nk); CAL.y = p.y; CAL.m = p.m; if (CAL.hide) CAL.shown[nk] = true; drawCal();
  });
  $('#calMarkAdd').addEventListener('click', () => {
    const t = $('#calMarkTxt').value.trim().slice(0, 12), k = calTarget();
    if (!k) { SK.toast('먼저 날짜를 눌러 보세요.'); return; }
    if (!t) { SK.toast('표시할 글을 적어 보세요.'); return; }
    S.marks[k] = t; save(); $('#calMarkTxt').value = ''; drawCal();
  });
  $('#calMarkTxt').addEventListener('keydown', e => { if (e.key === 'Enter') $('#calMarkAdd').click(); });
  $('#calMarkDel').addEventListener('click', () => { const k = calTarget(); if (k && S.marks[k]) { delete S.marks[k]; save(); drawCal(); } else SK.toast('고른 날에 표시가 없어요.'); });
  togBind($('#calHide'), false, on => { CAL.hide = on; CAL.shown = {}; drawCal(); });

  /* ═════════════ 6. 미션 ═════════════ */
  const fb = SK.feedback('#mFeedback');
  const mA = new Clock($('#mClockA'), { total: 600, locked: true });
  const mB = new Clock($('#mClockB'), { total: 600, step: 5, onChange: t => { $('#mDigB').textContent = M.q && M.q.kind === 'place' ? fmtHM(t, false, false) : ''; } });
  const M = { qs: [], qi: 0, tries: 0, first: 0, dots: [], q: null, picked: null, solved: false };
  const MC = { y: 0, m: 0, base: null, sel: null, onPick: null };
  const t12 = t => fmtHM(t, false, true);
  function mStage(o) {
    $('#mPair').hidden = !o.a; $('#mCardB').hidden = !o.b; $('#mArrow').hidden = !o.b;
    $('#mStripBox').hidden = !o.strip; $('#mCalBox').hidden = !o.cal;
    $('#mCapA').textContent = o.capA || ''; $('#mCapB').textContent = o.capB || ''; $('#mDigA').textContent = o.digA || ''; $('#mDigB').textContent = '';
  }
  function drawMCal() {
    $('#mCalTitle').textContent = MC.y + '년 ' + (MC.m + 1) + '월';
    renderCal($('#mCalGrid'), { y: MC.y, m: MC.m, sel: MC.sel ? [MC.sel] : [], base: MC.base, noToday: true, shown: {}, onPick: (k) => { if (MC.onPick) MC.onPick(k); } });
  }
  const mCalShift = d => { MC.m += d; if (MC.m < 0) { MC.m = 11; MC.y--; } if (MC.m > 11) { MC.m = 0; MC.y++; } drawMCal(); };
  $('#mCalPrev').addEventListener('click', () => mCalShift(-1)); $('#mCalNext').addEventListener('click', () => mCalShift(1));
  /* 보기 만들기: 정답 + 오답들(겹치면 뺌)에서 4개 */
  function options(ans, wrongs) { const out = [ans]; wrongs.forEach(w => { if (out.length < 4 && out.indexOf(w) < 0) out.push(w); }); return shuffle(out); }

  const SCENES = [['아침에 일어나 세수를 해요.', 430], ['학교에서 첫째 시간 공부를 시작해요.', 540], ['학교에서 점심을 먹고 나서 운동장에서 놀아요.', 770], ['학교가 끝나고 집에 돌아와요.', 880], ['저녁을 먹고 책을 읽어요.', 1170], ['잠자리에 누워요.', 1290]];
  const UNITS = [['1주일은 며칠일까요?', '7일', ['5일', '10일', '12일']], ['2주일은 며칠일까요?', '14일', ['7일', '12일', '20일']], ['3주일은 며칠일까요?', '21일', ['14일', '30일', '24일']],
    ['1년은 몇 개월일까요?', '12개월', ['10개월', '24개월', '7개월']], ['1년 6개월은 몇 개월일까요?', '18개월', ['16개월', '7개월', '24개월']], ['2년은 몇 개월일까요?', '24개월', ['12개월', '20개월', '14개월']],
    ['하루는 몇 시간일까요?', '24시간', ['12시간', '60시간', '10시간']], ['1시간은 몇 분일까요?', '60분', ['100분', '24분', '12분']]];

  const MISSIONS = [
    { title: '걸린 시간 구하기', make(i) {
      const hh = 8 + rand(7); let m0, dur;
      if (i === 0) { m0 = pick([0, 10, 20]); dur = pick([20, 30]); } else if (i === 1) { m0 = pick([0, 10, 20]); dur = 60 + pick([10, 20, 30]); } else { m0 = pick([40, 50]); dur = pick([30, 40, 80, 90]); }
      const a = hh * 60 + m0, b = a + dur;
      return { kind: 'hm', text: '시작한 시각과 끝난 시각을 보고 걸린 시간을 구해요.', a: a, b: b, dur: dur,
        setup() { mStage({ a: 1, b: 1, capA: '시작한 시각', capB: '끝난 시각', digA: '' }); mA.set(a, true); mB.o.locked = true; mB.applyOpts(); mB.set(b, true); },
        hint() { $('#mStripBox').hidden = false; drawStrip($('#mStrip'), norm(a), dur, dur); return '시간 띠에서 색칠한 곳을 세어 봐요. 한 칸은 10분, 6칸은 1시간이에요.'; },
        explain: t12(a) + '에서 ' + t12(b) + '까지 ' + fmtDur(dur) + '이에요.' };
    } },
    { title: '끝난 시각 맞추기', make(i) {
      const hh = 8 + rand(7); let m0, dur;
      if (i === 0) { m0 = pick([0, 10, 20]); dur = pick([20, 30]); } else if (i === 1) { m0 = pick([40, 50]); dur = pick([20, 30, 40]); } else { m0 = pick([30, 40, 50]); dur = 60 + pick([30, 40, 50]); }
      const a = hh * 60 + m0, b = a + dur;
      return { kind: 'place', text: t12(a) + '에 시작해서 ' + fmtDur(dur) + ' 동안 했어요. 끝난 시각을 오른쪽 시계에 나타내요.', a: a, b: b, dur: dur,
        setup() { mStage({ a: 1, b: 1, capA: '시작한 시각', capB: '끝난 시각 · 바늘을 돌려요', digA: fmtHM(a, false, false) }); mA.set(a, true); mB.o.locked = false; mB.applyOpts(); mB.set(a); },
        check() { return norm(mB.value) % 720 === norm(b) % 720; },
        hint() { return norm(mB.value) % 60 !== norm(b) % 60 ? '긴바늘을 다시 살펴봐요. 숫자 한 칸은 5분이에요.' : '긴바늘이 12를 지나면 짧은바늘도 다음 숫자 쪽으로 가요.'; },
        reveal() { mB.o.locked = true; mB.applyOpts(); mB.animateTo(shortest(mB.total, b)); },
        explain: t12(a) + '에서 ' + fmtDur(dur) + ' 뒤는 ' + ieyo(t12(b)) + '.' };
    } },
    { title: '오전과 오후', make(i) {
      if (i === 0) {
        const sc = pick(SCENES), t = sc[1], ans = ap(Math.floor(t / 60));
        return { kind: 'opts', text: sc[0] + ' 시계는 ' + ieyo(fmtHM(t, false, false)) + '. 오전일까요, 오후일까요?', opts: ['오전', '오후'], ans: ans,
          setup() { mStage({ a: 1, capA: '지금 시각' }); mA.set(t, true); },
          hint() { return '낮 12시보다 앞이면 오전, 뒤면 오후예요.'; },
          reveal() { $('#mStripBox').hidden = false; drawDayStrip($('#mStrip'), false).place(t); },
          explain: ieyo(t12(t)) + '. 밤 12시부터 낮 12시까지가 오전, 낮 12시부터 밤 12시까지가 오후예요.' };
      }
      const pm = i === 2 && rand(2) === 1, bh = (pm ? 22 : 10) + rand(2), base = bh * 60, n = bh % 12 === 10 ? 3 + rand(2) : 2 + rand(3), res = norm(base + n * 60), rh = Math.floor(res / 60);
      const flip = (rh < 12 ? '오후 ' : '오전 ') + h12(rh) + '시';
      return { kind: 'opts', text: t12(base) + '에서 ' + n + '시간 뒤는 몇 시일까요?', ans: t12(res),
        opts: options(t12(res), [flip, ap(Math.floor(base / 60)) + ' ' + (h12(Math.floor(base / 60)) + n) + '시', ap(rh) + ' ' + (h12(rh) % 12 + 1) + '시', ap(rh) + ' ' + (h12(rh) + 2) + '시']),
        setup() { mStage({ a: 1, capA: '처음 시각 · ' + t12(base) }); mA.set(base, true); },
        hint() { return '12시를 지나면 오전과 오후가 바뀌어요. 12시 다음은 1시예요.'; },
        reveal() { $('#mStripBox').hidden = false; drawDayStrip($('#mStrip'), false).place(res); mA.animateTo(base + n * 60); },
        explain: t12(base) + '에서 ' + n + '시간 뒤는 ' + (pm ? '다음 날 ' : '') + ieyo(t12(res)) + '.' };
    } },
    { title: '24시간으로 말하기', make(i) {
      const hh = 13 + rand(11), m = i === 2 ? pick([10, 20, 30, 40, 50]) : 0, t = hh * 60 + m, tail = m ? ' ' + m + '분' : '';
      const rev = i === 1;
      const o24 = x => x + '시' + tail, o12 = x => '오후 ' + x + '시' + tail;
      const q = rev
        ? { text: fmtHM(t, true) + josa(fmtHM(t, true), '은/는') + ' 오전·오후로 말하면 몇 시일까요?', ans: t12(t), opts: options(t12(t), [o12(hh - 10), '오전 ' + (hh - 12) + '시' + tail, o12(h12(hh) % 12 + 1)]) }
        : { text: t12(t) + josa(t12(t), '은/는') + ' 24시간제로 몇 시일까요?', ans: fmtHM(t, true), opts: options(fmtHM(t, true), [o24(hh - 2), o24(hh - 12), o24(hh + 1 > 24 ? hh - 1 : hh + 1)]) };
      return Object.assign(q, { kind: 'opts',
        setup() { mStage({ a: 1, capA: rev ? '오후의 시계' : '오후 ' + fmtHM(t, false, false) }); mA.o.nums24 = false; mA.applyOpts(); mA.set(t, true); },
        hint() { return '낮 12시가 지나면 13시, 14시로 이어서 세요. 오후 시각에 12를 더하면 24시간제 시각이에요.'; },
        reveal() { mA.o.nums24 = true; mA.applyOpts(); },
        explain: t12(t) + josa(t12(t), '은/는') + ' 24시간제로 ' + ieyo(fmtHM(t, true)) + '. (' + h12(hh) + ' + 12 = ' + hh + ')' });
    } },
    { title: '달력에서 날짜 찾기', make(i) {
      const y = today.getFullYear(), m = rand(12); let d, n, word;
      if (i === 0) { d = 3 + rand(10); n = 7; word = '1주일 뒤'; }
      else if (i === 1) { d = 5 + rand(8); n = pick([3, 4, 5, 10, 14]); word = n === 14 ? '2주일 뒤' : n + '일 뒤'; }
      else if (rand(2)) { d = dim(y, m) - rand(4); n = 7; word = '1주일 뒤'; } else { d = 3 + rand(5); n = -10; word = '10일 전'; }
      const base = keyOf(y, m, d), target = keyFromNum(dayNum(base) + n);
      return { kind: 'cal', text: shortDate(base) + '에서 ' + word + '는 며칠일까요? 달력에서 그 날짜를 눌러요.', target: target,
        setup() { mStage({ cal: 1 }); MC.y = y; MC.m = m; MC.base = base; MC.sel = null; drawMCal(); },
        check() { return M.picked === target; },
        hint() { return Math.abs(n) % 7 === 0 ? '1주일은 7일이에요. 같은 요일이 있는 아래 줄을 찾아봐요.' : (i === 2 ? '달이 바뀌면 [1달] 단추로 달력을 넘겨요. ' : '') + '주황 테두리 날짜에서 하루씩 세어 봐요.'; },
        reveal() { const p = fromKey(target); MC.y = p.y; MC.m = p.m; MC.sel = target; drawMCal(); },
        explain: shortDate(base) + '에서 ' + word + '는 ' + shortDate(target) + ' ' + DOW[dowOf(target)] + '요일이에요.' };
    } },
    { title: '요일과 날수', make(i) {
      const y = today.getFullYear(), m = rand(12);
      const showCal = (base, sel) => { $('#mCalBox').hidden = false; MC.y = y; MC.m = m; MC.base = base; MC.sel = sel; if (sel) { const p = fromKey(sel); MC.y = p.y; MC.m = p.m; } drawMCal(); };
      if (i === 0) { const u = pick(UNITS); return { kind: 'opts', text: u[0], ans: u[1], opts: options(u[1], u[2]), setup() { mStage({}); }, hint() { return '1주일은 7일, 1년은 12개월, 하루는 24시간, 1시간은 60분이에요.'; }, explain: u[0].replace(/ (며칠|몇 개월|몇 시간|몇 분)일까요\?$/, ' ') + u[1] + '이에요.' }; }
      if (i === 1) {
        const d = 2 + rand(12), n = pick([7, 8, 10, 14]), base = keyOf(y, m, d), target = keyFromNum(dayNum(base) + n), w0 = dowOf(base), w1 = dowOf(target);
        return { kind: 'opts', text: shortDate(base) + '은 ' + DOW[w0] + '요일이에요. ' + n + '일 뒤는 무슨 요일일까요?', ans: DOW[w1] + '요일',
          opts: options(DOW[w1] + '요일', shuffle([1, 2, 3, 4, 5, 6]).map(k => DOW[(w1 + k) % 7] + '요일')),
          setup() { mStage({}); MC.onPick = null; },
          hint() { return '같은 요일은 7일마다 돌아와요. 7일 뒤는 같은 요일이에요.'; },
          reveal() { showCal(base, target); },
          explain: shortDate(base) + '에서 ' + n + '일 뒤는 ' + shortDate(target) + ' ' + DOW[w1] + '요일이에요.' };
      }
      const n = dim(y, m);
      return { kind: 'opts', text: y + '년 ' + (m + 1) + '월은 며칠까지 있을까요?', ans: n + '일', opts: ['28일', '29일', '30일', '31일'],
        setup() { mStage({}); MC.onPick = null; },
        hint() { return '1, 3, 5, 7, 8, 10, 12월은 31일까지 있어요. 2월은 28일이나 29일까지 있어요.'; },
        reveal() { showCal(null, keyOf(y, m, n)); },
        explain: y + '년 ' + (m + 1) + '월은 ' + n + '일까지 있어요.' };
    } }
  ];

  function drawDots() {
    const S2 = $('#mStep'); S2.textContent = '';
    for (let i = 0; i < 3; i++) S2.appendChild(h('span', 'dot ' + (M.dots[i] || (i === M.qi ? 'cur' : ''))));
    S2.appendChild(h('span', '', '문제 ' + Math.min(M.qi + 1, 3) + ' / 3'));
  }
  function showButtons(state) { // 'ask' | 'next' | 'done'
    const last = mc.current() === MISSION_IDS.length - 1;
    $('#mCheck').hidden = state !== 'ask' || M.q.kind === 'opts' || M.q.kind === 'cal';
    $('#mNextQ').hidden = state !== 'next';
    $('#mNextMission').hidden = state !== 'done' || last;
    $('#mResult').hidden = !(state === 'done' && (last || mc.allDone()));
  }
  function renderAnswer() {
    const A = $('#mAnswer'); A.textContent = ''; const q = M.q;
    if (q.kind === 'opts') {
      const box = h('div', 'opts');
      q.opts.forEach(o => { const b = h('button', 'opt', o); b.type = 'button'; b.addEventListener('click', () => { if (M.solved) return; if (o === q.ans) { b.classList.add('right'); settle(true); } else { b.classList.add('wrong'); b.disabled = true; settle(false); } }); box.appendChild(b); });
      A.appendChild(box);
    } else if (q.kind === 'hm') {
      M.ansH = null; M.ansM = null;
      const row = (lbl, vals, key, unit) => {
        const r = h('div', 'field-row'); r.appendChild(h('span', 'lbl', lbl)); const c = h('div', 'chips'); c.setAttribute('role', 'group'); c.setAttribute('aria-label', lbl);
        vals.forEach(v => { const b = h('button', 'chip', v); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', v + unit);
          b.addEventListener('click', () => { if (M.solved) return; M[key] = v; $$('.chip', c).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }); c.appendChild(b); });
        r.appendChild(c); A.appendChild(r);
      };
      row('시간', [0, 1, 2, 3], 'ansH', '시간'); row('분', [0, 10, 20, 30, 40, 50], 'ansM', '분');
    } else if (q.kind === 'cal') {
      A.appendChild(h('p', 'hint-text', '주황 테두리가 처음 날짜예요. 달력에서 날짜를 누르면 바로 확인해요.'));
      MC.onPick = k => { if (M.solved) return; M.picked = k; MC.sel = k; drawMCal(); settle(q.check()); };
    } else {
      A.appendChild(h('p', 'hint-text', '오른쪽 시계의 긴바늘이나 짧은바늘을 끌어서 맞춘 뒤 [확인하기]를 눌러요. 바늘은 5분씩 움직여요.'));
    }
  }
  function askQuestion() {
    const q = M.q = M.qs[M.qi]; M.tries = 0; M.solved = false; M.picked = null; MC.onPick = null; MC.base = null; MC.sel = null;
    mA.o.nums24 = false; mA.applyOpts();
    fb.hide(); $('#mQ').textContent = q.text; q.setup(); renderAnswer(); drawDots(); showButtons('ask');
  }
  /* 맞으면 끝, 처음 틀리면 도움말, 두 번째 틀리면 정답을 보여 주고 끝 */
  function settle(ok) {
    const q = M.q;
    if (!ok && M.tries === 0) { M.tries = 1; fb.show('warn', '다시 생각해 봐요. ' + q.hint()); return; }
    M.solved = true;
    if (ok && M.tries === 0) M.first++;
    M.dots[M.qi] = ok ? 'ok' : 'no';
    if (q.reveal) q.reveal();
    if (q.kind === 'opts') $$('#mAnswer .opt').forEach(b => { b.disabled = true; if (b.textContent === q.ans) b.classList.add('right'); });
    const msg = (ok ? '맞았어요! ' : '정답을 함께 봐요. ') + q.explain;
    drawDots();
    if (M.qi < 2) { fb.show(ok ? 'ok' : 'info', msg); showButtons('next'); return; }
    const stars = Math.max(1, M.first);
    mc.complete({ stars: stars, message: msg + ' 별 ' + stars + '개를 받았어요.', tone: ok ? 'ok' : 'info' });
    showButtons('done');
  }
  $('#mCheck').addEventListener('click', () => {
    const q = M.q; if (!q || M.solved) return;
    if (q.kind === 'hm') {
      if (M.ansH == null || M.ansM == null) { fb.show('info', '시간과 분을 모두 골라요.'); return; }
      settle(M.ansH * 60 + M.ansM === q.dur);
    } else if (q.kind === 'place') settle(q.check());
  });
  $('#mNextQ').addEventListener('click', () => { M.qi++; askQuestion(); });
  $('#mNextMission').addEventListener('click', () => mc.next());
  $('#mResult').addEventListener('click', () => mc.finish());
  $('#mExit').addEventListener('click', () => setMode(S.tab));
  const mc = SK.missions({
    ids: MISSION_IDS, format: 'stars', progress: S.progress, nav: '#missionNav', feedback: fb, keepBest: true,
    onEnter(i) { $('#mTitle').textContent = '미션 ' + (i + 1) + '. ' + MISSIONS[i].title; M.qs = [0, 1, 2].map(k => MISSIONS[i].make(k)); M.qi = 0; M.first = 0; M.dots = []; askQuestion(); },
    onChange(p) { S.progress = p; save(); },
    onFinish() { showResult(); }
  });
  function showResult() {
    const G = $('#resultGrid'); G.textContent = '';
    MISSIONS.forEach((m, i) => { const c = h('div', 'result-cell'); c.setAttribute('role', 'listitem'); c.appendChild(h('span', '', (i + 1) + '. ' + m.title)); const s = h('span', 'stars', SK.stars.text(mc.starsOf(i), 3, '☆')); s.setAttribute('aria-label', '별 3개 중 ' + mc.starsOf(i) + '개'); c.appendChild(s); G.appendChild(c); });
    $('#resultSub').textContent = '미션 ' + MISSIONS.length + '개 중 ' + mc.doneCount() + '개를 마쳤어요. 모은 별은 ' + mc.totalStars() + '개예요.';
    screens.show('screenResult');
  }

  /* ═════════════ 공통: 모드·화면 ═════════════ */
  const screens = SK.screens({ focus: true });
  const VIEW = { read: 'viewRead', elapsed: 'viewElapsed', day: 'viewDay', routine: 'viewRoutine', cal: 'viewCal', mission: 'viewMission' };
  const PANE = { read: 'paneRead', elapsed: 'paneElapsed', day: 'paneDay', routine: 'paneRoutine', cal: 'paneCal', mission: 'paneMission' };
  let mode = null;
  function setMode(m) {
    if (!VIEW[m]) m = 'read';
    stopReadPlay(); stopElPlay(); stopDayPlay();
    if (mode === 'mission' && m !== 'mission') mc.stop();
    mode = m;
    Object.keys(VIEW).forEach(k => { $('#' + VIEW[k]).hidden = k !== m; $('#' + PANE[k]).hidden = k !== m; });
    $$('.mode-tab').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    if (m !== 'mission') { S.tab = m; save(); }
    if (m === 'routine') { buildRtList(); drawRoutine(); }
    if (m === 'cal') drawCal();
    if (m === 'mission') mc.start();
    const st = $('#stage'); if (st.scrollTo) st.scrollTo(0, 0);
  }
  $$('.mode-tab').forEach(b => b.addEventListener('click', () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode); }));
  function refreshAll() {
    updRead(readClock.value);
    if (R.quiz && R.quiz.type === 'place') $('#roMain').textContent = R.quiz.lvl === 'before' ? beforeStr(R.quiz.target) : fmtHM(R.quiz.target);
    updEl(); DY.strip = drawDayStrip(dayStrip, true); setDay(DY.t, 'mode'); buildRtList(); drawRoutine();
  }
  segBind($('#modeSeg'), S.mode24 ? '24' : '12', v => { S.mode24 = v === '24'; save(); refreshAll(); });
  $('#btnFull').addEventListener('click', () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => SK.toast('이 기기에서는 전체 화면을 쓸 수 없어요.')); else if (!p) SK.toast('이 기기에서는 전체 화면을 쓸 수 없어요.'); }
    } catch (e) { SK.toast('이 기기에서는 전체 화면을 쓸 수 없어요.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement, b = $('#btnFull');
    b.setAttribute('aria-pressed', String(on)); b.innerHTML = (on ? SK.icon('minimize') : SK.icon('maximize')) + '<span></span>'; b.lastChild.textContent = on ? '전체 화면 끄기' : '전체 화면';
  });

  $('#btnStart').addEventListener('click', () => { screens.show('screenMain'); setMode(S.tab); });
  $('#btnStartMission').addEventListener('click', () => { screens.show('screenMain'); setMode('mission'); });
  $('#btnRetry').addEventListener('click', () => { screens.show('screenMain'); mode = null; setMode('mission'); mc.go(0); });
  $('#btnToFree').addEventListener('click', () => { screens.show('screenMain'); setMode(S.tab); });

  /* 처음 그리기 */
  readClock.render(); updRead(readClock.value); syncMaskBtn();
  E.a.render(); E.b.render(); updEl();
  DY.strip = drawDayStrip(dayStrip, true); setDay(450, 'init');
  buildRtList(); drawRoutine(); drawCal();
})();
