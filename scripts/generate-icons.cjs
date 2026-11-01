#!/usr/bin/env node
/**
 * generate-icons.js
 * Regenerate brand assets from a single source icon (rounded-square app icon).
 * Every reference in the site already points at these paths, so replacing the
 * files in place rebrands the whole site with no HTML/JSON edits.
 *
 * Outputs:
 *   public/logo.png    — main logo (homepage header + apple-touch-icon)        512px
 *   public/logo.jpg    — header logo / icon used by sub-apps (white-matte JPEG) 512px
 *   public/favicon.svg — favicon; source embedded as data-URI so the existing
 *                        "/favicon.svg" references (init.js, index.html, …) all
 *                        show the new icon with zero reference changes.
 *   public/favicon.ico — legacy /favicon.ico auto-request (16/32/48 px, PNG-in-ICO)
 *
 * Usage: node scripts/generate-icons.js [sourceImage=./brand/logo.png]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'brand', 'logo.png');
const PUB = path.join(ROOT, 'public');

/** size×size로 줄인 sharp 파이프라인. matte가 있으면 투명 부분을 그 색으로 채운다. */
function render(size, matte) {
  const p = sharp(SRC).resize(size, size, { fit: 'fill', kernel: 'lanczos3' });
  return matte ? p.flatten({ background: matte }) : p;
}

/** Minimal PNG-in-ICO container (Vista+; all current browsers support it). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);             // reserved
  header.writeUInt16LE(1, 2);             // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  const blobs = [];
  entries.forEach((e, i) => {
    const o = 16 * i;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o);     // width  (0 = 256)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1); // height
    dir.writeUInt8(0, o + 2);                          // palette
    dir.writeUInt8(0, o + 3);                          // reserved
    dir.writeUInt16LE(1, o + 4);                       // planes
    dir.writeUInt16LE(32, o + 6);                      // bpp
    dir.writeUInt32LE(e.buffer.length, o + 8);         // byte size
    dir.writeUInt32LE(offset, o + 12);                 // offset
    offset += e.buffer.length;
    blobs.push(e.buffer);
  });
  return Buffer.concat([header, dir, ...blobs]);
}

(async () => {
  if (!fs.existsSync(SRC)) { console.error('✗ source not found:', SRC); process.exit(1); }
  const img = await sharp(SRC).metadata();
  const out = (f) => path.join(PUB, f);
  const kb = (b) => (b.length / 1024).toFixed(0) + ' KB';

  // 1) main logo
  const logoPng = await render(512).png().toBuffer();
  fs.writeFileSync(out('logo.png'), logoPng);

  // 2) header logo (no alpha → white matte, matches source background)
  const logoJpg = await render(512, '#ffffff').jpeg({ quality: 92 }).toBuffer();
  fs.writeFileSync(out('logo.jpg'), logoJpg);

  // 3) favicon.svg with embedded raster (keeps all existing /favicon.svg refs valid)
  const favPng = await render(128).png().toBuffer();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">\n' +
    '  <image width="128" height="128" href="data:image/png;base64,' + favPng.toString('base64') + '"/>\n' +
    '</svg>\n';
  fs.writeFileSync(out('favicon.svg'), svg);

  // 4) favicon.ico (multi-size)
  const ico = buildIco(await Promise.all([16, 32, 48].map(async (s) => ({ size: s, buffer: await render(s).png().toBuffer() }))));
  fs.writeFileSync(out('favicon.ico'), ico);

  console.log('✓ source      ', SRC, img.width + 'x' + img.height);
  console.log('✓ logo.png    ', kb(logoPng));
  console.log('✓ logo.jpg    ', kb(logoJpg));
  console.log('✓ favicon.svg ', kb(Buffer.from(svg)));
  console.log('✓ favicon.ico ', kb(ico));
})();
