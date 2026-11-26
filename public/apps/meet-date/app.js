// 협의 날짜 모으기 (docs/meet-date-plan.md §11)
// 종류: schedule(일정 정하기) · activity(활동 날짜 + 확인서) · live(실시간 등록부)
// 화면: 시작 · #new[=종류] 만들기 · #edit=CODE 설정 고치기 · #m=CODE 응답 · #s=CODE 출석 서명
//       #m=CODE&k=KEY → #manage=CODE 관리 · #share=… 양식 복제(vives-share)
// 서버 값은 모두 textContent로 넣는다(innerHTML에 넣지 않음). 아이콘만 VUI.icon(고정 이름) 사용.
// 서명 그림은 data:image/png 형식을 검사한 뒤에만 <img src>에 넣는다.
// @icons calendar circle-check clock map-pin pencil plus refresh-cw trash-2 x 
(function () {
  'use strict';

  const API = '/api/meet-date';
  const APP_PATH = '/apps/meet-date/';
  const $ = (id) => document.getElementById(id);
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const FIELD_LABEL = { org: '소속', pos: '직위', cls: '학년반·과목' };
  const KIND_LABEL = { schedule: '일정 정하기', activity: '활동 날짜 + 확인서', live: '실시간 등록부' };
  const FORM_DEFAULT = {
    schedule: { title: '협의회 참석 등록부', foot: '위와 같이 협의회에 참석하였음을 확인합니다.' },
    activity: { title: '활동 확인서', foot: '위와 같이 활동하였음을 확인합니다.' },
    live: { title: '참석 등록부', foot: '위와 같이 참석하였음을 확인합니다.' },
  };
  const LS_MINE = 'vives-meet:mine';
  const LS_ME = 'vives-meet:me';
  const lsResp = (id) => 'vives-meet:r:' + id;
  const lsSign = (id) => 'vives-meet:s:' + id;
  const lsExpect = (id) => 'vives-meet:expect:' + id;
  const ID_RE = /^[A-HJ-NP-Z2-9]{6}$/;
  const KEY_RE = /^[A-Za-z0-9_-]{22}$/;
  const PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

  // ── 작은 도구 ──────────────────────────────────────
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }
  function ic(name) {
    const t = document.createElement('template');
    t.innerHTML = VUI.icon(name); // 고정 이름만 넘긴다
    return t.content.firstChild || document.createTextNode('');
  }
  const pad = (n) => String(n).padStart(2, '0');
  function localDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d); }
  function dowOf(s) { return new Date(s + 'T00:00:00').getDay(); }
  function fmtD(s, year) {
    const [y, m, d] = s.split('-').map(Number);
    return (year ? y + '. ' : '') + m + '. ' + d + '.(' + DOW[dowOf(s)] + ')';
  }
  const fmtT = (s, e) => s + '~' + e;
  const fmtSlot = (sl, year) => fmtD(sl.d, year) + ' ' + fmtT(sl.s, sl.e);
  function fmtDT(iso) {
    const d = new Date(iso);
    return fmtD(localDate(d), true) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtHM(iso) { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function toLocalInput(iso) {
    const d = new Date(iso);
    return localDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function rangeDays(from, to) {
    const out = [];
    for (let d = from; d <= to && out.length < 100; d = addDays(d, 1)) out.push(d);
    return out;
  }
  const kindOf = (cfg) => (cfg && cfg.kind) || 'schedule';
  const store = VUI.storage;
  function mineList() { return store.get(LS_MINE, [], Array.isArray); }
  function saveMine(item) {
    const list = mineList().filter((x) => x && x.id !== item.id);
    list.unshift(item);
    store.set(LS_MINE, list.slice(0, 50));
  }
  function mineKey(id) { const m = mineList().find((x) => x && x.id === id); return m && KEY_RE.test(m.key || '') ? m.key : null; }
  function mineAt(id) { return (mineList().find((x) => x && x.id === id) || {}).at || Date.now(); }

  async function api(method, opts) {
    const o = opts || {};
    if (method === 'GET') {
      const headers = {};
      if (o.key) headers['X-Meet-Key'] = o.key;
      if (o.resp) { headers['X-Resp-Id'] = o.resp.rid; headers['X-Resp-Key'] = o.resp.rkey; }
      if (o.sign) { headers['X-Sign-Id'] = o.sign.sid; headers['X-Sign-Key'] = o.sign.skey; }
      return VUI.apiFetch(API + '?m=' + encodeURIComponent(o.id) + (o.query || ''), { headers, cache: 'no-store' });
    }
    return VUI.apiFetch(API, { json: o.body });
  }

  function show(view) {
    $('loading').hidden = true;
    document.querySelectorAll('.md-view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    if (view !== 'manage') stopPoll();
    window.scrollTo(0, 0);
  }
  function showError(msg) { $('err-msg').textContent = msg; show('error'); }
  function download(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const safeName = (s) => String(s || '협의').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 40) || '협의';
  const respLink = (id) => location.origin + APP_PATH + '#m=' + id;
  const signLink = (id) => location.origin + APP_PATH + '#s=' + id;
  const adminLink = (id, key) => location.origin + APP_PATH + '#m=' + id + '&k=' + key;
  const shareLinkOf = (cfg, id) => (kindOf(cfg) === 'live' ? signLink(id) : respLink(id));
  const normName = (s) => String(s || '').replace(/\s+/g, '');

  // ── 손글씨 서명 칸 ────────────────────────────────
  // 화면은 800×320 캔버스, 내보낼 때 400×160 투명 PNG(보통 5~15KB)
  function SigPad(box) {
    box.textContent = '';
    box.classList.remove('has-ink', 'is-disabled');
    const c = h('canvas', { width: 800, height: 320, 'aria-label': '서명란' });
    box.append(c);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.lineWidth = 7;
    let drawing = false, last = null, ink = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault(); drawing = true; last = pos(e);
      try { c.setPointerCapture(e.pointerId); } catch {}
      ctx.beginPath(); ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2); ctx.fill();
      if (!ink) { ink = true; box.classList.add('has-ink'); }
    });
    c.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) { const p = pos(ev); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; }
    });
    const end = () => { drawing = false; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('pointerleave', end);
    return {
      clear() { ctx.clearRect(0, 0, c.width, c.height); ink = false; box.classList.remove('has-ink'); },
      isEmpty() { return !ink; },
      disable(v) { box.classList.toggle('is-disabled', !!v); },
      toPng() {
        if (!ink) return null;
        const o = document.createElement('canvas'); o.width = 400; o.height = 160;
        const octx = o.getContext('2d');
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(c, 0, 0, 400, 160);
        return o.toDataURL('image/png');
      },
    };
  }

  // ── 라우터 ─────────────────────────────────────────
  async function route() {
    const hash = location.hash.slice(1);
    const p = new URLSearchParams(hash);
    closeBig();
    try {
      if (hash === 'new' || p.has('new')) return openBuilder(null, { kind: p.get('new') || 'schedule' });
      if (hash.startsWith('share=')) {
        const o = VUI.share.decode(hash.slice(6), (v) => v && v.t && typeof v.t.title === 'string');
        history.replaceState(null, '', APP_PATH + '#new');
        if (!o) return showError('양식 링크를 읽지 못했어요. 받은 링크를 다시 확인해 주세요.');
        VUI.toast('받은 양식으로 채웠어요. 날짜를 확인하고 만들어 주세요.');
        return openBuilder(null, { template: o.t });
      }
      if (p.get('edit')) {
        const id = p.get('edit'); const key = mineKey(id);
        if (!key) return showError('이 브라우저에 관리 링크가 없어요. 관리 링크로 열어 주세요.');
        return openBuilder(await loadOwner(id, key));
      }
      if (p.get('m') && p.get('k')) {
        const id = p.get('m'), key = p.get('k');
        if (!ID_RE.test(id) || !KEY_RE.test(key)) return showError('관리 링크가 올바르지 않아요.');
        const data = await loadOwner(id, key);
        saveMine({ id, key, title: data.event.config.title, at: mineAt(id) });
        history.replaceState(null, '', APP_PATH + '#manage=' + id); // 화면 공유 때 키가 보이지 않게
        return openManage(data);
      }
      if (p.get('manage')) {
        const id = p.get('manage'); const key = mineKey(id);
        if (!key) return showError('이 브라우저에 관리 링크가 없어요. 처음 받은 관리 링크로 열어 주세요.');
        return openManage(await loadOwner(id, key));
      }
      if (p.get('s')) {
        const id = p.get('s');
        if (!ID_RE.test(id)) return showError('주소가 올바르지 않아요. 받은 링크나 QR을 다시 확인해 주세요.');
        return openSign(id);
      }
      if (p.get('m')) {
        const id = p.get('m');
        if (!ID_RE.test(id)) return showError('주소가 올바르지 않아요. 받은 링크를 다시 확인해 주세요.');
        return openRespond(id);
      }
      return openHome();
    } catch (e) {
      showError(e && e.message ? e.message : '불러오지 못했어요.');
    }
  }
  async function loadOwner(id, key) {
    const data = await api('GET', { id, key });
    if (!data.owner) throw new Error('관리 링크가 맞지 않아요. 처음 받은 관리 링크를 확인해 주세요.');
    data.key = key;
    return data;
  }

  // ── 시작 ───────────────────────────────────────────
  function openHome() {
    const list = mineList();
    const ul = $('mine-list'); ul.textContent = '';
    for (const m of list) {
      if (!m || !ID_RE.test(m.id || '')) continue;
      ul.append(h('li', {},
        h('a', { class: 'md-item', href: '#manage=' + m.id },
          h('span', { class: 'md-item-title', text: m.title || m.id }),
          h('span', { class: 'md-item-sub', text: m.at ? fmtD(localDate(new Date(m.at))) + ' 만듦' : '' })),
        h('button', {
          class: 'hero-btn hero-btn-ghost hero-btn-icon hero-btn-sm', type: 'button', 'aria-label': '목록에서 빼기', title: '목록에서 빼기',
          onclick: async () => {
            if (!(await VUI.confirm('이 브라우저 목록에서 뺄까요? 받은 내용은 지워지지 않아요. 관리 링크가 없으면 다시 열 수 없어요.', { ok: '빼기' }))) return;
            store.set(LS_MINE, mineList().filter((x) => x.id !== m.id)); openHome();
          },
        }, ic('x'))));
    }
    $('home-mine').hidden = !ul.children.length;
    show('home');
  }
  $('form-open').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('in-open').value.trim();
    const m = v.match(/#m=([A-Z0-9]{6})&k=([A-Za-z0-9_-]{22})/);
    if (!m) { VUI.toast('관리 링크 전체를 붙여 넣어 주세요.', 'error'); return; }
    location.hash = 'm=' + m[1] + '&k=' + m[2];
  });

  // ── 만들기·고치기 ──────────────────────────────────
  const B = { editing: null, dows: new Set([1, 2, 3, 4, 5]), times: [], off: new Set(), ids: new Map(), seq: 0, closeTouched: false };

  function kindSel() { return document.querySelector('input[name="f-kind"]:checked').value; }
  function setKind(kind, applyDefaults) {
    const r = document.querySelector('input[name="f-kind"][value="' + kind + '"]');
    if (r) r.checked = true;
    $('form-new').dataset.kind = kind;
    const live = kind === 'live';
    $('live-opts').hidden = !live;
    $('range-opts').hidden = live;
    $('rule-label').textContent = kind === 'activity' ? '활동 횟수' : '몇 개 고르게 할까요?';
    $('form-h').textContent = kind === 'activity' ? '확인서 양식' : '등록부 양식';
    $('close-label').textContent = live ? '출석 마감 일시' : '응답 마감 일시';
    $('f-title').placeholder = kind === 'activity' ? '예) 방과후 학습 지원 봉사' : '예) 2학년 교육과정 협의회';
    if (applyDefaults) {
      $('f-form-title').value = FORM_DEFAULT[kind].title;
      $('f-form-foot').value = FORM_DEFAULT[kind].foot;
      if (kind === 'activity' && $('f-rule').value === 'any') { $('f-rule').value = 'exact'; $('f-rule-n').value = '2'; }
      syncRule();
      if (live && !B.closeTouched) syncLiveClose();
    }
  }
  document.querySelectorAll('input[name="f-kind"]').forEach((r) => r.addEventListener('change', () => setKind(r.value, true)));
  function syncLiveClose() {
    const d = $('f-live-d').value;
    if (d) $('f-close').value = d + 'T23:59';
  }
  $('f-live-d').addEventListener('change', () => { if (!B.closeTouched) syncLiveClose(); });
  $('f-close').addEventListener('input', () => { B.closeTouched = true; });

  function fillCommon(cfg) {
    $('f-title').value = cfg.title || ''; $('f-desc').value = cfg.desc || ''; $('f-place').value = cfg.place || '';
    $('f-owner').value = (cfg.form && cfg.form.owner) || '';
    const mode = document.querySelector('input[name="f-mode"][value="' + (cfg.mode || 'pick') + '"]');
    if (mode) mode.checked = true;
    $('f-rule').value = (cfg.rule && cfg.rule.type) || 'any'; $('f-rule-n').value = (cfg.rule && cfg.rule.n) || 1;
    document.querySelectorAll('input[name="f-field"]').forEach((c) => { c.checked = (cfg.fields || []).includes(c.value); });
    $('f-memo').checked = !!cfg.memo; $('f-others').checked = !!cfg.showOthers;
    const f = cfg.form || {}, def = FORM_DEFAULT[kindOf(cfg)];
    $('f-form-title').value = f.title || def.title; $('f-form-head').value = f.head || '';
    $('f-form-foot').value = f.foot != null ? f.foot : def.foot; $('f-sign').value = f.signFill || 'name'; $('f-when').checked = f.when !== false;
    $('f-sub-file').checked = !cfg.submit || cfg.submit.file !== false;
    $('f-sub-direct').checked = !cfg.submit || cfg.submit.direct !== false;
  }

  function openBuilder(data, opts) {
    const o = opts || {};
    B.editing = data;
    B.off = new Set(); B.ids = new Map(); B.seq = 0; B.closeTouched = false;
    $('new-error').hidden = true;
    const cfg = data && data.event.config;
    const today = localDate(new Date());
    if (cfg) {
      fillCommon(cfg);
      setKind(kindOf(cfg), false);
      $('f-from').value = cfg.range.from; $('f-to').value = cfg.range.to;
      if (cfg.session) { $('f-live-d').value = cfg.session.d; $('f-live-s').value = cfg.session.s; $('f-live-e').value = cfg.session.e; }
      if (cfg.mode === 'pick' && cfg.slots.length) {
        const tset = new Map();
        B.dows = new Set();
        for (const s of cfg.slots) {
          tset.set(s.s + '|' + s.e, { s: s.s, e: s.e });
          B.dows.add(dowOf(s.d));
          B.ids.set(s.d + '|' + s.s + '|' + s.e, s.id);
          const n = parseInt(String(s.id).replace(/\D/g, ''), 10);
          if (n >= B.seq) B.seq = n + 1;
        }
        B.times = [...tset.values()].sort((a, b) => a.s.localeCompare(b.s));
        const have = new Set(cfg.slots.map((s) => s.d + '|' + s.s + '|' + s.e));
        for (const d of rangeDays(cfg.range.from, cfg.range.to)) {
          if (!B.dows.has(dowOf(d))) continue;
          for (const t of B.times) { const k = d + '|' + t.s + '|' + t.e; if (!have.has(k)) B.off.add(k); }
        }
      } else { B.dows = new Set([1, 2, 3, 4, 5]); B.times = [{ s: '15:00', e: '16:00' }]; }
      $('f-close').value = toLocalInput(data.event.closesAt);
      B.closeTouched = true;
      document.querySelectorAll('input[name="f-mode"], input[name="f-kind"]').forEach((r) => { r.disabled = true; });
      $('f-live-open').closest('label').hidden = true;
      $('btn-save-new').querySelector('span').textContent = '고친 내용 저장';
    } else {
      $('form-new').reset();
      document.querySelectorAll('input[name="f-mode"], input[name="f-kind"]').forEach((r) => { r.disabled = false; });
      $('f-live-open').closest('label').hidden = false;
      const from = addDays(today, 1);
      $('f-from').value = from; $('f-to').value = addDays(from, 13);
      $('f-live-d').value = today;
      const close = new Date(); close.setDate(close.getDate() + 3); close.setHours(18, 0, 0, 0);
      $('f-close').value = toLocalInput(close.toISOString());
      B.dows = new Set([1, 2, 3, 4, 5]); B.times = [{ s: '15:00', e: '16:00' }];
      const t = o.template;
      if (t) {
        const kind = ['schedule', 'activity', 'live'].includes(t.kind) ? t.kind : 'schedule';
        fillCommon({ ...t, kind });
        setKind(kind, false);
        if (Array.isArray(t.dows)) B.dows = new Set(t.dows.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
        if (Array.isArray(t.times)) {
          const ok = t.times.filter((x) => x && /^\d\d:\d\d$/.test(x.s) && /^\d\d:\d\d$/.test(x.e) && x.s < x.e).slice(0, 12);
          if (ok.length) B.times = ok.map((x) => ({ s: x.s, e: x.e }));
        }
        if (t.session && /^\d\d:\d\d$/.test(t.session.s) && /^\d\d:\d\d$/.test(t.session.e)) { $('f-live-s').value = t.session.s; $('f-live-e').value = t.session.e; }
        if (kind === 'live') syncLiveClose();
      } else {
        setKind(['schedule', 'activity', 'live'].includes(o.kind) ? o.kind : 'schedule', true);
      }
      $('btn-save-new').querySelector('span').textContent = '만들고 링크 받기';
    }
    renderDows(); renderTimes(); syncMode(); syncRule(); renderSlotGrid();
    show('new');
  }

  function renderDows() {
    const box = $('f-dows'); box.textContent = '';
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      box.append(h('button', {
        type: 'button', class: 'md-chip', 'aria-pressed': String(B.dows.has(d)), text: DOW[d],
        onclick: () => { B.dows.has(d) ? B.dows.delete(d) : B.dows.add(d); renderDows(); renderSlotGrid(); },
      }));
    });
  }
  function renderTimes() {
    const box = $('f-times'); box.textContent = '';
    B.times.forEach((t, i) => {
      const s = h('input', { type: 'time', class: 'hero-input', value: t.s, step: 300, 'aria-label': '시작 시간' });
      const e = h('input', { type: 'time', class: 'hero-input', value: t.e, step: 300, 'aria-label': '끝 시간' });
      const upd = () => { t.s = s.value; t.e = e.value; renderSlotGrid(); };
      s.addEventListener('change', upd); e.addEventListener('change', upd);
      box.append(h('div', { class: 'md-time-row' }, s, h('span', { class: 'md-tilde', text: '~' }), e,
        B.times.length > 1 ? h('button', {
          type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-icon hero-btn-sm', 'aria-label': '시간대 빼기',
          onclick: () => { B.times.splice(i, 1); renderTimes(); renderSlotGrid(); },
        }, ic('x')) : null));
    });
  }
  $('btn-add-time').addEventListener('click', () => {
    const last = B.times[B.times.length - 1];
    let s = '16:00', e = '17:00';
    if (last && /^\d\d:\d\d$/.test(last.e)) {
      const [hh, mm] = last.e.split(':').map(Number);
      s = last.e; e = pad(Math.min(23, hh + 1)) + ':' + pad(mm);
    }
    B.times.push({ s, e }); renderTimes(); renderSlotGrid();
  });

  function builderSlots() {
    const from = $('f-from').value, to = $('f-to').value;
    if (!from || !to || from > to) return { days: [], times: [], slots: [] };
    const days = rangeDays(from, to).filter((d) => B.dows.has(dowOf(d)));
    const times = B.times.filter((t) => /^\d\d:\d\d$/.test(t.s) && /^\d\d:\d\d$/.test(t.e) && t.s < t.e)
      .sort((a, b) => a.s.localeCompare(b.s));
    const slots = [];
    for (const d of days) for (const t of times) {
      const k = d + '|' + t.s + '|' + t.e;
      if (B.off.has(k)) continue;
      if (!B.ids.has(k)) B.ids.set(k, 's' + (B.seq++));
      slots.push({ id: B.ids.get(k), d, s: t.s, e: t.e });
    }
    return { days, times, slots };
  }
  function renderSlotGrid() {
    const wrap = $('slot-grid'); wrap.textContent = '';
    const { days, times, slots } = builderSlots();
    $('slot-count').textContent = slots.length + '개';
    $('slot-count').className = 'md-pill' + (slots.length ? '' : ' warn');
    if (!days.length || !times.length) {
      wrap.append(h('p', { class: 'md-empty', text: '기간·요일·시간대를 정하면 후보 시간이 만들어져요.' }));
      return;
    }
    const thead = h('tr', {}, h('th', {}), times.map((t) => h('th', { text: fmtT(t.s, t.e) })));
    const rows = days.map((d) => h('tr', {}, h('th', { text: fmtD(d) }), times.map((t) => {
      const k = d + '|' + t.s + '|' + t.e;
      const on = !B.off.has(k);
      return h('td', {}, h('button', {
        type: 'button', class: 'md-sbtn', 'aria-pressed': String(on), 'aria-label': fmtD(d) + ' ' + fmtT(t.s, t.e),
        text: on ? t.s : '뺌',
        onclick: () => { B.off.has(k) ? B.off.delete(k) : B.off.add(k); renderSlotGrid(); },
      }));
    })));
    wrap.append(h('table', { class: 'md-sgrid' }, h('thead', {}, thead), h('tbody', {}, rows)));
    if (days.length > 40) wrap.append(h('p', { class: 'md-note', text: '날짜가 많아요. 요일을 줄이거나 기간을 좁히면 고르기 쉬워요.' }));
  }
  ['f-from', 'f-to'].forEach((id) => $(id).addEventListener('change', renderSlotGrid));

  function mode() { return document.querySelector('input[name="f-mode"]:checked').value; }
  function syncMode() { $('pick-opts').hidden = mode() !== 'pick'; }
  document.querySelectorAll('input[name="f-mode"]').forEach((r) => r.addEventListener('change', syncMode));
  function syncRule() { $('rule-n-wrap').hidden = $('f-rule').value === 'any'; }
  $('f-rule').addEventListener('change', syncRule);
  $('btn-cancel-new').addEventListener('click', () => {
    if (B.editing) location.hash = 'manage=' + B.editing.event.id; else location.hash = '';
  });

  $('form-new').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('new-error');
    const fail = (msg, focusId) => { errBox.textContent = msg; errBox.hidden = false; if (focusId) $(focusId).focus(); };
    errBox.hidden = true;
    const kind = kindSel();
    const live = kind === 'live';
    const m = live ? 'free' : mode();
    const { slots } = !live && m === 'pick' ? builderSlots() : { slots: [] };
    const config = {
      kind, title: $('f-title').value.trim(), desc: $('f-desc').value.trim(), place: $('f-place').value.trim(), mode: m,
      range: { from: $('f-from').value, to: $('f-to').value }, slots,
      session: live ? { d: $('f-live-d').value, s: $('f-live-s').value, e: $('f-live-e').value } : null,
      rule: { type: live ? 'any' : $('f-rule').value, n: Number($('f-rule-n').value) || 1 },
      fields: [...document.querySelectorAll('input[name="f-field"]:checked')].map((c) => c.value),
      memo: !live && $('f-memo').checked, showOthers: !live && $('f-others').checked,
      form: {
        title: $('f-form-title').value.trim(), head: $('f-form-head').value.trim(), foot: $('f-form-foot').value.trim(),
        owner: $('f-owner').value.trim(), signFill: $('f-sign').value, when: $('f-when').checked,
      },
      submit: kind === 'activity' ? { file: $('f-sub-file').checked, direct: $('f-sub-direct').checked } : null,
    };
    if (!config.title) return fail('제목을 적어 주세요.', 'f-title');
    if (live) {
      const s = config.session;
      if (!s.d) return fail('협의 날짜를 정해 주세요.', 'f-live-d');
      if (!s.s || !s.e || s.s >= s.e) return fail('시작 시간이 끝 시간보다 빨라야 해요.', 'f-live-s');
      config.range = { from: s.d, to: s.d };
    } else {
      if (!config.range.from || !config.range.to || config.range.from > config.range.to) return fail('기간을 확인해 주세요.', 'f-from');
      if (m === 'pick' && !slots.length) return fail('후보 시간을 하나 이상 만들어 주세요.');
      if (m === 'pick' && config.rule.type !== 'any' && config.rule.n > slots.length) return fail('횟수가 후보 시간 수(' + slots.length + '개)보다 많아요.', 'f-rule-n');
    }
    if (kind === 'activity' && !config.submit.file && !config.submit.direct) return fail('확인서 내는 방법을 하나 이상 골라 주세요.');
    const closeV = $('f-close').value;
    if (!closeV) return fail('마감 일시를 정해 주세요.', 'f-close');
    const closesAt = new Date(closeV).toISOString();

    const btn = $('btn-save-new'); btn.disabled = true;
    try {
      if (B.editing) {
        const ev = B.editing.event;
        const body = { action: 'update', id: ev.id, key: B.editing.key, config };
        if (closesAt !== ev.closesAt) body.closesAt = closesAt;
        await api('POST', { body });
        saveMine({ id: ev.id, key: B.editing.key, title: config.title, at: mineAt(ev.id) });
        VUI.toast('고친 내용을 저장했어요 ✓');
        location.hash = 'manage=' + ev.id;
      } else {
        const r = await api('POST', { body: { action: 'create', config, closesAt, liveOpen: $('f-live-open').checked } });
        saveMine({ id: r.id, key: r.key, title: config.title, at: Date.now() });
        VUI.toast(live ? '만들었어요. 협의 시간에 QR을 띄워 주세요.' : '만들었어요. 응답 링크를 보내 주세요.');
        location.hash = 'manage=' + r.id;
      }
    } catch (err) {
      fail(err.message);
    } finally { btn.disabled = false; }
  });

  // ── 공통: 머리 카드 ────────────────────────────────
  function confirmedSlots(ev) {
    const cfg = ev.config;
    if (kindOf(cfg) === 'live' && cfg.session) return [cfg.session];
    if (!ev.confirmed || !ev.confirmed.length) return [];
    if (cfg.mode === 'pick') {
      const byId = new Map(cfg.slots.map((s) => [s.id, s]));
      return ev.confirmed.map((id) => byId.get(id)).filter(Boolean);
    }
    return ev.confirmed;
  }
  function confirmedText(data) { return confirmedSlots(data.event).map((s) => fmtSlot(s, true)).join(', '); }
  function picksText(cfg, picks) {
    if (cfg.mode === 'pick') {
      const byId = new Map(cfg.slots.map((s) => [s.id, s]));
      return picks.map((id) => byId.get(id)).filter(Boolean).map((s) => fmtSlot(s));
    }
    return picks.map((s) => fmtSlot(s));
  }

  function eventHead(box, data, opts) {
    const o = opts || {};
    const ev = data.event, cfg = ev.config, kind = kindOf(cfg);
    box.textContent = '';
    box.append(h('h2', { class: 'md-ev-title', text: cfg.title }));
    if (cfg.desc) box.append(h('p', { class: 'md-ev-desc', text: cfg.desc }));
    const meta = h('ul', { class: 'md-meta' },
      kind === 'live' && cfg.session ? h('li', {}, ic('calendar'), fmtSlot(cfg.session, true))
        : h('li', {}, ic('calendar'), fmtD(cfg.range.from) + ' ~ ' + fmtD(cfg.range.to)),
      cfg.place ? h('li', {}, ic('map-pin'), cfg.place) : null,
      kind === 'live' ? null : h('li', {}, ic('clock'), '마감 ' + fmtDT(ev.closesAt)));
    box.append(meta);
    if (kind === 'live') {
      if (!o.manage && !ev.liveOpen) box.append(h('div', { class: 'md-banner closed' }, '지금은 출석을 받지 않아요. 협의가 시작되면 다시 열어 주세요. ',
        h('button', { type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-sm', onclick: () => route() }, ic('refresh-cw'), '새로 고침')));
      return;
    }
    const conf = confirmedText(data);
    if (conf) {
      box.append(h('div', { class: 'md-banner' }, h('b', { text: '확정: ' }), conf, ' ',
        h('button', { type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-sm', onclick: () => downloadIcs(ev) }, ic('calendar'), '내 달력에 넣기')));
    } else if (ev.closed) box.append(h('div', { class: 'md-banner closed', text: '응답이 마감됐어요. 확정되면 이 링크에서 확인할 수 있어요.' }));
  }

  // ── 응답(일정 정하기·활동) ──────────────────────────
  const R = { data: null, picks: new Set(), free: [], editing: false, pad: null };

  async function openRespond(id) {
    const resp = store.get(lsResp(id), null, (v) => v && typeof v.rid === 'string' && typeof v.rkey === 'string');
    const data = await api('GET', { id, resp });
    if (kindOf(data.event.config) === 'live') { history.replaceState(null, '', APP_PATH + '#s=' + id); return openSign(id); }
    if (resp && !data.mine) store.remove(lsResp(id)); // 담당자가 지운 응답
    R.data = data; R.editing = false;
    renderRespond();
    show('respond');
  }

  function ruleText(cfg) {
    const { type, n } = cfg.rule;
    const act = kindOf(cfg) === 'activity';
    if (type === 'exact') return (act ? '활동할 날짜를 ' : '') + n + '개 골라 주세요.';
    if (type === 'min') return (act ? '활동할 날짜를 ' : '') + n + '개 이상 골라 주세요.';
    if (act) return cfg.mode === 'pick' ? '활동할 시간을 골라 주세요.' : '활동할 날짜와 시간을 적어 주세요.';
    return cfg.mode === 'pick' ? '되는 시간을 모두 골라 주세요.' : '되는 날짜와 시간을 적어 주세요. 여러 개 적어도 돼요.';
  }

  function renderRespond() {
    const data = R.data, ev = data.event, cfg = ev.config, mine = data.mine;
    const act = kindOf(cfg) === 'activity';
    eventHead($('r-head'), data);
    $('r-pick-h').textContent = act ? '활동 날짜 고르기' : '되는 시간 고르기';
    const done = $('r-done');
    if (mine && !R.editing) {
      done.textContent = '';
      done.append(h('h2', { class: 'md-h2' }, ic('circle-check'), '제출했어요'),
        h('p', { class: 'md-note md-mt0', text: mine.name + ' · ' + picksText(cfg, mine.picks).join(', ') }),
        ev.closed ? h('p', { class: 'md-note', text: '마감돼서 고를 날짜는 더 고칠 수 없어요.' }) :
          h('div', { class: 'md-actions md-actions-left md-mt' },
            h('button', { class: 'hero-btn hero-btn-ghost hero-btn-sm', type: 'button', onclick: () => { R.editing = true; renderRespond(); } }, ic('pencil'), '고치기'),
            h('button', { class: 'hero-btn hero-btn-danger hero-btn-sm', type: 'button', onclick: unrespond }, ic('trash-2'), '내 응답 지우기')));
      done.hidden = false;
      $('form-resp').hidden = true;
      renderCertCard();
      return;
    }
    done.hidden = true;
    $('r-cert').hidden = true;
    $('form-resp').hidden = false;
    $('resp-error').hidden = true;
    $('r-rule').textContent = ruleText(cfg);

    const me = store.get(LS_ME, {}, (v) => v && typeof v === 'object');
    const src = mine || { name: me.name || '', fields: me.fields || {}, memo: '', picks: [] };
    $('r-name').value = src.name || '';
    fillFieldInputs($('r-fields'), cfg, src.fields);
    $('r-memo-wrap').hidden = !cfg.memo; $('r-memo').value = src.memo || '';
    $('r-privacy').textContent = '이름과 적은 내용은 이 ' + (act ? '활동의 날짜 확인과 확인서 작성' : '협의의 일정 조율과 등록부 작성') + '에 쓰고, ' + fmtD(localDate(new Date(ev.purgeAt)), true) + '에 자동으로 지워져요.';
    $('btn-resp-cancel').hidden = !mine;
    $('btn-resp').querySelector('span').textContent = mine ? '고친 내용 제출' : '제출하기';

    if (cfg.mode === 'pick') {
      R.picks = new Set(src.picks || []);
      $('r-slots').hidden = false; $('r-free').hidden = true;
      renderPickSlots();
    } else {
      R.free = (src.picks && src.picks.length ? src.picks : [{ d: cfg.range.from, s: '15:00', e: '16:00' }]).map((x) => ({ ...x }));
      $('r-slots').hidden = true; $('r-free').hidden = false;
      renderFreeRows();
    }
    const closed = ev.closed;
    $('form-resp').querySelectorAll('input,button,select').forEach((el) => { el.disabled = closed; });
  }
  function fillFieldInputs(box, cfg, values) {
    box.textContent = '';
    for (const k of cfg.fields) {
      box.append(h('label', { class: 'md-field' }, h('span', { class: 'md-label', text: FIELD_LABEL[k] }),
        h('input', { class: 'hero-input', maxlength: 40, 'data-field': k, value: (values && values[k]) || '' })));
    }
  }
  const readFields = (box) => { const f = {}; box.querySelectorAll('[data-field]').forEach((el) => { f[el.dataset.field] = el.value.trim(); }); return f; };

  function renderPickSlots() {
    const data = R.data, cfg = data.event.config;
    const box = $('r-slots'); box.textContent = '';
    const counts = data.counts || {};
    const names = {};
    for (const o of data.others || []) for (const p of o.picks) (names[p] = names[p] || []).push(o.name);
    const conf = new Set(data.event.confirmed || []);
    const byDay = new Map();
    for (const s of cfg.slots) { if (!byDay.has(s.d)) byDay.set(s.d, []); byDay.get(s.d).push(s); }
    for (const [d, list] of byDay) {
      box.append(h('div', { class: 'md-day' },
        h('p', { class: 'md-day-title', text: fmtD(d) }),
        h('div', { class: 'md-pick-list' }, list.map((s) => {
          const n = counts[s.id] || (names[s.id] || []).length || 0;
          const who = names[s.id] ? names[s.id].join(', ') : '';
          return h('button', {
            type: 'button', class: 'md-pick' + (conf.has(s.id) ? ' is-confirmed' : ''), 'aria-pressed': String(R.picks.has(s.id)),
            title: who || null,
            onclick: (e) => {
              R.picks.has(s.id) ? R.picks.delete(s.id) : R.picks.add(s.id);
              e.currentTarget.setAttribute('aria-pressed', String(R.picks.has(s.id)));
              updatePickCount();
            },
          }, h('span', { class: 'md-pick-time', text: fmtT(s.s, s.e) }),
          h('span', { class: 'md-pick-sub', text: who ? n + '명: ' + (who.length > 24 ? who.slice(0, 24) + '…' : who) : (n ? n + '명 가능' : '') }));
        }))));
    }
    updatePickCount();
  }
  function updatePickCount() {
    const cfg = R.data.event.config;
    const n = cfg.mode === 'pick' ? R.picks.size : R.free.length;
    const el = $('r-pick-count');
    const { type, n: need } = cfg.rule;
    el.textContent = n + '개 골랐어요';
    const ok = type === 'exact' ? n === need : type === 'min' ? n >= need : n >= 1;
    el.className = 'md-pill' + (ok ? ' ok' : '');
  }
  function renderFreeRows() {
    const cfg = R.data.event.config;
    const box = $('r-free-rows'); box.textContent = '';
    R.free.forEach((r, i) => {
      const d = h('input', { type: 'date', class: 'hero-input', value: r.d, min: cfg.range.from, max: cfg.range.to, 'aria-label': '날짜' });
      const s = h('input', { type: 'time', class: 'hero-input', value: r.s, step: 300, 'aria-label': '시작 시간' });
      const e = h('input', { type: 'time', class: 'hero-input', value: r.e, step: 300, 'aria-label': '끝 시간' });
      const upd = () => { r.d = d.value; r.s = s.value; r.e = e.value; };
      [d, s, e].forEach((x) => x.addEventListener('change', upd));
      box.append(h('div', { class: 'md-time-row' }, d, s, h('span', { class: 'md-tilde', text: '~' }), e,
        R.free.length > 1 ? h('button', {
          type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-icon hero-btn-sm', 'aria-label': '이 날짜 빼기',
          onclick: () => { R.free.splice(i, 1); renderFreeRows(); },
        }, ic('x')) : null));
    });
    updatePickCount();
  }
  $('btn-add-free').addEventListener('click', () => {
    const cfg = R.data.event.config;
    const last = R.free[R.free.length - 1];
    let d = last && last.d ? addDays(last.d, 1) : cfg.range.from;
    if (d > cfg.range.to) d = cfg.range.to;
    R.free.push({ d, s: last ? last.s : '15:00', e: last ? last.e : '16:00' });
    renderFreeRows();
  });
  $('btn-resp-cancel').addEventListener('click', () => { R.editing = false; renderRespond(); });

  $('form-resp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = R.data, ev = data.event, cfg = ev.config;
    const errBox = $('resp-error');
    const fail = (msg) => { errBox.textContent = msg; errBox.hidden = false; };
    errBox.hidden = true;
    const name = $('r-name').value.trim();
    if (!name) { fail('이름을 적어 주세요.'); $('r-name').focus(); return; }
    const fields = readFields($('r-fields'));
    const picks = cfg.mode === 'pick' ? cfg.slots.map((s) => s.id).filter((id) => R.picks.has(id)) : R.free.map((r) => ({ ...r }));
    const { type, n } = cfg.rule;
    if (!picks.length) return fail('되는 시간을 하나 이상 골라 주세요.');
    if (type === 'exact' && picks.length !== n) return fail('시간을 ' + n + '개 골라 주세요. 지금 ' + picks.length + '개예요.');
    if (type === 'min' && picks.length < n) return fail('시간을 ' + n + '개 이상 골라 주세요.');
    if (cfg.mode === 'free' && picks.some((p) => !p.d || !p.s || !p.e || p.s >= p.e)) return fail('날짜와 시간을 확인해 주세요. 시작 시간이 끝 시간보다 빨라야 해요.');

    const saved = store.get(lsResp(ev.id), null, (v) => v && v.rid);
    const body = { action: 'respond', id: ev.id, name, fields, picks, memo: $('r-memo').value.trim() };
    if (saved && data.mine) { body.rid = saved.rid; body.rkey = saved.rkey; }
    const btn = $('btn-resp'); btn.disabled = true;
    try {
      const r = await api('POST', { body });
      store.set(lsResp(ev.id), { rid: r.rid, rkey: r.rkey });
      store.set(LS_ME, { name, fields });
      VUI.toast(r.certReset ? '고쳤어요. 날짜가 바뀌어 확인서를 다시 내 주세요.' : r.updated ? '고친 내용을 제출했어요 ✓' : '제출했어요 ✓');
      await openRespond(ev.id);
    } catch (err) { fail(err.message); }
    finally { btn.disabled = false; }
  });

  async function unrespond() {
    const ev = R.data.event;
    const saved = store.get(lsResp(ev.id), null, (v) => v && v.rid);
    if (!saved) return;
    if (!(await VUI.confirm('내 응답을 지울까요? 되돌릴 수 없어요.', { ok: '지우기', danger: true }))) return;
    try {
      await api('POST', { body: { action: 'unrespond', id: ev.id, rid: saved.rid, rkey: saved.rkey } });
      store.remove(lsResp(ev.id));
      VUI.toast('내 응답을 지웠어요');
      await openRespond(ev.id);
    } catch (err) { VUI.toast(err.message, 'error'); }
  }

  // ── 내 활동 확인서 ─────────────────────────────────
  function certPage(cfg, r, img) {
    const rows = [['활동명', cfg.title]];
    for (const k of cfg.fields) rows.push([FIELD_LABEL[k], (r.fields && r.fields[k]) || '']);
    rows.push(['성명', r.name], ['활동 일시', picksText(cfg, r.picks).join('\n')], ['장소', cfg.place], ['활동 내용', cfg.desc]);
    rows.push(['서명', img ? { img } : '', true]);
    return {
      title: cfg.form.title || '활동 확인서', rows, foot: cfg.form.foot,
      date: fmtD(localDate(new Date()), true).replace(/\(.\)$/, ''), owner: cfg.form.owner || '',
    };
  }
  function renderCertCard() {
    const data = R.data, cfg = data.event.config, mine = data.mine;
    const card = $('r-cert');
    if (kindOf(cfg) !== 'activity' || !mine) { card.hidden = true; return; }
    card.hidden = false;
    const sub = cfg.submit || { file: true, direct: true };
    $('btn-cert-direct').hidden = !sub.direct;
    $('btn-cert-file').hidden = !sub.file;
    $('r-cert-file-note').hidden = !sub.file;
    const st = $('r-cert-state');
    if (mine.status === 'direct') st.textContent = '담당자에게 바로 냈어요' + (mine.cert ? '(' + fmtDT(mine.cert.at) + ', ' + (mine.cert.hasPng ? '서명 있음' : '서명 없음') + ')' : '') + '. 다시 서명해서 낼 수도 있어요.';
    else if (mine.status === 'file') st.textContent = '담당자가 확인서 파일을 받았다고 표시했어요.';
    else st.textContent = sub.direct && sub.file ? '서명한 뒤 바로 내거나, 파일로 받아 담당자에게 보내 주세요.' : sub.direct ? '서명한 뒤 담당자에게 바로 내 주세요.' : '확인서를 받아 담당자에게 보내 주세요.';
    st.className = 'md-note md-mt0' + (mine.status ? ' md-status direct' : '');
    R.pad = SigPad($('cert-pad'));
  }
  $('btn-cert-clear').addEventListener('click', () => R.pad && R.pad.clear());
  $('btn-cert-file').addEventListener('click', async () => {
    const cfg = R.data.event.config, mine = R.data.mine;
    const png = R.pad && R.pad.toPng();
    const bytes = png ? MeetHwpx.pngBytes(png) : null;
    const btn = $('btn-cert-file'); btn.disabled = true;
    try {
      const blob = await MeetHwpx.buildCerts([certPage(cfg, mine, bytes ? 'sig' : null)], bytes ? [{ id: 'sig', bytes }] : []);
      download(blob, safeName(cfg.title) + '_확인서_' + safeName(mine.name) + '.hwpx');
      VUI.toast('확인서를 받았어요. 담당자에게 보내 주세요.');
    } catch { VUI.toast('확인서를 만들지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.', 'error'); }
    finally { btn.disabled = false; }
  });
  $('btn-cert-direct').addEventListener('click', async () => {
    const ev = R.data.event;
    const saved = store.get(lsResp(ev.id), null, (v) => v && v.rid);
    if (!saved) return;
    const png = R.pad && R.pad.toPng();
    if (!png && !(await VUI.confirm('서명 없이 낼까요? 담당자가 받은 확인서의 서명란이 비어 있어요.', { ok: '서명 없이 내기' }))) return;
    const btn = $('btn-cert-direct'); btn.disabled = true;
    try {
      await api('POST', { body: { action: 'cert', id: ev.id, rid: saved.rid, rkey: saved.rkey, png } });
      VUI.toast('담당자에게 냈어요 ✓');
      await openRespond(ev.id);
    } catch (e) { VUI.toast(e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // ── 출석 서명(실시간 등록부) ───────────────────────
  const S = { data: null, editing: false, pad: null };

  async function openSign(id) {
    const sign = store.get(lsSign(id), null, (v) => v && typeof v.sid === 'string' && typeof v.skey === 'string');
    const data = await api('GET', { id, sign });
    if (sign && !data.mySign) store.remove(lsSign(id));
    S.data = data; S.editing = false;
    renderSign();
    show('sign');
  }
  function renderSign() {
    const data = S.data, ev = data.event, cfg = ev.config, my = data.mySign;
    const head = $('s-head');
    eventHead(head, data);
    if (kindOf(cfg) !== 'live' && !ev.liveOpen) {
      head.append(h('div', { class: 'md-banner closed' }, '지금은 출석을 받지 않아요. 협의가 시작되면 다시 열어 주세요. ',
        h('button', { type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-sm', onclick: () => route() }, ic('refresh-cw'), '새로 고침')));
    }
    const done = $('s-done');
    if (my && !S.editing) {
      done.textContent = '';
      done.append(h('h2', { class: 'md-h2' }, ic('circle-check'), '출석했어요'),
        h('p', { class: 'md-note md-mt0', text: my.name + ' · ' + fmtHM(my.at) + ' 서명' }),
        ev.liveOpen ? h('div', { class: 'md-actions md-actions-left md-mt' },
          h('button', { class: 'hero-btn hero-btn-ghost hero-btn-sm', type: 'button', onclick: () => { S.editing = true; renderSign(); } }, ic('pencil'), '다시 서명하기')) : null);
      done.hidden = false;
      $('form-sign').hidden = true;
      return;
    }
    done.hidden = true;
    $('form-sign').hidden = false;
    $('sign-error').hidden = true;
    const me = store.get(LS_ME, {}, (v) => v && typeof v === 'object');
    $('s-name').value = (my && my.name) || me.name || '';
    fillFieldInputs($('s-fields'), cfg, (my && my.fields) || me.fields);
    $('s-privacy').textContent = '이름과 서명은 이 등록부 작성에 써요. 담당자가 등록부를 받은 뒤 지울 수 있고, 늦어도 ' + fmtD(localDate(new Date(ev.purgeAt)), true) + '에 자동으로 지워져요.';
    $('btn-sign-cancel').hidden = !my;
    S.pad = SigPad($('sign-pad'));
    const closed = !ev.liveOpen;
    $('form-sign').querySelectorAll('input,button').forEach((el) => { el.disabled = closed; });
    S.pad.disable(closed);
  }
  $('btn-sign-clear').addEventListener('click', () => S.pad && S.pad.clear());
  $('btn-sign-cancel').addEventListener('click', () => { S.editing = false; renderSign(); });
  $('form-sign').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ev = S.data.event;
    const errBox = $('sign-error');
    const fail = (msg) => { errBox.textContent = msg; errBox.hidden = false; };
    errBox.hidden = true;
    const name = $('s-name').value.trim();
    if (!name) { fail('이름을 적어 주세요.'); $('s-name').focus(); return; }
    const png = S.pad && S.pad.toPng();
    if (!png) return fail('서명란에 서명해 주세요.');
    const fields = readFields($('s-fields'));
    const saved = store.get(lsSign(ev.id), null, (v) => v && v.sid);
    const body = { action: 'sign', id: ev.id, name, fields, png };
    if (saved && S.data.mySign) { body.sid = saved.sid; body.skey = saved.skey; }
    const btn = $('btn-sign'); btn.disabled = true;
    try {
      const r = await api('POST', { body });
      store.set(lsSign(ev.id), { sid: r.sid, skey: r.skey });
      store.set(LS_ME, { name, fields });
      VUI.toast('출석했어요 ✓');
      await openSign(ev.id);
    } catch (err) { fail(err.message); }
    finally { btn.disabled = false; }
  });

  // ── 관리 ───────────────────────────────────────────
  const M = { data: null, confirm: new Set(), freeConfirm: [], signs: new Map(), lastAt: '', timer: null, seen: new Set() };

  function openManage(data) {
    M.data = data;
    const ev = data.event, cfg = ev.config;
    M.confirm = new Set(cfg.mode === 'pick' ? ev.confirmed || [] : []);
    M.freeConfirm = cfg.mode === 'free' && kindOf(cfg) !== 'live' ? (ev.confirmed || []).map((x) => ({ ...x })) : [];
    saveMine({ id: ev.id, key: data.key, title: cfg.title, at: mineAt(ev.id) });
    renderManage();
    show('manage');
    if (liveVisible()) { M.signs = new Map(); M.lastAt = ''; pollSigns(true); }
  }
  async function reloadManage() { openManage(await loadOwner(M.data.event.id, M.data.key)); }
  const liveVisible = () => M.data && kindOf(M.data.event.config) !== 'activity';

  function renderManage() {
    const data = M.data, ev = data.event, cfg = ev.config, kind = kindOf(cfg);
    const head = $('m-head');
    eventHead(head, data, { manage: true });
    head.querySelector('.md-ev-title').append(' ',
      h('span', { class: 'md-pill', text: KIND_LABEL[kind] }), ' ',
      kind === 'live' ? null : h('span', { class: 'md-pill' + (ev.closed ? ' warn' : ' ok'), text: ev.closed ? '마감' : '응답 받는 중' }));
    head.append(h('p', { class: 'md-note', text: '받은 내용과 서명은 ' + fmtD(localDate(new Date(ev.purgeAt)), true) + '에 자동으로 지워져요.' }));

    $('m-resp-link').value = shareLinkOf(cfg, ev.id);
    $('m-resp-label').textContent = kind === 'live' ? '출석 링크 - QR로 띄우거나 보내요' : '응답 링크 - 받을 사람에게 보내요';
    $('m-admin-link').value = adminLink(ev.id, data.key);

    const isLive = kind === 'live';
    $('m-tally-card').hidden = isLive;
    $('m-resp-card').hidden = isLive;
    $('m-dl-card').hidden = isLive;
    $('m-live').hidden = !liveVisible();
    $('btn-certs').hidden = kind !== 'activity';
    $('m-dl-note').textContent = kind === 'activity'
      ? '확인서는 한 사람 한 쪽씩 한 파일로 받아요. 바로 낸 사람은 서명이 들어가요.'
      : '한글에서 열어 고치거나 인쇄할 수 있어요. 응답이 적으면 빈 줄을 더해 10줄로 맞춰요.';
    if (!isLive) {
      $('m-count').textContent = data.responses.length + '명';
      renderTally();
      renderResponses();
      $('m-only-wrap').hidden = !(cfg.mode === 'pick' && ev.confirmed && ev.confirmed.length);
    }
    if (liveVisible()) renderLive();
    $('m-msg').hidden = true; $('m-msg-actions').hidden = true;
    $('m-expect-in').value = store.get(lsExpect(ev.id), '', (v) => typeof v === 'string');
    renderExpect();
  }

  function renderTally() {
    const data = M.data, ev = data.event, cfg = ev.config, resps = data.responses;
    const box = $('m-summary'); box.textContent = '';
    if (cfg.mode === 'pick') {
      const who = {};
      for (const r of resps) for (const p of r.picks) (who[p] = who[p] || []).push(r.name);
      const max = Math.max(0, ...cfg.slots.map((s) => (who[s.id] || []).length));
      const total = resps.length || 1;
      const act = kindOf(cfg) === 'activity';
      const rows = cfg.slots.map((s) => {
        const list = who[s.id] || [];
        const cb = h('input', { type: 'checkbox', 'aria-label': fmtSlot(s) + ' 확정' });
        cb.checked = M.confirm.has(s.id);
        cb.addEventListener('change', () => { cb.checked ? M.confirm.add(s.id) : M.confirm.delete(s.id); syncConfirmBar(); tr.classList.toggle('is-confirmed', cb.checked); });
        const tr = h('tr', { class: (!act && max && list.length === max ? 'is-best' : '') + (M.confirm.has(s.id) ? ' is-confirmed' : '') },
          act ? null : h('td', { class: 'md-c-check' }, cb),
          h('td', { class: 'md-c-when', text: fmtSlot(s) }),
          h('td', { class: 'md-c-n' },
            h('div', { class: 'md-bar' },
              h('div', { class: 'md-bar-track' }, h('div', { class: 'md-bar-fill', style: 'width:' + Math.round((list.length / total) * 100) + '%' })),
              h('span', { class: 'md-bar-num', text: list.length + '명' })),
            list.length ? h('div', { class: 'md-names', text: list.join(', ') }) : null));
        return tr;
      });
      box.append(h('p', { class: 'md-note md-mt0', text: act ? '시간마다 누가 활동하는지 보여요.' : '확정할 시간을 체크하고 \'확정 저장\'을 누르면 응답 링크에 확정 일시가 보여요.' }),
        h('div', { class: 'md-table-wrap' }, h('table', { class: 'md-tally' },
          h('thead', {}, h('tr', {}, act ? null : h('th', { class: 'md-c-check', text: '확정' }), h('th', { text: '시간' }), h('th', { text: act ? '활동하는 사람' : '되는 사람' }))),
          h('tbody', {}, rows))));
    } else {
      const byDay = new Map();
      for (const r of resps) for (const p of r.picks) {
        if (!byDay.has(p.d)) byDay.set(p.d, []);
        byDay.get(p.d).push({ name: r.name, s: p.s, e: p.e });
      }
      const days = [...byDay.keys()].sort();
      if (!days.length) box.append(h('p', { class: 'md-empty', text: '아직 응답이 없어요.' }));
      else {
        box.append(h('div', { class: 'md-table-wrap' }, h('table', { class: 'md-tally' },
          h('thead', {}, h('tr', {}, h('th', { text: '날짜' }), h('th', { text: '인원' }), h('th', { text: '누가 언제' }))),
          h('tbody', {}, days.map((d) => {
            const list = byDay.get(d).sort((a, b) => a.s.localeCompare(b.s));
            return h('tr', {}, h('td', { class: 'md-c-when', text: fmtD(d) }), h('td', { text: new Set(list.map((x) => x.name)).size + '명' }),
              h('td', {}, h('div', { class: 'md-names', style: 'margin:0', text: list.map((x) => x.name + ' ' + fmtT(x.s, x.e)).join(', ') })));
          })))));
      }
      if (kindOf(cfg) !== 'activity') {
        const fc = h('div', { class: 'md-free-confirm' }, h('span', { class: 'md-label', text: '확정 일시(선택) - 응답 링크와 등록부에 들어가요' }));
        const rowsBox = h('div', { class: 'md-times' });
        const draw = () => {
          rowsBox.textContent = '';
          M.freeConfirm.forEach((r, i) => {
            const d = h('input', { type: 'date', class: 'hero-input', value: r.d, 'aria-label': '확정 날짜' });
            const s = h('input', { type: 'time', class: 'hero-input', value: r.s, step: 300, 'aria-label': '시작 시간' });
            const e = h('input', { type: 'time', class: 'hero-input', value: r.e, step: 300, 'aria-label': '끝 시간' });
            [d, s, e].forEach((x) => x.addEventListener('change', () => { r.d = d.value; r.s = s.value; r.e = e.value; syncConfirmBar(); }));
            rowsBox.append(h('div', { class: 'md-time-row' }, d, s, h('span', { class: 'md-tilde', text: '~' }), e,
              h('button', { type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-icon hero-btn-sm', 'aria-label': '빼기', onclick: () => { M.freeConfirm.splice(i, 1); draw(); syncConfirmBar(); } }, ic('x'))));
          });
        };
        draw();
        fc.append(rowsBox, h('button', {
          type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-sm',
          onclick: () => { M.freeConfirm.push({ d: days[0] || cfg.range.from, s: '15:00', e: '16:00' }); draw(); syncConfirmBar(); },
        }, ic('plus'), '확정 일시 더하기'));
        box.append(fc);
      }
    }
    syncConfirmBar();
  }

  function confirmValue() {
    const cfg = M.data.event.config;
    if (cfg.mode === 'pick') return cfg.slots.map((s) => s.id).filter((id) => M.confirm.has(id));
    return M.freeConfirm.filter((r) => r.d && r.s && r.e).map((r) => ({ d: r.d, s: r.s, e: r.e }));
  }
  function syncConfirmBar() {
    const ev = M.data.event;
    const bar = $('m-confirm-bar');
    if (kindOf(ev.config) === 'activity') { bar.hidden = true; return; }
    const now = JSON.stringify(confirmValue());
    bar.hidden = now === JSON.stringify(ev.confirmed || []);
    const n = JSON.parse(now).length;
    $('m-confirm-msg').textContent = n ? '확정할 시간 ' + n + '개 - 저장하면 응답 링크에 보여요.' : '확정을 모두 풀어요.';
  }
  $('btn-confirm').addEventListener('click', async () => {
    const v = confirmValue();
    if (M.data.event.config.mode === 'free' && v.some((r) => r.s >= r.e)) { VUI.toast('시작 시간이 끝 시간보다 빨라야 해요.', 'error'); return; }
    const btn = $('btn-confirm'); btn.disabled = true;
    try {
      const r = await api('POST', { body: { action: 'update', id: M.data.event.id, key: M.data.key, confirmed: v.length ? v : null } });
      M.data.event = { ...M.data.event, ...r.event };
      VUI.toast(v.length ? '확정했어요 ✓ 일정 안내 문구로 알려 주세요.' : '확정을 풀었어요');
      openManage(M.data);
    } catch (e) { VUI.toast(e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  function renderResponses() {
    const data = M.data, cfg = data.event.config, resps = data.responses;
    const act = kindOf(cfg) === 'activity';
    const box = $('m-responses'); box.textContent = '';
    if (!resps.length) {
      box.append(h('p', { class: 'md-empty', text: '아직 응답이 없어요. 응답 링크를 보내 주세요.' }));
      return;
    }
    const certSigns = new Map((data.signs || []).filter((s) => s.kind === 'cert').map((s) => [s.rid, s]));
    const head = h('tr', {}, h('th', { text: '이름' }), cfg.fields.map((k) => h('th', { text: FIELD_LABEL[k] })),
      h('th', { text: act ? '활동 날짜' : '고른 시간' }), cfg.memo ? h('th', { text: '의견' }) : null, act ? h('th', { text: '확인서' }) : null, h('th', {}));
    const rows = resps.map((r) => h('tr', {},
      h('td', { class: 'md-c-name', text: r.name }),
      cfg.fields.map((k) => h('td', { text: (r.fields && r.fields[k]) || '' })),
      h('td', {}, picksText(cfg, r.picks).flatMap((t, i) => (i ? [h('br'), t] : [t]))),
      cfg.memo ? h('td', { text: r.memo || '' }) : null,
      act ? h('td', {}, statusCell(r, certSigns.get(r.rid))) : null,
      h('td', { class: 'md-c-act' }, h('button', {
        type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-icon hero-btn-sm', 'aria-label': r.name + ' 응답 지우기', title: '응답 지우기',
        onclick: async () => {
          if (!(await VUI.confirm(r.name + ' 님의 응답을 지울까요? 되돌릴 수 없어요.', { ok: '지우기', danger: true }))) return;
          try {
            await api('POST', { body: { action: 'remove', id: data.event.id, key: data.key, rid: r.rid } });
            VUI.toast('응답을 지웠어요'); await reloadManage();
          } catch (e) { VUI.toast(e.message, 'error'); }
        },
      }, ic('trash-2')))));
    box.append(h('table', { class: 'md-rtable' }, h('thead', {}, head), h('tbody', {}, rows)));
  }
  function statusCell(r, sign) {
    if (r.status === 'direct') return h('span', { class: 'md-status direct', text: '바로 냄' + (sign && sign.hasPng ? '(서명)' : '') });
    const cb = h('input', { type: 'checkbox', 'aria-label': r.name + ' 확인서 파일 받음' });
    cb.checked = r.status === 'file';
    cb.addEventListener('change', async () => {
      try {
        await api('POST', { body: { action: 'mark', id: M.data.event.id, key: M.data.key, rid: r.rid, status: cb.checked ? 'file' : null } });
        r.status = cb.checked ? 'file' : null;
        renderExpect();
      } catch (e) { cb.checked = !cb.checked; VUI.toast(e.message, 'error'); }
    });
    return h('label', { class: 'md-check-line', style: 'margin:0' }, cb, h('span', { class: 'md-status none', text: '파일 받음' }));
  }

  // ── 실시간 출석(관리) ──────────────────────────────
  function renderLive() {
    const ev = M.data.event;
    const open = !!ev.liveOpen;
    $('m-live-pill').textContent = open ? '받는 중' : '멈춤';
    $('m-live-pill').className = 'md-pill' + (open ? ' ok' : ' warn');
    $('m-live-note').textContent = open
      ? '출석 링크나 QR로 들어온 사람이 이름을 적고 서명하면 아래에 바로 보여요.'
      : (kindOf(ev.config) === 'live' ? '출석 받기를 시작하면 QR로 서명을 받을 수 있어요.' : '협의하는 날 출석 받기를 시작하면 그 자리에서 손글씨 서명을 받아요.');
    const tbtn = $('btn-live-toggle');
    tbtn.querySelector('span').textContent = open ? '출석 받기 멈추기' : '출석 받기 시작';
    tbtn.className = 'hero-btn hero-btn-sm' + (open ? ' hero-btn-ghost' : '');
    renderSignTiles();
  }
  function liveSigns() { return [...M.signs.values()].filter((s) => s.kind === 'live').sort((a, b) => a.at.localeCompare(b.at)); }
  function renderSignTiles() {
    const list = liveSigns();
    $('m-sign-count').textContent = list.length + '명';
    const box = $('m-signs'); box.textContent = '';
    if (!list.length) { box.append(h('p', { class: 'md-empty', text: '아직 출석한 사람이 없어요.' })); }
    for (const s of list) {
      const okPng = s.png && PNG_RE.test(s.png);
      box.append(h('div', { class: 'md-sign' },
        okPng ? h('img', { src: s.png, alt: s.name + ' 서명' }) : h('span', { class: 'md-sign-empty', text: s.hasPng === false || !s.png ? '서명 그림 지움' : '' }),
        h('b', { text: s.name }),
        h('small', { text: fmtHM(s.at) + (Object.values(s.fields || {}).filter(Boolean).length ? ' · ' + Object.values(s.fields).filter(Boolean).join(' ') : '') }),
        h('button', {
          type: 'button', class: 'hero-btn hero-btn-ghost hero-btn-icon hero-btn-sm', 'aria-label': s.name + ' 출석 지우기', title: '지우기',
          onclick: async () => {
            if (!(await VUI.confirm(s.name + ' 님의 출석과 서명을 지울까요?', { ok: '지우기', danger: true }))) return;
            try {
              await api('POST', { body: { action: 'removeSign', id: M.data.event.id, key: M.data.key, sid: s.sid } });
              M.signs.delete(s.sid); renderSignTiles(); renderBig();
            } catch (e) { VUI.toast(e.message, 'error'); }
          },
        }, ic('x'))));
    }
    renderExpect();
  }
  async function pollSigns(first) {
    if (!M.data) return;
    try {
      const ev = M.data.event;
      const r = await api('GET', { id: ev.id, key: M.data.key, query: '&signs=1' + (M.lastAt ? '&after=' + encodeURIComponent(M.lastAt) : '') });
      const ids = new Set(r.ids);
      let changed = first;
      for (const id of [...M.signs.keys()]) if (!ids.has(id)) { M.signs.delete(id); changed = true; }
      for (const s of r.signs) {
        M.signs.set(s.sid, s); changed = true;
        if (s.updatedAt > M.lastAt) M.lastAt = s.updatedAt;
      }
      if (ev.liveOpen !== r.liveOpen) { ev.liveOpen = r.liveOpen; renderLive(); changed = false; }
      if (changed) { renderSignTiles(); renderBig(); }
    } catch {}
    schedulePoll();
  }
  function schedulePoll() {
    clearTimeout(M.timer);
    const viewOn = !$('view-manage').hidden;
    if (!viewOn || !M.data || !liveVisible()) return;
    const big = !$('live-big').hidden;
    if (!M.data.event.liveOpen && !big) return; // 멈춘 동안은 부르지 않음
    M.timer = setTimeout(() => pollSigns(false), big ? 3000 : 5000);
  }
  function stopPoll() { clearTimeout(M.timer); M.timer = null; }

  $('btn-live-toggle').addEventListener('click', async () => {
    const ev = M.data.event;
    const open = !ev.liveOpen;
    const btn = $('btn-live-toggle'); btn.disabled = true;
    try {
      await api('POST', { body: { action: 'live', id: ev.id, key: M.data.key, open } });
      ev.liveOpen = open;
      renderLive();
      VUI.toast(open ? '출석 받기를 시작했어요. QR을 띄워 주세요.' : '출석 받기를 멈췄어요');
      if (open) pollSigns(false); else stopPoll();
    } catch (e) { VUI.toast(e.message, 'error'); }
    finally { btn.disabled = false; }
  });
  $('btn-live-link').addEventListener('click', () => {
    VUI.share.link(signLink(M.data.event.id), { show: true, title: '출석 링크', desc: '협의 자리에서 QR을 보여 주거나 링크를 보내 주세요.' });
  });
  $('btn-live-big').addEventListener('click', openBig);
  $('btn-live-big-close').addEventListener('click', closeBig);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('live-big').hidden) closeBig(); });
  function openBig() {
    const ev = M.data.event;
    const url = signLink(ev.id);
    $('lb-title').textContent = ev.config.title;
    $('lb-url').textContent = url.replace(/^https?:\/\//, '');
    const qr = $('lb-qr'); qr.textContent = '';
    if (typeof QRCode !== 'undefined') { try { new QRCode(qr, { text: url, width: 420, height: 420, correctLevel: QRCode.CorrectLevel.M }); } catch {} }
    M.seen = new Set(M.signs.keys());
    $('live-big').hidden = false;
    document.body.style.overflow = 'hidden';
    if (!ev.liveOpen) VUI.toast('출석 받기가 멈춰 있어요. 시작해야 서명을 낼 수 있어요.', 'error');
    renderBig();
    pollSigns(false);
  }
  function closeBig() {
    if ($('live-big').hidden) return;
    $('live-big').hidden = true;
    document.body.style.overflow = '';
    schedulePoll();
  }
  function renderBig() {
    if ($('live-big').hidden) return;
    const list = liveSigns().reverse();
    $('lb-count').textContent = String(list.length);
    const ul = $('lb-list'); ul.textContent = '';
    for (const s of list) ul.append(h('li', { class: M.seen.has(s.sid) ? '' : 'is-new' }, s.name, h('small', { text: fmtHM(s.at) })));
  }

  async function fetchAllSigns() {
    const r = await api('GET', { id: M.data.event.id, key: M.data.key, query: '&signs=1' });
    return r.signs;
  }
  $('btn-sign-hwpx').addEventListener('click', async () => {
    const data = M.data, ev = data.event, cfg = ev.config, form = cfg.form;
    const btn = $('btn-sign-hwpx'); btn.disabled = true;
    try {
      const signs = (await fetchAllSigns()).filter((s) => s.kind === 'live');
      if (!signs.length) { VUI.toast('아직 출석한 사람이 없어요.', 'error'); return; }
      const images = [];
      const cols = [{ label: '번호', w: 0.7, center: true }];
      for (const k of cfg.fields) cols.push({ label: FIELD_LABEL[k], w: k === 'pos' ? 1.2 : 1.8, center: true });
      cols.push({ label: '성명', w: 1.5, center: true }, { label: '서명 시각', w: 1.2, center: true }, { label: '서명', w: 2.4, center: true });
      const rows = signs.map((s, i) => {
        const bytes = s.png ? MeetHwpx.pngBytes(s.png) : null;
        const id = 'g' + (i + 1);
        if (bytes) images.push({ id, bytes });
        return [String(i + 1), ...cfg.fields.map((k) => (s.fields && s.fields[k]) || ''), s.name, fmtHM(s.at), bytes ? { img: id } : ''];
      });
      const when = confirmedText(data) || fmtD(localDate(new Date(signs[0].at)), true);
      const blob = await MeetHwpx.buildRoster({
        title: form.title || '참석 등록부',
        info: [['협의명', cfg.title], ['일시', when], ['장소', cfg.place], ['내용', cfg.desc]],
        head: form.head, columns: cols, rows, minRows: 10, foot: form.foot,
        date: fmtD(localDate(new Date(signs[0].at)), true).replace(/\(.\)$/, ''), owner: form.owner || '',
      }, images);
      download(blob, safeName(cfg.title) + '_서명등록부.hwpx');
      VUI.toast('서명 등록부를 받았어요 ✓');
    } catch (e) { VUI.toast(e && e.message && e.code ? e.message : '등록부를 만들지 못했어요. 다시 해 주세요.', 'error'); }
    finally { btn.disabled = false; }
  });
  $('btn-sign-clear-all').addEventListener('click', async () => {
    if (!(await VUI.confirm('모든 서명 그림을 지울까요? 이름과 시각은 남고, 지운 그림은 되돌릴 수 없어요. 등록부를 먼저 받아 두세요.', { title: '서명 그림 지우기', ok: '지우기', danger: true }))) return;
    try {
      await api('POST', { body: { action: 'clearSigns', id: M.data.event.id, key: M.data.key } });
      VUI.toast('서명 그림을 지웠어요');
      M.signs = new Map(); M.lastAt = ''; pollSigns(true);
    } catch (e) { VUI.toast(e.message, 'error'); }
  });

  // ── 받기: 명단 등록부·확인서·CSV ───────────────────
  function rosterRows() {
    const data = M.data, ev = data.event, cfg = ev.config;
    const conf = cfg.mode === 'pick' ? new Set(ev.confirmed || []) : null;
    const only = cfg.mode === 'pick' && conf.size && $('m-only').checked;
    const byId = cfg.mode === 'pick' ? new Map(cfg.slots.map((s) => [s.id, s])) : null;
    const out = [];
    for (const r of data.responses) {
      let when;
      if (cfg.mode === 'pick') {
        let ids = r.picks;
        if (conf.size) { const hit = ids.filter((id) => conf.has(id)); if (hit.length) ids = hit; else if (only) continue; }
        when = ids.map((id) => byId.get(id)).filter(Boolean).map((s) => fmtSlot(s));
      } else when = r.picks.map((s) => fmtSlot(s));
      out.push({ r, when });
    }
    return out;
  }

  $('btn-hwpx').addEventListener('click', async () => {
    const data = M.data, ev = data.event, cfg = ev.config, form = cfg.form;
    const btn = $('btn-hwpx'); btn.disabled = true;
    try {
      const cols = [{ label: '번호', w: 0.7, center: true, get: (_, i) => String(i + 1) }];
      for (const k of cfg.fields) cols.push({ label: FIELD_LABEL[k], w: k === 'pos' ? 1.2 : 1.8, center: true, get: (x) => (x.r.fields && x.r.fields[k]) || '' });
      cols.push({ label: '성명', w: 1.5, center: true, get: (x) => x.r.name });
      if (form.when !== false || kindOf(cfg) === 'activity') cols.push({ label: kindOf(cfg) === 'activity' ? '활동 일시' : '참석 일시', w: 3, get: (x) => x.when.join('\n') });
      cols.push({ label: '서명', w: 1.5, center: true, get: (x) => (form.signFill === 'name' && kindOf(cfg) === 'schedule' ? x.r.name : '') });
      const list = rosterRows();
      const conf = confirmedText(data);
      const firstConf = confirmedSlots(ev)[0];
      const blob = await MeetHwpx.buildRoster({
        title: kindOf(cfg) === 'activity' ? '활동 명단' : (form.title || '협의회 참석 등록부'),
        info: [[kindOf(cfg) === 'activity' ? '활동명' : '협의명', cfg.title], ['일시', conf || (fmtD(cfg.range.from, true) + ' ~ ' + fmtD(cfg.range.to, true) + ' 중')], ['장소', cfg.place], ['내용', cfg.desc]],
        head: form.head,
        columns: cols.map(({ label, w, center }) => ({ label, w, center })),
        rows: list.map((x, i) => cols.map((c) => c.get(x, i))),
        minRows: 10,
        foot: form.foot,
        date: fmtD(firstConf ? firstConf.d : localDate(new Date()), true).replace(/\(.\)$/, ''),
        owner: form.owner || '',
      });
      download(blob, safeName(cfg.title) + '_등록부.hwpx');
      VUI.toast('등록부를 받았어요 ✓');
    } catch {
      VUI.toast('등록부를 만들지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.', 'error');
    } finally { btn.disabled = false; }
  });

  $('btn-certs').addEventListener('click', async () => {
    const data = M.data, cfg = data.event.config;
    if (!data.responses.length) { VUI.toast('아직 응답이 없어요.', 'error'); return; }
    const btn = $('btn-certs'); btn.disabled = true;
    try {
      const signs = new Map((await fetchAllSigns()).filter((s) => s.kind === 'cert').map((s) => [s.rid, s]));
      const images = [];
      const pages = data.responses.map((r, i) => {
        const s = signs.get(r.rid);
        const bytes = s && s.png ? MeetHwpx.pngBytes(s.png) : null;
        const id = 'c' + (i + 1);
        if (bytes) images.push({ id, bytes });
        return certPage(cfg, r, bytes ? id : null);
      });
      const blob = await MeetHwpx.buildCerts(pages, images);
      download(blob, safeName(cfg.title) + '_확인서_모음.hwpx');
      VUI.toast('확인서 ' + pages.length + '장을 받았어요 ✓');
    } catch { VUI.toast('확인서를 만들지 못했어요. 다시 해 주세요.', 'error'); }
    finally { btn.disabled = false; }
  });

  $('btn-csv').addEventListener('click', () => {
    const data = M.data, cfg = data.event.config;
    const act = kindOf(cfg) === 'activity';
    const q = (v) => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // 엑셀 수식 실행 막기
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const head = ['번호', '이름', ...cfg.fields.map((k) => FIELD_LABEL[k]), act ? '활동 날짜' : '고른 시간', ...(cfg.memo ? ['의견'] : []), ...(act ? ['확인서'] : []), '제출 시각'];
    const lines = [head.map(q).join(',')];
    data.responses.forEach((r, i) => {
      lines.push([i + 1, r.name, ...cfg.fields.map((k) => (r.fields && r.fields[k]) || ''), picksText(cfg, r.picks).join(' / '),
        ...(cfg.memo ? [r.memo || ''] : []), ...(act ? [r.status === 'direct' ? '바로 냄' : r.status === 'file' ? '파일 받음' : ''] : []), fmtDT(r.updatedAt)].map(q).join(','));
    });
    download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), safeName(cfg.title) + '_응답.csv');
  });

  // ── 안내하기 ───────────────────────────────────────
  function showMsg(text) {
    $('m-msg').value = text; $('m-msg').hidden = false; $('m-msg-actions').hidden = false;
    $('m-msg').style.height = 'auto'; $('m-msg').style.height = Math.min(320, $('m-msg').scrollHeight + 4) + 'px';
  }
  function noticeText() {
    const ev = M.data.event, cfg = ev.config, kind = kindOf(cfg);
    const link = shareLinkOf(cfg, ev.id);
    const lines = [];
    if (kind === 'live') {
      lines.push('[' + cfg.title + '] 출석 서명 안내');
      if (cfg.session) lines.push('- 일시: ' + fmtSlot(cfg.session, true));
      if (cfg.place) lines.push('- 장소: ' + cfg.place);
      lines.push('협의 시간에 아래 링크나 화면의 QR로 들어와 이름을 적고 서명해 주세요.', link);
      return lines.join('\n');
    }
    const conf = confirmedText(M.data);
    if (conf && kind === 'schedule') {
      lines.push('[' + cfg.title + '] 일정이 정해졌어요');
      lines.push('- 일시: ' + conf);
      if (cfg.place) lines.push('- 장소: ' + cfg.place);
      if (cfg.desc) lines.push('- 내용: ' + cfg.desc.split('\n')[0]);
      lines.push('자세한 내용과 달력 넣기: ' + link);
      return lines.join('\n');
    }
    lines.push('[' + cfg.title + '] ' + (kind === 'activity' ? '활동할 날짜를 골라 주세요' : '가능한 시간을 알려 주세요'));
    lines.push('- 기간: ' + fmtD(cfg.range.from) + ' ~ ' + fmtD(cfg.range.to));
    if (cfg.rule.type !== 'any') lines.push('- ' + (kind === 'activity' ? '활동 횟수' : '고를 개수') + ': ' + cfg.rule.n + '개' + (cfg.rule.type === 'min' ? ' 이상' : ''));
    if (cfg.place) lines.push('- 장소: ' + cfg.place);
    lines.push('- 마감: ' + fmtDT(ev.closesAt));
    lines.push('링크에서 고르고 이름을 적어 주세요. 로그인은 없어요.', link);
    return lines.join('\n');
  }
  function remindText() {
    const ev = M.data.event, cfg = ev.config, kind = kindOf(cfg);
    const missing = missingNames();
    const lines = ['[' + cfg.title + '] ' + (kind === 'live' ? '아직 출석 서명을 하지 않으셨다면 아래 링크로 서명해 주세요.' : '아직 응답하지 않으셨다면 ' + fmtDT(ev.closesAt) + '까지 응답해 주세요.')];
    if (kind === 'activity') lines.push('응답한 뒤에는 활동 확인서도 내 주세요.');
    if (missing && missing.length) lines.push('(아직 안 낸 분: ' + missing.join(', ') + ')');
    lines.push(shareLinkOf(cfg, ev.id));
    return lines.join('\n');
  }
  $('btn-msg-notice').addEventListener('click', () => showMsg(noticeText()));
  $('btn-msg-remind').addEventListener('click', () => showMsg(remindText()));
  $('btn-msg-copy').addEventListener('click', () => VUI.copy($('m-msg').value, '안내 문구를 복사했어요. 메신저에 붙여 넣어 주세요.'));
  $('btn-ics').addEventListener('click', () => downloadIcs(M.data.event));

  function icsStamp(d, t) { return new Date(d + 'T' + t + ':00').toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m); }
  function downloadIcs(ev) {
    const cfg = ev.config;
    const list = confirmedSlots(ev);
    if (!list.length) { VUI.toast('확정한 일정이 없어요. 시간을 확정한 뒤 받아 주세요.', 'error'); return; }
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eduin VIVES//meet-date//KO', 'CALSCALE:GREGORIAN'];
    list.forEach((s, i) => {
      out.push('BEGIN:VEVENT', 'UID:' + ev.id + '-' + i + '@eduin.info', 'DTSTAMP:' + now,
        'DTSTART:' + icsStamp(s.d, s.s), 'DTEND:' + icsStamp(s.d, s.e), 'SUMMARY:' + icsEsc(cfg.title));
      if (cfg.place) out.push('LOCATION:' + icsEsc(cfg.place));
      if (cfg.desc) out.push('DESCRIPTION:' + icsEsc(cfg.desc));
      out.push('END:VEVENT');
    });
    out.push('END:VCALENDAR');
    download(new Blob([out.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }), safeName(cfg.title) + '.ics');
  }

  // 받을 사람 명단 → 아직 안 낸 사람
  function expectedNames() {
    return $('m-expect-in').value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, 500);
  }
  function doneNames() {
    const data = M.data, kind = kindOf(data.event.config);
    if (kind === 'live') return liveSigns().map((s) => s.name);
    return (data.responses || []).map((r) => r.name);
  }
  function missingNames() {
    const exp = expectedNames();
    if (!exp.length) return null;
    const done = new Set(doneNames().map(normName));
    return exp.filter((n) => !done.has(normName(n)));
  }
  function renderExpect() {
    if (!M.data) return;
    const out = $('m-expect-out');
    const miss = missingNames();
    if (!miss) { out.textContent = '명단을 적으면 아직 안 낸 사람을 알려 드려요.'; return; }
    out.textContent = miss.length ? '아직 안 낸 사람 ' + miss.length + '명: ' + miss.join(', ') : '명단의 모든 사람이 냈어요 ✓';
  }
  $('m-expect-in').addEventListener('input', () => {
    store.set(lsExpect(M.data.event.id), $('m-expect-in').value.slice(0, 8000));
    renderExpect();
  });

  // ── 관리 버튼 ──────────────────────────────────────
  $('btn-refresh').addEventListener('click', async () => {
    try { await reloadManage(); VUI.toast('새로 불러왔어요'); } catch (e) { VUI.toast(e.message, 'error'); }
  });
  $('btn-share-resp').addEventListener('click', () => {
    const cfg = M.data.event.config;
    VUI.share.link(shareLinkOf(cfg, M.data.event.id), { show: true, title: kindOf(cfg) === 'live' ? '출석 링크' : '응답 링크', desc: '메신저로 보내거나 화면의 QR을 보여 주세요.' });
  });
  $('btn-copy-admin').addEventListener('click', () => VUI.copy(adminLink(M.data.event.id, M.data.key), '관리 링크를 복사했어요. 다른 사람이 볼 수 없는 곳에 보관하세요.'));
  $('btn-show-admin').addEventListener('click', () => {
    const el = $('m-admin-link');
    el.type = el.type === 'password' ? 'text' : 'password';
  });
  $('btn-edit').addEventListener('click', () => { location.hash = 'edit=' + M.data.event.id; });
  $('btn-close-now').addEventListener('click', async () => {
    const cur = toLocalInput(M.data.event.closesAt).replace('T', ' ');
    const v = await VUI.prompt('새 마감 일시를 적어 주세요. 지금 마감하려면 지금 시각을 적으면 돼요.', { title: '마감 바꾸기', value: cur, placeholder: '2026-12-01 18:00', ok: '바꾸기' });
    if (v == null) return;
    const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/);
    if (!m) { VUI.toast('2026-12-01 18:00 모양으로 적어 주세요.', 'error'); return; }
    let t = new Date(m[1] + 'T' + pad(m[2]) + ':' + m[3]);
    if (t.getTime() < Date.now()) t = new Date(); // 지난 시각은 지금 마감
    try {
      const r = await api('POST', { body: { action: 'update', id: M.data.event.id, key: M.data.key, closesAt: t.toISOString() } });
      M.data.event = { ...M.data.event, ...r.event }; VUI.toast('마감을 바꿨어요 ✓'); openManage(M.data);
    } catch (e) { VUI.toast(e.message, 'error'); }
  });
  function templateOf(cfg) {
    const times = new Map(), dows = new Set();
    for (const s of cfg.slots || []) { times.set(s.s + '|' + s.e, { s: s.s, e: s.e }); dows.add(dowOf(s.d)); }
    return {
      kind: kindOf(cfg), title: cfg.title, desc: cfg.desc, place: cfg.place, mode: cfg.mode, rule: cfg.rule, fields: cfg.fields,
      memo: cfg.memo, showOthers: cfg.showOthers, form: cfg.form, submit: cfg.submit,
      times: [...times.values()], dows: [...dows], session: cfg.session ? { s: cfg.session.s, e: cfg.session.e } : null,
    };
  }
  $('btn-clone').addEventListener('click', () => { location.hash = 'share=' + VUI.share.encode({ t: templateOf(M.data.event.config) }); });
  $('btn-clone-link').addEventListener('click', () => {
    const url = location.origin + APP_PATH + '#share=' + VUI.share.encode({ t: templateOf(M.data.event.config) });
    VUI.share.link(url, { show: true, title: '양식 링크', desc: '받은 사람은 같은 설정으로 새로 만들 수 있어요. 받은 응답과 서명은 들어가지 않아요.' });
  });
  $('btn-delete').addEventListener('click', async () => {
    if (!(await VUI.confirm('받은 응답과 서명을 모두 지울까요? 되돌릴 수 없고, 링크도 열리지 않아요.', { title: '지우기', ok: '모두 지우기', danger: true }))) return;
    try {
      await api('POST', { body: { action: 'delete', id: M.data.event.id, key: M.data.key } });
      store.set(LS_MINE, mineList().filter((x) => x.id !== M.data.event.id));
      VUI.toast('지웠어요');
      location.hash = '';
    } catch (e) { VUI.toast(e.message, 'error'); }
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden && M.data && !$('view-manage').hidden) schedulePoll(); });
  window.addEventListener('hashchange', route);
  route();
})();
