/**
 * seo-injector.js — Runtime SEO tag injection for eduin VIVES sub-apps
 * Fetches /apps.json (cached in sessionStorage) and injects Twitter Card,
 * Open Graph, canonical, and JSON-LD structured data for the current page.
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
    // Remove trailing index.html for comparison
    return (p || '').replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  }

  function matchApp(apps, pathname) {
    var normalised = normalizePath(pathname);

    // 1) exact match on href
    for (var i = 0; i < apps.length; i++) {
      if (apps[i].href === pathname) return apps[i];
    }

    // 2) normalised match (handles /app/ vs /app/index.html)
    for (var j = 0; j < apps.length; j++) {
      if (normalizePath(apps[j].href) === normalised) return apps[j];
    }

    // 3) prefix match (e.g. /scoring-table/ matches /scoring-table/index.html)
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
      if (cached) {
        callback(JSON.parse(cached));
        return;
      }
    } catch (e) { /* ignore */ }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/apps.json', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) return;
      try {
        var data = JSON.parse(xhr.responseText);
        try { sessionStorage.setItem(CACHE_KEY, xhr.responseText); } catch (e) { /* ignore */ }
        callback(data);
      } catch (e) { /* ignore parse error */ }
    };
    xhr.send();
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
