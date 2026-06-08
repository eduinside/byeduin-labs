#!/usr/bin/env node
/**
 * generate-og-default.js
 * 홈/기본 OG 이미지(public/og-default.png, 1200×630)를 생성.
 * 브랜드 공유 아트워크(logo-seo.png — 아이콘 + 워드마크 + 태그라인)를 흰색
 * 1200×630 캔버스 중앙에 배치하고 좌우를 흰색으로 채운다. 이렇게 하면 와이드
 * 소셜 카드(카카오톡·X·페이스북·슬랙 등)가 1.91:1로 표시할 때 아이콘/태그라인이
 * 잘리지 않는다. (generate-og.js는 앱별 OG만 생성)
 *
 * Usage: node scripts/generate-og-default.js [sourceImage=./brand/logo-seo.png]
 */
const fs = require('fs');
const path = require('path');
let createCanvas, loadImage;
try { ({ createCanvas, loadImage } = require('canvas')); }
catch (e) { console.error('❌ "canvas" 패키지가 필요합니다: npm install canvas'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'brand', 'logo-seo.png');
const OUT = path.join(ROOT, 'public', 'og-default.png');
const W = 1200, H = 630, BG = '#ffffff';

/** Tight bounding box of non-white / non-transparent pixels (trims source padding). */
function contentBounds(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let l = w, t = h, r = 0, b = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isBg = d[i + 3] === 0 || (d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244);
      if (!isBg) { found = true; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
    }
  }
  return found ? { l, t, r, b } : { l: 0, t: 0, r: w - 1, b: h - 1 };
}

(async () => {
  if (!fs.existsSync(SRC)) { console.warn('⚠ source 없음 — og-default 생성 건너뜀:', SRC); return; }
  const img = await loadImage(SRC);

  // 1) 소스의 흰 여백을 잘라낸 콘텐츠 영역 측정
  const m = createCanvas(img.width, img.height);
  const mx = m.getContext('2d');
  mx.drawImage(img, 0, 0);
  const { l, t, r, b } = contentBounds(mx, img.width, img.height);
  const cw = r - l + 1, ch = b - t + 1;

  // 2) 1200×630 안에서 위아래 여백을 남기고 비율 유지 스케일
  const scale = Math.min((H * 0.80) / ch, (W * 0.62) / cw);
  const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
  const dx = Math.round((W - dw) / 2), dy = Math.round((H - dh) / 2);

  // 3) 흰 캔버스 중앙에 합성
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, l, t, cw, ch, dx, dy, dw, dh);

  fs.writeFileSync(OUT, c.toBuffer('image/png'));
  console.log(`✅ og-default.png ${W}×${H} (콘텐츠 ${dw}×${dh} 중앙, 좌우 흰 여백 ${dx}px, ${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
})();
