/* =====================================================
   eduin VIVES — 코드 기반 동기화 클라이언트 모듈
   /common/sync.js   (서버: functions/api/_sync.js)

   read-tree에서 검증된 "로컬 우선 + 코드 동기화" 패턴을 재사용 모듈로 추출.
   - localStorage가 항상 우선. 서버는 백업·다기기 이어쓰기 채널.
   - 오프라인/엔드포인트 없음/에러는 조용히 무시 → 로컬만으로도 항상 동작.
   - 개인정보 없음. 6자리 코드(A–Z·0–9)가 곧 사용자 키.

   ── 통합 코드 (byeduin 전 앱 공용, 공용 키 'vives:code') ──
     const code = VivesSync.ensureCode();        // 없으면 발급, 있으면 기존 코드
     VivesSync.getCode();  VivesSync.setCode(s);  VivesSync.clearCode();
     VivesSync.genCode();  VivesSync.isCode(s);   // 저수준 유틸

   ── doc 모드 (상태를 통째 JSON으로 저장하는 앱: flash-deck, allowance 등) ──
     <script src="/common/sync.js"></script>
     const sync = VivesSync.createDoc({
       apiUrl: '/api/flash-deck',
       getLocal: () => JSON.parse(localStorage.getItem('vives-flashdeck') || '{"decks":[]}'),
       setLocal: (data) => localStorage.setItem('vives-flashdeck', JSON.stringify(data)),
     });
     await sync.pull(code);   // 로그인 시: 서버↔로컬 최신본 머지
     sync.push(code);         // 변경 후: 디바운스 저장(현재 로컬 전체를 서버로)

   ── set 모드 (항목별 토글/값: read-tree 등) ──
     const sync = VivesSync.createSet({
       apiUrl: '/api/readtree',
       getItems: () => store.reads,             // { itemId: isoTimestamp 또는 value }
       setItems: (items) => store.save(items),
     });
     await sync.pull(code);
     sync.put(code, itemId, value);  // value 생략 가능
     sync.del(code, itemId);
   ===================================================== */
(function (global) {
  'use strict';

  var CODE_RE = /^[A-Z0-9]{6}$/;
  var CODE_LEN = 6;
  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function isCode(s) { return CODE_RE.test(String(s || '').toUpperCase()); }

  function genCode() {
    var out = '';
    var rnd = (global.crypto && global.crypto.getRandomValues)
      ? global.crypto.getRandomValues(new Uint32Array(CODE_LEN))
      : null;
    for (var i = 0; i < CODE_LEN; i++) {
      var n = rnd ? rnd[i] : Math.floor(Math.random() * 4294967296);
      out += ALPHABET[n % ALPHABET.length];
    }
    return out;
  }

  function nowIso() { return new Date().toISOString(); }

  // ── 통합 익명 코드 ────────────────────────────────────────
  // byeduin 전 앱 공용 키 1개. localStorage는 origin(eduin.info) 단위 공유라
  // 한 번 발급하면 모든 /apps/* 가 자동 인식 → 앱별 코드 분산 문제 해소.
  // 코드는 무작위 난수(개인정보 0). 학생용 아님 → 6자리 유지.
  var CODE_STORE_KEY = 'vives:code';
  function getCode() {
    try { var c = (localStorage.getItem(CODE_STORE_KEY) || '').toUpperCase(); return isCode(c) ? c : null; }
    catch (e) { return null; }
  }
  function setCode(code) {
    code = String(code || '').toUpperCase();
    if (!isCode(code)) return null;
    try { localStorage.setItem(CODE_STORE_KEY, code); } catch (e) {}
    return code;
  }
  function clearCode() { try { localStorage.removeItem(CODE_STORE_KEY); } catch (e) {} }
  // 코드가 없으면 새로 발급해 저장하고 반환(있으면 기존 것 그대로).
  function ensureCode() { return getCode() || setCode(genCode()); }

  // ── doc 모드 ─────────────────────────────────────────────
  // 문서 단위 LWW: 로컬에 updatedAt을 함께 저장해 서버와 비교.
  function createDoc(cfg) {
    if (!cfg || !cfg.apiUrl || !cfg.getLocal || !cfg.setLocal) {
      throw new Error('VivesSync.createDoc: { apiUrl, getLocal, setLocal } 필요');
    }
    var url = cfg.apiUrl;
    var stampKey = cfg.stampKey || ('vives-sync-stamp:' + url);
    var debounceMs = cfg.debounceMs || 1200;
    var on = cfg.enabled !== false;
    var timer = null;

    function localStamp() { try { return localStorage.getItem(stampKey) || ''; } catch (e) { return ''; } }
    function setStamp(v) { try { localStorage.setItem(stampKey, v); } catch (e) {} }

    return {
      // 서버↔로컬 최신본 머지. 서버가 더 최신이면 로컬 덮어쓰기, 로컬이 최신이면 push.
      pull: async function (code) {
        if (!on || !isCode(code)) return false;
        var server;
        try {
          var r = await fetch(url + '?code=' + encodeURIComponent(code), { cache: 'no-store' });
          if (!r.ok) return false;
          server = await r.json();
        } catch (e) { return false; }
        var sAt = server && server.updated_at;
        var lAt = localStamp();
        if (sAt && (!lAt || sAt > lAt) && server.data != null) {
          cfg.setLocal(server.data); setStamp(sAt); return true;   // 서버가 최신
        }
        if (!sAt || (lAt && lAt > sAt)) { this.push(code, true); }  // 로컬이 최신 → 보충
        return false;
      },
      // 현재 로컬 전체를 서버에 저장(디바운스). immediate=true면 즉시.
      push: function (code, immediate) {
        if (!on || !isCode(code)) return;
        var self = this;
        if (timer) { clearTimeout(timer); timer = null; }
        var run = function () {
          var at = nowIso(); setStamp(at);
          fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, data: cfg.getLocal(), updatedAt: at }),
          }).then(function (r) { return r.ok ? r.json() : null; })
            .then(function (res) {
              // 서버가 더 최신이라며 stale 반환 → 서버본을 로컬에 반영
              if (res && res.stale && res.data != null) { cfg.setLocal(res.data); setStamp(res.updated_at); }
            })
            .catch(function () { /* 오프라인: 로컬 유지, 다음 pull 때 재시도 */ });
        };
        if (immediate) run(); else timer = setTimeout(run, debounceMs);
      },
      reset: function (code) {
        if (!on || !isCode(code)) return;
        setStamp('');
        fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code }) }).catch(function () {});
      },
    };
  }

  // ── set 모드 ─────────────────────────────────────────────
  // 두 가지 로컬 표현을 지원(서버 응답은 항상 { id: { v, at } }):
  //   • valueIsTimestamp:true  → 로컬 { id: value }. value가 곧 LWW 키(read-tree: value=읽은날짜).
  //   • valueIsTimestamp:false → 로컬 { id: { v, at } }. v=내용, at=수정시각(별도 LWW 키).
  function createSet(cfg) {
    if (!cfg || !cfg.apiUrl || !cfg.getItems || !cfg.setItems) {
      throw new Error('VivesSync.createSet: { apiUrl, getItems, setItems } 필요');
    }
    var url = cfg.apiUrl;
    var on = cfg.enabled !== false;
    var tsVal = cfg.valueIsTimestamp === true;

    function entryOf(local, id) {
      var e = local[id];
      if (tsVal) return { v: e, at: e };
      return { v: e && e.v, at: (e && e.at) || '' };
    }
    function putLocal(local, id, v, at) { local[id] = tsVal ? v : { v: v, at: at }; }

    return {
      pull: async function (code) {
        if (!on || !isCode(code)) return false;
        var server;
        try {
          var r = await fetch(url + '?code=' + encodeURIComponent(code), { cache: 'no-store' });
          if (!r.ok) return false;
          server = (await r.json()).items || {};   // { id: { v, at } }
        } catch (e) { return false; }
        var local = cfg.getItems() || {};
        var changed = false;
        // 서버 → 로컬 (항목별 at 최신 우선)
        for (var id in server) {
          var s = server[id], le = entryOf(local, id);
          if (!(id in local) || s.at > le.at) { putLocal(local, id, s.v, s.at); changed = true; }
        }
        if (changed) cfg.setItems(local);
        // 로컬 → 서버 (서버에 없거나 로컬이 최신인 항목 보충)
        for (var lid in local) {
          var ll = entryOf(local, lid);
          if (!(lid in server) || ll.at > server[lid].at) this.put(code, lid, ll.v, ll.at);
        }
        return changed;
      },
      // updatedAt 생략 시: tsVal이면 value를, 아니면 현재시각을 LWW 키로 사용.
      put: function (code, itemId, value, updatedAt) {
        if (!on || !isCode(code)) return;
        var at = updatedAt || (tsVal ? value : nowIso());
        fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, itemId: itemId, value: value, updatedAt: at }) })
          .catch(function () {});
      },
      del: function (code, itemId) {
        if (!on || !isCode(code)) return;
        fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, itemId: itemId }) }).catch(function () {});
      },
    };
  }

  // ── 선택 동기화 UI (doc 모드) ─────────────────────────────
  // 헤더(.top-overlay)에 '동기화' 버튼+패널을 주입. 평소엔 로컬만, 코드 연결 시 서버 동기화.
  //   keys: 이 앱이 소유한 localStorage 키 배열. 해당 키가 바뀌면 자동(디바운스) push.
  //   onApplied: 서버→로컬 머지 후 재렌더 콜백.
  // 반환: { push, refresh } (보통 직접 호출 불필요 — setItem 가로채기로 자동 push).
  function mountDocSync(cfg) {
    if (!cfg || !cfg.apiUrl || !Array.isArray(cfg.keys) || !cfg.keys.length) {
      throw new Error('VivesSync.mountDocSync: { apiUrl, keys:[...] } 필요');
    }
    var keys = cfg.keys;
    var keySet = {}; keys.forEach(function (k) { keySet[k] = true; });
    var applying = false;   // setLocal 중에는 자동 push 억제(루프 방지)

    function getLocal() {
      var o = {};
      keys.forEach(function (k) {
        try { var raw = localStorage.getItem(k); o[k] = raw == null ? null : JSON.parse(raw); }
        catch (e) { o[k] = null; }
      });
      return o;
    }
    function setLocal(data) {
      if (!data) return;
      applying = true;
      keys.forEach(function (k) {
        if (data[k] != null) { try { localStorage.setItem(k, JSON.stringify(data[k])); } catch (e) {} }
      });
      applying = false;
      if (cfg.onApplied) try { cfg.onApplied(); } catch (e) {}
    }

    var sync = createDoc({ apiUrl: cfg.apiUrl, getLocal: getLocal, setLocal: setLocal });

    // localStorage.setItem 가로채기 → watched 키 변경 시 자동 push(디바운스는 createDoc 내부)
    var origSet = localStorage.setItem.bind(localStorage);
    try {
      localStorage.setItem = function (k, v) {
        origSet(k, v);
        if (!applying && keySet[k]) { var c = getCode(); if (c) sync.push(c); }
      };
    } catch (e) { /* 일부 환경에서 setItem 재정의 불가 — 자동 push 생략 */ }

    function doPush() { var c = getCode(); if (c) sync.push(c, true); }

    // ── UI ──
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'overlay-btn vs-sync-btn';
    btn.title = '기기 간 동기화';
    btn.style.cssText = 'gap:5px;';
    var panel = document.createElement('div');
    panel.className = 'vs-sync-panel';
    panel.style.cssText = [
      'position:fixed;top:52px;right:12px;z-index:9600;width:260px;display:none;',
      'flex-direction:column;gap:10px;padding:14px;border-radius:13px;',
      'background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);',
      'box-shadow:0 10px 30px rgba(0,0,0,0.22);color:var(--fg,#11181c);',
      'font-family:inherit;font-size:13px;'
    ].join('');

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
    function render() {
      var code = getCode();
      btn.innerHTML = code ? '🔄 <span>' + code + '</span>' : '🔄 <span>동기화</span>';
      btn.classList.toggle('vs-on', !!code);
      if (code) {
        panel.innerHTML =
          '<div style="font-weight:800;font-size:12px;color:var(--primary,#006fee)">기기 간 동기화 켜짐</div>' +
          '<div style="line-height:1.5">이 코드를 다른 기기에 입력하면 ' + esc(cfg.appName || '설정') + '이 이어집니다.</div>' +
          '<div style="font-size:20px;font-weight:800;letter-spacing:.18em;text-align:center;font-family:ui-monospace,monospace;color:var(--primary,#006fee)">' + esc(code) + '</div>' +
          '<button class="vs-act" data-act="copy" style="' + btnCss() + '">코드 복사</button>' +
          '<button class="vs-act" data-act="off" style="' + btnCss(1) + '">연결 해제(이 기기 로컬만)</button>';
      } else {
        panel.innerHTML =
          '<div style="font-weight:800;font-size:12px;color:var(--primary,#006fee)">기기 간 동기화</div>' +
          '<div style="line-height:1.5">코드 하나로 여러 기기에서 ' + esc(cfg.appName || '설정') + '을 이어쓰세요. 로그인·개인정보 없음.</div>' +
          '<input class="vs-code-in" maxlength="6" placeholder="코드 입력 (예: AB12CD)" ' +
            'style="text-transform:uppercase;text-align:center;letter-spacing:.16em;font-weight:700;padding:9px;border-radius:9px;border:1px solid var(--border,#e2e8f0);background:var(--input-bg,#fff);color:var(--fg,#11181c);font-family:inherit">' +
          '<button class="vs-act" data-act="connect" style="' + btnCss() + '">연결</button>' +
          '<button class="vs-act" data-act="new" style="' + btnCss(1) + '">새 코드 발급</button>';
      }
    }
    function btnCss(ghost) {
      return 'padding:9px;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;border:1px solid var(--border,#e2e8f0);' +
        (ghost ? 'background:transparent;color:var(--fg,#11181c);' : 'background:var(--primary,#006fee);color:#fff;border-color:var(--primary,#006fee);');
    }
    function open() { render(); panel.style.display = 'flex'; var i = panel.querySelector('.vs-code-in'); if (i) i.focus(); }
    function close() { panel.style.display = 'none'; }
    function toggle() { panel.style.display === 'flex' ? close() : open(); }

    function toast(msg) {
      var t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--fg,#11181c);color:var(--bg,#fff);padding:9px 16px;border-radius:9px;font-size:13px;z-index:9999;';
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1800);
    }

    async function connect(code) {
      code = String(code || '').toUpperCase();
      if (!isCode(code)) { toast('6자리 코드를 입력하세요.'); return; }
      setCode(code);
      await sync.pull(code);          // 서버↔로컬 머지(없으면 로컬 업로드)
      if (cfg.onApplied) try { cfg.onApplied(); } catch (e) {}
      render(); toast('동기화 연결됨 ✓');
    }
    function newCode() {
      var code = setCode(genCode());
      doPush();                       // 현재 로컬을 새 코드로 업로드
      render(); toast('새 코드 발급됨 ✓');
    }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('.vs-act'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'connect') connect(panel.querySelector('.vs-code-in').value);
      else if (act === 'new') newCode();
      else if (act === 'copy') { navigator.clipboard && navigator.clipboard.writeText(getCode()).then(function () { toast('코드 복사됨 ✓'); }); }
      else if (act === 'off') { clearCode(); render(); toast('이 기기에서 동기화 해제'); }
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var i = panel.querySelector('.vs-code-in'); if (i) connect(i.value); }
    });
    btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.addEventListener('click', function (e) { if (!panel.contains(e.target) && e.target !== btn) close(); });

    function mountButton() {
      var bar = document.querySelector('.top-overlay');
      if (bar) bar.insertBefore(btn, bar.firstChild);
      else { btn.style.cssText += 'position:fixed;top:12px;right:12px;z-index:9600;'; document.body.appendChild(btn); }
      document.body.appendChild(panel);
      render();
      // 로드 시 코드 있으면 자동 동기화
      var c = getCode();
      if (c) sync.pull(c).then(function () { if (cfg.onApplied) try { cfg.onApplied(); } catch (e) {} });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton);
    else mountButton();

    return { push: doPush, refresh: render, connect: connect };
  }

  // ── 우상단 코드 버튼만(상태 자동동기화 없음) ───────────────
  // 통합 코드(vives:code)를 헤더 버튼/패널로 연결·발급·해제만 한다.
  // docStore(다중 문서)·createSet(항목) 앱이 이 버튼으로 코드를 관리하고,
  // onChange(code|null)에서 자기 화면(모달·목록·동기화)을 갱신한다.
  function mountCodeButton(cfg) {
    cfg = cfg || {};
    function notify() { if (cfg.onChange) try { cfg.onChange(getCode()); } catch (e) {} }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
    function bcss(g) { return 'padding:9px;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;border:1px solid var(--border,#e2e8f0);' + (g ? 'background:transparent;color:var(--fg,#11181c);' : 'background:var(--primary,#006fee);color:#fff;border-color:var(--primary,#006fee);'); }

    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'overlay-btn vs-sync-btn'; btn.title = '기기 간 동기화'; btn.style.cssText = 'gap:5px;';
    var panel = document.createElement('div');
    panel.className = 'vs-sync-panel';
    panel.style.cssText = 'position:fixed;top:52px;right:12px;z-index:9600;width:260px;display:none;flex-direction:column;gap:10px;padding:14px;border-radius:13px;background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);box-shadow:0 10px 30px rgba(0,0,0,0.22);color:var(--fg,#11181c);font-family:inherit;font-size:13px;';

    function render() {
      var code = getCode(), app = esc(cfg.appName || '내용');
      btn.innerHTML = code ? '🔄 <span>' + esc(code) + '</span>' : '🔄 <span>동기화</span>';
      btn.classList.toggle('vs-on', !!code);
      if (code) {
        panel.innerHTML =
          '<div style="font-weight:800;font-size:12px;color:var(--primary,#006fee)">기기 간 동기화 켜짐</div>' +
          '<div style="line-height:1.5">이 코드를 다른 기기에 입력하면 ' + app + '을(를) 이어서 쓸 수 있어요.</div>' +
          '<div style="font-size:20px;font-weight:800;letter-spacing:.18em;text-align:center;font-family:ui-monospace,monospace;color:var(--primary,#006fee)">' + esc(code) + '</div>' +
          '<button class="vs-act" data-act="copy" style="' + bcss() + '">코드 복사</button>' +
          '<button class="vs-act" data-act="off" style="' + bcss(1) + '">연결 해제(이 기기만)</button>';
      } else {
        panel.innerHTML =
          '<div style="font-weight:800;font-size:12px;color:var(--primary,#006fee)">기기 간 동기화</div>' +
          '<div style="line-height:1.5">코드 하나로 여러 기기에서 ' + app + '을(를) 이어쓰세요. 로그인·개인정보 없음.</div>' +
          '<input class="vs-code-in" maxlength="6" placeholder="코드 입력 (예: AB12CD)" style="text-transform:uppercase;text-align:center;letter-spacing:.16em;font-weight:700;padding:9px;border-radius:9px;border:1px solid var(--border,#e2e8f0);background:var(--input-bg,#fff);color:var(--fg,#11181c);font-family:inherit">' +
          '<button class="vs-act" data-act="connect" style="' + bcss() + '">연결</button>' +
          '<button class="vs-act" data-act="new" style="' + bcss(1) + '">새 코드 발급</button>';
      }
    }
    function open() { render(); panel.style.display = 'flex'; var i = panel.querySelector('.vs-code-in'); if (i) i.focus(); }
    function close() { panel.style.display = 'none'; }
    function toast(msg) { var t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--fg,#11181c);color:var(--bg,#fff);padding:9px 16px;border-radius:9px;font-size:13px;z-index:9999;'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800); }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('.vs-act'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'connect') { var v = (panel.querySelector('.vs-code-in').value || '').toUpperCase(); if (!isCode(v)) { toast('6자리 코드를 입력하세요.'); return; } setCode(v); render(); notify(); toast('동기화 연결됨 ✓'); }
      else if (act === 'new') { setCode(genCode()); render(); notify(); toast('새 코드 발급됨 ✓'); }
      else if (act === 'copy') { navigator.clipboard && navigator.clipboard.writeText(getCode()).then(function () { toast('코드 복사됨 ✓'); }); }
      else if (act === 'off') { clearCode(); render(); notify(); toast('이 기기에서 동기화 해제'); }
    });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var b = panel.querySelector('[data-act="connect"]'); if (b) b.click(); } });
    btn.addEventListener('click', function (e) { e.stopPropagation(); panel.style.display === 'flex' ? close() : open(); });
    document.addEventListener('click', function (e) { if (!panel.contains(e.target) && e.target !== btn) close(); });

    function mountButton() {
      var bar = document.querySelector('.top-overlay');
      if (bar) bar.insertBefore(btn, bar.firstChild);
      else { btn.style.cssText += 'position:fixed;top:12px;right:12px;z-index:9600;'; document.body.appendChild(btn); }
      document.body.appendChild(panel);
      render();
      notify();   // 로드 시 현재 코드 상태 1회 통지(코드 있으면 앱이 초기 동기화)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton);
    else mountButton();

    return { getCode: getCode, refresh: render, open: open, close: close };
  }

  // ── 코드 기반 문서 라이브러리 (set 모드, 서버 직접 조회) ────
  // mountDocSync(현재 상태 통째 동기화)와 달리, 코드별 '저장된 문서 여러 개'를
  // 직접 저장/열기/삭제한다. math-sheet 세트·md-editor 문서처럼 다중 문서용.
  //   const lib = VivesSync.docStore({ apiUrl:'/api/math-sheet' });
  //   await lib.list(code)  -> [{ id, value(파싱됨), at }] 최신순
  //   await lib.save(code, id, obj);  await lib.remove(code, id);
  function docStore(cfg) {
    if (!cfg || !cfg.apiUrl) throw new Error('VivesSync.docStore: { apiUrl } 필요');
    var url = cfg.apiUrl;
    return {
      list: async function (code) {
        if (!isCode(code)) return [];
        try {
          var r = await fetch(url + '?code=' + encodeURIComponent(code), { cache: 'no-store' });
          if (!r.ok) return [];
          var items = (await r.json()).items || {};
          var out = [];
          for (var id in items) {
            var v = null; try { v = JSON.parse(items[id].v); } catch (e) {}
            out.push({ id: id, value: v, at: items[id].at });
          }
          out.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
          return out;
        } catch (e) { return []; }
      },
      save: async function (code, id, valueObj) {
        if (!isCode(code)) return false;
        try {
          var r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, itemId: String(id), value: JSON.stringify(valueObj), updatedAt: nowIso() }) });
          return r.ok;
        } catch (e) { return false; }
      },
      remove: async function (code, id) {
        if (!isCode(code)) return false;
        try {
          var r = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, itemId: String(id) }) });
          return r.ok;
        } catch (e) { return false; }
      },
    };
  }

  global.VivesSync = {
    isCode: isCode, genCode: genCode,
    getCode: getCode, setCode: setCode, clearCode: clearCode, ensureCode: ensureCode,
    createDoc: createDoc, createSet: createSet,
    mountDocSync: mountDocSync, mountCodeButton: mountCodeButton, docStore: docStore,
  };
})(typeof window !== 'undefined' ? window : this);
