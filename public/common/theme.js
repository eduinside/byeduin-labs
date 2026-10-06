/* =====================================================
   eduin VIVES — 공통 테마 전환 스크립트
   /common/theme.js

   사용법:
     <link rel="stylesheet" href="/common/hero-theme.css">
     <script src="/common/theme.js"></script>
     ...
     <div class="top-overlay">
       <button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()"></button>
       <a href="/" class="overlay-btn">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
           <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
           <polyline points="9 22 9 12 15 12 15 22"/>
         </svg>
         <span>홈</span>
       </a>
     </div>
   ===================================================== */

(function () {
  var KEY = 'vives-theme'; // localStorage key

  // lucide 아이콘 이름(스프라이트 /common/icons.svg) — @icons monitor sun moon
  var ICONS = { auto: 'monitor', light: 'sun', dark: 'moon' };
  var LABELS = { auto: '화면 모드: 자동', light: '화면 모드: 밝게', dark: '화면 모드: 어둡게' };

  // <html data-theme-lock="light">: 앱이 화면 모드를 고정(시뮬레이션 등). 저장된 선택을 무시하고 버튼도 숨긴다.
  var LOCK = document.documentElement.getAttribute('data-theme-lock');

  // 저장소가 막힌 환경(일부 시크릿 창·학교 정책)에서도 스크립트가 멈추지 않게
  function getStoredTheme() {
    if (LOCK === 'light' || LOCK === 'dark') return LOCK;
    try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
  }

  function iconHtml(theme) {
    var n = ICONS[theme] || 'monitor';
    if (window.VUI && window.VUI.icon) return window.VUI.icon(n);
    return '<svg class="ic" aria-hidden="true" focusable="false"><use href="/common/icons.svg#' + n + '"></use></svg>';
  }

  function resolveTheme(theme) {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  function applyTheme(theme) {
    var resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
  }

  function updateIcon(theme) {
    var btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    if (LOCK) { btn.hidden = true; return; }
    var label = LABELS[theme] || LABELS.auto;
    btn.innerHTML = iconHtml(theme);
    btn.title = label + ' (누르면 바뀜)';
    btn.setAttribute('aria-label', label);
  }

  function cycleTheme() {
    if (LOCK) return;
    var current = getStoredTheme();
    var next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    applyTheme(next);
    updateIcon(next);
  }

  // 초기화 — 스크립트 로드 즉시 (FOUC 방지)
  applyTheme(getStoredTheme());

  // 시스템 테마 변경 감지 (auto 모드일 때만 반응)
  // (옛 Safari는 MediaQueryList.addEventListener가 없어 addListener로 대체 — 여기서 멈추면 cycleTheme가 노출되지 않음)
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var onScheme = function () { if (!LOCK && getStoredTheme() === 'auto') applyTheme('auto'); };
  if (mq.addEventListener) mq.addEventListener('change', onScheme);
  else if (mq.addListener) mq.addListener(onScheme);

  // DOM 로드 후 아이콘 업데이트
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { updateIcon(getStoredTheme()); });
  } else {
    updateIcon(getStoredTheme());
  }

  // 공유 피드백 토스트
  //  1) 공용 VUI.toast(ui.js)가 있으면 그것을 쓴다 — 색은 --toast-bg/--toast-fg 한 쌍이라
  //     앱이 --bg만 바꿔도(clubs 등) 밝은 바탕에 밝은 글씨가 되지 않는다(docs/audit-2026-10.md 7.2).
  //  2) ui.js가 없는 독립 HTML: 앱 자체 토스트 요소(옛 id 4개)를 쓰고,
  //  3) 그것도 없으면 같은 토큰으로 임시 토스트를 만든다.
  function _shareToast(msg) {
    if (window.VUI && window.VUI.toast) { window.VUI.toast(msg); return; }
    var existing = document.getElementById('qr-toast') ||
                   document.getElementById('md-toast') ||
                   document.getElementById('fd-toast') ||
                   document.getElementById('ssToast');
    var dur = Math.max(2500, Math.min(8000, 1500 + String(msg).length * 60));
    if (existing) {
      existing.textContent = msg;
      existing.classList.add('show');
      setTimeout(function() { existing.classList.remove('show'); }, dur);
      return;
    }
    // 없으면 임시 생성
    var t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);' +
      'background:var(--toast-bg,#18181b);color:var(--toast-fg,#fafafa);padding:0.55rem 1.25rem;' +
      'border-radius:1rem;font-size:0.85rem;font-weight:600;z-index:10050;' +
      'max-width:92vw;text-align:center;overflow-wrap:anywhere;pointer-events:none;';
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, dur);
  }

  // 클립보드 복사 + 피드백. 복사가 안 되면 링크 창(ui.js)으로 보여 준다.
  function _copyWithFallback(url) {
    if (window.VUI && window.VUI.share) {
      window.VUI.share.copyOrShow(url, { title: '이 페이지 공유' });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function() { _shareToast('링크를 복사했어요 ✓'); })
        .catch(function() { _shareToast('주소: ' + url); });
    } else {
      _shareToast('주소: ' + url);
    }
  }

  // 공유 함수
  function shareCurrentPage() {
    var url = window.location.href;
    var title = document.title;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function(e) {
        // 사용자가 공유 시트를 닫은 경우는 아무것도 하지 않는다
        if (e && e.name === 'AbortError') return;
        _copyWithFallback(url);
      });
    } else {
      _copyWithFallback(url);
    }
  }

  // 전역 노출
  window.cycleTheme = cycleTheme;
  window.getTheme = getStoredTheme;
  window.shareCurrentPage = shareCurrentPage;
})();
