/* SimKit — eduin VIVES 시뮬레이션 앱 공용 키트 (docs/sim-kit.md)
   시뮬레이션 앱들이 서로 복사해 쓰던 화면 전환·모드 탭·미션 진행·피드백·토스트·저장·공유·타이머·효과음·읽어주기를
   한곳에 모았다. 프레임워크 없음, 전역 window.SimKit 하나. 조각별로 골라 쓸 수 있다.

   불러오기 (Astro 앱 페이지의 <Fragment slot="head"> 안):
     <link rel="stylesheet" href="/common/sim-kit.css">
     <script is:inline src="/common/sim-kit.js"></script>

   핵심 보장 (미션 컨트롤러 SimKit.missions):
   - 미션을 옮기면(go/next/prev/skip/retry/start/stop/finish) 대기 중인 자동 이동·미션 타이머가 모두 취소된다
     (토큰 + 타이머 스코프 이중 장치). 정답 직후 건너뛰기를 눌러도 두 칸 넘어가지 않는다.
   - complete()는 미션 준비(onEnter)를 다시 부르지 않는다. 성공 문구는 사용자가 다른 미션으로 갈 때까지 남는다.
   - 자동 이동이 예약된 동안 complete()/fail()은 무시된다(중복 채점·중복 예약 방지).
   ES2017. 외부 의존 없음. window.VUI(public/common/ui.js)가 있으면 토스트·공유 모달을 그쪽에 맡긴다. */
(function (root) {
  'use strict';
  if (root.SimKit && root.SimKit.version) return; // 두 번 불러와도 한 번만

  var hasDoc = typeof document !== 'undefined';

  /* ───────────── 내부 유틸 ───────────── */
  // 대상: 요소 | 선택자 문자열 | 요소를 돌려주는 함수(다시 그려지는 영역용, 쓸 때마다 새로 찾음)
  function resolve(t) {
    if (!t) return null;
    if (typeof t === 'function') { try { return t() || null; } catch (e) { return null; } }
    if (typeof t === 'string') return hasDoc ? document.querySelector(t) : null;
    return t;
  }
  function resolveAll(t) {
    if (!t) return [];
    if (typeof t === 'function') t = t();
    if (typeof t === 'string') return hasDoc ? Array.prototype.slice.call(document.querySelectorAll(t)) : [];
    if (t && typeof t.length === 'number' && !t.nodeType) return Array.prototype.slice.call(t);
    return t ? [t] : [];
  }
  function toInt(v, min, max, def) {
    var n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return def;
    n = Math.trunc(n);
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function call(fn) {
    if (typeof fn !== 'function') return undefined;
    return fn.apply(null, Array.prototype.slice.call(arguments, 1));
  }
  function ready(fn) {
    if (!hasDoc) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ───────────── 타이머 스코프 ─────────────
     var t = SimKit.timers();  t.timeout(fn, ms) / t.interval(fn, ms) / t.raf(fn) / await t.sleep(ms)
     t.reset() → 걸어 둔 것 전부 해제. 대기 중인 sleep은 false로 풀린다(async 흐름에서 "중단됨" 확인용). */
  function timers() {
    var tSet = new Set(), iSet = new Set(), rSet = new Set(), sleepers = new Set();
    var api = {
      timeout: function (fn, ms) {
        var id = root.setTimeout(function () { tSet.delete(id); fn(); }, ms || 0);
        tSet.add(id);
        return id;
      },
      interval: function (fn, ms) {
        var id = root.setInterval(fn, ms);
        iSet.add(id);
        return id;
      },
      raf: function (fn) {
        if (typeof root.requestAnimationFrame !== 'function') {
          return api.timeout(function () { fn(Date.now()); }, 16);
        }
        var id = root.requestAnimationFrame(function (ts) { rSet.delete(id); fn(ts); });
        rSet.add(id);
        return id;
      },
      sleep: function (ms) {
        return new Promise(function (res) {
          var s = { res: res, id: null };
          sleepers.add(s);
          s.id = api.timeout(function () { sleepers.delete(s); res(true); }, ms);
        });
      },
      clear: function (id) {
        if (tSet.has(id)) { root.clearTimeout(id); tSet.delete(id); }
        if (iSet.has(id)) { root.clearInterval(id); iSet.delete(id); }
        if (rSet.has(id)) { root.cancelAnimationFrame(id); rSet.delete(id); }
      },
      reset: function () {
        tSet.forEach(function (id) { root.clearTimeout(id); });
        iSet.forEach(function (id) { root.clearInterval(id); });
        if (typeof root.cancelAnimationFrame === 'function') rSet.forEach(function (id) { root.cancelAnimationFrame(id); });
        tSet.clear(); iSet.clear(); rSet.clear();
        var list = Array.from(sleepers);
        sleepers.clear();
        list.forEach(function (s) { s.res(false); });
      },
      size: function () { return tSet.size + iSet.size + rSet.size; }
    };
    return api;
  }

  /* ───────────── 피드백 상자 ─────────────
     var fb = SimKit.feedback('#feedbackBox', { html: true, classes: { ok: 'ok', no: 'no' } });
     fb.show('ok' | 'no' | 'info' | 'warn', '문구');  fb.hide();
     - role="status" + aria-live="polite"를 붙인다.
     - 기본은 textContent. html:true는 앱이 직접 쓴 고정 문구에만(공유 링크·입력값을 넣지 말 것).
     - classes: 앱의 기존 스타일 클래스를 함께 붙이고 뗀다(예: .feedback-box.ok). */
  var FB_TYPES = ['ok', 'no', 'info', 'warn'];
  function normType(t) {
    if (FB_TYPES.indexOf(t) >= 0) return t;
    if (t === 'success') return 'ok';
    if (t === 'error' || t === 'fail') return 'no';
    return 'info';
  }
  function feedback(target, opts) {
    opts = opts || {};
    var extra = opts.classes || {};
    var lastExtra = [];
    function el() { return resolve(target); }
    function prep(e) {
      if (!e.getAttribute('role')) e.setAttribute('role', 'status');
      if (!e.getAttribute('aria-live')) e.setAttribute('aria-live', 'polite');
      e.classList.add('sk-feedback');
    }
    var api = {
      el: el,
      show: function (type, msg, o) {
        var e = el();
        if (!e) return false;
        type = normType(type);
        prep(e);
        FB_TYPES.forEach(function (t) { e.classList.remove('sk-feedback--' + t); });
        lastExtra.forEach(function (c) { e.classList.remove(c); });
        e.classList.add('sk-feedback--' + type);
        lastExtra = String(extra[type] || '').split(/\s+/).filter(Boolean);
        lastExtra.forEach(function (c) { e.classList.add(c); });
        var html = o && o.html != null ? o.html : opts.html;
        if (html) e.innerHTML = msg == null ? '' : String(msg);
        else e.textContent = msg == null ? '' : String(msg);
        e.hidden = false;
        e.style.display = opts.display || '';
        e.setAttribute('data-sk-type', type);
        return true;
      },
      hide: function () {
        var e = el();
        if (!e) return;
        e.style.display = 'none';
        e.removeAttribute('data-sk-type');
      },
      clear: function () {
        var e = el();
        if (!e) return;
        api.hide();
        e.textContent = '';
      },
      visible: function () {
        var e = el();
        return !!e && !e.hidden && e.style.display !== 'none' && e.hasAttribute('data-sk-type');
      },
      type: function () { var e = el(); return e ? e.getAttribute('data-sk-type') : null; }
    };
    return api;
  }

  /* ───────────── 토스트 ─────────────
     SimKit.toast('문구')  SimKit.toast('실패했어요', 'no')  SimKit.toast(msg, { type, duration })
     window.VUI.toast가 있으면 그쪽에 맡기고, 없으면 화면 아래 작은 알림을 띄운다. 어디서 불러도 된다(스코프 문제 없음). */
  var toastEl = null, toastTimer = null;
  function toast(msg, opts) {
    if (typeof opts === 'string') opts = { type: opts };
    opts = opts || {};
    msg = msg == null ? '' : String(msg);
    var V = root.VUI;
    if (!opts.local && V && typeof V.toast === 'function') {
      // 앱들이 쓰는 'no' 유형은 VUI의 'error'(붉은색·role=alert)로 넘긴다
      var vopts = opts.type === 'no' ? Object.assign({}, opts, { type: 'error' }) : opts;
      try { V.toast(msg, vopts); return; } catch (e) { /* 아래 기본 토스트로 */ }
    }
    if (!hasDoc || !document.body) return;
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    var bad = opts.type === 'no' || opts.type === 'error';
    toastEl.className = 'sk-toast' + (bad ? ' sk-toast--no' : '');
    toastEl.textContent = msg;
    void toastEl.offsetWidth; // 다시 띄울 때 전환 효과가 보이도록
    toastEl.classList.add('sk-show');
    root.clearTimeout(toastTimer);
    var dur = opts.duration || Math.min(8000, Math.max(2500, msg.length * 90));
    toastTimer = root.setTimeout(function () { if (toastEl) toastEl.classList.remove('sk-show'); }, dur);
  }

  /* ───────────── 저장 ─────────────
     var st = SimKit.store('food-bike:v1', { defaults: {...}, validate: function (raw, defaults) { return 정리된 객체 | null } });
     st.load() → 항상 쓸 수 있는 객체(손상·없음·검사 실패 → defaults 복사본)
     st.save(obj) → true | false(용량 초과·차단). 실패해도 예외를 던지지 않고, 이번 방문 동안은 메모리에 남긴다.
     version을 주면 저장 객체에 _v를 붙이고, 다른 _v는 migrate(raw, oldV)로 넘긴다(없으면 defaults).
     기존 키·형식을 그대로 읽으므로 이미 저장된 학생 기록이 사라지지 않는다. */
  function store(key, opts) {
    opts = opts || {};
    var defaults = opts.defaults === undefined ? {} : opts.defaults;
    var mem; // localStorage를 못 쓸 때의 대체 저장소
    function readRaw() {
      if (mem !== undefined) return clone(mem); // 이번 방문에서 저장에 실패한 최신 값
      var txt = null;
      try { txt = root.localStorage.getItem(key); } catch (e) { return null; }
      if (txt == null) return null;
      try { return JSON.parse(txt); } catch (e) { return null; }
    }
    var api = {
      key: key,
      load: function () {
        var raw = readRaw();
        if (raw != null && opts.version != null && isObj(raw) && raw._v != null && raw._v !== opts.version) {
          try { raw = typeof opts.migrate === 'function' ? opts.migrate(raw, raw._v) : null; } catch (e) { raw = null; }
        }
        if (raw == null) return clone(defaults);
        if (typeof opts.validate === 'function') {
          var out;
          try { out = opts.validate(raw, clone(defaults)); } catch (e) { out = null; }
          return out == null ? clone(defaults) : out;
        }
        if (isObj(raw) && isObj(defaults)) return Object.assign(clone(defaults), raw);
        return clone(defaults);
      },
      save: function (data) {
        var obj = data;
        if (opts.version != null && isObj(data)) { obj = Object.assign({}, data); obj._v = opts.version; }
        var txt;
        try { txt = JSON.stringify(obj); } catch (e) { return false; }
        try {
          root.localStorage.setItem(key, txt);
          mem = undefined;
          return true;
        } catch (e) {
          mem = JSON.parse(txt);
          return false;
        }
      },
      update: function (patch) {
        var cur = api.load();
        var next = isObj(cur) ? Object.assign(cur, patch) : patch;
        api.save(next);
        return next;
      },
      clear: function () {
        mem = undefined;
        try { root.localStorage.removeItem(key); } catch (e) { /* 무시 */ }
      }
    };
    return api;
  }

  /* 저장값·공유 링크 값 정리 도우미 (validate 안에서 쓰기) */
  var clean = {
    // { m1: true, m2: 'x' } → { m1: true, m2: false } (ids에 있는 키만)
    flags: function (obj, ids) {
      var out = {};
      ids.forEach(function (id) { out[id] = !!obj && obj[id] === true; });
      return out;
    },
    // 별 개수: 0~max 정수 (ids에 있는 키만)
    stars: function (obj, ids, max) {
      var out = {};
      ids.forEach(function (id) { out[id] = toInt(obj && obj[id], 0, max == null ? 3 : max, 0); });
      return out;
    },
    // 허용된 값만, 중복 없이, 최대 max개. allowed: 배열 | Set | (값)=>boolean
    list: function (arr, allowed, max) {
      if (!Array.isArray(arr)) return [];
      var ok = typeof allowed === 'function' ? allowed
        : allowed instanceof Set ? function (v) { return allowed.has(v); }
        : Array.isArray(allowed) ? function (v) { return allowed.indexOf(v) >= 0; }
        : function () { return true; };
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        if (max != null && out.length >= max) break;
        var v = arr[i];
        if (ok(v) && out.indexOf(v) < 0) out.push(v);
      }
      return out;
    },
    int: function (v, min, max, def) { return toInt(v, min, max, def); }
  };

  /* ───────────── 공유 링크 ─────────────
     만들기: SimKit.share.link({ v: 1, plate: [...] })  → https://…/apps/x/#share=<base64url>
     읽기:   var p = SimKit.share.read({ version: 1 });  → 객체 | null (읽은 뒤 주소의 #share= 를 지움)
     보내기: SimKit.share.send(url, { title })          → 기기 공유 → VUI 공유 모달 → 복사+토스트 → prompt 순
     연결:   SimKit.share.bind(() => payload, { title }) → 셸의 공유 버튼(window.shareCurrentPage)을 덮어씀
     read는 예전 형식(#share=<URI 인코딩 JSON>, #share=<btoa(encodeURIComponent(JSON))>)도 읽는다.
     받은 값은 믿지 말고 앱의 clean 함수로 다시 검사할 것. */
  function b64decodeToText(s) {
    var b = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b)) throw new Error('not base64');
    while (b.length % 4) b += '=';
    var bin = root.atob(b);
    if (/^\s*(%7B|%5B)/i.test(bin)) return decodeURIComponent(bin); // btoa(encodeURIComponent(json))
    if (typeof root.TextDecoder === 'function') {                    // btoa(UTF-8 바이트)
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new root.TextDecoder().decode(bytes);
    }
    return bin;
  }
  var share = {
    maxLength: 16000,
    encode: function (payload, format) {
      var json = JSON.stringify(payload);
      if (format === 'json') return encodeURIComponent(json);
      var b = root.btoa(encodeURIComponent(json)); // ASCII만 남으므로 btoa 안전
      if (format === 'b64') return b;
      return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    decode: function (raw) {
      if (typeof raw !== 'string' || !raw || raw.length > share.maxLength) return null;
      var s = raw.trim();
      var d = s;
      try { d = decodeURIComponent(s); } catch (e) { /* 그대로 */ }
      if (/^\s*[{[]/.test(d)) { try { return JSON.parse(d); } catch (e) { return null; } }
      try { return JSON.parse(b64decodeToText(d)); } catch (e) { /* 다음 */ }
      var V = root.VUI && root.VUI.share;
      if (V && typeof V.decode === 'function') {
        try { var r = V.decode(s); if (r && typeof r === 'object') return r; } catch (e) { /* 무시 */ }
      }
      return null;
    },
    link: function (payload, o) {
      o = o || {};
      var base = o.base || (root.location.origin + root.location.pathname);
      return base + (o.prefix || '#share=') + share.encode(payload, o.format);
    },
    read: function (o) {
      o = o || {};
      var prefix = o.prefix || '#share=';
      var h = root.location && root.location.hash || '';
      if (h.indexOf(prefix) !== 0) return null;
      var data = share.decode(h.slice(prefix.length));
      if (o.clear !== false) {
        try { root.history.replaceState(null, '', root.location.pathname + root.location.search); } catch (e) { /* 무시 */ }
      }
      if (!data || typeof data !== 'object') return null;
      if (o.version != null && data.v !== o.version) return null;
      return data;
    },
    send: async function (url, o) {
      o = o || {};
      var V = root.VUI && root.VUI.share;
      if (o.shorten && V && typeof V.shorten === 'function') {
        try {
          var s = await V.shorten(url);
          if (typeof s === 'string' && s) url = s;
          else if (s && typeof s.shortURL === 'string') url = s.shortURL;
        } catch (e) { /* 긴 주소 그대로 */ }
      }
      var nav = root.navigator || {};
      if (o.native !== false && typeof nav.share === 'function') {
        try { await nav.share({ title: o.title || (hasDoc ? document.title : ''), url: url }); return 'shared'; }
        catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
      }
      if (V && typeof V.copyOrShow === 'function') {
        try { await V.copyOrShow(url, { title: o.title }); return 'vui'; } catch (e) { /* 아래로 */ }
      }
      if (nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        try { await nav.clipboard.writeText(url); toast(o.copiedMessage || '공유 링크를 복사했어요.'); return 'copied'; }
        catch (e) { /* 아래로 */ }
      }
      try { root.prompt('아래 링크를 복사해 주세요.', url); } catch (e) { /* 무시 */ }
      return 'shown';
    },
    bind: function (getPayload, o) {
      o = o || {};
      root.shareCurrentPage = function () {
        var p = null;
        try { p = getPayload(); } catch (e) { p = null; }
        if (p == null) { toast(o.emptyMessage || '공유할 내용이 없어요.'); return; }
        return share.send(share.link(p, o), o);
      };
    }
  };

  /* ───────────── 화면 전환 ─────────────
     var screens = SimKit.screens({ onShow(id) {...} });  screens.show('screenExplore');
     .screen 중 하나에만 .active를 붙인다(기존 showScreen과 같은 동작). focus:true면 새 화면의 제목으로 초점 이동. */
  function screens(o) {
    o = o || {};
    var sel = o.selector || '.screen';
    var cls = o.activeClass || 'active';
    var current = null;
    return {
      show: function (id) {
        if (!hasDoc) return null;
        resolveAll(sel).forEach(function (s) { s.classList.remove(cls); });
        var el = document.getElementById(id);
        if (el) el.classList.add(cls);
        current = id;
        if (el && o.focus) {
          var h = el.querySelector('[data-sk-focus], h1, h2');
          if (h) {
            if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
            try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
          }
        }
        call(o.onShow, id, el);
        return el;
      },
      current: function () { return current; }
    };
  }

  /* ───────────── 모드 탭 ─────────────
     var tabs = SimKit.tabs('.mode-tab', { attr: 'mode', onSelect(value, btn) { switchMode(value); } });
     tabs.select('2', { silent: true }) → 표시만 바꿈. 선택된 버튼에 .active + aria-pressed="true". */
  function tabs(buttons, o) {
    o = o || {};
    var attr = o.attr || 'mode';
    var cls = o.activeClass || 'active';
    var value = o.initial != null ? String(o.initial) : null;
    function list() { return resolveAll(buttons); }
    function paint() {
      list().forEach(function (b) {
        var on = b.getAttribute('data-' + attr) === value;
        b.classList.toggle(cls, on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    var api = {
      select: function (v, so) {
        value = v == null ? null : String(v);
        paint();
        if (!(so && so.silent)) {
          var btn = list().filter(function (b) { return b.getAttribute('data-' + attr) === value; })[0] || null;
          call(o.onSelect, value, btn);
        }
      },
      value: function () { return value; },
      refresh: paint
    };
    list().forEach(function (b) {
      if (b.getAttribute('type') == null && b.tagName === 'BUTTON') b.setAttribute('type', 'button');
      b.addEventListener('click', function () {
        if (typeof o.canSelect === 'function' && o.canSelect(b.getAttribute('data-' + attr)) === false) return;
        api.select(b.getAttribute('data-' + attr));
      });
    });
    if (value != null) paint();
    return api;
  }

  /* ───────────── 별 ───────────── */
  var stars = {
    // 개수 → 별 0~3: grade(완료 수, [1개 기준, 2개 기준, 3개 기준])  예) grade(5, [1, 4, 6]) → 2
    grade: function (score, cuts) {
      cuts = cuts || [1, 2, 3];
      if (score >= cuts[2]) return 3;
      if (score >= cuts[1]) return 2;
      if (score >= cuts[0]) return 1;
      return 0;
    },
    text: function (n, max, empty) {
      n = toInt(n, 0, max == null ? 3 : max, 0);
      return n > 0 ? '⭐'.repeat(n) : (empty || '');
    },
    // el에 별을 그리고 화면 읽기 프로그램용 이름을 붙인다: "별 3개 중 2개"
    render: function (el, n, max, o) {
      el = resolve(el);
      if (!el) return;
      max = max == null ? 3 : max;
      n = toInt(n, 0, max, 0);
      el.classList.add('sk-stars');
      el.textContent = stars.text(n, max, o && o.empty);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', '별 ' + max + '개 중 ' + n + '개');
    }
  };

  /* ───────────── 미션 컨트롤러 ─────────────
     var mc = SimKit.missions({
       ids: ['m1','m2','m3'] (또는 count: 3 → m1..m3),
       format: 'flags' | 'stars' | 'full',   // 진행 기록 모양(앱의 기존 저장 형식에 맞춤)
       progress: 저장해 둔 기록,               // format 모양
       nav: '#missionNav',                    // 번호 버튼을 키트가 그림 (또는 navButtons: '.mission-nav-btn' 기존 버튼 사용)
       controls: { prev, next, skip },        // 이전/다음/건너뛰기 버튼(선택)
       feedback: '#feedbackBox' | SimKit.feedback(...) | () => 요소,
       autoAdvance: false | ms,               // 성공 뒤 자동으로 다음 미션
       onEnter(i, ctx), onLeave(prev, next), onComplete(i, r), onAllDone(summary), onFinish(summary), onChange(progress)
     });
     mc.start(); mc.go(i); mc.next(); mc.prev(); mc.skip(); mc.retry();
     mc.complete({ stars, message, tone, html, advance }); mc.fail(message);
     mc.later(fn, ms) / mc.every(fn, ms) / mc.frame(fn) / await mc.sleep(ms) — 미션을 옮기면 자동 취소
     mc.token() / mc.alive(token) — async 흐름에서 "아직 같은 미션인가" 확인 */
  function missions(o) {
    o = o || {};
    var ids = Array.isArray(o.ids) ? o.ids.map(String) : [];
    if (!ids.length) {
      var n = toInt(o.count, 0, 500, 0);
      for (var k = 0; k < n; k++) ids.push('m' + (k + 1));
    }
    var count = ids.length;
    var format = o.format === 'flags' || o.format === 'stars' ? o.format : 'full';
    var maxStars = toInt(o.maxStars, 1, 10, 3);
    var keepBest = o.keepBest !== false;
    var fb = null;
    if (o.feedback) fb = typeof o.feedback.show === 'function' ? o.feedback : feedback(o.feedback, o.feedbackOptions);
    var scope = timers();
    var token = 0;
    var cur = -1;
    var pending = false;
    var attempts = 0;
    var destroyed = false;
    var prog = {};
    var controlsBound = false;

    function importProgress(src) {
      prog = {};
      ids.forEach(function (id) { prog[id] = { done: false, stars: 0 }; });
      if (!isObj(src)) return;
      ids.forEach(function (id) {
        var v = src[id];
        if (format === 'flags') prog[id].done = v === true;
        else if (format === 'stars') { var s = toInt(v, 0, maxStars, 0); prog[id] = { done: s > 0, stars: s }; }
        else if (isObj(v)) prog[id] = { done: v.done === true, stars: toInt(v.stars, 0, maxStars, 0) };
      });
    }
    function exportProgress() {
      var out = {};
      ids.forEach(function (id) {
        var e = prog[id];
        out[id] = format === 'flags' ? e.done : format === 'stars' ? e.stars : { done: e.done, stars: e.stars };
      });
      return out;
    }
    function entry(i) { return prog[ids[i]] || { done: false, stars: 0 }; }
    function summary() {
      return ids.map(function (id, i) { return { index: i, id: id, done: prog[id].done, stars: prog[id].stars }; });
    }
    function emitChange() { call(o.onChange, exportProgress()); }
    function cancel() { token++; pending = false; scope.reset(); }
    function ctx(i) {
      var e = entry(i);
      return { index: i, id: ids[i], done: e.done, stars: e.stars, token: token };
    }

    /* 번호 버튼 */
    function labelFor(i) {
      var e = entry(i);
      return (o.label || '미션') + ' ' + (i + 1) + (e.done ? ' (완료)' : '');
    }
    function paintButtons(btns) {
      btns.forEach(function (b, i) {
        var e = entry(i);
        b.classList.toggle('active', i === cur);
        b.classList.toggle('done', e.done);
        if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        b.setAttribute('aria-label', labelFor(i));
        if (typeof o.navText === 'function') b.textContent = o.navText(i, { id: ids[i], done: e.done, stars: e.stars });
      });
    }
    function renderNav() {
      if (!hasDoc) return;
      var btns = [];
      if (o.navButtons) {
        btns = resolveAll(o.navButtons).slice(0, count);
        btns.forEach(function (b, i) {
          if (b._skOwner === api) return;
          b._skOwner = api;
          b.classList.add('sk-mnav-btn');
          b.addEventListener('click', function () { if (b._skOwner === api && !destroyed) go(i); });
        });
      } else {
        var box = resolve(o.nav);
        if (box) {
          var mine = box._skOwner === api ? box.querySelectorAll('[data-sk-nav]') : [];
          if (mine.length !== count) {
            box.innerHTML = '';
            box._skOwner = api;
            box.classList.add('sk-mnav');
            if (!box.getAttribute('role')) box.setAttribute('role', 'group');
            if (!box.getAttribute('aria-label')) box.setAttribute('aria-label', (o.label || '미션') + ' 고르기');
            ids.forEach(function (id, i) {
              var b = document.createElement('button');
              b.type = 'button';
              b.className = 'sk-mnav-btn' + (o.navClass ? ' ' + o.navClass : '');
              b.setAttribute('data-sk-nav', String(i));
              b.textContent = String(i + 1);
              b.addEventListener('click', function () { if (box._skOwner === api && !destroyed) go(i); });
              box.appendChild(b);
            });
          }
          btns = Array.prototype.slice.call(box.querySelectorAll('[data-sk-nav]'));
        }
      }
      paintButtons(btns);
      paintControls();
    }
    function paintControls() {
      var c = o.controls;
      if (!c || !hasDoc) return;
      var prevB = resolve(c.prev), nextB = resolve(c.next), skipB = resolve(c.skip);
      if (!controlsBound) {
        controlsBound = true;
        if (prevB) prevB.addEventListener('click', function () { if (!destroyed) prev(); });
        if (nextB) nextB.addEventListener('click', function () { if (!destroyed) next(); });
        if (skipB) skipB.addEventListener('click', function () { if (!destroyed) skip(); });
      }
      if (prevB) prevB.disabled = cur <= 0;
      if (nextB) nextB.disabled = cur < 0;
      if (skipB) skipB.disabled = cur < 0;
    }

    /* 이동 */
    function go(i, g) {
      if (destroyed || !count) return api;
      g = g || {};
      i = toInt(i, 0, count - 1, 0);
      var prevI = cur;
      cancel();
      if (prevI >= 0) call(o.onLeave, prevI, i);
      cur = i;
      attempts = 0;
      if (fb && !g.keepFeedback) fb.hide();
      renderNav();
      call(o.onEnter, i, ctx(i));
      return api;
    }
    function next() {
      if (destroyed) return api;
      if (cur + 1 >= count) return finish();
      return go(cur + 1);
    }
    function prev() {
      if (destroyed) return api;
      if (cur > 0) go(cur - 1);
      return api;
    }
    function skip() {
      if (destroyed || cur < 0) return api;
      call(o.onSkip, cur);
      return next();
    }
    function finish() {
      if (destroyed) return api;
      var last = cur;
      cancel();
      if (last >= 0) call(o.onLeave, last, -1);
      cur = -1;
      renderNav();
      call(o.onFinish, summary());
      return api;
    }
    function stop() {
      if (destroyed) return api;
      var last = cur;
      cancel();
      if (last >= 0) call(o.onLeave, last, -1);
      cur = -1;
      if (fb) fb.hide();
      renderNav();
      return api;
    }
    function firstIncomplete() {
      for (var i = 0; i < count; i++) if (!prog[ids[i]].done) return i;
      return -1;
    }

    /* 채점 결과 */
    function complete(r) {
      r = r || {};
      if (destroyed || cur < 0 || pending) return false;
      var t0 = token;
      var i = cur;
      var e = prog[ids[i]];
      var s = r.stars == null ? maxStars : toInt(r.stars, 0, maxStars, maxStars);
      if (format === 'stars' && s < 1) s = 1; // stars 형식은 별 0 = 미완료
      e.done = true;
      e.stars = keepBest && r.keepBest !== false ? Math.max(e.stars, s) : s;
      if (fb && r.message != null) fb.show(r.tone || 'ok', r.message, { html: r.html });
      renderNav();
      emitChange();
      call(o.onComplete, i, { id: ids[i], stars: e.stars, earned: s });
      if (token === t0 && firstIncomplete() === -1) call(o.onAllDone, summary());
      var adv = r.advance !== undefined ? r.advance : o.autoAdvance;
      if (token === t0 && typeof adv === 'number' && adv >= 0) {
        pending = true;
        scope.timeout(function () {
          if (t0 !== token || destroyed) return;
          pending = false;
          next();
        }, adv);
      }
      return true;
    }
    function fail(message, r) {
      r = r || {};
      if (destroyed || cur < 0 || pending) return false;
      attempts++;
      if (fb && message != null) fb.show(r.tone || 'no', message, { html: r.html });
      call(o.onFail, cur, attempts);
      return true;
    }

    var api = {
      ids: ids.slice(),
      count: count,
      timers: scope,
      feedback: fb,
      start: function (i) {
        if (typeof i === 'number') return go(i);
        var f = firstIncomplete();
        return go(f < 0 ? 0 : f);
      },
      go: go,
      next: next,
      prev: prev,
      skip: skip,
      retry: function () { return cur < 0 ? api : go(cur); },
      finish: finish,
      stop: stop,
      complete: complete,
      fail: fail,
      later: function (fn, ms) {
        var t = token;
        return scope.timeout(function () { if (t === token && !destroyed) fn(); }, ms);
      },
      every: function (fn, ms) {
        var t = token;
        return scope.interval(function () { if (t === token && !destroyed) fn(); }, ms);
      },
      frame: function (fn) {
        var t = token;
        return scope.raf(function (ts) { if (t === token && !destroyed) fn(ts); });
      },
      sleep: function (ms) {
        var t = token;
        return scope.sleep(ms).then(function (ok) { return ok && t === token && !destroyed; });
      },
      token: function () { return token; },
      alive: function (t) { return t === token && !destroyed; },
      pending: function () { return pending; },
      attempts: function () { return attempts; },
      current: function () { return cur; },
      id: function (i) { return ids[i == null ? cur : i]; },
      isDone: function (i) { return entry(i == null ? cur : i).done; },
      starsOf: function (i) { return entry(i == null ? cur : i).stars; },
      doneCount: function () { return summary().filter(function (x) { return x.done; }).length; },
      totalStars: function () { return summary().reduce(function (a, x) { return a + x.stars; }, 0); },
      allDone: function () { return firstIncomplete() === -1; },
      firstIncomplete: firstIncomplete,
      summary: summary,
      progress: exportProgress,
      setProgress: function (src) { importProgress(src); renderNav(); return api; },
      reset: function () {
        ids.forEach(function (id) { prog[id] = { done: false, stars: 0 }; });
        emitChange();
        renderNav();
        return api;
      },
      render: renderNav,
      destroy: function () { cancel(); destroyed = true; }
    };
    importProgress(o.progress);
    return api;
  }

  /* ───────────── 효과음 (Web Audio) ─────────────
     SimKit.sound.play('done' | 'wrong' | 'star' | 'stamp' | 'move')
     SimKit.sound.bindButton('#muteBtn')  → 누르면 음소거 전환, aria-pressed 갱신
     음소거는 localStorage 'vives:sim-muted'에 저장. 예전 키를 쓰는 앱은 SimKit.sound.useKey('clubs.muted'). */
  var sound = (function () {
    var KEY = 'vives:sim-muted';
    var muted = null;
    var actx = null;
    var buttons = [];
    function isMuted() {
      if (muted === null) {
        try { muted = root.localStorage.getItem(KEY) === '1'; } catch (e) { muted = false; }
      }
      return muted;
    }
    function ac() {
      if (!actx) {
        var C = root.AudioContext || root.webkitAudioContext;
        if (!C) return null;
        try { actx = new C(); } catch (e) { return null; }
      }
      if (actx.state === 'suspended') { try { actx.resume(); } catch (e) { /* 무시 */ } }
      return actx;
    }
    function tone(freq, dur, type, gain, delay) {
      if (isMuted()) return;
      var c = ac();
      if (!c) return;
      try {
        var t = c.currentTime + (delay || 0);
        var osc = c.createOscillator(), g = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain || 0.14, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(c.destination);
        osc.start(t); osc.stop(t + dur + 0.03);
      } catch (e) { /* 소리는 실패해도 앱은 계속 */ }
    }
    // blocks-universe 3종(break-make·clubs·step-squad)의 sfx와 같은 소리
    var PRESETS = {
      move: function () { tone(540, 0.08, 'triangle', 0.10); },
      done: function () { tone(523, 0.12, 'sine', 0.14, 0); tone(659, 0.12, 'sine', 0.14, 0.09); tone(784, 0.18, 'sine', 0.14, 0.18); },
      star: function () { tone(988, 0.08, 'triangle', 0.13, 0); tone(1319, 0.13, 'triangle', 0.13, 0.07); },
      stamp: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.15, 'square', 0.10, i * 0.11); }); },
      wrong: function () { tone(233, 0.18, 'sine', 0.13, 0); tone(185, 0.22, 'sine', 0.13, 0.13); }
    };
    PRESETS.ok = PRESETS.done; PRESETS.no = PRESETS.wrong; PRESETS.tap = PRESETS.move;
    function paint() {
      var m = isMuted();
      buttons.forEach(function (b) {
        b.el.setAttribute('aria-pressed', m ? 'true' : 'false');
        b.el.setAttribute('aria-label', m ? '소리 켜기' : '소리 끄기');
        b.el.title = m ? '소리 켜기' : '소리 끄기';
        if (typeof b.render === 'function') b.render(b.el, m);
        else if (!b.keep) b.el.textContent = m ? '🔇' : '🔊';
      });
    }
    var api = {
      useKey: function (k) { KEY = k; muted = null; paint(); return api; },
      muted: isMuted,
      setMuted: function (v) {
        muted = !!v;
        try { root.localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* 이번 방문 동안만 */ }
        paint();
      },
      toggle: function () {
        api.setMuted(!isMuted());
        if (!muted) PRESETS.move();
        return muted;
      },
      play: function (name) { if (!isMuted() && PRESETS[name]) PRESETS[name](); },
      tone: tone,
      presets: PRESETS,
      // keepContent:true면 버튼 안의 아이콘(SVG 등)을 건드리지 않음. render(el, muted)로 직접 그려도 됨
      bindButton: function (el, bo) {
        bo = bo || {};
        el = resolve(el);
        if (!el || el._skSound) return;
        el._skSound = true;
        if (el.tagName === 'BUTTON' && !el.getAttribute('type')) el.setAttribute('type', 'button');
        buttons.push({ el: el, render: bo.render, keep: !!bo.keepContent });
        el.addEventListener('click', function () { api.toggle(); });
        paint();
      }
    };
    return api;
  })();

  /* ───────────── 읽어주기 (TTS) ───────────── */
  function speak(text, o) {
    o = o || {};
    if (!speak.supported() || !text) return null;
    try {
      root.speechSynthesis.cancel();
      var u = new root.SpeechSynthesisUtterance(String(text));
      u.lang = o.lang || 'ko-KR';
      if (o.rate) u.rate = o.rate;
      if (typeof o.onend === 'function') { u.onend = o.onend; u.onerror = o.onend; }
      root.speechSynthesis.speak(u);
      return u;
    } catch (e) { return null; }
  }
  speak.supported = function () {
    return typeof root.speechSynthesis !== 'undefined' && typeof root.SpeechSynthesisUtterance !== 'undefined';
  };
  speak.cancel = function () { try { if (speak.supported()) root.speechSynthesis.cancel(); } catch (e) { /* 무시 */ } };

  /* ───────────── 조사 ─────────────
     SimKit.josa('곡류', '이/가') → '곡류가'   SimKit.josa('5', '은/는') → '5는'   SimKit.josa('서울', '으로/로') → '서울로'
     josa.pick(단어, 짝) → 조사만. 한글·숫자로 끝나지 않으면 '은(는)'처럼 둘 다 보여 준다.
     짝은 '받침 있을 때/없을 때' 순서. 반대로 써도('는/은') 알아서 맞춘다. */
  var WITH_B = ['은', '이', '을', '과', '으로', '이라', '이랑', '아', '이나', '이에요', '이야'];
  var DIGIT_JONG = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 }; // 영 일 이 삼 사 오 육 칠 팔 구
  function lastJong(word) {
    var w = String(word == null ? '' : word).replace(/[\s)\]}"'」』》>.,!?~]+$/, '');
    if (!w) return null;
    var ch = w.charAt(w.length - 1);
    var code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) return code % 28;
    if (Object.prototype.hasOwnProperty.call(DIGIT_JONG, ch)) return DIGIT_JONG[ch];
    return null;
  }
  function josaPick(word, pair) {
    var parts = String(pair || '은/는').split('/');
    var a = parts[0], b = parts[1] || '';
    if (WITH_B.indexOf(a) < 0 && WITH_B.indexOf(b) >= 0) { var t = a; a = b; b = t; }
    var j = lastJong(word);
    if (j === null) return a + '(' + b + ')';
    if (a.indexOf('으로') === 0) return (j !== 0 && j !== 8) ? a : b; // ㄹ 받침은 '로'
    return j !== 0 ? a : b;
  }
  function josa(word, pair) { return String(word == null ? '' : word) + josaPick(word, pair); }
  josa.pick = josaPick;

  root.SimKit = {
    version: '1.0.0',
    ready: ready,
    timers: timers,
    feedback: feedback,
    toast: toast,
    store: store,
    clean: clean,
    share: share,
    screens: screens,
    tabs: tabs,
    stars: stars,
    missions: missions,
    sound: sound,
    speak: speak,
    josa: josa
  };
})(typeof window !== 'undefined' ? window : globalThis);
