#!/usr/bin/env node
/**
 * generate-og-default.cjs
 * 홈/기본 OG 이미지(public/og-default.png, 1200×630)를 생성.
 * 브랜드 공유 아트워크(logo-seo.png — 아이콘 + 워드마크 + 태그라인)를 흰색
 * 1200×630 캔버스 중앙에 배치하고 좌우를 흰색으로 채운다. 이렇게 하면 와이드
 * 소셜 카드(카카오톡·X·페이스북·슬랙 등)가 1.91:1로 표시할 때 아이콘/태그라인이
 * 잘리지 않는다. (앱별 OG는 빌드 때 src/pages/og/[id].png.ts가 만든다)
 *
 * Usage: node scripts/generate-og-default.cjs [sourceImage=./brand/logo-seo.png]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'brand', 'logo-seo.png');
const OUT = path.join(ROOT, 'public', 'og-default.png');
const W = 1200, H = 630, BG = '#ffffff';

(async () => {
  if (!fs.existsSync(SRC)) { console.warn('⚠ source 없음 — og-default 생성 건너뜀:', SRC); return; }

  // 1) 소스의 흰 여백을 잘라낸다(밝기 245 이상·투명은 배경으로 봄)
  const trimmed = await sharp(SRC).flatten({ background: BG }).trim({ background: BG, threshold: 11 }).toBuffer();

  // 2) 1200×630 안에서 위아래 여백을 남기고 비율 유지 스케일
  const { data: art, info } = await sharp(trimmed)
    .resize({ width: Math.round(W * 0.62), height: Math.round(H * 0.80), fit: 'inside', kernel: 'lanczos3' })
    .toBuffer({ resolveWithObject: true });
  const dx = Math.round((W - info.width) / 2), dy = Math.round((H - info.height) / 2);

  // 3) 흰 캔버스 중앙에 합성
  await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([{ input: art, left: dx, top: dy }])
    .png()
    .toFile(OUT);
  console.log(`✅ og-default.png ${W}×${H} (콘텐츠 ${info.width}×${info.height} 중앙, 좌우 흰 여백 ${dx}px, ${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
})();
