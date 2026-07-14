#!/usr/bin/env node
/**
 * generate-sitemap.js
 * Reads public/apps.json and generates public/sitemap.xml
 * No external dependencies.
 *
 * Usage: node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const APPS_JSON = path.join(__dirname, '..', 'public', 'apps.json');
const SITEMAP_OUT = path.join(__dirname, '..', 'public', 'sitemap.xml');

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrl(loc, lastmod, changefreq, priority) {
  return [
    '  <url>',
    '    <loc>' + escapeXml(loc) + '</loc>',
    '    <lastmod>' + lastmod + '</lastmod>',
    '    <changefreq>' + changefreq + '</changefreq>',
    '    <priority>' + priority + '</priority>',
    '  </url>'
  ].join('\n');
}

function main() {
  if (!fs.existsSync(APPS_JSON)) {
    console.error('❌ apps.json not found at', APPS_JSON);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(APPS_JSON, 'utf8'));
  var siteUrl = (data.site && data.site.url) || 'https://eduin.info';
  siteUrl = siteUrl.replace(/\/$/, '');

  var lastmod = today();
  var urls = [];

  // Home page
  urls.push(buildUrl(siteUrl + '/', lastmod, 'weekly', '1.0'));

  // App pages (exclude external modal-type apps)
  var apps = data.apps || [];
  var count = 0;

  apps.forEach(function (app) {
    // Skip external links and all modal-type entries (no crawlable page)
    if (app.external) return;
    if (app.type === 'modal') return;

    // Only include internal app pages
    if (!app.href || !app.href.startsWith('/')) return;

    var fullUrl = siteUrl + app.href;
    urls.push(buildUrl(fullUrl, lastmod, 'monthly', '0.8'));
    count++;
  });

  var xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join('\n'),
    '</urlset>',
    ''
  ].join('\n');

  fs.writeFileSync(SITEMAP_OUT, xml, 'utf8');

  console.log('✅ sitemap.xml generated → ' + SITEMAP_OUT);
  console.log('   Home page  : ' + siteUrl + '/');
  console.log('   App pages  : ' + count);
  console.log('   Total URLs : ' + (count + 1));
  console.log('   Last-mod   : ' + lastmod);
}

main();
