#!/usr/bin/env node
/**
 * scaffold-app.js
 * Interactive scaffolding for a new eduin VIVES sub-app.
 * Creates the HTML file and adds the entry to apps.json.
 * No external dependencies.
 *
 * Usage: node scripts/scaffold-app.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const APPS_JSON = path.join(__dirname, '..', 'public', 'apps.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function ask(rl, question) {
  return new Promise(function (resolve) {
    rl.question(question, function (answer) {
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (!fs.existsSync(APPS_JSON)) {
    console.error('❌ apps.json not found at', APPS_JSON);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(APPS_JSON, 'utf8'));
  var categories = data.categories || [];

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('');
  console.log('🛠  eduin VIVES — New App Scaffolder');
  console.log('─'.repeat(40));
  console.log('');

  // 1. App ID
  var appId = await ask(rl, '📌 App ID (slug, e.g., "my-app"): ');
  if (!appId) {
    console.error('❌ App ID is required.');
    rl.close();
    process.exit(1);
  }

  // Check if already exists
  if (data.apps.some(function (a) { return a.id === appId; })) {
    console.error('❌ App "' + appId + '" already exists in apps.json.');
    rl.close();
    process.exit(1);
  }

  // 2. App name
  var appName = await ask(rl, '📝 App name (display name): ');
  if (!appName) {
    console.error('❌ App name is required.');
    rl.close();
    process.exit(1);
  }

  // 3. Category
  console.log('');
  console.log('   Available categories:');
  categories.forEach(function (cat, i) {
    console.log('   ' + (i + 1) + '. ' + cat.label + ' (' + cat.id + ')');
  });
  var catInput = await ask(rl, '📂 Category (number or id): ');
  var category;
  var catNum = parseInt(catInput, 10);
  if (!isNaN(catNum) && catNum >= 1 && catNum <= categories.length) {
    category = categories[catNum - 1].id;
  } else {
    category = catInput;
  }
  if (!categories.some(function (c) { return c.id === category; })) {
    console.error('⚠️  Unknown category "' + category + '". Continuing anyway.');
  }

  // 4. Emoji
  var emoji = await ask(rl, '🎭 Emoji icon: ');
  emoji = emoji || '📦';

  // 5. Short description
  var desc = await ask(rl, '💬 Short description (for card): ');
  desc = desc || appName;

  // 6. SEO title
  var seoTitle = await ask(rl, '🔍 SEO title: ');
  seoTitle = seoTitle || appName;

  // 7. SEO description
  var seoDesc = await ask(rl, '📄 SEO description: ');
  seoDesc = seoDesc || desc;

  rl.close();

  // ── Build the HTML ──
  var categoryUpper = category.charAt(0).toUpperCase() + category.slice(1);
  var siteUrl = (data.site && data.site.url) || 'https://eduin.info';

  var htmlContent = '<!DOCTYPE html>\n'
    + '<html lang="ko">\n'
    + '<head>\n'
    + '  <meta charset="UTF-8">\n'
    + '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '  <title>' + escapeHtml(appName) + ' — eduin VIVES</title>\n'
    + '  <meta name="description" content="' + escapeHtmlAttr(seoDesc) + '">\n'
    + '  <meta property="og:title" content="' + escapeHtmlAttr(seoTitle) + ' | eduin VIVES">\n'
    + '  <meta property="og:description" content="' + escapeHtmlAttr(seoDesc) + '">\n'
    + '  <meta property="og:image" content="/og-images/' + appId + '.png">\n'
    + '  <meta property="og:type" content="website">\n'
    + '  <link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
    + '  <link rel="stylesheet" href="/common/hero-theme.css">\n'
    + '  <script src="/common/theme.js"><\/script>\n'
    + '  <script src="/common/init.js"><\/script>\n'
    + '  <script src="/common/seo-injector.js" defer><\/script>\n'
    + '  <style>\n'
    + '    /* App-specific styles here */\n'
    + '  </style>\n'
    + '</head>\n'
    + '<body>\n'
    + '  <div class="app-header">\n'
    + '    <div class="app-badge">◆ ' + escapeHtml(categoryUpper) + '</div>\n'
    + '    <h1 class="app-title">' + emoji + ' ' + escapeHtml(appName) + '</h1>\n'
    + '    <p class="app-desc">' + escapeHtml(desc) + '</p>\n'
    + '  </div>\n'
    + '  <main class="container" style="max-width:720px;margin:0 auto;padding:0 1rem 4rem;position:relative;z-index:1;">\n'
    + '    <!-- App content here -->\n'
    + '  </main>\n'
    + '</body>\n'
    + '</html>\n';

  // ── Create the directory and file ──
  var appDir = path.join(PUBLIC_DIR, appId);
  var htmlFile = path.join(appDir, 'index.html');

  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }

  if (fs.existsSync(htmlFile)) {
    console.error('⚠️  ' + htmlFile + ' already exists. Overwriting.');
  }

  fs.writeFileSync(htmlFile, htmlContent, 'utf8');

  // ── Add entry to apps.json ──
  var newApp = {
    id: appId,
    emoji: emoji,
    title: appName,
    desc: desc,
    href: '/' + appId + '/',
    category: category,
    seo: {
      title: seoTitle,
      description: seoDesc,
      keywords: []
    },
    ogImage: '/og-images/' + appId + '.png'
  };

  data.apps.push(newApp);
  fs.writeFileSync(APPS_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // ── Done ──
  console.log('');
  console.log('─'.repeat(40));
  console.log('✅ App "' + appName + '" scaffolded successfully!');
  console.log('');
  console.log('   📁 HTML : ' + htmlFile);
  console.log('   📋 Added to apps.json');
  console.log('');
  console.log('   Next steps:');
  console.log('   1. Edit ' + htmlFile + ' to build your app');
  console.log('   2. Run "node scripts/generate-og.js" to create the OG image');
  console.log('   3. Run "node scripts/generate-sitemap.js" to update the sitemap');
  console.log('   4. Run "node scripts/inject-seo.js" to inject SEO tags');
  console.log('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

main().catch(function (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
