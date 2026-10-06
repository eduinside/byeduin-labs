/* =====================================================
   eduin VIVES — 공통 앱 셸 스크립트
   /common/app-shell.js

   theme.js 이후에 로드(cycleTheme/shareCurrentPage/getTheme 사용).
   레이아웃은 app-shell.css가 [data-shell]/[data-width]로 처리.
   이 스크립트의 역할:
     1) 플로팅 크롬 자동 주입(.top-overlay-left 홈 + .top-overlay 테마·공유)
        — 이미 마크업이 있으면 스킵(점진 적용 안전장치)
     2) sidebar 모바일 드로어 토글
     3) focus 유틸(enterFocus/exitFocus) 전역 노출
   ===================================================== */

(function () {
  function makeEl(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  // lucide 스프라이트 아이콘 — @icons house share-2 menu x monitor
  function ic(name) {
    if (window.VUI && window.VUI.icon) return window.VUI.icon(name);
    return '<svg class="ic" aria-hidden="true" focusable="false"><use href="/common/icons.svg#' + name + '"></use></svg>';
  }

  function injectChrome() {
    var body = document.body;

    /* ── 좌상단: 홈 ── */
    if (!document.querySelector('.top-overlay-left')) {
      var left = makeEl('<div class="top-overlay-left"></div>');
      left.appendChild(makeEl(
        '<a href="/" class="overlay-btn" title="홈으로" aria-label="홈으로">' + ic('house') + '<span>홈</span></a>'
      ));
      body.appendChild(left);
    }

    /* ── 우상단: (앱 추가 액션) + 테마 + 공유 ── */
    if (!document.querySelector('.top-overlay')) {
      var right = makeEl('<div class="top-overlay"></div>');

      // 앱이 본문에 둔 .app-actions가 있으면 크롬으로 끌어올림
      var actions = document.querySelector('.app-actions');
      if (actions) right.appendChild(actions);

      var themeBtn = makeEl('<button type="button" id="themeToggleBtn" class="overlay-btn" title="화면 모드" aria-label="화면 모드" onclick="cycleTheme()">' + ic('monitor') + '</button>');
      var shareBtn = makeEl(
        '<button type="button" class="overlay-btn" title="이 페이지 공유" aria-label="이 페이지 공유" onclick="shareCurrentPage()">' +
          ic('share-2') + '<span>공유</span></button>'
      );
      right.appendChild(themeBtn);
      right.appendChild(shareBtn);
      body.appendChild(right);

      // 초기 테마 아이콘 (theme.js가 DOMContentLoaded에 갱신하지만, 늦게 주입된 경우 대비)
      if (window.cycleTheme && window.getTheme) {
        var t = window.getTheme();
        var names = { auto: 'monitor', light: 'sun', dark: 'moon' };
        var labels = { auto: '화면 모드: 자동', light: '화면 모드: 밝게', dark: '화면 모드: 어둡게' };
        themeBtn.innerHTML = ic(names[t] || 'monitor');
        themeBtn.setAttribute('aria-label', labels[t] || labels.auto);
        themeBtn.title = (labels[t] || labels.auto) + ' (누르면 바뀜)';
      }
      if (document.documentElement.hasAttribute('data-theme-lock')) themeBtn.hidden = true;
    }
  }

  function setupSidebarDrawer() {
    if (document.body.getAttribute('data-shell') !== 'sidebar') return;
    if (!document.querySelector('.app-aside')) return;

    // 햄버거 토글(좌상단, 홈 옆) — 모바일에서만 보임(CSS)
    var left = document.querySelector('.top-overlay-left');
    if (left && !document.querySelector('.app-drawer-toggle')) {
      var btn = makeEl('<button type="button" class="overlay-btn app-drawer-toggle" title="메뉴" aria-label="메뉴" aria-expanded="false">' + ic('menu') + '</button>');
      btn.addEventListener('click', function () {
        setDrawer(!document.body.classList.contains('sidebar-open'));
      });
      left.insertBefore(btn, left.firstChild);
    }

    function setDrawer(open) {
      document.body.classList.toggle('sidebar-open', open);
      var t = document.querySelector('.app-drawer-toggle');
      if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    // 백드롭(클릭 시 닫힘)
    if (!document.querySelector('.app-drawer-backdrop')) {
      var bd = makeEl('<div class="app-drawer-backdrop"></div>');
      bd.addEventListener('click', function () { setDrawer(false); });
      document.body.appendChild(bd);
    }

    // 모바일: 사이드바 내 항목(링크/버튼) 클릭 시 드로어 자동 닫힘, Esc로 닫힘
    var aside = document.querySelector('.app-aside');
    aside.addEventListener('click', function (e) {
      if (window.innerWidth > 768) return;
      if (e.target.closest('a, button')) setDrawer(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) setDrawer(false);
    });
  }

  /* ── focus 전환 유틸(전역) ── */
  window.enterFocus = function () { document.body.classList.add('in-focus'); };
  window.exitFocus  = function () { document.body.classList.remove('in-focus'); };
  window.toggleFocus = function (on) { document.body.classList.toggle('in-focus', on); };

  function setupFocus() {
    // 닫기 버튼(✕) 주입 — focus 중에만 표시(CSS). 앱이 자체 .focus-close 두면 스킵.
    if (!document.querySelector('.focus-close')) {
      var close = makeEl('<button type="button" class="overlay-btn focus-close" title="닫기" aria-label="닫기">' + ic('x') + '</button>');
      close.addEventListener('click', window.exitFocus);
      document.body.appendChild(close);
    }
    // Esc로 닫기
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('in-focus')) window.exitFocus();
    });
  }

  function init() {
    injectChrome();
    setupSidebarDrawer();
    setupFocus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
