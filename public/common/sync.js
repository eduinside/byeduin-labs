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
     sync.del(code, itemId);         // 삭제 표식(tombstone)을 남겨 다른 기기가 되살리지 않게 함
   ===================================================== */
(function (global) {
  'use strict';

  var CODE_RE = /^[A-Z0-9]{6}$/;
  var CODE_LEN = 6;
  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function isCode(s) { return CODE_RE.test(String(s || '').toUpperCase()); }

  // 코드는 데이터 읽기·쓰기·삭제 열쇠라 화면(전자칠판·TV)에 그대로 띄우지 않는다.
  // 헤더 버튼은 앞 2자리만, 패널은 '보기'를 눌렀을 때만 전체를 보여 준다.
  function maskCode(code) { code = String(code || ''); return code.slice(0, 2) + '••••'; }
  function codeBox(code, revealed, ghostCss) {
    var shown = revealed ? code : maskCode(code);
    return '<div style="display:flex;align-items:center;justify-content:center;gap:8px">' +
      '<div style="font-size:20px;font-weight:800;letter-spacing:.18em;font-family:ui-monospace,monospace;color:var(--primary,#006fee)">' +
      String(shown).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }) + '</div>' +
      '<button class="vs-act" data-act="reveal" style="' + ghostCss + 'padding:5px 9px;font-size:12px;">' + (revealed ? '가리기' : '보기') + '</button>' +
      '</div>';
  }
  function copyCode(code, toast) {
    var fallback = function () { try { window.prompt('코드를 복사하세요', code); } catch (e) {} };
    if (global.VUI && global.VUI.copy) {
      global.VUI.copy(code, false).then(function (ok) { if (ok) toast('코드 복사됨 ✓'); else fallback(); });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { toast('코드 복사됨 ✓'); }, fallback);
    } else fallback();
  }

  // 공용 토스트(ui.js)가 있으면 그것을, 없으면 같은 색 토큰으로 임시 토스트
  function uiToast(msg, type) {
    if (global.VUI && global.VUI.toast) { global.VUI.toast(msg, type ? { type: type } : undefined); return; }
    var t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);max-width:92vw;text-align:center;' +
      'background:var(--toast-bg,#18181b);color:var(--toast-fg,#fafafa);padding:9px 16px;border-radius:9px;font-size:13px;z-index:10050;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, Math.max(2500, Math.min(8000, 1500 + String(msg).length * 60)));
  }

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
    async function fetchServer(code) {
      try {
        var r = await fetch(url + '?code=' + encodeURIComponent(code), { cache: 'no-store' });
        if (!r.ok) return null;
        return (await r.json()) || null;
      } catch (e) { return null; }
    }

    return {
      // 서버본만 가져오기 { data, updated_at } (실패하면 null). 연결 전 덮어쓰기 확인용.
      fetchServer: function (code) { return isCode(code) ? fetchServer(code) : Promise.resolve(null); },
      // 서버본을 로컬에 그대로 적용(확인을 받은 뒤 사용)
      apply: function (data, at) { if (data != null) { cfg.setLocal(data); setStamp(at || nowIso()); } },
      // 서버↔로컬 최신본 머지. 서버가 더 최신이면 로컬 덮어쓰기, 로컬이 최신이면 push.
      //   pre: 이미 받아 둔 서버본({ data, updated_at })이 있으면 다시 받지 않는다.
      pull: async function (code, pre) {
        if (!on || !isCode(code)) return false;
        var server = pre || await fetchServer(code);
        if (!server) return false;
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
  //
  // 삭제 표식(tombstone, docs/audit-2026-10.md 4.4):
  //   del()은 서버 행을 지우지 않고 value=TOMB로 덮어쓴다(updatedAt=지운 시각). 서버는 항목 단위
  //   LWW라 더 늦은 기록이 남고, 다른 기기는 pull 때 자기 것보다 늦은 표식을 보고 로컬에서 지운다.
  //   (예전처럼 행을 지우면, 아직 그 항목을 가진 기기가 pull 때 '서버에 없음'으로 보고 다시 올려 되살렸다.)
  //   서버 변경 없음 — _sync.js set 모드는 value에 아무 문자열이나 받는다. 표식도 코드당 항목 수(maxItems)에 포함.
  //   기기별 보조 기록은 localStorage 'vives-sync-set:<apiUrl>:<code>'에 둔다:
  //     del: { id: 지운 시각 }        — 아직 서버에 못 보낸 삭제를 다음 pull 때 다시 보냄
  //     at:  { id: 표시한 시각(ISO) } — valueIsTimestamp 모드에서 날짜보다 정밀한 LWW 키
  //   cfg.tombstones === false면 예전 방식(서버 DELETE).
  var TOMB = '__del__';
  function createSet(cfg) {
    if (!cfg || !cfg.apiUrl || !cfg.getItems || !cfg.setItems) {
      throw new Error('VivesSync.createSet: { apiUrl, getItems, setItems } 필요');
    }
    var url = cfg.apiUrl;
    var on = cfg.enabled !== false;
    var tsVal = cfg.valueIsTimestamp === true;
    var tombOn = cfg.tombstones !== false;
    var metaPrefix = cfg.metaKey || ('vives-sync-set:' + url + ':');

    function loadMeta(code) {
      try {
        var m = JSON.parse(localStorage.getItem(metaPrefix + code) || '{}') || {};
        return {
          at: m.at && typeof m.at === 'object' ? m.at : {},
          del: m.del && typeof m.del === 'object' ? m.del : {}
        };
      } catch (e) { return { at: {}, del: {} }; }
    }
    function saveMeta(code, m) { try { localStorage.setItem(metaPrefix + code, JSON.stringify(m)); } catch (e) {} }

    function entryOf(local, id, meta) {
      var e = local[id];
      if (tsVal) return { v: e, at: String((meta && meta.at[id]) || e || '') };
      return { v: e && e.v, at: String((e && e.at) || '') };
    }
    function putLocal(local, id, v, at) { local[id] = tsVal ? v : { v: v, at: at }; }
    function same(a, b) { return a === b || JSON.stringify(a) === JSON.stringify(b); }
    function send(method, body) {
      return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .catch(function () { /* 오프라인: 로컬 표식이 남아 다음 pull 때 다시 보냄 */ });
    }

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
        var meta = loadMeta(code);
        var changed = false, metaChanged = false;
        var id, s, sAt, le;

        // 서버 → 로컬 (항목별 at 최신 우선, 삭제 표식 반영)
        for (id in server) {
          s = server[id] || {};
          sAt = String(s.at || '');
          if (tombOn && s.v === TOMB) {
            if (id in local) {
              le = entryOf(local, id, meta);
              if (sAt > le.at) { delete local[id]; delete meta.at[id]; changed = true; metaChanged = true; }
            }
            if (!(id in local) && (!meta.del[id] || meta.del[id] < sAt)) { meta.del[id] = sAt; metaChanged = true; }
            continue;
          }
          if (!(id in local)) {
            if (tombOn && meta.del[id] && meta.del[id] >= sAt) continue;   // 이 기기에서 더 늦게 지움 → 아래에서 표식 전송
            putLocal(local, id, s.v, sAt);
            if (tsVal) meta.at[id] = sAt;
            if (meta.del[id]) delete meta.del[id];
            changed = true; metaChanged = true;
            continue;
          }
          le = entryOf(local, id, meta);
          if (sAt > le.at) {
            if (!same(le.v, s.v)) { putLocal(local, id, s.v, sAt); changed = true; }
            if (tsVal) { meta.at[id] = sAt; metaChanged = true; }
          }
        }
        if (changed) cfg.setItems(local);

        // 로컬 → 서버 (서버에 없거나, 로컬이 더 최신인 항목 보충 — 서버 표식보다 늦게 다시 표시한 경우 포함)
        for (id in local) {
          le = entryOf(local, id, meta);
          s = server[id];
          if (meta.del[id]) { delete meta.del[id]; metaChanged = true; }   // 다시 표시됨 → 이 기기의 표식은 무효
          if (!s) { this.put(code, id, le.v, le.at); continue; }
          sAt = String(s.at || '');
          if (le.at > sAt && !(s.v !== TOMB && same(le.v, s.v))) this.put(code, id, le.v, le.at);
        }
        // 이 기기에서 지운 항목: 서버에 아직 살아 있고 지운 시각이 같거나 더 늦으면 표식 전송
        if (tombOn) {
          for (id in meta.del) {
            s = server[id];
            if (s && s.v !== TOMB && meta.del[id] >= String(s.at || '')) {
              send('PUT', { code: code, itemId: id, value: TOMB, updatedAt: meta.del[id] });
            }
          }
        }
        if (metaChanged) saveMeta(code, meta);
        return changed;
      },
      // updatedAt 생략 시 현재 시각(ISO)을 LWW 키로 사용.
      //   valueIsTimestamp 모드도 날짜(value) 대신 ISO 시각을 보낸다 — 같은 날 '해제 → 다시 표시'가
      //   해제 표식(ISO)보다 늦은 것으로 정확히 비교되도록. 로컬 값(날짜)은 그대로.
      put: function (code, itemId, value, updatedAt) {
        if (!on || !isCode(code)) return;
        var at = updatedAt || nowIso();
        if (tsVal || tombOn) {
          var meta = loadMeta(code);
          if (tsVal) meta.at[itemId] = at;
          delete meta.del[itemId];
          saveMeta(code, meta);
        }
        send('PUT', { code: code, itemId: itemId, value: value, updatedAt: at });
      },
      del: function (code, itemId) {
        if (!on || !isCode(code)) return;
        if (!tombOn) { send('DELETE', { code: code, itemId: itemId }); return; }
        var at = nowIso();
        var meta = loadMeta(code);
        meta.del[itemId] = at;
        delete meta.at[itemId];
        saveMeta(code, meta);
        send('PUT', { code: code, itemId: itemId, value: TOMB, updatedAt: at });
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
      btn.innerHTML = code ? '🔄 <span>' + esc(maskCode(code)) + '</span>' : '🔄 <span>동기화</span>';
      btn.classList.toggle('vs-on', !!code);
      if (code) {
        panel.innerHTML =
          '<div style="font-weight:800;font-size:12px;color:var(--primary,#006fee)">기기 간 동기화 켜짐</div>' +
          '<div style="line-height:1.5">이 코드를 다른 기기에 입력하면 ' + esc(cfg.appName || '설정') + '이 이어집니다.</div>' +
          codeBox(code, revealed, btnCss(1)) +
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
    var revealed = false;   // 패널에서 '보기'를 눌렀을 때만 전체 코드 표시(닫으면 다시 가림)
    function open() { revealed = false; render(); panel.style.display = 'flex'; var i = panel.querySelector('.vs-code-in'); if (i) i.focus(); }
    function close() { panel.style.display = 'none'; revealed = false; }
    function toggle() { panel.style.display === 'flex' ? close() : open(); }

    var toast = uiToast;

    // 값이 '비어 있지 않은가'(null·빈 배열·빈 객체·빈 문자열은 빈 것으로)
    function filled(v) {
      if (v == null || v === '') return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    }
    // 서버본을 적용하면 사라지는 이 기기 내용이 있는가(같은 키에 서로 다른 값)
    function wouldLose(local, server) {
      if (!server || typeof server !== 'object') return false;
      return keys.some(function (k) {
        return filled(local[k]) && server[k] != null && JSON.stringify(local[k]) !== JSON.stringify(server[k]);
      });
    }

    // 코드 연결. 이 기기와 코드(서버) 양쪽에 서로 다른 내용이 있으면 무엇을 남길지 먼저 묻는다
    // (docs/audit-2026-10.md 4.4 — 예전에는 확인 없이 서버본으로 바뀌었다).
    async function connect(code) {
      code = String(code || '').toUpperCase();
      if (!isCode(code)) { toast('6자리 코드를 입력하세요.'); return; }
      var server = await sync.fetchServer(code);
      if (!server) {
        // 서버본을 확인할 수 없으면 연결하지 않는다 — 나중 pull에서 확인 없이 덮어쓰는 일을 막기 위해
        toast('서버에 연결하지 못했어요. 인터넷을 확인하고 다시 해 주세요.', 'error');
        return;
      }
      var app = cfg.appName || '설정';
      if (server.data != null && wouldLose(getLocal(), server.data)) {
        var useServer = window.confirm(
          '이 기기에도 ' + app + ' 내용이 있고, 코드에는 다른 내용이 저장되어 있어요.\n\n' +
          '[확인] 코드에 저장된 내용으로 바꿔요. (이 기기 내용은 지워져요)\n' +
          '[취소] 바꾸지 않아요. (다음 질문으로)');
        if (useServer) {
          setCode(code);
          sync.apply(server.data, server.updated_at);   // setLocal → onApplied 호출됨
          render(); toast('코드에 저장된 내용으로 바꿨어요 ✓');
          return;
        }
        var keepLocal = window.confirm(
          '이 기기 내용을 코드에 올릴까요?\n\n' +
          '[확인] 이 기기 내용을 남겨요. 코드에 있던 내용은 이 기기 내용으로 바뀌어요.\n' +
          '[취소] 연결하지 않아요. 아무것도 바뀌지 않아요.');
        if (!keepLocal) { toast('연결하지 않았어요. 아무것도 바뀌지 않았어요.'); return; }
        setCode(code);
        sync.push(code, true);
        render(); toast('이 기기 내용으로 동기화를 시작했어요 ✓');
        return;
      }
      setCode(code);
      await sync.pull(code, server);  // 잃을 내용 없음 → 평소처럼 머지(서버에 없으면 로컬 업로드)
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
      else if (act === 'reveal') { e.stopPropagation(); revealed = !revealed; render(); }  // 재렌더로 버튼이 빠져도 패널이 닫히지 않게
      else if (act === 'copy') { copyCode(getCode(), toast); }
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
      btn.innerHTML = code ? '🔄 <span>' + esc(maskCode(code)) + '</span>' : '🔄 <span>동기화</span>';
      btn.classList.toggle('vs-on', !!code);
      if (code) {
        panel.innerHTML =
          '<div style="font-weight:800;font-size:12px;color:var(--primary,#006fee)">기기 간 동기화 켜짐</div>' +
          '<div style="line-height:1.5">이 코드를 다른 기기에 입력하면 ' + app + '을(를) 이어서 쓸 수 있어요.</div>' +
          codeBox(code, revealed, bcss(1)) +
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
    var revealed = false;   // 패널에서 '보기'를 눌렀을 때만 전체 코드 표시(닫으면 다시 가림)
    function open() { revealed = false; render(); panel.style.display = 'flex'; var i = panel.querySelector('.vs-code-in'); if (i) i.focus(); }
    function close() { panel.style.display = 'none'; revealed = false; }
    var toast = uiToast;

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('.vs-act'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'connect') { var v = (panel.querySelector('.vs-code-in').value || '').toUpperCase(); if (!isCode(v)) { toast('6자리 코드를 입력하세요.'); return; } setCode(v); render(); notify(); toast('동기화 연결됨 ✓'); }
      else if (act === 'new') { setCode(genCode()); render(); notify(); toast('새 코드 발급됨 ✓'); }
      else if (act === 'reveal') { e.stopPropagation(); revealed = !revealed; render(); }  // 재렌더로 버튼이 빠져도 패널이 닫히지 않게
      else if (act === 'copy') { copyCode(getCode(), toast); }
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
