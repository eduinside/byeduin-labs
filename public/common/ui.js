/* =====================================================
   eduin VIVES — 공용 UI 도구 (window.VUI)
   /common/ui.js

   AppLayout이 <head>에서 safe.js 다음에 동기로 불러온다(독립 HTML은 직접 <script src="/common/ui.js">).
   로드 시점에는 document.body를 건드리지 않는다 — DOM은 처음 쓸 때 만든다.
   자세한 사용법·이전 패턴 → docs/common-ui.md

   VUI.toast(msg, opts)                 공용 토스트(스크린리더 안내 포함). opts: {type:'error'|'success', duration}
   VUI.modal.open(el, opts) / close(el) 기존 모달 요소의 접근성(포커스 가두기·ESC·포커스 복귀)
   VUI.modal.bind(el, opts)             기본 옵션 등록 + {open, close, isOpen} 반환
   VUI.share.encode(obj) / decode(str)  공유 링크용 base64url(UTF-8). decode는 옛 형식도 읽음
   VUI.share.shorten(url)               /api/shorten. 실패하면 원래 주소로 resolve
   VUI.share.copyOrShow(url, opts)      복사 시도 → 안 되면 링크·QR 창
   VUI.share.link(longUrl, opts)        shorten + copyOrShow(또는 show:true면 창에서 바로 보여 줌)
   VUI.copy(text, okMsg)                클립보드 복사(옛 브라우저 대체 포함). Promise<boolean>
   VUI.apiFetch(url, opts)              시간 제한·상태 확인·JSON 해석·한국어 오류
   VUI.josa(word, '은/는')               받침에 맞는 조사. VUI.withJosa(word, '이/가') → 단어+조사
   VUI.storage.get(key, fallback, validate) / set(key, value) / remove(key)
   ===================================================== */
(function (global) {
  'use strict';
  if (global.VUI) return;
  var doc = global.document;
  var uid = 0;

  /* ─────────────────────────────────────────────
     스타일 — 처음 쓸 때 한 번 <head>에 넣는다.
     색은 hero-theme.css의 토스트·대화상자 토큰을 쓰고, 없으면 기본값.
     ───────────────────────────────────────────── */
  var CSS = [
    '.vui-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:10050;',
    'box-sizing:border-box;width:max-content;max-width:min(92vw,480px);padding:10px 18px;border-radius:12px;',
    'background:var(--toast-bg,#18181b);color:var(--toast-fg,#fafafa);font-family:inherit;font-size:14px;font-weight:600;',
    'line-height:1.5;text-align:center;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;',
    'box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;transform:translate(-50%,12px);pointer-events:none;',
    'transition:opacity .2s ease,transform .2s ease}',
    '.vui-toast:empty{padding:0;box-shadow:none}',
    '.vui-toast.vui-show{opacity:1;transform:translate(-50%,0)}',
    '.vui-toast.vui-error{background:var(--toast-error-bg,#be123c);color:var(--toast-error-fg,#fff)}',
    '.vui-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;',
    'overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}',
    '.vui-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;',
    'padding:16px;background:rgba(0,0,0,.5)}',
    '.vui-overlay[hidden]{display:none}',
    '.vui-dialog{box-sizing:border-box;width:min(360px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px;',
    'display:flex;flex-direction:column;gap:12px;border-radius:16px;font-family:inherit;',
    'background:var(--dialog-bg,#fff);color:var(--dialog-fg,#11181c);border:1px solid var(--dialog-border,rgba(127,127,127,.3));',
    'box-shadow:0 20px 50px rgba(0,0,0,.3)}',
    '.vui-dialog h2{margin:0;font-size:17px;font-weight:800;line-height:1.4}',
    '.vui-dialog p{margin:0;font-size:13px;line-height:1.55;opacity:.8}',
    '.vui-status{font-size:13px;line-height:1.5;text-align:center}',
    '.vui-status:empty{display:none}',
    '.vui-qr{display:flex;justify-content:center;align-items:center;padding:12px;background:#fff;border-radius:12px;min-height:80px}',
    '.vui-qr[hidden]{display:none}',
    '.vui-qr img,.vui-qr canvas{display:block;max-width:100%;height:auto}',
    '.vui-qr-msg{font-size:12px;color:#52525b;text-align:center;line-height:1.5}',
    '.vui-row{display:flex;gap:8px}',
    '.vui-input{flex:1;min-width:0;box-sizing:border-box;min-height:44px;padding:9px 11px;border-radius:10px;font-family:inherit;font-size:13px;',
    'background:transparent;color:inherit;border:1px solid var(--dialog-border,rgba(127,127,127,.45))}',
    '.vui-btn{min-height:44px;padding:0 16px;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;',
    'background:var(--primary,#006fee);color:var(--primary-fg,#fff);border:1px solid var(--primary,#006fee)}',
    '.vui-btn-ghost{background:transparent;color:inherit;border-color:var(--dialog-border,rgba(127,127,127,.45))}',
    '.vui-btn:focus-visible,.vui-input:focus-visible{outline:2px solid var(--primary,#006fee);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){.vui-toast{transition:opacity .01s;transform:translate(-50%,0)}}',
    '@media print{.vui-toast,.vui-overlay{display:none!important}}'
  ].join('');
  var styleDone = false;
  function ensureStyle() {
    if (styleDone) return;
    var head = doc.head || doc.getElementsByTagName('head')[0];
    if (!head) return;
    styleDone = true;
    var s = doc.createElement('style');
    s.id = 'vui-style';
    s.textContent = CSS;
    head.appendChild(s);
  }
  // body가 아직 없으면(헤드 스크립트에서 바로 호출) DOM 준비 후 실행
  function whenBody(fn) {
    if (doc.body) { fn(); return; }
    doc.addEventListener('DOMContentLoaded', fn);
  }
  function resolveEl(el, root) {
    if (!el) return null;
    if (typeof el === 'string') { try { return (root || doc).querySelector(el); } catch (e) { return null; } }
    return el;
  }

  /* ─────────────────────────────────────────────
     1) 토스트
     ───────────────────────────────────────────── */
  var regions = {};          // { status: el, alert: el }
  var toastTimer = null;
  function region(kind) {
    if (regions[kind] && regions[kind].isConnected !== false) return { el: regions[kind], fresh: false };
    ensureStyle();
    var el = doc.createElement('div');
    el.className = 'vui-toast' + (kind === 'alert' ? ' vui-error' : '');
    el.setAttribute('role', kind);
    el.setAttribute('aria-live', kind === 'alert' ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'true');
    doc.body.appendChild(el);
    regions[kind] = el;
    return { el: el, fresh: true };
  }
  function toastDuration(msg) {
    var n = String(msg).length;
    return Math.max(2500, Math.min(8000, 1500 + n * 60));
  }
  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    ['status', 'alert'].forEach(function (k) {
      var el = regions[k];
      if (!el) return;
      el.classList.remove('vui-show');
      // 흐려진 뒤 글자를 비워 스크린리더가 옛 문구를 다시 읽지 않게
      setTimeout(function () { if (!el.classList.contains('vui-show')) el.textContent = ''; }, 250);
    });
  }
  function toast(msg, opts) {
    if (typeof opts === 'string') opts = { type: opts };
    else if (typeof opts === 'number') opts = { duration: opts };
    opts = opts || {};
    msg = msg == null ? '' : String(msg);
    if (!msg) return hideToast;
    if (!doc.body) { whenBody(function () { toast(msg, opts); }); return hideToast; }
    var kind = opts.type === 'error' ? 'alert' : 'status';
    var other = regions[kind === 'alert' ? 'status' : 'alert'];
    if (other) { other.classList.remove('vui-show'); other.textContent = ''; }
    var r = region(kind), el = r.el;
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    // 같은 문구를 연달아 띄워도 다시 읽히도록 비웠다가 넣는다(새로 만든 영역은 조금 더 기다림)
    el.textContent = '';
    var delay = r.fresh ? 80 : 20;
    var dur = typeof opts.duration === 'number' && opts.duration > 0 ? opts.duration : toastDuration(msg);
    setTimeout(function () {
      el.textContent = msg;
      el.classList.add('vui-show');
    }, delay);
    toastTimer = setTimeout(hideToast, dur + delay);
    return hideToast;
  }
  toast.hide = hideToast;

  /* ─────────────────────────────────────────────
     2) 모달 접근성 — 앱이 이미 가진 모달 요소에 붙여 쓴다(모양은 건드리지 않음)
     ───────────────────────────────────────────── */
  var FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
    'select:not([disabled]),textarea:not([disabled]),iframe,audio[controls],video[controls],' +
    '[contenteditable=""],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
  var recs = [];    // 모달별 기록 { el, base, o, open, prevFocus, dialog, mode }
  var stack = [];   // 열려 있는 모달(마지막 = 맨 위)
  var listening = false;

  function findRec(el) {
    for (var i = 0; i < recs.length; i++) if (recs[i].el === el) return recs[i];
    return null;
  }
  function getRec(el) {
    var rec = findRec(el);
    if (rec) return rec;
    rec = { el: el, base: {}, o: {}, open: false, prevFocus: null, dialog: null, mode: null, downOnBackdrop: false };
    recs.push(rec);
    // 바깥(배경) 클릭 닫기: 누른 곳과 뗀 곳이 모두 배경일 때만(글자 드래그 중 닫힘 방지)
    el.addEventListener('mousedown', function (e) { rec.downOnBackdrop = e.target === el; });
    el.addEventListener('click', function (e) {
      if (!rec.open) return;
      var closer = e.target && e.target.closest ? e.target.closest('[data-vui-close]') : null;
      if (closer && el.contains(closer)) { close(el, 'button'); return; }
      if (rec.o.backdropClose && e.target === el && rec.downOnBackdrop) close(el, 'backdrop');
      rec.downOnBackdrop = false;
    });
    return rec;
  }
  function assign(a, b) {
    var o = {}, k;
    if (a) for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    if (b) for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
    return o;
  }
  function merge(a, b) {
    var o = assign(a, b);
    if (o.manual) { if (!('show' in o)) o.show = false; if (!('hide' in o)) o.hide = false; }
    if (o.show === false && !('hide' in o)) o.hide = false;
    return o;
  }
  function isVisible(n) {
    return !!(n.offsetWidth || n.offsetHeight || (n.getClientRects && n.getClientRects().length));
  }
  function focusables(root) {
    var list = root.querySelectorAll(FOCUSABLE), out = [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.closest && n.closest('[inert]')) continue;
      if (isVisible(n)) out.push(n);
    }
    return out;
  }
  function dialogOf(el, o) {
    var d = o.dialog ? resolveEl(o.dialog, el) : null;
    return d || el.querySelector('[role="dialog"],[role="alertdialog"]') || el;
  }
  function applyAria(el, o) {
    var d = dialogOf(el, o);
    if (!d.getAttribute('role')) d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    if (!d.hasAttribute('aria-label') && !d.hasAttribute('aria-labelledby')) {
      if (o.label) d.setAttribute('aria-label', o.label);
      else {
        var h = d.querySelector('h1,h2,h3,h4,[data-dialog-title]');
        if (h) { if (!h.id) h.id = 'vui-dlg-t' + (++uid); d.setAttribute('aria-labelledby', h.id); }
      }
    }
    if (!d.hasAttribute('tabindex')) d.setAttribute('tabindex', '-1');   // 포커스할 곳이 없을 때 대상
    return d;
  }
  function doShow(rec) {
    var el = rec.el, o = rec.o;
    rec.mode = null;
    if (o.show === false) return;
    if (typeof o.show === 'function') { o.show(el); return; }
    if (o.className) { el.classList.add(o.className); rec.mode = 'class'; return; }
    if (el.hidden) { el.hidden = false; rec.mode = 'hidden'; }
    if (el.style.display === 'none') { el.style.display = ''; if (!rec.mode) rec.mode = 'display'; }
    if (global.getComputedStyle && global.getComputedStyle(el).display === 'none') {
      el.style.display = o.display || 'block';
      rec.mode = 'display';
    }
  }
  function doHide(rec) {
    var el = rec.el, o = rec.o;
    if (o.hide === false) return;
    if (typeof o.hide === 'function') { o.hide(el); return; }
    if (o.className) { el.classList.remove(o.className); return; }
    if (rec.mode === 'hidden') el.hidden = true;
    else el.style.display = 'none';
  }
  function focusInitial(rec) {
    var o = rec.o, el = rec.el, t = null;
    if (o.initialFocus === false) return;
    if (typeof o.initialFocus === 'function') t = o.initialFocus(el);
    else if (o.initialFocus) t = resolveEl(o.initialFocus, el);
    if (!t) t = el.querySelector('[autofocus]');
    if (!t || !isVisible(t)) t = focusables(rec.dialog)[0] || focusables(el)[0] || rec.dialog;
    try { t.focus({ preventScroll: false }); } catch (e) { try { t.focus(); } catch (e2) {} }
  }
  function onKey(e) {
    var top = stack[stack.length - 1];
    if (!top) return;
    if ((e.key === 'Escape' || e.key === 'Esc') && top.o.escClose !== false && !e.defaultPrevented) {
      close(top.el, 'esc');
      return;
    }
    if (e.key !== 'Tab' || top.o.trap === false) return;
    var list = focusables(top.el);
    var a = doc.activeElement;
    if (!list.length) { e.preventDefault(); try { top.dialog.focus(); } catch (er) {} return; }
    var first = list[0], last = list[list.length - 1];
    var inside = top.el.contains(a);
    if (e.shiftKey && (!inside || a === first || a === top.dialog || a === top.el)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (!inside || a === last)) { e.preventDefault(); first.focus(); }
  }
  function onFocusIn(e) {
    var top = stack[stack.length - 1];
    if (!top || top.o.trap === false) return;
    var t = e.target;
    if (top.el.contains(t)) return;
    // 위에 뜬 다른 것(토스트 등)은 포커스를 받지 않으므로 그대로 안쪽으로 돌려보낸다
    var list = focusables(top.el);
    try { (list[0] || top.dialog).focus(); } catch (er) {}
  }
  function listen(on) {
    if (on === listening) return;
    listening = on;
    var m = on ? 'addEventListener' : 'removeEventListener';
    doc[m]('keydown', onKey);
    doc[m]('focusin', onFocusIn);
  }
  function handle(el) {
    return {
      el: el,
      open: function (o) { return open(el, o); },
      close: function () { return close(el); },
      isOpen: function () { var r = findRec(el); return !!(r && r.open); }
    };
  }
  /* opts:
       className   보일 때 붙일 클래스(예: 'open', 'show'). 없으면 hidden/style.display를 바꿈
       show/hide   직접 보이기·숨기기 함수(el). false면 VUI가 보이기·숨기기를 하지 않음
       manual      true = show:false + hide:false (앱이 보이기·숨기기를 직접 함)
       display     기본 방식에서 CSS가 display:none일 때 쓸 값(기본 'block')
       dialog      role="dialog"를 붙일 안쪽 상자(요소·선택자). 기본은 el
       label       제목 요소가 없을 때 aria-label
       initialFocus 처음 포커스할 요소·선택자·함수. false면 옮기지 않음
       onClose(reason) VUI가 닫았을 때만 호출('esc'|'backdrop'|'button'). 앱이 close()를 부를 땐 호출 안 함
       backdropClose 배경 클릭으로 닫기(기본 false)
       escClose     ESC로 닫기(기본 true)
       trap         Tab 포커스 가두기(기본 true)
       restoreFocus 닫을 때 원래 포커스로 돌려놓기(기본 true) */
  function open(el, opts) {
    el = resolveEl(el);
    if (!el) return null;
    var rec = getRec(el);
    if (rec.open) return handle(el);
    rec.o = merge(rec.base, opts);
    rec.prevFocus = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    rec.dialog = applyAria(el, rec.o);
    doShow(rec);
    rec.open = true;
    stack.push(rec);
    listen(true);
    setTimeout(function () { if (rec.open) focusInitial(rec); }, 0);
    return handle(el);
  }
  function close(el, reason) {
    el = resolveEl(el);
    var rec = el && findRec(el);
    if (!rec || !rec.open) return false;
    rec.open = false;
    var i = stack.indexOf(rec);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) listen(false);
    var hadFocus = el.contains(doc.activeElement) || doc.activeElement === doc.body || !doc.activeElement;
    doHide(rec);
    var p = rec.prevFocus;
    rec.prevFocus = null;
    if (rec.o.restoreFocus !== false && p && hadFocus && doc.contains(p) && typeof p.focus === 'function') {
      try { p.focus({ preventScroll: true }); } catch (e) { try { p.focus(); } catch (e2) {} }
    }
    if (reason && typeof rec.o.onClose === 'function') { try { rec.o.onClose(reason); } catch (e) { if (global.console) console.error(e); } }
    return true;
  }
  function bind(el, opts) {
    el = resolveEl(el);
    if (!el) return null;
    var rec = getRec(el);
    rec.base = merge(rec.base, opts);
    applyAria(el, rec.base);
    return handle(el);
  }
  var modal = {
    open: open,
    close: function (el) { return close(el); },
    bind: bind,
    isOpen: function (el) { var r = findRec(resolveEl(el)); return !!(r && r.open); }
  };

  /* ─────────────────────────────────────────────
     3) 공유 — 인코딩·단축·복사/보여 주기
     ───────────────────────────────────────────── */
  function utf8ToBin(str) {
    if (global.TextEncoder) {
      var bytes = new TextEncoder().encode(str), out = '';
      for (var i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return out;
    }
    return unescape(encodeURIComponent(str));
  }
  function binToUtf8(bin) {
    if (global.TextDecoder) {
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    return decodeURIComponent(escape(bin));
  }
  function toB64url(bin) {
    return global.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(s) {
    s = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    if (s.length % 4 === 1) throw new Error('bad base64');
    return global.atob(s + '==='.slice(0, (4 - s.length % 4) % 4));
  }
  // 객체 → 공유 링크용 문자열. JSON → UTF-8 바이트 → base64url (한글이 옛 방식보다 약 3배 짧음)
  function encode(obj) { return toB64url(utf8ToBin(JSON.stringify(obj))); }
  // 문자열 → 객체. 새 형식 → 옛 형식 btoa(encodeURIComponent(json)) → btoa(json) 순서로 시도.
  // validate(obj)가 false를 주면 다음 형식을 시도하고, 모두 실패하면 null.
  function decode(str, validate) {
    if (str == null) return null;
    str = String(str).replace(/^#/, '').replace(/^share=/, '');
    if (str.indexOf('%') >= 0) { try { str = decodeURIComponent(str); } catch (e) {} }
    var bin;
    try { bin = fromB64url(str); } catch (e) { return null; }
    var tries = [
      function () { return JSON.parse(binToUtf8(bin)); },
      function () { return JSON.parse(decodeURIComponent(bin)); },
      function () { return JSON.parse(bin); }
    ];
    for (var i = 0; i < tries.length; i++) {
      try {
        var v = tries[i]();
        if (v != null && (!validate || validate(v))) return v;
      } catch (e) { /* 다음 형식 */ }
    }
    return null;
  }

  var shortCache = Object.create ? Object.create(null) : {};
  // 긴 주소 → 짧은 주소. 실패(한도 초과·오프라인 등)하면 원래 주소로 resolve — reject하지 않음.
  function shorten(url, opts) {
    url = url == null ? '' : String(url);
    if (!/^https?:\/\//i.test(url)) return Promise.resolve(url);
    if (shortCache[url]) return Promise.resolve(shortCache[url]);
    var timeout = (opts && opts.timeout) || 10000;
    return apiFetch('/api/shorten', { method: 'POST', json: { url: url }, timeout: timeout }).then(function (d) {
      var s = d && typeof d.shortURL === 'string' && /^https?:\/\//i.test(d.shortURL) ? d.shortURL : null;
      if (s) { shortCache[url] = s; return s; }
      return url;
    }, function () { return url; });
  }

  // 클립보드 복사. 성공하면 true, 실패하면 false로 resolve(reject하지 않음).
  function legacyCopy(text) {
    if (!doc.body) return false;
    var active = doc.activeElement, ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    if (active && active.focus) { try { active.focus({ preventScroll: true }); } catch (e) {} }
    return ok;
  }
  function copyText(text) {
    text = text == null ? '' : String(text);
    return new Promise(function (resolve) {
      var nav = global.navigator;
      if (nav && nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(text).then(function () { resolve(true); }, function () { resolve(legacyCopy(text)); });
      } else resolve(legacyCopy(text));
    });
  }
  function copy(text, okMsg) {
    return copyText(text).then(function (ok) {
      if (ok && okMsg !== false) toast(okMsg || '복사했어요 ✓', { type: 'success' });
      return ok;
    });
  }

  // 링크 보여 주기 창(한 개를 만들어 다시 씀)
  var dlg = null;
  function buildDialog() {
    ensureStyle();
    var ov = doc.createElement('div');
    ov.className = 'vui-overlay';
    ov.hidden = true;
    var tid = 'vui-share-t' + (++uid);
    ov.innerHTML =
      '<div class="vui-dialog" role="dialog" aria-modal="true" aria-labelledby="' + tid + '">' +
        '<h2 id="' + tid + '"></h2>' +
        '<p class="vui-desc"></p>' +
        '<div class="vui-status" role="status" aria-live="polite"></div>' +
        '<div class="vui-qr" hidden></div>' +
        '<div class="vui-row vui-link-row" hidden>' +
          '<input class="vui-input" type="text" readonly aria-label="공유 링크">' +
          '<button type="button" class="vui-btn vui-copy">복사</button>' +
        '</div>' +
        '<button type="button" class="vui-btn vui-btn-ghost" data-vui-close>닫기</button>' +
      '</div>';
    doc.body.appendChild(ov);
    var q = function (s) { return ov.querySelector(s); };
    var d = {
      ov: ov, title: q('h2'), desc: q('.vui-desc'), status: q('.vui-status'), qr: q('.vui-qr'),
      row: q('.vui-link-row'), input: q('.vui-input'), copyBtn: q('.vui-copy'), qrOn: true
    };
    d.input.addEventListener('focus', function () { d.input.select(); });
    d.input.addEventListener('click', function () { d.input.select(); });
    d.copyBtn.addEventListener('click', function () {
      d.input.focus(); d.input.select();
      copyText(d.input.value).then(function (ok) {
        if (ok) { d.status.textContent = '복사했어요 ✓'; toast('링크를 복사했어요 ✓', { type: 'success' }); }
        else { d.input.focus(); d.input.select(); d.status.textContent = '자동 복사가 안 돼요. 링크를 길게 누르거나 Ctrl+C로 복사해 주세요.'; }
      });
    });
    return d;
  }
  function renderQR(d, url) {
    d.qr.innerHTML = '';
    var QR = global.QRCode;
    if (!d.qrOn || typeof QR !== 'function' || !url) { d.qr.hidden = true; return; }
    d.qr.hidden = false;
    try {
      var o = { text: url, width: 180, height: 180 };
      if (QR.CorrectLevel) o.correctLevel = QR.CorrectLevel.M;
      new QR(d.qr, o);
    } catch (e) {
      d.qr.innerHTML = '<div class="vui-qr-msg">링크가 길어서 QR을 만들 수 없어요.<br>아래 링크를 복사해 주세요.</div>';
    }
  }
  function dialogOpen(opts) {
    if (!dlg) dlg = buildDialog();
    var d = dlg;
    d.title.textContent = opts.title || '🔗 링크 공유';
    d.desc.textContent = opts.desc || '';
    d.desc.hidden = !opts.desc;
    d.status.textContent = opts.status || '';
    d.qrOn = opts.qr !== false;
    d.qr.hidden = true; d.qr.innerHTML = '';
    d.row.hidden = true; d.input.value = '';
    if (!modal.isOpen(d.ov)) {
      modal.open(d.ov, {
        backdropClose: true,
        // 링크가 이미 채워졌으면 입력칸(선택됨), 아직 만드는 중이면 닫기 버튼
        initialFocus: function () { return d.row.hidden ? d.ov.querySelector('[data-vui-close]') : d.input; }
      });
    }
    return d;
  }
  function dialogSetUrl(url, note) {
    var d = dlg;
    if (!d || !modal.isOpen(d.ov)) return;
    d.status.textContent = note || '';
    d.input.value = url;
    d.row.hidden = false;
    renderQR(d, url);
    d.input.focus();
    d.input.select();
  }
  // 링크를 창으로 보여 준다(복사 없이). opts: {title, desc, qr:false, note}
  function showLink(url, opts) {
    opts = opts || {};
    whenBody(function () { dialogOpen(opts); dialogSetUrl(url, opts.note); });
  }
  // 복사 시도 → 성공하면 토스트, 실패하면 링크 창. opts.show=true면 복사 없이 창만.
  // resolve 값: 복사했으면 true
  function copyOrShow(url, opts) {
    opts = opts || {};
    if (opts.show) { showLink(url, opts); return Promise.resolve(false); }
    return copyText(url).then(function (ok) {
      if (ok) { toast(opts.copiedMessage || '링크를 복사했어요 ✓', { type: 'success' }); return true; }
      showLink(url, assign(opts, { note: opts.note || '자동 복사가 안 돼서 링크를 보여 드려요.' }));
      return false;
    });
  }
  // 긴 주소 → 단축 → 복사(또는 창). show:true면 창을 먼저 열고 "만드는 중"을 보여 준다.
  // resolve 값: 최종 주소(단축 실패 시 원래 주소)
  function link(longURL, opts) {
    opts = opts || {};
    if (opts.show) {
      return new Promise(function (resolve) {
        whenBody(function () {
          dialogOpen(assign(opts, { status: '⏳ 짧은 링크를 만드는 중이에요…' }));
          shorten(longURL).then(function (u) {
            dialogSetUrl(u, u === longURL ? (opts.note || '짧은 링크를 만들지 못해서 원래 링크를 보여 드려요.') : opts.note);
            resolve(u);
          });
        });
      });
    }
    return shorten(longURL).then(function (u) {
      return copyOrShow(u, opts).then(function () { return u; });
    });
  }

  var share = {
    encode: encode, decode: decode, shorten: shorten,
    copyOrShow: copyOrShow, show: showLink, link: link,
    close: function () { if (dlg) modal.close(dlg.ov); }
  };

  /* ─────────────────────────────────────────────
     4) apiFetch — 시간 제한 + 상태 확인 + 안전한 JSON + 한국어 오류
     ───────────────────────────────────────────── */
  var MSG = {
    offline: '인터넷 연결이 끊겼어요. 연결을 확인해 주세요.',
    network: '서버에 연결하지 못했어요. 잠시 후 다시 해 주세요.',
    timeout: '응답이 너무 늦어요. 잠시 후 다시 해 주세요.',
    abort: '요청을 취소했어요.',
    rate_limit: '요청이 많아요. 잠시 후 다시 해 주세요.',
    server: '서버에 잠시 문제가 생겼어요. 잠시 후 다시 해 주세요.',
    bad_response: '받은 내용을 읽지 못했어요. 잠시 후 다시 해 주세요.',
    400: '보낸 내용을 다시 확인해 주세요.',
    401: '이 요청은 할 수 없어요.',
    403: '이 요청은 할 수 없어요.',
    404: '찾는 내용이 없어요.',
    413: '보낸 내용이 너무 커요.',
    client: '요청을 처리하지 못했어요.'
  };
  function apiError(code, message, status, data) {
    var e = new Error(message || MSG[code] || MSG.network);
    e.code = code;
    e.status = status || 0;
    e.data = data === undefined ? null : data;
    return e;
  }
  function hasHangul(s) { return typeof s === 'string' && /[가-힣]/.test(s); }
  function httpError(status, data) {
    var sm = data && (data.error || data.message);
    var e;
    if (status === 429) e = apiError('rate_limit', MSG.rate_limit, status, data);
    else if (status >= 500) e = apiError('server', hasHangul(sm) ? sm : MSG.server, status, data);
    else e = apiError('client', hasHangul(sm) ? sm : (MSG[status] || MSG.client), status, data);
    e.serverMessage = typeof sm === 'string' ? sm : '';
    return e;
  }
  /* opts: fetch 옵션 + { timeout(ms, 기본 20000, 0이면 없음), json(본문 객체 → JSON, method 기본 POST),
           as: 'json'(기본) | 'text' | 'response' }
     resolve: 해석한 JSON(본문이 비면 null) / reject: Error { message(한국어), code, status, data } */
  function apiFetch(url, opts) {
    opts = opts || {};
    var init = {}, k;
    for (k in opts) if (Object.prototype.hasOwnProperty.call(opts, k) && k !== 'timeout' && k !== 'json' && k !== 'as') init[k] = opts[k];
    if (opts.json !== undefined) {
      init.body = JSON.stringify(opts.json);
      if (!init.method) init.method = 'POST';
      var h = {}, src = opts.headers;
      if (src && typeof src.forEach === 'function' && !Array.isArray(src)) src.forEach(function (v, n) { h[n] = v; });
      else if (src) for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) h[k] = src[k];
      var hasCT = false;
      for (k in h) if (k.toLowerCase() === 'content-type') hasCT = true;
      if (!hasCT) h['Content-Type'] = 'application/json';
      init.headers = h;
    }
    var timeout = opts.timeout == null ? 20000 : opts.timeout;
    var userSignal = opts.signal || null;
    var timedOut = false, timer = null;
    if (timeout > 0) {
      if (!userSignal && global.AbortSignal && typeof global.AbortSignal.timeout === 'function') {
        init.signal = global.AbortSignal.timeout(timeout);
      } else if (global.AbortController) {
        var ctrl = new AbortController();
        timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, timeout);
        if (userSignal) {
          if (userSignal.aborted) ctrl.abort();
          else userSignal.addEventListener('abort', function () { ctrl.abort(); });
        }
        init.signal = ctrl.signal;
      }
    }
    function done() { if (timer) { clearTimeout(timer); timer = null; } }
    function netError(err) {
      done();
      if (err && err.code && err.status !== undefined && err instanceof Error && MSG[err.code]) return err;  // 이미 만든 오류
      var name = err && err.name;
      if (timedOut || name === 'TimeoutError') return apiError('timeout');
      if (name === 'AbortError') return apiError('abort');
      if (global.navigator && global.navigator.onLine === false) return apiError('offline');
      return apiError('network');
    }
    var p;
    try { p = global.fetch(url, init); } catch (e) { return Promise.reject(netError(e)); }
    return p.then(function (r) {
      if (r.ok && opts.as === 'response') { done(); return r; }
      return r.text().then(function (text) {
        done();
        var data = null, bad = false;
        if (text) { try { data = JSON.parse(text); } catch (e) { bad = true; } }
        if (!r.ok) throw httpError(r.status, bad ? null : data);
        if (opts.as === 'text') return text;
        if (bad) throw apiError('bad_response', MSG.bad_response, r.status, null);
        return data;
      }, function (err) { throw netError(err); });
    }, function (err) { throw netError(err); });
  }

  /* ─────────────────────────────────────────────
     5) 조사 — 받침에 맞춰 은/는, 이/가, 을/를, 과/와, 으로/로 …
     ───────────────────────────────────────────── */
  // [받침 있을 때, 없을 때]
  var PAIRS = [['은', '는'], ['이', '가'], ['을', '를'], ['과', '와'], ['으로', '로'], ['아', '야'],
    ['이랑', '랑'], ['이나', '나'], ['이에요', '예요'], ['이었', '였'], ['이라고', '라고'], ['이며', '며'], ['이야', '야']];
  // 숫자 읽기: 0영 1일 2이 3삼 4사 5오 6육 7칠 8팔 9구 → [받침 있음, ㄹ받침]
  var DIGIT = { 0: [1, 0], 1: [1, 1], 2: [0, 0], 3: [1, 0], 4: [0, 0], 5: [0, 0], 6: [1, 0], 7: [1, 1], 8: [1, 1], 9: [0, 0] };
  // 영문 글자 이름: L엘·R알(ㄹ), M엠·N엔(받침), 나머지는 받침 없음(에이·비·씨…)
  var LETTER = { L: [1, 1], R: [1, 1], M: [1, 0], N: [1, 0] };
  function finalSound(word) {
    var s = String(word == null ? '' : word).replace(/[\s"'`)\]}>»」』〉》.,!?~…·:;]+$/, '');
    if (!s) return null;
    var ch = s.charAt(s.length - 1), c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) { var j = (c - 0xAC00) % 28; return [j > 0 ? 1 : 0, j === 8 ? 1 : 0]; }
    if (c >= 0x3131 && c <= 0x314E) return [1, ch === 'ㄹ' ? 1 : 0];   // 자음 낱자(ㄱ, ㄴ…)
    if (ch >= '0' && ch <= '9') {
      var run = s.match(/[0-9]+$/)[0];
      if (ch !== '0') return DIGIT[ch];
      if (/^0+$/.test(run)) return DIGIT[0];                         // 0 → 영
      var z = run.match(/0+$/)[0].length;
      if (z >= 12) return [0, 0];                                       // 조
      if (z >= 8) return [1, 0];                                        // 억
      if (z >= 4) return [1, 0];                                        // 만
      return [1, 0];                                                    // 십·백·천
    }
    if (/[A-Za-z]/.test(ch)) {
      var w = s.match(/[A-Za-z]+$/)[0];
      if (w === w.toUpperCase()) return LETTER[ch.toUpperCase()] || [0, 0];   // 약어·낱글자: 글자 이름으로
      var lw = w.toLowerCase();
      if (/l$/.test(lw)) return [1, 1];                                  // school → 스쿨
      if (/(m|n|ng|[mn]e)$/.test(lw)) return [1, 0];                     // pen, song, game(게임), phone(폰)
      if (/[kpt]$/.test(lw) && !/ght$/.test(lw)) return [1, 0];        // book, cup, cat (light → 라이트 제외)
      return [0, 0];                                                    // apple, computer …
    }
    return null;
  }
  function pairOf(pair) {
    pair = String(pair || '은/는');
    var parts = pair.split('/');
    for (var i = 0; i < PAIRS.length; i++) {
      var p = PAIRS[i];
      if ((parts[0] === p[0] && parts[1] === p[1]) || (parts[0] === p[1] && parts[1] === p[0])) return p;
    }
    return [parts[0], parts[1] == null ? parts[0] : parts[1]];
  }
  function josa(word, pair) {
    var p = pairOf(pair), f = finalSound(word);
    if (!f) return p[0] + '(' + p[1] + ')';                            // 판단 못 함 → 은(는)
    if (p[0] === '으로') return f[0] && !f[1] ? '으로' : '로';         // ㄹ받침 → 로
    return f[0] ? p[0] : p[1];
  }
  function withJosa(word, pair) { return String(word == null ? '' : word) + josa(word, pair); }

  /* ─────────────────────────────────────────────
     6) storage — JSON + 검사 + 용량 초과 안내(한 번만)
     ───────────────────────────────────────────── */
  var quotaWarned = false;
  function isQuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }
  var storage = {
    get: function (key, fallback, validate) {
      var raw = null;
      try { raw = global.localStorage.getItem(key); } catch (e) { return fallback; }
      if (raw == null) return fallback;
      var v;
      try { v = JSON.parse(raw); } catch (e) { return fallback; }
      if (typeof validate === 'function') {
        var ok = false;
        try { ok = validate(v); } catch (e) { ok = false; }
        if (!ok) return fallback;
      }
      return v;
    },
    set: function (key, value) {
      try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) {
        if (isQuota(e) && !quotaWarned) {
          quotaWarned = true;
          toast('저장 공간이 꽉 차서 저장하지 못했어요. 안 쓰는 내용을 지워 주세요.', { type: 'error' });
        }
        return false;
      }
    },
    remove: function (key) {
      try { global.localStorage.removeItem(key); return true; } catch (e) { return false; }
    }
  };

  global.VUI = {
    toast: toast,
    modal: modal,
    share: share,
    copy: copy,
    apiFetch: apiFetch,
    josa: josa,
    withJosa: withJosa,
    storage: storage
  };
})(typeof window !== 'undefined' ? window : this);
