/* =====================================================
   byeduin VIVES — 공통 테마 전환 스크립트
   /common/theme.js

   사용법:
     <link rel="stylesheet" href="/common/hero-theme.css">
     <script src="/common/theme.js"></script>
     ...
     <div class="top-overlay">
       <button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()">💻</button>
       <a href="/" class="overlay-btn">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
           <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
           <polyline points="9 22 9 12 15 12 15 22"/>
         </svg>
         <span>Home</span>
       </a>
     </div>
   ===================================================== */

(function () {
  var KEY = 'vives-theme'; // localStorage key

  var ICONS = { auto: '💻', light: '☀️', dark: '🌙' };
  var LABELS = { auto: '자동 (시스템)', light: '라이트 모드', dark: '다크 모드' };

  function getStoredTheme() {
    return localStorage.getItem(KEY) || 'auto';
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
    btn.textContent = ICONS[theme] || '💻';
    btn.title = LABELS[theme] || '테마 변경';
  }

  function cycleTheme() {
    var current = getStoredTheme();
    var next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    localStorage.setItem(KEY, next);
    applyTheme(next);
    updateIcon(next);
  }

  // 초기화 — 스크립트 로드 즉시 (FOUC 방지)
  applyTheme(getStoredTheme());

  // 시스템 테마 변경 감지 (auto 모드일 때만 반응)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (getStoredTheme() === 'auto') applyTheme('auto');
  });

  // DOM 로드 후 아이콘 업데이트
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { updateIcon(getStoredTheme()); });
  } else {
    updateIcon(getStoredTheme());
  }

  // 전역 노출
  window.cycleTheme = cycleTheme;
  window.getTheme = getStoredTheme;
})();
