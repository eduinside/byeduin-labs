#!/usr/bin/env node
/**
 * inject-seo.js
 * Reads public/apps.json and injects/updates SEO meta tags into each
 * internal app's HTML file. Uses simple string manipulation (no DOM parser).
 * No external dependencies.
 *
 * Usage: node scripts/inject-seo.js
 */

const fs = require('fs');
const path = require('path');

const APPS_JSON = path.join(__dirname, '..', 'public', 'apps.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function main() {
  if (!fs.existsSync(APPS_JSON)) {
    console.error('❌ apps.json not found at', APPS_JSON);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(APPS_JSON, 'utf8'));
  var site = data.site || {};
  var siteUrl = (site.url || 'https://eduin.info').replace(/\/$/, '');
  var apps = data.apps || [];

  var processed = 0;
  var skipped = 0;

  apps.forEach(function (app) {
    if (!app.href || !app.href.startsWith('/')) {
      console.log('   ⏭  ' + app.id + ' — external or no href, skipping');
      skipped++;
      return;
    }

    // Resolve HTML file path
    var htmlPath;
    if (app.href.endsWith('.html')) {
      htmlPath = path.join(PUBLIC_DIR, app.href);
    } else if (app.href.endsWith('/')) {
      htmlPath = path.join(PUBLIC_DIR, app.href, 'index.html');
    } else {
      htmlPath = path.join(PUBLIC_DIR, app.href, 'index.html');
    }

    if (!fs.existsSync(htmlPath)) {
      console.log('   ⚠️  ' + app.id + ' — HTML not found: ' + htmlPath);
      skipped++;
      return;
    }

    var html = fs.readFileSync(htmlPath, 'utf8');
    var changes = [];
    var seo = app.seo || {};
    var ogImageUrl = app.ogImage ? siteUrl + app.ogImage : (site.ogImage ? siteUrl + site.ogImage : '');
    var canonicalUrl = siteUrl + app.href;
    var fullTitle = seo.title + ' | ' + (site.name || 'eduin VIVES');
    var description = seo.description || '';

    // ── 1. Update og:image ──
    var ogImageRegex = /<meta\s+property="og:image"\s+content="([^"]*)"\s*\/?>/i;
    if (ogImageRegex.test(html) && ogImageUrl) {
      html = html.replace(ogImageRegex, '<meta property="og:image" content="' + ogImageUrl + '">');
      changes.push('og:image updated');
    } else if (!ogImageRegex.test(html) && ogImageUrl) {
      html = addBeforeHeadClose(html, '  <meta property="og:image" content="' + ogImageUrl + '">');
      changes.push('og:image added');
    }

    // ── 2. Update meta description ──
    if (description) {
      var descRegex = /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i;
      if (descRegex.test(html)) {
        html = html.replace(descRegex, '<meta name="description" content="' + escapeHtmlAttr(description) + '">');
        changes.push('description updated');
      }
    }

    // ── 3. Update og:description ──
    if (description) {
      var ogDescRegex = /<meta\s+property="og:description"\s+content="([^"]*)"\s*\/?>/i;
      if (ogDescRegex.test(html)) {
        html = html.replace(ogDescRegex, '<meta property="og:description" content="' + escapeHtmlAttr(description) + '">');
        changes.push('og:description updated');
      }
    }

    // ── 4. Add Twitter Card tags if missing ──
    if (!html.includes('twitter:card')) {
      var twitterTags = [
        '  <meta name="twitter:card" content="summary_large_image">',
        '  <meta name="twitter:title" content="' + escapeHtmlAttr(fullTitle) + '">',
        '  <meta name="twitter:description" content="' + escapeHtmlAttr(description) + '">',
        '  <meta name="twitter:image" content="' + ogImageUrl + '">'
      ].join('\n');
      html = addBeforeHeadClose(html, twitterTags);
      changes.push('twitter cards added');
    }

    // ── 5. Canonical link (update or add) ──
    var canonicalRegex = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
    if (canonicalRegex.test(html)) {
      html = html.replace(canonicalRegex, '<link rel="canonical" href="' + canonicalUrl + '">');
      changes.push('canonical updated');
    } else {
      html = addBeforeHeadClose(html, '  <link rel="canonical" href="' + canonicalUrl + '">');
      changes.push('canonical added');
    }

    // ── 6. og:url (update or add) ──
    var ogUrlRegex = /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i;
    if (ogUrlRegex.test(html)) {
      html = html.replace(ogUrlRegex, '<meta property="og:url" content="' + canonicalUrl + '">');
      changes.push('og:url updated');
    } else {
      html = addBeforeHeadClose(html, '  <meta property="og:url" content="' + canonicalUrl + '">');
      changes.push('og:url added');
    }

    // ── 7. JSON-LD (update or add) ──
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
    var ldTag = '<script type="application/ld+json">' + JSON.stringify(ld) + '<\/script>';
    var ldRegex = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
    if (ldRegex.test(html)) {
      html = html.replace(ldRegex, ldTag);
      changes.push('JSON-LD updated');
    } else {
      html = addBeforeHeadClose(html, '  ' + ldTag);
      changes.push('JSON-LD added');
    }

    // ── 8. Add seo-injector.js script if missing ──
    if (!html.includes('seo-injector.js')) {
      html = addBeforeHeadClose(html, '  <script src="/common/seo-injector.js" defer><\/script>');
      changes.push('seo-injector.js added');
    }

    // Write back
    if (changes.length > 0) {
      fs.writeFileSync(htmlPath, html, 'utf8');
      console.log('   ✅ ' + app.id + ' — ' + changes.join(', '));
      processed++;
    } else {
      console.log('   ✔️  ' + app.id + ' — already up to date');
    }
  });

  console.log('');
  console.log('🏁 Done! Processed: ' + processed + ', Skipped: ' + skipped);
}

/**
 * Insert content before </head>, preserving indentation.
 */
function addBeforeHeadClose(html, content) {
  var headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx === -1) {
    // Try case-insensitive
    headCloseIdx = html.toLowerCase().indexOf('</head>');
  }
  if (headCloseIdx === -1) return html; // can't find </head>

  return html.slice(0, headCloseIdx) + content + '\n' + html.slice(headCloseIdx);
}

/**
 * Escape special chars for HTML attribute values.
 */
function escapeHtmlAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

main();
