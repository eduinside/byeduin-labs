#!/usr/bin/env node
/**
 * generate-og-default.js
 * 홈/기본 OG 이미지(public/og-default.png, 1024×1024)를 'eduin VIVES' 브랜드 스타일로 생성.
 * 다크 그리드 배경 + 중앙 글로우 + 흩뿌린 앱 이모지 + 타이틀/서브타이틀.
 * (generate-og.js는 앱별 OG만 생성하므로 홈 기본 이미지는 이 스크립트로 별도 생성)
 *
 * Usage: node scripts/generate-og-default.js
 */
var createCanvas, registerFont;
try {
  var canvasModule = require('canvas');
  createCanvas = canvasModule.createCanvas;
  registerFont = canvasModule.registerFont;
} catch (e) {
  console.error('❌ "canvas" 패키지가 필요합니다: npm install canvas');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'og-default.png');
const SIZE = 1024;

// ── 폰트 등록 (Noto Sans KR 있으면 사용) ──
var fontFamily = 'sans-serif';
try {
  var fonts = [
    ['/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf', 'normal'],
    ['/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf', 'normal'],
    [path.join(__dirname, '..', 'fonts', 'NotoSansKR-Regular.ttf'), 'normal'],
    [path.join(__dirname, '..', 'fonts', 'NotoSansKR-Regular.otf'), 'normal'],
    ['/usr/share/fonts/opentype/noto/NotoSansKR-Bold.otf', 'bold'],
    ['/usr/share/fonts/truetype/noto/NotoSansKR-Bold.ttf', 'bold'],
    [path.join(__dirname, '..', 'fonts', 'NotoSansKR-Bold.ttf'), 'bold'],
    [path.join(__dirname, '..', 'fonts', 'NotoSansKR-Bold.otf'), 'bold']
  ];
  fonts.forEach(function (f) {
    if (fs.existsSync(f[0])) { registerFont(f[0], { family: 'NotoSansKR', weight: f[1] }); fontFamily = 'NotoSansKR'; }
  });
} catch (e) { /* fallback sans-serif */ }

var canvas = createCanvas(SIZE, SIZE);
var ctx = canvas.getContext('2d');

// ── 배경 ──
ctx.fillStyle = '#0b1020';
ctx.fillRect(0, 0, SIZE, SIZE);

// ── 그리드 ──
ctx.strokeStyle = 'rgba(124, 106, 247, 0.06)';
ctx.lineWidth = 1;
for (var g = 0; g <= SIZE; g += 64) {
  ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, SIZE); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(SIZE, g); ctx.stroke();
}

// ── 중앙 방사형 글로우 ──
var glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 40, SIZE / 2, SIZE / 2, 440);
glow.addColorStop(0, 'rgba(124, 106, 247, 0.34)');
glow.addColorStop(0.5, 'rgba(0, 111, 238, 0.12)');
glow.addColorStop(1, 'rgba(11, 16, 32, 0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, SIZE, SIZE);

// (이모지 장식은 node-canvas가 무채색 글리프로만 렌더해 흐릿하므로 생략 — 글로우/그리드로 질감 처리)

// ── 타이틀 ──
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 100px ' + fontFamily + ', sans-serif';
ctx.fillText('eduin VIVES', SIZE / 2, SIZE / 2 - 8);

// ── 서브타이틀 ──
ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
ctx.font = '42px ' + fontFamily + ', sans-serif';
ctx.fillText('교육 미니앱 모음', SIZE / 2, SIZE / 2 + 78);

fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log('✅ og-default.png 생성 완료:', OUT, '(' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
