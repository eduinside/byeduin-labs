/**
 * seo-injector.js — Runtime SEO tag injection for eduin VIVES sub-apps
 * Fetches /apps.json (cached in sessionStorage) and injects Twitter Card,
 * Open Graph, canonical, and JSON-LD structured data for the current page.
 * Also replaces leading emoji in h1.app-title with the matching Lucide icon.
 *
 * Usage: <script src="/common/seo-injector.js" defer></script>
 */
(function () {
  'use strict';

  var CACHE_KEY = 'byeduin_apps_json';

  /* ── helpers ─────────────────────────────────────── */

  function metaExists(attr, value) {
    return !!document.querySelector('meta[' + attr + '="' + value + '"]');
  }

  function linkExists(rel) {
    return !!document.querySelector('link[rel="' + rel + '"]');
  }

  function addMeta(attr, name, content) {
    if (!content) return;
    var meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  }

  function addLink(rel, href) {
    if (!href) return;
    var link = document.createElement('link');
    link.setAttribute('rel', rel);
    link.setAttribute('href', href);
    document.head.appendChild(link);
  }

  function absUrl(siteUrl, path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return siteUrl.replace(/\/$/, '') + path;
  }

  /* ── path matching ──────────────────────────────── */

  function normalizePath(p) {
    return (p || '').replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  }

  function matchApp(apps, pathname) {
    var normalised = normalizePath(pathname);
    for (var i = 0; i < apps.length; i++) {
      if (apps[i].href === pathname) return apps[i];
    }
    for (var j = 0; j < apps.length; j++) {
      if (normalizePath(apps[j].href) === normalised) return apps[j];
    }
    for (var k = 0; k < apps.length; k++) {
      var href = apps[k].href;
      if (href && pathname.indexOf(normalizePath(href)) === 0) return apps[k];
    }
    return null;
  }

  /* ── data fetch (with sessionStorage cache) ─────── */

  function fetchAppsData(callback) {
    try {
      var cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) { callback(JSON.parse(cached)); return; }
    } catch (e) { /* ignore */ }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/apps.json', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || xhr.status !== 200) return;
      try {
        var data = JSON.parse(xhr.responseText);
        try { sessionStorage.setItem(CACHE_KEY, xhr.responseText); } catch (e) {}
        callback(data);
      } catch (e) {}
    };
    xhr.send();
  }

  /* ── app-title Lucide icon injection ────────────── */

  function stripLeadingEmoji(text) {
    // 이모지(유니코드 멀티바이트 포함) + 앞쪽 공백 제거
    return text.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\uFE0F\u200D\s]+/u, '').trim();
  }

  var _lucideLoading = false;
  var _lucideCallbacks = [];

  function ensureLucide(cb) {
    if (window.lucide) { cb(); return; }
    _lucideCallbacks.push(cb);
    if (_lucideLoading) return;
    _lucideLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js';
    s.onload = function () {
      _lucideLoading = false;
      _lucideCallbacks.forEach(function (fn) { try { fn(); } catch (e) {} });
      _lucideCallbacks = [];
    };
    document.head.appendChild(s);
  }

  function injectAppHeader(app) {
    // immersive 앱 (대형 캔버스/지도/3D 전용)은 스킵
    if (document.body.getAttribute('data-shell') === 'immersive') return;

    var header = document.querySelector('.app-header');
    if (!header || header.classList.contains('has-lucide-header')) return;

    var badge = header.querySelector('.app-badge');
    var h1 = header.querySelector('h1.app-title');
    var desc = header.querySelector('.app-desc');

    // 1) 배지 HTML 정제
    var badgeHtml = '';
    if (badge) {
      badgeHtml = badge.outerHTML;
    } else if (app.badge) {
      badgeHtml = '<div class="app-badge">◆ ' + app.badge + '</div>';
    }

    // 2) 타이틀 HTML 정제 (앞쪽 이모지 제거 및 span 유지)
    var titleHtml = '';
    if (h1) {
      var existingSpan = h1.querySelector('span');
      var spanHtml = existingSpan ? existingSpan.outerHTML : null;
      var rawText = h1.innerHTML.replace(/<span[^>]*>.*?<\/span>/gi, '').replace(/<[^>]+>/g, '');
      var cleanedText = stripLeadingEmoji(rawText);
      titleHtml = '<h1 class="app-title">' + cleanedText + (spanHtml ? ' ' + spanHtml : '') + '</h1>';
    } else {
      titleHtml = '<h1 class="app-title">' + app.title + '</h1>';
    }

    // 3) 설명글 HTML 정제
    var descHtml = '';
    if (desc) {
      descHtml = desc.outerHTML;
    } else if (app.desc) {
      descHtml = '<p class="app-desc">' + app.desc + '</p>';
    }

    // 4) Lucide 아이콘 래퍼 빌드
    var iconName = app.lucideIcon || 'hash';
    var subcat = app.subcategory || 'default';
    var iconHtml = '<div class="app-header-icon-blob sub-' + subcat + '">' +
                   '<i data-lucide="' + iconName + '"></i>' +
                   '</div>';

    // 5) 전체 HTML 재배치 및 클래스 추가
    var textWrapperHtml = '<div class="app-header-text">' +
                          badgeHtml +
                          titleHtml +
                          descHtml +
                          '</div>';

    header.innerHTML = iconHtml + textWrapperHtml;
    header.classList.add('has-lucide-header');

    ensureLucide(function () {
      window.lucide.createIcons({ nodes: [header] });
    });
  }

  /* ── injection logic ────────────────────────────── */

  function inject(data) {
    var site = data.site || {};
    var apps = data.apps || [];
    var pathname = window.location.pathname;

    var app = matchApp(apps, pathname);
    if (!app || !app.seo) return;

    var seo = app.seo;
    var siteUrl = (site.url || 'https://eduin.info').replace(/\/$/, '');
    var fullTitle = seo.title + ' | ' + (site.name || 'eduin VIVES');
    var description = seo.description || '';
    var ogImage = absUrl(siteUrl, app.ogImage || site.ogImage || '');
    var canonicalUrl = siteUrl + app.href;

    // ── Twitter Card ──
    if (!metaExists('name', 'twitter:card'))        addMeta('name', 'twitter:card', 'summary_large_image');
    if (!metaExists('name', 'twitter:title'))       addMeta('name', 'twitter:title', fullTitle);
    if (!metaExists('name', 'twitter:description')) addMeta('name', 'twitter:description', description);
    if (!metaExists('name', 'twitter:image'))       addMeta('name', 'twitter:image', ogImage);

    // ── Canonical ──
    if (!linkExists('canonical')) addLink('canonical', canonicalUrl);

    // ── OG image (update existing or add) ──
    var existingOgImage = document.querySelector('meta[property="og:image"]');
    if (existingOgImage && app.ogImage) {
      existingOgImage.setAttribute('content', ogImage);
    } else if (!existingOgImage) {
      addMeta('property', 'og:image', ogImage);
    }

    // ── OG url ──
    if (!metaExists('property', 'og:url')) addMeta('property', 'og:url', canonicalUrl);

    // ── JSON-LD structured data ──
    if (!document.querySelector('script[type="application/ld+json"]')) {
      var ld = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: app.title || seo.title,
        description: description,
        url: canonicalUrl,
        applicationCategory: 'EducationApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
        isPartOf: { '@type': 'WebSite', name: site.name || 'eduin VIVES', url: siteUrl }
      };
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(ld);
      document.head.appendChild(script);
    }

    // ── App title Lucide icon (비-immersive 앱 헤더) ──
    injectAppHeader(app);
  }

  /* ── entry point (defer-compatible) ─────────────── */

  function run() {
    try {
      fetchAppsData(function (data) {
        try { inject(data); } catch (e) { /* silent */ }
      });
    } catch (e) { /* silent */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
