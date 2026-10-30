// ─────────────── 공통 ───────────────
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function escHtml(s) {
  if (window.VSafe && typeof VSafe.esc === 'function') return VSafe.esc(s);
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 토스트: 공용 VUI(AppLayout이 <head>에서 불러옴). 없으면 콘솔에만
function showToast(msg, type) {
  if (window.VUI) VUI.toast(msg, type);
  else console.log('[file-tools]', msg);
}
// 아이콘(공용 스프라이트). VUI가 없으면 빈 문자열
// @icons x download rotate-cw layout-grid
function ic(name) { return window.VUI ? VUI.icon(name) : ''; }

// 파일 확장자로 다룰 수 있는지 판단
const PAGE_EXTS = ['pdf', 'tif', 'tiff', 'jpg', 'jpeg', 'png', 'heic', 'heif'];   // PDF·그림
const DOC_EXTS = ['pptx', 'docx', 'xlsx', 'hwpx'];                // 그림이 든 문서(zip)
function extOf(f) { return f.name.split('.').pop().toLowerCase(); }
const isDocFile = f => DOC_EXTS.includes(extOf(f));
const isSupported = f => PAGE_EXTS.includes(extOf(f)) || isDocFile(f);
const isHwp = f => extOf(f) === 'hwp';                 // 옛 한글 형식: 줄이는 대신 HWPX로 바꾸는 방법을 안내
const isHeic = f => ['heic', 'heif'].includes(extOf(f));
// 못 쓰는 파일을 뺐다고 알림(조용히 빈 결과를 만들지 않게)
function reportSkipped(skipped, hint) {
  if (!skipped.length) return;
  const names = skipped.slice(0, 2).map(f => f.name).join(', ') + (skipped.length > 2 ? ` 외 ${skipped.length - 2}개` : '');
  showToast(`${skipped.length}개는 여기서 줄일 수 없는 파일이라 뺐어요: ${names}${hint ? '\n' + hint : ''}`, 'error');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─────────────── 외부 라이브러리 지연 로드 (버전 고정) ───────────────
// 첫 화면에서는 아무것도 받지 않고, 실제로 필요한 순간에 한 번만 불러옵니다.
const PDFJS_VER = '3.11.174';
const LIBS = {
  jszip:  { src: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', ready: () => window.JSZip },
  utif:   { src: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js', ready: () => window.UTIF },
  pdfjs:  {
    src: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`,
    ready: () => window.pdfjsLib,
    init: () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`;
    },
  },
  pdflib: { src: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', ready: () => window.PDFLib },
  heic2any: { src: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js', ready: () => window.heic2any },
};
const _libPromises = {};
function loadLib(name) {
  const lib = LIBS[name];
  if (lib.ready()) return Promise.resolve(lib.ready());
  if (_libPromises[name]) return _libPromises[name];
  _libPromises[name] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = lib.src;
    s.async = true;
    s.onload = () => {
      if (!lib.ready()) { reject(new Error('라이브러리 초기화 실패')); return; }
      try { lib.init?.(); } catch (e) { console.warn(e); }
      resolve(lib.ready());
    };
    s.onerror = () => reject(new Error('처리 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'));
    document.head.appendChild(s);
  }).catch(err => { delete _libPromises[name]; throw err; });   // 실패하면 다음에 다시 시도할 수 있게
  return _libPromises[name];
}
function loadLibs(names) { return Promise.all(names.map(loadLib)); }

// 드롭존 바인딩
function bindDropzone(zoneEl, inputEl, onFiles) {
  zoneEl.addEventListener('click', () => inputEl.click());
  // 키보드: Enter·Space로 파일 고르기 창 열기
  zoneEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl.click(); }
  });
  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) onFiles(Array.from(inputEl.files));
    inputEl.value = '';
  });
  ['dragenter', 'dragover'].forEach(ev =>
    zoneEl.addEventListener(ev, e => { e.preventDefault(); zoneEl.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(ev =>
    zoneEl.addEventListener(ev, e => { e.preventDefault(); zoneEl.classList.remove('drag-over'); }));
  zoneEl.addEventListener('drop', e => {
    if (e.dataTransfer?.files?.length) onFiles(Array.from(e.dataTransfer.files));
  });
}

// 캔버스 → JPEG/PNG Blob
function canvasToBlob(canvas, mime, quality) {
  return new Promise(res => canvas.toBlob(res, mime, quality));
}

// ─────────────── 목표 용량 탐색 ───────────────
// 설정 후보를 "예상 용량이 작은 것 → 큰 것" 순으로 늘어놓고 이진 탐색합니다.
// 목표 이하이면 더 높은 품질 쪽을, 초과면 더 낮은 쪽을 시도해
// "목표 용량 안에서 가장 좋은 품질"을 고릅니다.
// 어떤 설정도 목표에 못 들어가면 시도한 것 중 가장 작은 결과를 돌려줍니다(reached=false).
function buildLadder(widths, qualities, losslessOnly) {
  const list = [];
  if (losslessOnly) widths.forEach(w => list.push({ w, q: 1 }));
  else widths.forEach(w => qualities.forEach(q => list.push({ w, q })));
  const est = a => a.w * a.w * (losslessOnly ? 1 : (0.04 + a.q * 0.18));
  return list.sort((a, b) => est(a) - est(b) || a.w - b.w || a.q - b.q);
}

async function searchBestUnderTarget(ladder, targetBytes, evaluate) {
  let lo = 0, hi = ladder.length - 1, n = 0;
  let best = null, smallest = null;
  const maxSteps = Math.ceil(Math.log2(ladder.length + 1));
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const params = ladder[mid];
    const blob = await evaluate(params, ++n, maxSteps);
    const entry = { blob, params };
    if (!smallest || blob.size < smallest.blob.size) smallest = entry;
    if (blob.size <= targetBytes) { best = entry; lo = mid + 1; }   // 들어감 → 더 좋은 품질 시도
    else hi = mid - 1;                                               // 초과 → 더 낮은 품질 시도
  }
  return best ? { ...best, reached: true } : { ...smallest, reached: false };
}

// 전체 내용 SHA-256 (같은 그림 판정용). 사용할 수 없는 환경이면 null
async function hashBlob(blob) {
  try {
    if (!window.crypto?.subtle) return null;
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return blob.size + ':' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

// 동시에 처리할 개수 제한 (큰 문서에서 메모리 폭증 방지)
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ─────────────── 줄이기 ───────────────
// PDF·그림·문서를 한곳에 넣는다. 파일을 넣거나 설정을 바꾸면 바로 시작하고,
// 결과는 파일마다 보여 준 뒤 저장한다.
// PDF는 글자·도형은 그대로 두고 안에 든 그림만 다시 압축한다(기본).
// 쪽을 통째로 그림으로 바꾸는 방식은 파일 줄의 버튼으로만 쓴다.
// 문서(PPTX·DOCX·XLSX·HWPX)는 안의 그림을 그려진 크기에 맞춰 줄이고 형식은 그대로.

// dpi: 그려진 크기(또는 쪽 긴 변) 기준 해상도, q: JPEG 화질
const SCAN_PRESETS = {
  light:  { dpi: 100, q: 0.5 },
  normal: { dpi: 150, q: 0.65 },
  high:   { dpi: 220, q: 0.8 },
};
const SCAN_LEVEL_NOTES = {
  light: '메신저로 보내거나 화면으로 볼 때 알맞아요.',
  normal: '공문 첨부처럼 대부분은 이 정도면 충분해요.',
  high: '인쇄할 문서에 알맞아요. 덜 줄어들어요.',
  target: '정한 용량 이하가 되도록 화질과 크기를 자동으로 맞춰요. 파일을 합치면 합친 파일 기준이에요.',
};
const SCAN_FORMAT_NOTES = {
  keep: 'PDF는 PDF로, JPG·PNG는 같은 형식으로 줄여요. TIFF는 PDF로 만들어요.',
  pdf: '그림 파일은 쪽 하나짜리 PDF로 만들어요.',
  jpg: 'PDF·TIFF는 쪽마다 JPG 한 장으로 바꾸고, 여러 장이면 ZIP 파일 하나로 묶어요. 글자도 그림이 돼요.',
};
const A4_LONG_IN = 11.69;   // A4 긴 변(인치)
const A4_LONG_PT = 842;     // A4 긴 변(pt)
const SCAN_PREF_KEY = 'vives-file-tools-scan-v1';
const CANCELLED = Symbol('cancelled');   // 설정이 바뀌거나 파일을 빼서 하던 일을 버릴 때

const scanState = {
  files: [],          // { id, file }
  jobs: [],           // { id, entries, status: wait|run|done|error, pct, result, error }
  raster: new Set(),  // 쪽을 그림으로 바꾸기로 한 작업 id
  edits: new Map(),   // 쪽 정리: 작업 id → { removed: Set(쪽 번호), rot: Map(쪽 번호 → 90·180·270) }
  level: 'normal', format: 'keep', targetMB: 5, merge: false,
  strip: true,        // 개인정보(사진 위치·기기, 문서 작성자) 지우기
  gray: false,        // 회색으로(글자 스캔)
  running: false,
};
let _scanSeq = 0;

function loadScanPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(SCAN_PREF_KEY) || 'null');
    if (!p) return;
    if (['light', 'normal', 'high', 'target'].includes(p.level)) scanState.level = p.level;
    if (['keep', 'pdf', 'jpg'].includes(p.format)) scanState.format = p.format;
    if (+p.targetMB >= 0.05) scanState.targetMB = +p.targetMB;
    scanState.merge = !!p.merge;
    if (typeof p.strip === 'boolean') scanState.strip = p.strip;
    scanState.gray = !!p.gray;
  } catch { /* 저장소를 못 쓰면 기본값 */ }
}
function saveScanPrefs() {
  const { level, format, targetMB, merge, strip, gray } = scanState;
  try { localStorage.setItem(SCAN_PREF_KEY, JSON.stringify({ level, format, targetMB, merge, strip, gray })); } catch { /* 무시 */ }
}

const isTif = f => ['tif', 'tiff'].includes(extOf(f));
const stemOf = f => f.name.replace(/\.[^.]+$/, '');
const pageEntries = () => scanState.files.filter(e => !isDocFile(e.file) && !isHwp(e.file));
const mergeActive = () => scanState.format === 'pdf' && scanState.merge && pageEntries().length > 1;
const newScanJob = (id, entries) => ({ id, entries, status: 'wait', pct: 0, result: null, error: null });

// ── 그리기 도우미 ──
// 긴 변이 maxLong을 넘으면 비율대로 줄인 캔버스. white: JPEG처럼 투명을 못 담을 때 흰 바탕
function drawFit(src, w, h, maxLong, white) {
  const s = Math.max(w, h) > maxLong ? maxLong / Math.max(w, h) : 1;
  return drawScaled(src, Math.round(w * s), Math.round(h * s), white);
}
function drawScaled(src, cw, ch, white) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, cw);
  c.height = Math.max(1, ch);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (white) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
// 낱장 그림을 PDF 쪽으로 넣을 때 쪽 크기: 긴 변을 A4에 맞춤
function a4Pt(w, h) {
  const s = A4_LONG_PT / Math.max(w, h);
  return { w: w * s, h: h * s };
}
function freeCanvas(c) { c.width = 0; c.height = 0; }

// 글자 스캔용 회색: 밝기(0.299R + 0.587G + 0.114B)로 바꾼 뒤 종이 색은 흰색으로, 글자는 더 진하게 펴 준다.
// 용량은 회색보다 바탕의 얼룩·잡티가 사라지는 데서 크게 준다(캔버스는 3채널 JPEG만 만듦)
function toGray(c) {
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    d[i] = y;
    hist[y]++;
  }
  // 종이 색: 밝은 쪽(128 이상)에서 가장 많은 밝기. 흰 점은 그보다 조금 어둡게, 검은 점은 어두운 쪽 2%
  let paper = 255;
  for (let v = 128, best = -1; v < 256; v++) if (hist[v] > best) { best = hist[v]; paper = v; }
  const total = d.length / 4;
  let black = 0;
  for (let v = 0, acc = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { black = v; break; } }
  const white = Math.max(black + 40, paper - 18);
  black = Math.min(black, white - 40);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = ((v - black) * 255) / (white - black);
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = lut[d[i]];
  g.putImageData(img, 0, 0);
  return c;
}

// 그림 파일 열기. HEIC는 브라우저가 못 열면 그때 변환 도구를 불러 PNG로 바꿔 연다
async function openBitmap(file) {
  if (!isHeic(file)) return createImageBitmap(file);
  try { return await createImageBitmap(file); } catch { /* Safari 말고는 대개 직접 못 엶 */ }
  await loadLib('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/png' });
  return createImageBitmap(Array.isArray(out) ? out[0] : out);
}

// JPEG에서 EXIF·XMP(APP1)·IPTC(APP13)·주석(COM)을 뺀 사본. 뺄 것이 없으면 null
function stripJpegMeta(b) {
  if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
  const keep = [b.subarray(0, 2)];
  let i = 2, removed = false;
  while (i + 4 <= b.length && b[i] === 0xFF) {
    const m = b[i + 1];
    if (m === 0xFF) { i++; continue; }   // 채움 바이트
    if (m === 0xDA) break;               // 영상 데이터부터는 그대로
    const end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
    if (m === 0xE1 || m === 0xED || m === 0xFE) removed = true;
    else keep.push(b.subarray(i, end));
    i = end;
  }
  if (!removed) return null;
  keep.push(b.subarray(i));
  return new Blob(keep, { type: 'image/jpeg' });
}
// PNG에서 eXIf·글 조각(tEXt·zTXt·iTXt)·시각(tIME)을 뺀 사본
function stripPngMeta(b) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((v, k) => b[k] !== v)) return null;
  const drop = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
  const keep = [b.subarray(0, 8)];
  let i = 8, removed = false;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (drop.has(type)) removed = true; else keep.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return removed ? new Blob(keep, { type: 'image/png' }) : null;
}
async function stripImageMeta(blob, ext) {
  const b = new Uint8Array(await blob.arrayBuffer());
  return ext === 'png' ? stripPngMeta(b) : stripJpegMeta(b);
}
// PDF 작성자 정보(Info의 Author·Creator·Producer, XMP) 지우기. 지운 것이 있으면 true
function stripPdfMeta(doc) {
  const N = k => PDFLib.PDFName.of(k);
  const info = doc.getInfoDict();
  let removed = false;
  for (const k of ['Author', 'Creator', 'Producer']) if (info.has(N(k))) { info.delete(N(k)); removed = true; }
  if (doc.catalog.has(N('Metadata'))) { doc.catalog.delete(N('Metadata')); removed = true; }
  return removed;
}

// 파일의 쪽을 하나씩 캔버스로 그려 onPage(canvas, 쪽 크기 pt, 쪽 번호, 쪽 수)에 넘긴다
async function forEachPage(file, p, ctx, prog, onPage) {
  const ext = extOf(file);
  if (ext === 'pdf') {
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        ctx.check();
        const page = await doc.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: p.dpi / 72 });
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(vp.width));
        c.height = Math.max(1, Math.round(vp.height));
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        if (p.gray) toGray(c);
        await onPage(c, { w: vp1.width, h: vp1.height }, i, doc.numPages);
        freeCanvas(c);
        page.cleanup();
        prog(i / doc.numPages);
      }
    } finally { doc.destroy(); }
    return;
  }
  const maxLong = Math.round(A4_LONG_IN * p.dpi);
  if (ext === 'tif' || ext === 'tiff') {
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    for (let i = 0; i < ifds.length; i++) {
      ctx.check();
      UTIF.decodeImage(buf, ifds[i]);
      const w = ifds[i].width, h = ifds[i].height;
      const rgba = UTIF.toRGBA8(ifds[i]);
      const src = document.createElement('canvas');
      src.width = w; src.height = h;
      src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0);
      const c = drawFit(src, w, h, maxLong, true);
      freeCanvas(src);   // 원본 크기 캔버스 메모리 바로 반납
      if (p.gray) toGray(c);
      await onPage(c, a4Pt(c.width, c.height), i + 1, ifds.length);
      freeCanvas(c);
      prog((i + 1) / ifds.length);
    }
    return;
  }
  const bmp = await openBitmap(file);
  const c = drawFit(bmp, bmp.width, bmp.height, maxLong, true);
  bmp.close?.();
  if (p.gray) toGray(c);
  await onPage(c, a4Pt(c.width, c.height), 1, 1);
  freeCanvas(c);
  prog(1);
}

// 낱장 JPG·PNG를 같은 형식으로 줄이기(PNG는 크기만 줄어듦)
async function shrinkImage(file, p, ctx, mime) {
  const bmp = await openBitmap(file);
  ctx.check();
  const jpeg = mime === 'image/jpeg';
  const c = drawFit(bmp, bmp.width, bmp.height, Math.round(A4_LONG_IN * p.dpi), jpeg);
  bmp.close?.();
  if (p.gray) toGray(c);
  const blob = await canvasToBlob(c, mime, jpeg ? p.q : undefined);
  freeCanvas(c);
  if (!blob || !blob.size) throw new Error('그림을 만들지 못했어요.');
  return blob;
}

// ── PDF 안의 그림만 다시 압축 ──
const pdfNum = x => (x && typeof x.asNumber === 'function' ? x.asNumber() : 0);

function pdfFilterNames(f) {
  if (!f) return [];
  if (f instanceof PDFLib.PDFArray) {
    const out = [];
    for (let i = 0; i < f.size(); i++) out.push(String(f.lookup(i)));
    return out;
  }
  return [String(f)];
}

// 색 성분 수: 회색 1, RGB 3. CMYK·Indexed 등 다루지 않는 것은 0
function pdfColorComponents(cs) {
  if (!cs) return 0;
  if (cs instanceof PDFLib.PDFArray) {
    const kind = String(cs.lookup(0));
    if (kind === '/ICCBased') return pdfNum(cs.lookup(1)?.dict?.lookup(PDFLib.PDFName.of('N')));
    if (kind === '/CalRGB') return 3;
    if (kind === '/CalGray') return 1;
    return 0;
  }
  const s = String(cs);
  return s === '/DeviceRGB' ? 3 : s === '/DeviceGray' ? 1 : 0;
}

// PNG 예측(Predictor 10~15)으로 저장된 줄 데이터를 원래 픽셀로 되돌림
function undoPngPredictor(data, bpp, columns) {
  const rowLen = bpp * columns;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = r * (rowLen + 1) + 1;
    const row = out.subarray(r * rowLen, (r + 1) * rowLen);
    for (let i = 0; i < rowLen; i++) {
      const x = data[src + i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      if (type === 0) v = x;
      else if (type === 1) v = x + a;
      else if (type === 2) v = x + b;
      else if (type === 3) v = x + ((a + b) >> 1);
      else if (type === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      row[i] = v & 255;
    }
    prev = row;
  }
  return out;
}

function pixelsToRgba(raw, w, h, n) {
  const px = w * h;
  const out = new Uint8ClampedArray(px * 4);
  for (let i = 0, k = 0, j = 0; i < px; i++, j += 4) {
    if (n === 3) { out[j] = raw[k]; out[j + 1] = raw[k + 1]; out[j + 2] = raw[k + 2]; k += 3; }
    else { out[j] = out[j + 1] = out[j + 2] = raw[k]; k += 1; }
    out[j + 3] = 255;
  }
  return out;
}

// 색 가짓수(limit에 닿으면 멈춤). 256가지 이하면 도표·로고로 본다
function countColors(rgba, limit) {
  const seen = new Set();
  for (let j = 0; j < rgba.length; j += 4) {
    seen.add((rgba[j] << 16) | (rgba[j + 1] << 8) | rgba[j + 2]);
    if (seen.size >= limit) break;
  }
  return seen.size;
}

// 그림 하나를 다시 압축. 바꿀 만하면 { dict, bytes }, 아니면 null
async function recompressPdfImage(o, capPx, q, gray) {
  const { PDFName, PDFArray, PDFDict, PDFNumber, decodePDFRawStream } = PDFLib;
  const N = k => PDFName.of(k);
  const d = o.dict;
  const get = k => d.lookup(N(k));
  if (String(get('ImageMask')) === 'true') return null;
  if (get('Decode') || get('Mask') instanceof PDFArray) return null;   // 색 뒤집기·색 키 투명은 JPEG로 옮기면 깨짐
  if (pdfNum(get('BitsPerComponent')) !== 8) return null;
  const W = pdfNum(get('Width')), H = pdfNum(get('Height'));
  if (!W || !H) return null;
  const n = pdfColorComponents(get('ColorSpace'));
  if (n !== 1 && n !== 3) return null;
  const filters = pdfFilterNames(get('Filter'));
  const parms = get('DecodeParms');
  let source;
  if (filters.length === 1 && filters[0] === '/DCTDecode') {
    if (parms instanceof PDFDict && parms.lookup(N('ColorTransform')) !== undefined) return null;
    source = await createImageBitmap(new Blob([o.getContents()], { type: 'image/jpeg' }), { colorSpaceConversion: 'none' });
    // 회전 정보가 든 JPEG처럼 크기가 안 맞으면 손대지 않음
    if (source.width !== W || source.height !== H) { source.close?.(); return null; }
  } else if (filters.length === 0 || (filters.length === 1 && filters[0] === '/FlateDecode')) {
    let raw = filters.length ? decodePDFRawStream(o).decode() : o.getContents();
    const pred = parms instanceof PDFDict ? pdfNum(parms.lookup(N('Predictor'))) : 0;
    if (pred >= 10) {
      raw = undoPngPredictor(raw, pdfNum(parms.lookup(N('Colors'))) || n, pdfNum(parms.lookup(N('Columns'))) || W);
    } else if (pred > 1) return null;   // TIFF 예측은 드물어서 건너뜀
    if (!raw || raw.length < W * H * n) return null;
    const rgba = pixelsToRgba(raw, W, H, n);
    if (countColors(rgba, 257) <= 256) return null;   // 색이 적은 도표·로고는 무손실 그대로
    source = document.createElement('canvas');
    source.width = W; source.height = H;
    source.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
  } else {
    return null;   // JBIG2·CCITT·JPX 등
  }
  const c = drawFit(source, W, H, capPx, true);
  if (source.close) source.close(); else freeCanvas(source);
  if (gray) toGray(c);
  const blob = await canvasToBlob(c, 'image/jpeg', q);
  const cw = c.width, ch = c.height;
  freeCanvas(c);
  if (!blob || !blob.size || blob.size > o.getContentsSize() * 0.9) return null;   // 10% 넘게 줄 때만 바꿈
  const nd = d.clone();
  nd.set(N('Filter'), N('DCTDecode'));
  nd.delete(N('DecodeParms'));
  nd.set(N('Width'), PDFNumber.of(cw));
  nd.set(N('Height'), PDFNumber.of(ch));
  nd.set(N('BitsPerComponent'), PDFNumber.of(8));
  if (n === 1) nd.set(N('ColorSpace'), N('DeviceRGB'));   // 캔버스는 컬러 JPEG로만 내보냄
  return { dict: nd, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

// 문서 안 그림을 모두 살펴 다시 압축(문서를 직접 고침)
async function recompressPdfImages(doc, p, ctx, prog) {
  const { PDFName, PDFRawStream, PDFRef } = PDFLib;
  const N = k => PDFName.of(k);
  let maxPt = 0;
  for (const pg of doc.getPages()) {
    const { width, height } = pg.getSize();
    maxPt = Math.max(maxPt, width, height);
    pg.node.delete(N('Thumb'));   // 쪽 미리보기 그림은 뷰어가 다시 만든다
  }
  // 그림 긴 변 상한: 가장 큰 쪽의 긴 변을 목표 해상도로 환산(스캔 PDF는 그림 = 쪽)
  const capPx = Math.max(200, Math.round(maxPt / 72 * p.dpi));
  const images = doc.context.enumerateIndirectObjects()
    .filter(([, o]) => o instanceof PDFRawStream && String(o.dict.lookup(N('Subtype'))) === '/Image');
  // 다른 그림의 투명 마스크로 쓰이는 회색 그림은 그대로 둔다
  const masks = new Set();
  for (const [, o] of images) {
    for (const k of ['SMask', 'Mask']) {
      const v = o.dict.get(N(k));
      if (v instanceof PDFRef) masks.add(v.toString());
    }
  }
  const capOver = Math.round(capPx * 1.2);
  const stats = { images: 0, changed: 0 };
  for (let i = 0; i < images.length; i++) {
    ctx.check();
    const [ref, o] = images[i];
    if (masks.has(ref.toString())) continue;
    stats.images++;
    try {
      // 상한을 조금 넘는 정도면 크기는 두고 화질만 조절
      const W = pdfNum(o.dict.lookup(N('Width'))), H = pdfNum(o.dict.lookup(N('Height')));
      const rep = await recompressPdfImage(o, Math.max(W, H) > capOver ? capPx : Infinity, p.q, p.gray);
      if (rep) {
        doc.context.assign(ref, PDFRawStream.of(rep.dict, rep.bytes));
        stats.changed++;
      }
    } catch (e) {
      if (e === CANCELLED) throw e;
      console.warn('[file-tools] 그림 다시 압축 실패', e);
    }
    prog((i + 1) / images.length);
  }
  prog(1);
  return stats;
}

const loadPdfLibDoc = async file => PDFLib.PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });

// 여러 파일(또는 쪽을 그림으로 바꾼 PDF 하나)로 PDF 만들기
async function pdfFromEntries(entries, p, raster, ctx, prog) {
  // PDF 하나는 그 문서를 그대로 고쳐 저장(책갈피·양식·링크 유지)
  if (entries.length === 1 && extOf(entries[0].file) === 'pdf' && !raster) {
    const doc = await loadPdfLibDoc(entries[0].file);
    const stats = await recompressPdfImages(doc, p, ctx, prog);
    if (p.strip) stats.stripped = stripPdfMeta(doc);
    ctx.check();
    return { bytes: await doc.save(), stats };
  }
  const out = await PDFLib.PDFDocument.create();
  const stats = { images: 0, changed: 0 };
  for (let i = 0; i < entries.length; i++) {
    const f = entries[i].file;
    const sub = x => prog((i + x) / entries.length);
    if (extOf(f) === 'pdf' && !raster) {
      const src = await loadPdfLibDoc(f);
      const st = await recompressPdfImages(src, p, ctx, sub);
      stats.images += st.images; stats.changed += st.changed;
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(pg => out.addPage(pg));
    } else {
      await forEachPage(f, p, ctx, sub, async (c, pt) => {
        const blob = await canvasToBlob(c, 'image/jpeg', p.q);
        if (!blob || !blob.size) throw new Error('그림을 만들지 못했어요.');
        const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        out.addPage([pt.w, pt.h]).drawImage(img, { x: 0, y: 0, width: pt.w, height: pt.h });
      });
    }
  }
  ctx.check();
  return { bytes: await out.save(), stats };
}

// ── 문서(PPTX·DOCX·XLSX·HWPX) 안의 그림 줄이기 ──
const EMU_PER_IN = 914400;     // OOXML 길이 단위
const HWPUNIT_PER_IN = 7200;   // 한글 길이 단위
const DOC_MEDIA_DIR = { pptx: 'ppt/media/', docx: 'word/media/', xlsx: 'xl/media/', hwpx: 'BinData/' };
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const parseXml = s => new DOMParser().parseFromString(s, 'application/xml');
const byLocal = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
const childByLocal = (el, name) => Array.from(el?.children || []).find(c => c.localName === name) || null;
const numAttr = (el, name) => +(el?.getAttribute(name) || 0);

// 문서 안 경로 합치기: base 폴더 기준 상대 경로(../ 포함), '/'로 시작하면 문서 맨 위 기준
function resolvePart(baseDir, target) {
  const parts = (target.startsWith('/') ? target.slice(1) : baseDir + target).split('/');
  const out = [];
  for (const s of parts) {
    if (s === '..') out.pop();
    else if (s && s !== '.') out.push(s);
  }
  return out.join('/');
}
const dirOf = path => path.slice(0, path.lastIndexOf('/') + 1);

// 파트의 관계 파일(_rels/이름.rels): Id → 문서 안 경로
async function readRels(zip, partPath) {
  const relsPath = dirOf(partPath) + '_rels/' + partPath.slice(partPath.lastIndexOf('/') + 1) + '.rels';
  const f = zip.file(relsPath);
  const map = new Map();
  if (!f) return map;
  for (const r of byLocal(parseXml(await f.async('text')), 'Relationship')) {
    if (r.getAttribute('TargetMode') === 'External') continue;
    map.set(r.getAttribute('Id'), resolvePart(dirOf(partPath), r.getAttribute('Target') || ''));
  }
  return map;
}

// 잘라 쓴 그림(a:srcRect, 1/100000 단위)이면 보이는 비율만큼 그림 전체 크기를 키워 계산
function cropScale(blipFill) {
  const r = childByLocal(blipFill, 'srcRect');
  if (!r) return { w: 1, h: 1 };
  const v = k => numAttr(r, k) / 100000;
  return { w: Math.max(0.05, 1 - v('l') - v('r')), h: Math.max(0.05, 1 - v('t') - v('b')) };
}

// OOXML: a:blip마다 그려진 크기(인치)를 찾아 uses(경로 → [{wIn, hIn}])에 모은다
async function collectOoxmlUses(zip, kind, uses, fallbackIn) {
  const partRe = {
    pptx: /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/,
    docx: /^word\/(document|header\d*|footer\d*)\.xml$/,
    xlsx: /^xl\/drawings\/[^/]+\.xml$/,
  }[kind];
  for (const path of Object.keys(zip.files).filter(n => partRe.test(n))) {
    const doc = parseXml(await zip.file(path).async('text'));
    const rels = await readRels(zip, path);
    for (const blip of byLocal(doc, 'blip')) {
      const target = rels.get(blip.getAttributeNS(NS_R, 'embed') || blip.getAttribute('r:embed') || '');
      if (!target) continue;
      const fill = blip.parentElement;
      const crop = cropScale(fill);
      let cx = 0, cy = 0;
      if (kind === 'docx') {
        let a = fill;
        while (a && a.localName !== 'inline' && a.localName !== 'anchor') a = a.parentElement;
        const ext = childByLocal(a, 'extent');
        cx = numAttr(ext, 'cx'); cy = numAttr(ext, 'cy');
      } else {
        const owner = fill?.parentElement;   // p:pic·p:sp·xdr:pic, 배경이면 p:bgPr
        const ext = childByLocal(childByLocal(childByLocal(owner, 'spPr'), 'xfrm'), 'ext');
        cx = numAttr(ext, 'cx'); cy = numAttr(ext, 'cy');
        // XLSX는 크기를 앵커(xdr:oneCellAnchor·absoluteAnchor)의 xdr:ext에 두기도 함
        if (kind === 'xlsx' && !(cx && cy)) {
          let a = owner;
          while (a && !/^(oneCellAnchor|absoluteAnchor)$/.test(a.localName)) a = a.parentElement;
          const ax = childByLocal(a, 'ext');
          cx = numAttr(ax, 'cx'); cy = numAttr(ax, 'cy');
        }
      }
      const use = cx && cy
        ? { wIn: cx / EMU_PER_IN / crop.w, hIn: cy / EMU_PER_IN / crop.h }
        : { wIn: fallbackIn.w, hIn: fallbackIn.h };   // 배경 등 크기를 못 찾으면 쪽 전체로
      (uses.get(target) || uses.set(target, []).get(target)).push(use);
    }
  }
}

// HWPX: hp:pic의 hc:img(binaryItemIDRef) → content.hpf의 경로, 크기는 hp:curSz(없으면 hp:sz)
async function collectHwpxUses(zip, uses) {
  const hpf = zip.file('Contents/content.hpf');
  const idToPath = new Map();
  if (hpf) {
    for (const it of byLocal(parseXml(await hpf.async('text')), 'item')) {
      if (it.getAttribute('href')) idToPath.set(it.getAttribute('id'), resolvePart('', it.getAttribute('href')));
    }
  }
  for (const path of Object.keys(zip.files).filter(n => /^Contents\/section\d+\.xml$/.test(n))) {
    const doc = parseXml(await zip.file(path).async('text'));
    for (const pic of byLocal(doc, 'pic')) {
      const img = childByLocal(pic, 'img');
      const target = idToPath.get(img?.getAttribute('binaryItemIDRef'));
      if (!target) continue;
      let sz = childByLocal(pic, 'curSz');
      if (!numAttr(sz, 'width')) sz = childByLocal(pic, 'sz');
      const w = numAttr(sz, 'width'), h = numAttr(sz, 'height');
      if (!w || !h) continue;
      const clip = childByLocal(pic, 'imgClip'), dim = childByLocal(pic, 'imgDim');
      const dw = numAttr(dim, 'dimwidth'), dh = numAttr(dim, 'dimheight');
      const fw = clip && dw ? Math.max(0.05, (numAttr(clip, 'right') - numAttr(clip, 'left')) / dw) : 1;
      const fh = clip && dh ? Math.max(0.05, (numAttr(clip, 'bottom') - numAttr(clip, 'top')) / dh) : 1;
      (uses.get(target) || uses.set(target, []).get(target)).push({ wIn: w / HWPUNIT_PER_IN / fw, hIn: h / HWPUNIT_PER_IN / fh });
    }
  }
}

// JPEG의 EXIF 회전 값(없으면 0)
function jpegOrientation(b) {
  if (b[0] !== 0xFF || b[1] !== 0xD8) return 0;
  let i = 2;
  while (i + 10 < b.length && b[i] === 0xFF) {
    const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xDA) return 0;
    if (marker === 0xE1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      const t = i + 10, le = b[t] === 0x49;
      const r16 = o => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const r32 = o => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0;
      const ifd = t + r32(t + 4);
      if (ifd + 2 > b.length) return 0;
      for (let k = 0, n = r16(ifd); k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 10 > b.length) return 0;
        if (r16(e) === 0x0112) return r16(e + 8);
      }
      return 0;
    }
    i += 2 + len;
  }
  return 0;
}

// 문서를 한 번 열어 그림 목록·쓰임을 정리(시도마다 다시 쓰도록 작업에 보관)
async function prepareDoc(file) {
  const kind = extOf(file);
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  // 쓰임을 못 찾은 그림의 상한: 슬라이드 크기(PPTX) 또는 A4
  let fallbackIn = { w: 8.27, h: A4_LONG_IN };
  if (kind === 'pptx' && zip.file('ppt/presentation.xml')) {
    const sz = byLocal(parseXml(await zip.file('ppt/presentation.xml').async('text')), 'sldSz')[0];
    if (numAttr(sz, 'cx') && numAttr(sz, 'cy')) fallbackIn = { w: numAttr(sz, 'cx') / EMU_PER_IN, h: numAttr(sz, 'cy') / EMU_PER_IN };
  }
  const uses = new Map();
  try {
    if (kind === 'hwpx') await collectHwpxUses(zip, uses);
    else await collectOoxmlUses(zip, kind, uses, fallbackIn);
  } catch (e) {
    console.warn('[file-tools] 그림 쓰임을 다 찾지 못했어요', e);   // 못 찾은 그림은 상한으로만 줄인다
  }
  const dir = DOC_MEDIA_DIR[kind];
  const media = [];
  const byHash = new Map();
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith(dir) || zip.files[name].dir) continue;
    const ext = name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) continue;   // 영상·벡터(emf·svg) 등은 손대지 않음
    const blob = await zip.file(name).async('blob');
    const hash = await hashBlob(blob);
    const item = { name, ext, blob, uses: (uses.get(name) || []).slice(), dupOf: null, kind: null };
    if (hash && byHash.has(hash)) {
      item.dupOf = byHash.get(hash);
      item.dupOf.uses.push(...item.uses);   // 같은 그림은 가장 크게 그려진 곳 기준
    } else if (hash) byHash.set(hash, item);
    media.push(item);
  }
  // 원래 무압축이던 항목(HWPX mimetype 등)은 다시 묶을 때도 무압축
  const stored = Object.keys(zip.files).filter(n => zip.files[n]._data?.compression?.magic === '\x00\x00');
  if (kind === 'hwpx' && zip.file('mimetype') && !stored.includes('mimetype')) stored.push('mimetype');
  return { kind, buf, media, fallbackIn, stored };
}

// PNG가 사진인지(색이 많고 투명하지 않음) 표본으로 판단
function classifyPng(bmp) {
  const s = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;   // 섞인 색이 새로 생기지 않게 가장 가까운 픽셀로
  g.drawImage(bmp, 0, 0, c.width, c.height);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  freeCanvas(c);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return 'alpha';
  return countColors(data, 257) > 256 ? 'photo' : 'graphic';
}

// 그림 하나 줄이기. 바꿀 만하면 { blob, ext }, 아니면 null
async function shrinkDocImage(m, prep, p) {
  if (m.ext !== 'png') {
    const head = new Uint8Array(await m.blob.slice(0, 65536).arrayBuffer());
    if (jpegOrientation(head) > 1) return null;   // 회전 처리가 프로그램마다 달라 건너뜀
  }
  const bmp = await createImageBitmap(m.blob);
  try {
    const W = bmp.width, H = bmp.height;
    // 필요한 배율: 그려진 곳 중 가장 큰 곳 기준. 쓰임을 못 찾으면 쪽 전체 기준
    const uses = m.uses.length ? m.uses : [prep.fallbackIn.w >= prep.fallbackIn.h
      ? { wIn: prep.fallbackIn.w, hIn: prep.fallbackIn.w * H / W }
      : { wIn: prep.fallbackIn.h * W / H, hIn: prep.fallbackIn.h }];
    const need = Math.max(...uses.map(u => Math.max(u.wIn * p.dpi / W, u.hIn * p.dpi / H)));
    const resize = need < 1 / 1.2;   // 1.2배 넘게 클 때만 크기를 줄임
    const cw = resize ? Math.max(1, Math.round(W * need)) : W;
    const ch = resize ? Math.max(1, Math.round(H * need)) : H;
    let mime = 'image/jpeg';
    if (m.ext === 'png') {
      if (!m.kind) m.kind = classifyPng(bmp);
      if (m.kind !== 'photo') {
        if (!resize) return null;   // 도표·투명 그림은 PNG 그대로, 크기를 줄일 때만 다시 만듦
        mime = 'image/png';
      }
    }
    const c = drawScaled(bmp, cw, ch, mime === 'image/jpeg');
    const blob = await canvasToBlob(c, mime, mime === 'image/jpeg' ? p.q : undefined);
    freeCanvas(c);
    if (!blob || !blob.size || blob.size > m.blob.size * 0.9) return null;   // 10% 넘게 줄 때만
    return { blob, ext: mime === 'image/png' ? 'png' : (m.ext === 'png' ? 'jpg' : m.ext) };
  } finally {
    bmp.close?.();
  }
}

// JPEG로 바뀐 PNG의 새 이름(같은 이름이 있으면 _2, _3…)
function renamedPath(zip, name, ext, taken) {
  const base = name.replace(/\.[^.]+$/, '');
  for (let i = 1; ; i++) {
    const cand = `${base}${i > 1 ? '_' + i : ''}.${ext}`;
    if (!zip.file(cand) && !taken.has(cand)) return cand;
  }
}

// 바뀐 그림 이름을 참조하는 곳 고치기
async function applyRenames(zip, kind, renames) {
  if (!renames.size) return;
  const baseName = p => p.slice(p.lastIndexOf('/') + 1);
  if (kind === 'hwpx') {
    for (const path of ['Contents/content.hpf', 'META-INF/manifest.xml']) {
      const f = zip.file(path);
      if (!f) continue;
      let s = await f.async('text');
      for (const [from, to] of renames) {
        s = s.split(`"${from}"`).join(`"${to}"`);
        // content.hpf의 그림 형식 표시도 맞춤
        s = s.replace(new RegExp(`(href="${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*media-type=")image/png(")`), '$1image/jpg$2');
      }
      zip.file(path, s, { createFolders: false });
    }
    return;
  }
  // OOXML: 모든 관계 파일의 Target, [Content_Types].xml의 Override·Default
  for (const relsPath of Object.keys(zip.files).filter(n => n.endsWith('.rels'))) {
    const s = await zip.file(relsPath).async('text');
    const partDir = dirOf(relsPath).replace(/_rels\/$/, '');   // ppt/slides/_rels/x.rels → ppt/slides/, _rels/.rels → ''
    let changed = false;
    const out = s.replace(/(<Relationship\b[^>]*?\bTarget=")([^"]+)(")/g, (all, a, target, b) => {
      if (/TargetMode="External"/.test(all)) return all;
      const to = renames.get(resolvePart(partDir, target));
      if (!to) return all;
      changed = true;
      return a + target.slice(0, target.length - baseName(target).length) + baseName(to) + b;
    });
    if (changed) zip.file(relsPath, out, { createFolders: false });
  }
  const ct = zip.file('[Content_Types].xml');
  if (ct) {
    let s = await ct.async('text');
    for (const [from, to] of renames) s = s.split(`PartName="/${from}"`).join(`PartName="/${to}"`);
    if (!/<Default\b[^>]*Extension="jpg"/i.test(s)) s = s.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
    zip.file('[Content_Types].xml', s, { createFolders: false });
  }
}

// 문서 속성에서 작성자·마지막 저장한 사람·회사·관리자 지우기. 지운 것이 있으면 true
async function stripDocProps(zip, kind) {
  const targets = kind === 'hwpx'
    ? [['Contents/content.hpf', /(<opf:meta\b[^>]*\bname="(?:creator|lastsaveby)"[^>]*>)[^<]+(<\/opf:meta>)/g]]
    : [['docProps/core.xml', /(<(dc:creator|cp:lastModifiedBy)\b[^>]*>)[^<]+(<\/\2>)/g],
       ['docProps/app.xml', /(<(Company|Manager)\b[^>]*>)[^<]+(<\/\2>)/g]];
  let changed = false;
  for (const [path, re] of targets) {
    const f = zip.file(path);
    if (!f) continue;
    const s = await f.async('text');
    const out = s.replace(re, (all, open, ...rest) => open + rest.find(x => typeof x === 'string' && x.startsWith('</')));
    if (out !== s) { zip.file(path, out, { createFolders: false }); changed = true; }
  }
  return changed;
}

// 정한 설정 p로 문서 하나 다시 만들기(시도마다 원본에서 새로 시작)
async function buildDocOutput(job, p, ctx, prog) {
  const file = job.entries[0].file;
  if (!job.prep) job.prep = await prepareDoc(file);
  const prep = job.prep;
  ctx.check();
  const uniques = prep.media.filter(m => !m.dupOf);
  const results = new Map();   // name → { blob, ext }
  let done = 0;
  await mapLimit(uniques, 3, async (m) => {
    ctx.check();
    try {
      const r = await shrinkDocImage(m, prep, p);
      if (r) results.set(m.name, r);
    } catch (e) {
      if (e === CANCELLED) throw e;
      console.warn('[file-tools] 그림 줄이기 실패', m.name, e);
    }
    prog(0.85 * (++done / Math.max(1, uniques.length)));
  });
  for (const m of prep.media) if (m.dupOf && results.has(m.dupOf.name)) results.set(m.name, results.get(m.dupOf.name));
  ctx.check();

  const zip = await JSZip.loadAsync(prep.buf);
  const renames = new Map();
  const taken = new Set();
  for (const [name, r] of results) {
    if (r.ext === name.split('.').pop().toLowerCase()) { zip.file(name, r.blob, { createFolders: false }); continue; }
    const to = renamedPath(zip, name, r.ext, taken);
    taken.add(to);
    renames.set(name, to);
    zip.remove(name);
    zip.file(to, r.blob, { createFolders: false });   // 원본에 없던 폴더 항목을 만들지 않게
  }
  await applyRenames(zip, prep.kind, renames);
  let stripped = false;
  if (p.strip) {
    stripped = await stripDocProps(zip, prep.kind);
    // 그대로 둔 그림의 EXIF도 지움(다시 그린 그림은 이미 빠짐)
    const plain = new Map();
    for (const m of prep.media) {
      if (results.has(m.name)) continue;
      const src = m.dupOf || m;
      if (!plain.has(src.name)) plain.set(src.name, await stripImageMeta(src.blob, src.ext));
      const b = plain.get(src.name);
      if (b) { zip.file(m.name, b, { createFolders: false }); stripped = true; }
    }
  }
  for (const n of prep.stored) {
    const f = zip.file(n);
    if (f) zip.file(n, await f.async('uint8array'), { compression: 'STORE', createFolders: false });
  }
  prog(0.9);
  const blob = await zip.generateAsync({
    type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: file.type || undefined,
  });
  prog(1);
  const images = uniques.length;
  const changed = uniques.filter(m => results.has(m.name)).length;
  return {
    blob, name: `${stemOf(file)}_compressed.${extOf(file)}`, same: true, stripped,
    note: images ? `그림 ${images}개 중 ${changed}개를 줄였어요. 글자와 서식은 그대로예요.` : '이 문서에는 줄일 그림이 없어요.',
  };
}

// 같은 이름이 겹치면 (2), (3)을 붙임
function uniqueNames(items) {
  const used = new Map();
  return items.map(it => {
    const k = it.name.toLowerCase();
    const n = (used.get(k) || 0) + 1;
    used.set(k, n);
    return n === 1 ? it : { ...it, name: it.name.replace(/(\.[^.]+)?$/, m => ` (${n})${m}`) };
  });
}

// 정한 설정 p로 결과 파일 하나 만들기. same: 원본과 같은 형식(줄지 않으면 원본을 그대로 씀)
async function buildScanOutput(job, fmt, p, raster, ctx, base, span) {
  const prog = f => ctx.progress(base + span * Math.min(1, f));
  const entries = job.entries;
  const first = entries[0].file;
  const ext = extOf(first);
  const stem = stemOf(first) + (entries.length > 1 ? `_외${entries.length - 1}개` : '');

  if (isDocFile(first)) return buildDocOutput(job, p, ctx, prog);

  if (fmt === 'jpg') {
    const shots = [];
    for (let i = 0; i < entries.length; i++) {
      const f = entries[i].file;
      await forEachPage(f, p, ctx, x => prog((i + x) / entries.length), async (c, pt, idx, total) => {
        const blob = await canvasToBlob(c, 'image/jpeg', p.q);
        if (!blob || !blob.size) throw new Error('그림을 만들지 못했어요.');
        shots.push({ blob, name: `${stemOf(f)}${total > 1 ? '_p' + idx : ''}.jpg` });
      });
    }
    if (shots.length === 1) return { blob: shots[0].blob, name: stem + '_compressed.jpg', same: ext === 'jpg' || ext === 'jpeg' };
    const zip = new JSZip();
    uniqueNames(shots).forEach(s => zip.file(s.name, s.blob));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    return { blob, name: stem + '_compressed.zip', same: false, note: `그림 ${shots.length}장을 ZIP 파일 하나로 묶었어요.` };
  }

  if (fmt === 'keep' && entries.length === 1 && ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext)) {
    const blob = await shrinkImage(first, p, ctx, ext === 'png' ? 'image/png' : 'image/jpeg');
    prog(1);
    if (isHeic(first)) return { blob, name: `${stemOf(first)}_compressed.jpg`, same: false, note: '아이폰 사진(HEIC)을 JPG로 바꿨어요.' };
    return { blob, name: `${stemOf(first)}_compressed.${ext}`, same: true };
  }

  const { bytes, stats } = await pdfFromEntries(entries, p, raster, ctx, prog);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const same = entries.length === 1 && ext === 'pdf';
  let note = '';
  if (raster) note = '쪽을 그림으로 바꿨어요. 글자를 검색하거나 복사할 수는 없어요.';
  else if (entries.length > 1) note = `파일 ${entries.length}개를 PDF 하나로 합쳤어요.`;
  else if (same) note = stats.images ? `그림 ${stats.images}개 중 ${stats.changed}개를 줄였어요. 글자는 그대로예요.` : '이 PDF에는 줄일 그림이 없어요.';
  else if (isTif(first)) note = '브라우저에서는 TIFF로 저장할 수 없어서 PDF로 만들었어요.';
  return { blob, name: stem + '_compressed.pdf', same, note, stripped: !!stats.stripped };
}

function libsForScanJob(job, fmt, raster) {
  if (isDocFile(job.entries[0].file)) return ['jszip'];
  const hasPdf = job.entries.some(e => extOf(e.file) === 'pdf');
  const need = [];
  if (fmt === 'jpg') need.push('jszip'); else need.push('pdflib');
  if (hasPdf && (raster || fmt === 'jpg')) need.push('pdfjs');
  if (job.entries.some(e => isTif(e.file))) need.push('utif');
  return need;
}

async function runScanJob(job, ctx) {
  const { level, format, targetMB } = scanState;
  const raster = scanState.raster.has(job.id);
  const isDoc = isDocFile(job.entries[0].file);
  const extra = { strip: scanState.strip, gray: scanState.gray && !isDoc };   // 회색은 PDF·그림에만
  const origSize = job.entries.reduce((n, e) => n + e.file.size, 0);
  await loadLibs(libsForScanJob(job, format, raster));
  ctx.check();

  let out, params, reached = null;
  if (level !== 'target') {
    params = { ...SCAN_PRESETS[level], ...extra };
    out = await buildScanOutput(job, format, params, raster, ctx, 0, 1);
  } else {
    const targetBytes = targetMB * 1024 * 1024;
    const onlyPng = format === 'keep' && job.entries.length === 1 && extOf(job.entries[0].file) === 'png';
    const ladder = buildLadder([72, 100, 130, 150, 180, 220, 260, 300], [0.4, 0.55, 0.7, 0.85], onlyPng)
      .map(a => ({ dpi: a.w, q: a.q, ...extra }));
    const outs = new Map();
    const found = await searchBestUnderTarget(ladder, targetBytes, async (pp, n, max) => {
      const o = await buildScanOutput(job, format, pp, raster, ctx, (n - 1) / max, 1 / max);
      outs.set(o.blob, o);
      return o.blob;
    });
    out = outs.get(found.blob);
    params = found.params;
    reached = found.reached;
  }

  // 같은 형식인데 줄지 않았으면 원본을 그대로 쓴다. 개인정보 지우기를 켰으면 지운 사본
  if (out.same && out.blob.size >= origSize) {
    const f = job.entries[0].file;
    let clean = null;
    if (scanState.strip && out.stripped) clean = { blob: out.blob, note: (out.note ? out.note + ' ' : '') + '작성자 정보를 지웠어요.' };
    else if (scanState.strip && ['jpg', 'jpeg', 'png'].includes(extOf(f))) {
      const b = await stripImageMeta(f, extOf(f) === 'png' ? 'png' : 'jpg');
      if (b) clean = { blob: b, note: '화질은 그대로 두고 사진 속 위치·기기 정보를 지웠어요.' };
    }
    if (clean) {
      return {
        blob: clean.blob, name: out.name, size: clean.blob.size, origSize, kept: false, privacyOnly: true, params, note: clean.note,
        reached: reached === null ? null : clean.blob.size <= targetMB * 1024 * 1024,
      };
    }
    return {
      blob: f, name: f.name, size: f.size, origSize, kept: true, params, note: out.note,
      reached: reached === null ? null : f.size <= targetMB * 1024 * 1024,
    };
  }
  return { blob: out.blob, name: out.name, size: out.blob.size, origSize, kept: false, params, note: out.note, reached };
}

// 쪽 정리(빼기·돌리기)를 줄인 PDF에 적용. 정리할 것이 없거나 PDF가 아니면 그대로
async function applyPageEdits(job, base) {
  const ed = scanState.edits.get(job.id);
  if (!ed || (!ed.removed.size && !ed.rot.size) || !/\.pdf$/i.test(base.name)) return base;
  await loadLib('pdflib');
  const src = await PDFLib.PDFDocument.load(await base.blob.arrayBuffer(), { updateMetadata: false });
  const n = src.getPageCount();
  const keep = src.getPageIndices().filter(i => !ed.removed.has(i));
  if (!keep.length) return base;
  // 남길 쪽만 새 문서로 옮겨야 뺀 쪽의 그림까지 빠져 용량이 준다
  const out = await PDFLib.PDFDocument.create({ updateMetadata: false });
  const title = src.getTitle();
  if (title) out.setTitle(title);
  const pages = await out.copyPages(src, keep);
  let rotated = 0;
  pages.forEach((pg, k) => {
    const r = ed.rot.get(keep[k]) || 0;
    if (r) { pg.setRotation(PDFLib.degrees((pg.getRotation().angle + r) % 360)); rotated++; }
    out.addPage(pg);
  });
  const blob = new Blob([await out.save()], { type: 'application/pdf' });
  const parts = [];
  if (n - keep.length) parts.push(`${n}쪽 중 ${n - keep.length}쪽 뺌`);
  if (rotated) parts.push(`${rotated}쪽 회전`);
  return {
    ...base, blob, size: blob.size, kept: false, privacyOnly: false, edited: parts.join('·'),
    name: base.kept ? `${stemOf({ name: base.name })}_compressed.pdf` : base.name,
  };
}

function friendlyScanError(e) {
  const m = String(e?.message || e || '');
  if (e?.name === 'PasswordException') return '열기 암호가 걸린 PDF는 줄일 수 없어요.';
  if (/encrypt/i.test(m) || e?.name === 'EncryptedPDFError') return '암호가 걸린 PDF예요. 아래 버튼으로 쪽을 그림으로 바꿔 줄일 수 있어요.';
  if (/불러오지 못했어요|만들지 못했어요/.test(m)) return m;
  return '파일을 열 수 없어요. 파일이 손상되었거나 지원하지 않는 형식일 수 있어요.';
}

// 기다리는 작업을 하나씩 차례로 처리
async function pumpScan() {
  if (scanState.running) return;
  scanState.running = true;
  try {
    for (;;) {
      const job = scanState.jobs.find(j => j.status === 'wait');
      if (!job) break;
      job.status = 'run'; job.pct = 0;
      renderScanJobs();
      const alive = () => scanState.jobs.includes(job);
      const ctx = {
        check() { if (!alive()) throw CANCELLED; },
        progress(f) { if (alive()) { job.pct = f; paintScanProgress(job); } },
      };
      try {
        job.base = await runScanJob(job, ctx);
        job.result = await applyPageEdits(job, job.base);
        job.status = 'done';
      } catch (e) {
        if (e === CANCELLED || !alive()) continue;
        console.error(e);
        job.status = 'error';
        job.error = friendlyScanError(e);
      }
      job.prep = null;   // 문서 원본 메모리 반납
      if (alive()) renderScanJobs();
    }
  } finally {
    scanState.running = false;
    renderScanJobs();
  }
}

// 파일 목록·설정에서 작업 목록을 다시 만든다. resetAll: 끝난 결과도 모두 다시
function rebuildScanJobs(resetAll) {
  const old = new Map(scanState.jobs.map(j => [j.id, j]));
  const keep = e => isHwp(e.file)
    ? { ...newScanJob(e.id, [e]), status: 'hwp' }
    : (!resetAll && old.get(e.id)) || newScanJob(e.id, [e]);
  if (mergeActive()) {
    // 합치기는 PDF·그림만. 문서·HWP 파일은 따로
    scanState.jobs = [newScanJob('merge', pageEntries()), ...scanState.files.filter(e => isDocFile(e.file) || isHwp(e.file)).map(keep)];
  } else {
    scanState.jobs = scanState.files.map(keep);
  }
  renderScanJobs();
  pumpScan();
}

function addScanFiles(files) {
  const ok = files.filter(f => isSupported(f) || isHwp(f));
  reportSkipped(files.filter(f => !ok.includes(f)), '');
  if (!ok.length) return;
  ok.forEach(file => scanState.files.push({ id: 'f' + (++_scanSeq), file }));
  if (ok.some(f => !isDocFile(f) && !isHwp(f))) scanState.edits.delete('merge');   // 합치는 쪽이 바뀜
  rebuildScanJobs(false);
}

function removeScanFile(fileId) {
  const e = scanState.files.find(x => x.id === fileId);
  scanState.files = scanState.files.filter(x => x.id !== fileId);
  scanState.raster.delete(fileId);
  scanState.edits.delete(fileId);
  if (e && !isDocFile(e.file) && !isHwp(e.file)) scanState.edits.delete('merge');
  rebuildScanJobs(false);
}

function resetScanJob(id) {
  const i = scanState.jobs.findIndex(j => j.id === id);
  if (i < 0) return;
  scanState.jobs[i] = newScanJob(id, scanState.jobs[i].entries);   // 새 객체로 바꿔 하던 일은 버림
  renderScanJobs();
  pumpScan();
}

function clearScan() {
  scanState.files = [];
  scanState.jobs = [];
  scanState.raster.clear();
  scanState.edits.clear();
  renderScanJobs();
}

// ── 화면 ──
function scanJobRowHtml(j) {
  const merged = j.id === 'merge';
  const orig = j.entries.reduce((n, e) => n + e.file.size, 0);
  const title = merged ? `PDF 하나로 합치기 · 파일 ${j.entries.length}개` : j.entries[0].file.name;
  const isDoc = !merged && isDocFile(j.entries[0].file);
  const canRaster = scanState.format !== 'jpg' && j.entries.some(e => extOf(e.file) === 'pdf');
  const raster = scanState.raster.has(j.id);
  let cls = '', meta = '', notes = [], link = '';

  if (j.status === 'hwp') {
    return `<div class="job is-info" data-id="${j.id}">
    <div class="job-main">
      <div class="job-name">${escHtml(title)}</div>
      <div class="job-meta">${fmtBytes(orig)} · 옛 한글 형식(HWP)은 바로 줄일 수 없어요</div>
      <ol class="job-steps">
        <li>한글에서 이 파일을 열어요.</li>
        <li><b>파일</b> → <b>다른 이름으로 저장하기</b>를 눌러요.</li>
        <li><b>파일 형식</b>에서 <b>HWPX 문서 (*.hwpx)</b>를 골라 저장해요.</li>
        <li>저장한 HWPX 파일을 여기에 넣으면 줄여 드려요.</li>
      </ol>
    </div>
    <div class="job-acts"><button type="button" class="file-list-remove" data-act="remove-file" data-file="${j.entries[0].id}" aria-label="${escHtml(title)} 빼기" title="빼기">${ic('x')}</button></div>
  </div>`;
  }
  if (j.status === 'wait') meta = `${fmtBytes(orig)} · 기다리는 중`;
  else if (j.status === 'run') meta = `${fmtBytes(orig)} · 줄이는 중 <span class="job-pct">${Math.round(j.pct * 100)}%</span>`;
  else if (j.status === 'error') {
    cls = 'is-error';
    meta = `${fmtBytes(orig)} · 만들지 못했어요`;
    notes.push(escHtml(j.error));
  } else {
    const r = j.result;
    const pct = Math.round((1 - r.size / r.origSize) * 100);
    const grew = r.size > r.origSize;
    cls = 'is-done';
    if (r.kept) meta = `${fmtBytes(orig)} · 원본 그대로`;
    else meta = `${fmtBytes(orig)} → <strong>${fmtBytes(r.size)}</strong> <span class="job-badge${grew ? ' up' : ''}">${grew ? `${-pct}% 커짐` : `${pct}% 줄어듦`}</span>`;
    if (r.note) notes.push(escHtml(r.note));
    if (r.edited) notes.push(escHtml(`쪽 정리: ${r.edited}.`));
    if (r.kept) notes.push('더 줄어들지 않아서 원본을 그대로 둬요. 저장하면 원본을 받아요.');
    if (grew && r.privacyOnly) notes.push('정보를 지우며 다시 묶느라 크기가 조금 달라졌어요.');
    else if (grew) { cls = 'is-warn'; notes.push('형식을 바꾸면서 원본보다 커졌어요.'); }
    if (r.reached === false) {
      cls = 'is-warn';
      notes.push(`가장 작게 해도 목표 용량(${fmtBytes(scanState.targetMB * 1024 * 1024)})보다 커요.`);
      if (isDoc) notes.push('영상·소리·글꼴처럼 그림이 아닌 내용은 줄일 수 없어요.');
    }
  }
  if (canRaster && (j.status === 'done' || j.status === 'error')) {
    if (raster) link = `<button type="button" class="job-link" data-act="unraster">글자를 살리는 원래 방식으로 되돌리기</button>`;
    // 작은 글자 PDF는 그림으로 바꾸면 커지기만 하므로 500KB 이상일 때만 권함
    else if (j.status === 'error' || (orig >= 500 * 1024 && (j.result.kept || j.result.reached === false || (j.result.origSize - j.result.size) < j.result.origSize * 0.2))) {
      link = `<button type="button" class="job-link" data-act="raster">쪽을 그림으로 바꿔 더 줄이기</button>`;
    }
  }
  // 쪽 정리: 결과가 PDF일 때
  if (j.status === 'done' && /\.pdf$/i.test(j.base?.name || '')) {
    link = `<button type="button" class="job-link" data-act="pages">${ic('layout-grid')} 쪽 정리</button>` + link;
  }
  if (link) link = `<div class="job-links">${link}</div>`;
  const files = merged
    ? `<ul class="job-files">${j.entries.map(e => `<li><span>${escHtml(e.file.name)}</span><button type="button" class="file-list-remove" data-act="remove-file" data-file="${e.id}" aria-label="${escHtml(e.file.name)} 빼기" title="빼기">${ic('x')}</button></li>`).join('')}</ul>`
    : '';
  const bar = j.status === 'run'
    ? `<div class="job-bar" role="progressbar" aria-label="${escHtml(title)} 줄이는 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(j.pct * 100)}"><div style="width:${Math.round(j.pct * 100)}%"></div></div>`
    : '';
  const save = j.status === 'done'
    ? `<button type="button" class="job-btn primary" data-act="save" aria-label="${escHtml(j.result.name)} 저장">${ic('download')} 저장</button>`
    : '';
  const remove = merged
    ? ''
    : `<button type="button" class="file-list-remove" data-act="remove-file" data-file="${j.entries[0].id}" aria-label="${escHtml(title)} 빼기" title="빼기">${ic('x')}</button>`;
  return `<div class="job ${cls}" data-id="${j.id}">
    <div class="job-main">
      <div class="job-name">${escHtml(title)}</div>
      <div class="job-meta">${meta}</div>
      ${bar}
      ${notes.length ? `<div class="job-note">${notes.join(' ')}</div>` : ''}
      ${link}
      ${files}
    </div>
    <div class="job-acts">${save}${remove}</div>
  </div>`;
}

function paintScanProgress(job) {
  const row = document.querySelector(`#scanJobs .job[data-id="${job.id}"]`);
  if (!row) return;
  const v = Math.round(job.pct * 100);
  const pctEl = row.querySelector('.job-pct');
  if (pctEl) pctEl.textContent = v + '%';
  const bar = row.querySelector('.job-bar');
  if (bar) { bar.setAttribute('aria-valuenow', String(v)); bar.firstElementChild.style.width = v + '%'; }
}

let _scanSummaryText = '';
function renderScanJobs() {
  document.getElementById('scanJobs').innerHTML = scanState.jobs.map(scanJobRowHtml).join('');
  const jobs = scanState.jobs.filter(j => j.status !== 'hwp');
  document.getElementById('scanActions').hidden = !scanState.jobs.length;
  const done = jobs.filter(j => j.status === 'done');
  const busy = jobs.some(j => j.status === 'wait' || j.status === 'run');
  const saveAll = document.getElementById('scanSaveAll');
  saveAll.disabled = busy || !done.length;
  saveAll.innerHTML = `${ic('download')} ${done.length > 1 ? '모두 저장 (ZIP)' : '저장'}`;

  let text = '';
  if (busy) text = `${jobs.length}개 중 ${done.length}개 끝남 · 줄이는 중…`;
  else if (done.length) {
    const orig = done.reduce((n, j) => n + j.result.origSize, 0);
    const size = done.reduce((n, j) => n + j.result.size, 0);
    const pct = Math.round((1 - size / orig) * 100);
    text = `다 됐어요. ${fmtBytes(orig)} → ${fmtBytes(size)}` + (pct > 0 ? ` (${pct}% 줄어듦)` : '');
    const failed = jobs.filter(j => j.status === 'error').length;
    if (failed) text += ` · ${failed}개는 만들지 못했어요`;
  }
  if (text !== _scanSummaryText) {
    _scanSummaryText = text;
    document.getElementById('scanSummary').textContent = text;
  }
  syncScanControls();
}

async function saveAllScan() {
  const done = scanState.jobs.filter(j => j.status === 'done');
  if (!done.length) return;
  if (done.length === 1) { downloadBlob(done[0].result.blob, done[0].result.name); return; }
  const btn = document.getElementById('scanSaveAll');
  btn.disabled = true;
  try {
    await loadLib('jszip');
    const zip = new JSZip();
    uniqueNames(done.map(j => ({ name: j.result.name, blob: j.result.blob }))).forEach(s => zip.file(s.name, s.blob));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    downloadBlob(blob, `줄인 파일 ${done.length}개.zip`);
  } catch (e) {
    console.error(e);
    showToast(/불러오지 못했어요/.test(e?.message || '') ? e.message : 'ZIP 파일을 만들지 못했어요.', 'error');
  } finally {
    btn.disabled = false;
  }
}

function setPressed(groupSel, attr, value) {
  document.querySelectorAll(`${groupSel} button`).forEach(b => {
    const on = b.dataset[attr] === value;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function syncScanControls() {
  const s = scanState;
  setPressed('#scanLevelToggle', 'level', s.level);
  setPressed('#scanFormatToggle', 'fmt', s.format);
  document.getElementById('scanLevelNote').textContent = SCAN_LEVEL_NOTES[s.level];
  document.getElementById('scanTargetRow').hidden = s.level !== 'target';
  const hasDoc = s.files.some(e => isDocFile(e.file));
  document.getElementById('scanFormatNote').textContent = SCAN_FORMAT_NOTES[s.format] +
    (hasDoc ? ' 문서 파일(PPTX·DOCX·XLSX·HWPX)은 형식은 그대로 두고 안의 그림을 줄여요.' : '');
  document.getElementById('scanMergeRow').hidden = s.format !== 'pdf';
  document.getElementById('scanMerge').checked = s.merge;
  document.getElementById('scanStrip').checked = s.strip;
  document.getElementById('scanGray').checked = s.gray;
  const t = document.getElementById('scanTargetMB');
  if (document.activeElement !== t) t.value = String(+s.targetMB.toFixed(2));
  document.querySelectorAll('#scanTargetChips button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.mb === s.targetMB)));
}

function changeScanSetting(patch) {
  Object.assign(scanState, patch);
  saveScanPrefs();
  rebuildScanJobs(true);
}

// ── 연결 ──
loadScanPrefs();

bindDropzone(document.getElementById('scanDrop'), document.getElementById('scanInput'), addScanFiles);

// 캡처한 그림을 Ctrl+V로 붙여넣기
document.addEventListener('paste', e => {
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  const files = Array.from(e.clipboardData?.files || []);
  if (!files.length) return;
  e.preventDefault();
  addScanFiles(files);
});

document.getElementById('scanLevelToggle').addEventListener('click', e => {
  const b = e.target.closest('button[data-level]');
  if (b && b.dataset.level !== scanState.level) changeScanSetting({ level: b.dataset.level });
});
document.getElementById('scanFormatToggle').addEventListener('click', e => {
  const b = e.target.closest('button[data-fmt]');
  if (b && b.dataset.fmt !== scanState.format) changeScanSetting({ format: b.dataset.fmt });
});
document.getElementById('scanMerge').addEventListener('change', e => changeScanSetting({ merge: e.target.checked }));
document.getElementById('scanStrip').addEventListener('change', e => changeScanSetting({ strip: e.target.checked }));
document.getElementById('scanGray').addEventListener('change', e => changeScanSetting({ gray: e.target.checked }));

let _scanTargetTimer;
document.getElementById('scanTargetMB').addEventListener('input', e => {
  clearTimeout(_scanTargetTimer);
  const v = +e.target.value;
  if (!(v >= 0.05)) return;
  _scanTargetTimer = setTimeout(() => { if (v !== scanState.targetMB) changeScanSetting({ targetMB: v }); }, 600);
});
document.getElementById('scanTargetChips').addEventListener('click', e => {
  const b = e.target.closest('button[data-mb]');
  if (!b) return;
  clearTimeout(_scanTargetTimer);
  document.getElementById('scanTargetMB').value = b.dataset.mb;
  if (+b.dataset.mb !== scanState.targetMB) changeScanSetting({ targetMB: +b.dataset.mb });
});

document.getElementById('scanJobs').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('.job')?.dataset.id;
  const job = scanState.jobs.find(j => j.id === id);
  const act = b.dataset.act;
  if (act === 'remove-file') removeScanFile(b.dataset.file);
  else if (act === 'save' && job?.result) downloadBlob(job.result.blob, job.result.name);
  else if (act === 'raster') { scanState.raster.add(id); resetScanJob(id); }
  else if (act === 'unraster') { scanState.raster.delete(id); resetScanJob(id); }
  else if (act === 'pages' && job) openPages(job);
});
// ── 쪽 정리 창: 썸네일을 누르면 빼기, ↻로 90도 회전, 거의 흰 쪽은 처음 열 때 빼기로 표시 ──
const pagesUI = { job: null, doc: null, removed: new Set(), rot: new Map(), blank: new Set(), total: 0, seq: 0, observer: null };
const pagesModal = window.VUI?.modal?.bind('#pagesModal', { backdropClose: true, onClose: () => closePages(true) });

async function openPages(job) {
  const seq = ++pagesUI.seq;
  const saved = scanState.edits.get(job.id);
  Object.assign(pagesUI, {
    job, removed: new Set(saved?.removed || []), rot: new Map(saved?.rot || []), blank: new Set(), autoBlank: !saved,
  });
  const grid = document.getElementById('pagesGrid');
  grid.innerHTML = '';
  document.getElementById('pagesTitle').textContent = '쪽 정리 · ' + (job.id === 'merge' ? '합친 PDF' : job.entries[0].file.name);
  document.getElementById('pagesCount').textContent = '쪽을 불러오는 중…';
  document.getElementById('pagesApply').disabled = true;
  showPagesModal(true);
  try {
    await loadLib('pdfjs');
    const doc = await pdfjsLib.getDocument({ data: await job.base.blob.arrayBuffer() }).promise;
    if (seq !== pagesUI.seq) { doc.destroy(); return; }
    pagesUI.doc = doc;
    pagesUI.total = doc.numPages;
    grid.innerHTML = Array.from({ length: doc.numPages }, (_, i) => `
      <div class="pg" data-i="${i}">
        <button type="button" class="pg-thumb" data-pg="toggle" aria-pressed="false" aria-label="${i + 1}쪽 빼기"><canvas width="1" height="1"></canvas><span class="pg-no">${i + 1}</span><span class="pg-tag">빈 쪽</span></button>
        <button type="button" class="pg-rot" data-pg="rot" aria-label="${i + 1}쪽 90도 돌리기" title="90도 돌리기">${ic('rotate-cw')}</button>
      </div>`).join('');
    paintPages();
    renderThumbs(seq);
  } catch (e) {
    console.error(e);
    document.getElementById('pagesCount').textContent = '쪽을 불러오지 못했어요.';
  }
}

// 보이는 쪽부터 차례로 그림(거의 흰 쪽 찾기도 함께)
async function renderThumbs(seq) {
  const grid = document.getElementById('pagesGrid');
  const visible = new Set();
  pagesUI.observer?.disconnect();
  pagesUI.observer = new IntersectionObserver(es => es.forEach(en => {
    const i = +en.target.dataset.i;
    if (en.isIntersecting) visible.add(i); else visible.delete(i);
  }), { root: grid, rootMargin: '200px' });
  grid.querySelectorAll('.pg').forEach(el => pagesUI.observer.observe(el));
  const done = new Set();
  while (seq === pagesUI.seq && done.size < pagesUI.total) {
    await new Promise(r => setTimeout(r, 0));
    let i = [...visible].sort((a, b) => a - b).find(x => !done.has(x));
    if (i === undefined) for (let k = 0; k < pagesUI.total; k++) if (!done.has(k)) { i = k; break; }
    done.add(i);
    try {
      const page = await pagesUI.doc.getPage(i + 1);
      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 150 / Math.max(vp1.width, vp1.height) });
      const c = grid.querySelector(`.pg[data-i="${i}"] canvas`);
      if (!c || seq !== pagesUI.seq) return;
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      page.cleanup();
      // 거의 흰 쪽: 어두운 점이 0.3% 미만
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] * 77 + d[k + 1] * 150 + d[k + 2] * 29 < 200 * 256) ink++;
      if (ink < (d.length / 4) * 0.003) {
        pagesUI.blank.add(i);
        // 처음 열 때만 빼기로 표시. 모든 쪽을 뺄 수는 없게
        if (pagesUI.autoBlank && pagesUI.removed.size < pagesUI.total - 1) pagesUI.removed.add(i);
      }
    } catch (e) { console.warn('[file-tools] 썸네일 실패', i, e); }
    paintPages();
  }
}

function paintPages() {
  const grid = document.getElementById('pagesGrid');
  grid.querySelectorAll('.pg').forEach(el => {
    const i = +el.dataset.i;
    const off = pagesUI.removed.has(i);
    el.classList.toggle('is-off', off);
    el.classList.toggle('is-blank', pagesUI.blank.has(i));
    const t = el.querySelector('.pg-thumb');
    t.setAttribute('aria-pressed', String(off));
    t.setAttribute('aria-label', `${i + 1}쪽 ${off ? '다시 넣기' : '빼기'}`);
    // 옆으로 돌린 쪽은 상자 안에 들어가게 줄여서 보여 줌
    const cv = el.querySelector('canvas');
    const r = pagesUI.rot.get(i) || 0;
    const fit = r % 180 && cv.clientWidth && cv.clientHeight
      ? Math.min(cv.clientWidth, cv.clientHeight) / Math.max(cv.clientWidth, cv.clientHeight) : 1;
    cv.style.transform = `rotate(${r}deg) scale(${fit})`;
  });
  const rot = [...pagesUI.rot.values()].filter(Boolean).length;
  const parts = [`${pagesUI.total}쪽`];
  if (pagesUI.removed.size) parts.push(`${pagesUI.removed.size}쪽 빼기`);
  if (rot) parts.push(`${rot}쪽 회전`);
  if (pagesUI.blank.size) parts.push(`빈 쪽 ${pagesUI.blank.size}개 찾음`);
  document.getElementById('pagesCount').textContent = parts.join(' · ');
  document.getElementById('pagesApply').disabled = !pagesUI.total || pagesUI.removed.size >= pagesUI.total;
}

function showPagesModal(on) {
  const el = document.getElementById('pagesModal');
  if (pagesModal) { if (on) pagesModal.open(); else pagesModal.close(); }
  else el.hidden = !on;
}

function closePages(fromVui) {
  pagesUI.seq++;
  pagesUI.observer?.disconnect();
  pagesUI.doc?.destroy();
  pagesUI.doc = null;
  if (!fromVui) showPagesModal(false);
}

document.getElementById('pagesGrid').addEventListener('click', e => {
  const b = e.target.closest('button[data-pg]');
  if (!b) return;
  const i = +b.closest('.pg').dataset.i;
  if (b.dataset.pg === 'toggle') {
    if (pagesUI.removed.has(i)) pagesUI.removed.delete(i);
    else if (pagesUI.removed.size < pagesUI.total - 1) pagesUI.removed.add(i);
    else {   // 토스트는 창 뒤에 가려지므로 창 안 상태 줄에 알림
      document.getElementById('pagesCount').textContent = '모든 쪽을 뺄 수는 없어요. 한 쪽은 남겨 주세요.';
      return;
    }
  } else {
    const r = ((pagesUI.rot.get(i) || 0) + 90) % 360;
    if (r) pagesUI.rot.set(i, r); else pagesUI.rot.delete(i);
  }
  paintPages();
});
document.getElementById('pagesReset').addEventListener('click', () => {
  pagesUI.removed.clear(); pagesUI.rot.clear(); pagesUI.autoBlank = false;
  paintPages();
});
document.getElementById('pagesApply').addEventListener('click', async () => {
  const job = pagesUI.job;
  scanState.edits.set(job.id, { removed: new Set(pagesUI.removed), rot: new Map(pagesUI.rot) });
  closePages(false);
  if (!scanState.jobs.includes(job) || job.status !== 'done') return;
  try {
    job.result = await applyPageEdits(job, job.base);
  } catch (e) {
    console.error(e);
    showToast('쪽 정리를 적용하지 못했어요.', 'error');
  }
  renderScanJobs();
});

document.getElementById('scanSaveAll').addEventListener('click', saveAllScan);
document.getElementById('scanClear').addEventListener('click', clearScan);

renderScanJobs();
