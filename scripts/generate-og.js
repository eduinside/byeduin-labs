#!/usr/bin/env node
/**
 * generate-og.js
 * Generates 1200×630 OG images for each app in apps.json
 * Requires: npm install canvas
 *
 * Usage: node scripts/generate-og.js
 */

// ── Check for canvas dependency ──
var createCanvas, registerFont;
try {
  var canvasModule = require('canvas');
  createCanvas = canvasModule.createCanvas;
  registerFont = canvasModule.registerFont;
} catch (e) {
  console.error('');
  console.error('❌ The "canvas" npm package is required but not installed.');
  console.error('');
  console.error('   Install it with:');
  console.error('     npm install canvas');
  console.error('');
  console.error('   On Windows you may also need:');
  console.error('     - Python 3');
  console.error('     - Visual Studio Build Tools');
  console.error('');
  console.error('   See: https://github.com/Automattic/node-canvas#compiling');
  console.error('');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const APPS_JSON = path.join(__dirname, '..', 'public', 'apps.json');
const OG_DIR = path.join(__dirname, '..', 'public', 'og-images');

const WIDTH = 1200;
const HEIGHT = 630;
const ACCENT_BAR_H = 4;

// Category accent colours
const CATEGORY_COLORS = {
  edu: '#7c6af7',
  utility: '#006fee',
  social: '#10b981',
  creative: '#f59e0b',
  notion: '#6b7280'
};

const CATEGORY_LABELS = {
  edu: '📚 교육',
  utility: '🛠 유틸리티',
  social: '💬 소셜 도구',
  creative: '🎨 크리에이티브',
  notion: '📐 노션 도구'
};

// ── Try to register Noto Sans KR if available ──
var fontFamily = 'sans-serif';
try {
  // Common paths where Noto Sans KR might exist
  var fontPaths = [
    '/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf',
    path.join(__dirname, '..', 'fonts', 'NotoSansKR-Regular.ttf'),
    path.join(__dirname, '..', 'fonts', 'NotoSansKR-Regular.otf')
  ];
  var boldFontPaths = [
    '/usr/share/fonts/opentype/noto/NotoSansKR-Bold.otf',
    '/usr/share/fonts/truetype/noto/NotoSansKR-Bold.ttf',
    path.join(__dirname, '..', 'fonts', 'NotoSansKR-Bold.ttf'),
    path.join(__dirname, '..', 'fonts', 'NotoSansKR-Bold.otf')
  ];

  fontPaths.forEach(function (fp) {
    if (fs.existsSync(fp)) {
      registerFont(fp, { family: 'NotoSansKR', weight: 'normal' });
      fontFamily = 'NotoSansKR';
    }
  });
  boldFontPaths.forEach(function (fp) {
    if (fs.existsSync(fp)) {
      registerFont(fp, { family: 'NotoSansKR', weight: 'bold' });
      fontFamily = 'NotoSansKR';
    }
  });
} catch (e) {
  // Fallback to sans-serif
}

// ── Text wrapping helper ──
function wrapText(ctx, text, maxWidth, maxLines) {
  var words = text.split('');
  var lines = [];
  var currentLine = '';

  for (var i = 0; i < words.length; i++) {
    var testLine = currentLine + words[i];
    var metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = words[i];
      if (lines.length >= maxLines) break;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  } else if (lines.length === maxLines && currentLine) {
    // Truncate last line with ellipsis
    var last = lines[maxLines - 1];
    var ellipsis = last + '…';
    while (ctx.measureText(ellipsis).width > maxWidth && ellipsis.length > 2) {
      last = last.slice(0, -1);
      ellipsis = last + '…';
    }
    lines[maxLines - 1] = ellipsis;
  }

  return lines;
}

// ── Draw a single OG image ──
function drawOgImage(app, categories) {
  var canvas = createCanvas(WIDTH, HEIGHT);
  var ctx = canvas.getContext('2d');

  var accentColor = CATEGORY_COLORS[app.category] || '#6b7280';

  // ── Background: solid dark with subtle gradient overlay ──
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle gradient overlay
  var grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, 'rgba(124, 106, 247, 0.05)');
  grad.addColorStop(0.5, 'rgba(0, 111, 238, 0.03)');
  grad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Accent bar at top ──
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, WIDTH, ACCENT_BAR_H);

  // ── Category badge pill (top-left) ──
  var catLabel = CATEGORY_LABELS[app.category] || app.category;
  ctx.font = '16px ' + fontFamily + ', sans-serif';
  var badgeText = catLabel;
  var badgeMetrics = ctx.measureText(badgeText);
  var badgeW = badgeMetrics.width + 24;
  var badgeH = 32;
  var badgeX = 60;
  var badgeY = 40;

  ctx.fillStyle = accentColor + '33'; // ~20% opacity
  ctx.beginPath();
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fill();

  ctx.fillStyle = accentColor;
  ctx.font = '16px ' + fontFamily + ', sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + 12, badgeY + badgeH / 2);

  // ── Emoji (large, centred vertically with text block) ──
  var contentCenterY = HEIGHT / 2 - 10;

  ctx.font = '80px ' + fontFamily + ', sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(app.emoji || '📦', WIDTH / 2, contentCenterY - 70);

  // ── App title ──
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px ' + fontFamily + ', sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(app.title || '', WIDTH / 2, contentCenterY + 20);

  // ── SEO description (max 2 lines) ──
  var desc = (app.seo && app.seo.description) || app.desc || '';
  if (desc) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px ' + fontFamily + ', sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var descLines = wrapText(ctx, desc, WIDTH - 200, 2);
    var lineHeight = 32;
    var descStartY = contentCenterY + 60;

    descLines.forEach(function (line, i) {
      ctx.fillText(line, WIDTH / 2, descStartY + i * lineHeight);
    });
  }

  // ── Bottom branding ──
  ctx.fillStyle = '#475569';
  ctx.font = '18px ' + fontFamily + ', sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('byeduin VIVES', WIDTH / 2, HEIGHT - 40);

  // Small line above branding
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 60, HEIGHT - 60);
  ctx.lineTo(WIDTH / 2 + 60, HEIGHT - 60);
  ctx.stroke();

  return canvas;
}

// ── Rounded rectangle helper ──
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Main ──
function main() {
  if (!fs.existsSync(APPS_JSON)) {
    console.error('❌ apps.json not found at', APPS_JSON);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(APPS_JSON, 'utf8'));
  var apps = data.apps || [];

  // Ensure output directory
  if (!fs.existsSync(OG_DIR)) {
    fs.mkdirSync(OG_DIR, { recursive: true });
    console.log('📁 Created', OG_DIR);
  }

  var generated = 0;
  var skipped = 0;

  apps.forEach(function (app) {
    if (!app.ogImage) {
      console.log('   ⏭  ' + app.id + ' — no ogImage field, skipping');
      skipped++;
      return;
    }

    var outFile = path.join(OG_DIR, app.id + '.png');
    console.log('   🖼  Generating ' + app.id + '.png ...');

    try {
      var canvas = drawOgImage(app, data.categories);
      var buf = canvas.toBuffer('image/png');
      fs.writeFileSync(outFile, buf);
      console.log('   ✅ ' + outFile + ' (' + Math.round(buf.length / 1024) + ' KB)');
      generated++;
    } catch (err) {
      console.error('   ❌ Failed: ' + app.id + ' — ' + err.message);
    }
  });

  console.log('');
  console.log('🏁 Done! Generated: ' + generated + ', Skipped: ' + skipped);
}

main();
