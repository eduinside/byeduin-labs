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
// @icons x download circle-check triangle-alert circle-x chart-column
function ic(name) { return window.VUI ? VUI.icon(name) : ''; }

// 목표 용량 표시: MB 소수 둘째 자리
function fmtMB(v) { return (+v).toFixed(2); }
// 화질 0.75 → "75%"
function fmtQ(q) { return Math.round(q * 100) + '%'; }

// 파일 확장자로 탭별 지원 여부 판단
const SCAN_EXTS = ['pdf', 'tif', 'tiff', 'jpg', 'jpeg', 'png'];
function extOf(f) { return f.name.split('.').pop().toLowerCase(); }
function isScanFile(f) { return SCAN_EXTS.includes(extOf(f)); }
function isPptxFile(f) { return extOf(f) === 'pptx'; }
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

function switchTab(tab, focus) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
}
// 탭: 왼쪽·오른쪽 화살표로 옮겨 다님(WAI-ARIA 탭 패턴)
document.querySelector('.tabs')?.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const cur = tabs.findIndex(b => b.classList.contains('active'));
  let next = cur;
  if (e.key === 'ArrowLeft') next = (cur - 1 + tabs.length) % tabs.length;
  else if (e.key === 'ArrowRight') next = (cur + 1) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else next = tabs.length - 1;
  e.preventDefault();
  switchTab(tabs[next].dataset.tab, true);
});

// 진행 표시: 막대(progressbar) 값과, 단계가 바뀔 때만 스크린리더에 읽어 줄 문구
const _progressPhase = {};
function setProgressUI(prefix, pct, msg) {
  const v = Math.round(Math.max(0, Math.min(100, pct)));
  document.getElementById(prefix + 'Progress').style.display = 'block';
  document.getElementById(prefix + 'ProgressFill').style.width = v + '%';
  document.getElementById(prefix + 'ProgressMsg').textContent = msg;
  const bar = document.getElementById(prefix + 'ProgressBar');
  if (bar) { bar.setAttribute('aria-valuenow', String(v)); bar.setAttribute('aria-valuetext', v + '% · ' + msg); }
  // "시도 2/6 - 이미지 3/20"처럼 자주 바뀌는 뒷부분은 빼고 앞부분이 바뀔 때만 알림
  const phase = String(msg).split(' - ')[0];
  if (_progressPhase[prefix] !== phase) {
    _progressPhase[prefix] = phase;
    const live = document.getElementById(prefix + 'ProgressLive');
    if (live) live.textContent = phase;
  }
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

// 다운스케일 캔버스 만들기
function downscaleToCanvas(bitmap, maxWidth) {
  const w = bitmap.width, h = bitmap.height;
  const scale = w > maxWidth ? maxWidth / w : 1;
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  c.getContext('2d').drawImage(bitmap, 0, 0, cw, ch);
  return c;
}

// PNG에 alpha가 실제로 쓰이는지 검사
async function pngHasAlpha(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = Math.min(bmp.width, 64);
  c.height = Math.min(bmp.height, 64);
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

// ─────────────── 목표 용량 탐색 (공통) ───────────────
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

// ─────────────── Tab 1: PDF·이미지 줄이기 ───────────────
// PDF는 글자·도형은 그대로 두고 안에 든 그림만 다시 압축한다(기본).
// 쪽을 통째로 그림으로 바꾸는 방식은 파일 줄의 버튼으로만 쓴다.
// 파일을 넣거나 설정을 바꾸면 바로 시작하고, 결과는 파일마다 보여 준 뒤 저장한다.

// dpi: 쪽 긴 변 기준 해상도(낱장 그림은 A4 긴 변으로 환산), q: JPEG 화질
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
  level: 'normal', format: 'keep', targetMB: 2, merge: false,
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
  } catch { /* 저장소를 못 쓰면 기본값 */ }
}
function saveScanPrefs() {
  const { level, format, targetMB, merge } = scanState;
  try { localStorage.setItem(SCAN_PREF_KEY, JSON.stringify({ level, format, targetMB, merge })); } catch { /* 무시 */ }
}

const isTif = f => ['tif', 'tiff'].includes(extOf(f));
const stemOf = f => f.name.replace(/\.[^.]+$/, '');
const mergeActive = () => scanState.format === 'pdf' && scanState.merge && scanState.files.length > 1;
const newScanJob = (id, entries) => ({ id, entries, status: 'wait', pct: 0, result: null, error: null });

// ── 그리기 도우미 ──
// 긴 변이 maxLong을 넘으면 비율대로 줄인 캔버스. white: JPEG처럼 투명을 못 담을 때 흰 바탕
function drawFit(src, w, h, maxLong, white) {
  const s = Math.max(w, h) > maxLong ? maxLong / Math.max(w, h) : 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
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
      await onPage(c, a4Pt(c.width, c.height), i + 1, ifds.length);
      freeCanvas(c);
      prog((i + 1) / ifds.length);
    }
    return;
  }
  const bmp = await createImageBitmap(file);
  const c = drawFit(bmp, bmp.width, bmp.height, maxLong, true);
  bmp.close?.();
  await onPage(c, a4Pt(c.width, c.height), 1, 1);
  freeCanvas(c);
  prog(1);
}

// 낱장 JPG·PNG를 같은 형식으로 줄이기(PNG는 크기만 줄어듦)
async function shrinkImage(file, p, ctx, mime) {
  const bmp = await createImageBitmap(file);
  ctx.check();
  const jpeg = mime === 'image/jpeg';
  const c = drawFit(bmp, bmp.width, bmp.height, Math.round(A4_LONG_IN * p.dpi), jpeg);
  bmp.close?.();
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
async function recompressPdfImage(o, capPx, q) {
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
      const rep = await recompressPdfImage(o, Math.max(W, H) > capOver ? capPx : Infinity, p.q);
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

  if (fmt === 'keep' && entries.length === 1 && ['jpg', 'jpeg', 'png'].includes(ext)) {
    const blob = await shrinkImage(first, p, ctx, ext === 'png' ? 'image/png' : 'image/jpeg');
    prog(1);
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
  return { blob, name: stem + '_compressed.pdf', same, note };
}

function libsForScanJob(job, fmt, raster) {
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
  const origSize = job.entries.reduce((n, e) => n + e.file.size, 0);
  await loadLibs(libsForScanJob(job, format, raster));
  ctx.check();

  let out, params, reached = null;
  if (level !== 'target') {
    params = SCAN_PRESETS[level];
    out = await buildScanOutput(job, format, params, raster, ctx, 0, 1);
  } else {
    const targetBytes = targetMB * 1024 * 1024;
    const onlyPng = format === 'keep' && job.entries.length === 1 && extOf(job.entries[0].file) === 'png';
    const ladder = buildLadder([72, 100, 130, 150, 180, 220, 260, 300], [0.4, 0.55, 0.7, 0.85], onlyPng)
      .map(a => ({ dpi: a.w, q: a.q }));
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

  // 같은 형식인데 줄지 않았으면 원본을 그대로 쓴다
  if (out.same && out.blob.size >= origSize) {
    const f = job.entries[0].file;
    return {
      blob: f, name: f.name, size: f.size, origSize, kept: true, params, note: out.note,
      reached: reached === null ? null : f.size <= targetMB * 1024 * 1024,
    };
  }
  return { blob: out.blob, name: out.name, size: out.blob.size, origSize, kept: false, params, note: out.note, reached };
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
        job.result = await runScanJob(job, ctx);
        job.status = 'done';
      } catch (e) {
        if (e === CANCELLED || !alive()) continue;
        console.error(e);
        job.status = 'error';
        job.error = friendlyScanError(e);
      }
      if (alive()) renderScanJobs();
    }
  } finally {
    scanState.running = false;
    renderScanJobs();
  }
}

// 파일 목록·설정에서 작업 목록을 다시 만든다. resetAll: 끝난 결과도 모두 다시
function rebuildScanJobs(resetAll) {
  if (mergeActive()) {
    scanState.jobs = [newScanJob('merge', scanState.files.slice())];
  } else {
    const old = new Map(scanState.jobs.map(j => [j.id, j]));
    scanState.jobs = scanState.files.map(e => (!resetAll && old.get(e.id)) || newScanJob(e.id, [e]));
  }
  renderScanJobs();
  pumpScan();
}

function addScanFiles(files) {
  const ok = files.filter(isScanFile);
  const skipped = files.filter(f => !isScanFile(f));
  reportSkipped(skipped, skipped.some(isPptxFile) ? '‘PPTX 줄이기’ 탭에서 넣어 주세요.' : '');
  if (!ok.length) return;
  ok.forEach(file => scanState.files.push({ id: 'f' + (++_scanSeq), file }));
  rebuildScanJobs(false);
}

function removeScanFile(fileId) {
  scanState.files = scanState.files.filter(e => e.id !== fileId);
  scanState.raster.delete(fileId);
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
  renderScanJobs();
}

// ── 화면 ──
function scanJobRowHtml(j) {
  const merged = j.id === 'merge';
  const orig = j.entries.reduce((n, e) => n + e.file.size, 0);
  const title = merged ? `PDF 하나로 합치기 · 파일 ${j.entries.length}개` : j.entries[0].file.name;
  const canRaster = scanState.format !== 'jpg' && j.entries.some(e => extOf(e.file) === 'pdf');
  const raster = scanState.raster.has(j.id);
  let cls = '', meta = '', notes = [], link = '';

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
    if (r.kept) notes.push('더 줄어들지 않아서 원본을 그대로 둬요. 저장하면 원본을 받아요.');
    if (grew) { cls = 'is-warn'; notes.push('형식을 바꾸면서 원본보다 커졌어요.'); }
    if (r.reached === false) { cls = 'is-warn'; notes.push(`가장 작게 해도 목표 용량(${fmtBytes(scanState.targetMB * 1024 * 1024)})보다 커요.`); }
  }
  if (canRaster && (j.status === 'done' || j.status === 'error')) {
    if (raster) link = `<button type="button" class="job-link" data-act="unraster">글자를 살리는 원래 방식으로 되돌리기</button>`;
    // 작은 글자 PDF는 그림으로 바꾸면 커지기만 하므로 500KB 이상일 때만 권함
    else if (j.status === 'error' || (orig >= 500 * 1024 && (j.result.kept || j.result.reached === false || (j.result.origSize - j.result.size) < j.result.origSize * 0.2))) {
      link = `<button type="button" class="job-link" data-act="raster">쪽을 그림으로 바꿔 더 줄이기</button>`;
    }
  }
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
  const jobs = scanState.jobs;
  document.getElementById('scanJobs').innerHTML = jobs.map(scanJobRowHtml).join('');
  const done = jobs.filter(j => j.status === 'done');
  const busy = jobs.some(j => j.status === 'wait' || j.status === 'run');
  document.getElementById('scanActions').hidden = !jobs.length;
  const saveAll = document.getElementById('scanSaveAll');
  saveAll.disabled = busy || !done.length;
  saveAll.innerHTML = `${ic('download')} ${done.length > 1 ? `모두 저장 (ZIP)` : '저장'}`;

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
  document.getElementById('scanFormatNote').textContent = SCAN_FORMAT_NOTES[s.format];
  document.getElementById('scanMergeRow').hidden = s.format !== 'pdf';
  document.getElementById('scanMerge').checked = s.merge;
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

bindDropzone(
  document.getElementById('scanDrop'),
  document.getElementById('scanInput'),
  (files) => {
    // PPTX 파일만 들어오면 PPTX 탭으로 이동
    if (files.every(isPptxFile)) {
      switchTab('pptx');
      setPptxFile(files[0]);
      if (files.length > 1) showToast('PPTX는 한 번에 한 파일만 줄일 수 있어요. 첫 파일만 넣었어요.');
      return;
    }
    addScanFiles(files);
  }
);

// 캡처한 그림을 Ctrl+V로 붙여넣기
document.addEventListener('paste', e => {
  if (!document.getElementById('panel-scan').classList.contains('active')) return;
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
});
document.getElementById('scanSaveAll').addEventListener('click', saveAllScan);
document.getElementById('scanClear').addEventListener('click', clearScan);

renderScanJobs();

// ─────────────── Tab 2: PPTX 압축 ───────────────
// analyzing: 그림 목록을 살펴보는 중(실행 버튼 잠금). userTarget: 사용자가 정한 목표(MB)
const pptxState = { file: null, mediaInfo: null, minMB: 0.05, maxMB: 10, analyzing: false, userTarget: null, seq: 0 };

function setPptxFile(file) {
  pptxState.file = file;
  pptxState.mediaInfo = null;
  document.getElementById('pptxResult').style.display = 'none';
  renderPptxList();
  scanPptxMedia();
}

bindDropzone(
  document.getElementById('pptxDrop'),
  document.getElementById('pptxInput'),
  (files) => {
    // 스캔 타입 파일이 들어오면 스캔 탭으로 이동
    if (files.every(isScanFile)) {
      switchTab('scan');
      addScanFiles(files);
      return;
    }
    const pptx = files.filter(isPptxFile);
    reportSkipped(files.filter(f => !isPptxFile(f)), '');
    if (!pptx.length) return;
    if (pptx.length > 1) showToast('PPTX는 한 번에 한 파일만 줄일 수 있어요. 첫 파일만 넣었어요.');
    setPptxFile(pptx[0]);
  }
);

document.getElementById('pptxTargetMB').addEventListener('input', () => {
  const v = +document.getElementById('pptxTargetMB').value;
  pptxState.userTarget = v;
  document.getElementById('pptxTargetMBVal').textContent = fmtMB(v);
  updatePptxEstimate();
});

function renderPptxList() {
  const el = document.getElementById('pptxFileList');
  const grid = document.getElementById('pptxOptionsGrid');
  if (!pptxState.file) {
    el.innerHTML = '';
    grid.style.display = 'none';
    document.getElementById('pptxRunBtn').disabled = true;
    return;
  }
  const f = pptxState.file;
  el.innerHTML = `<div class="file-list-item">
       <span class="name">${escHtml(f.name)}</span>
       <span class="meta">${fmtBytes(f.size)} <button type="button" class="file-list-remove" onclick="window.clearPptx()" title="빼기" aria-label="${escHtml(f.name)} 빼기">${ic('x')}</button></span>
     </div>`;
  grid.style.display = 'grid';
  // 그림 목록을 다 살펴본 뒤에만 실행할 수 있다
  document.getElementById('pptxRunBtn').disabled = pptxState.analyzing || !pptxState.mediaInfo;
}

window.clearPptx = () => {
  pptxState.seq++;   // 살펴보는 중이던 결과는 버린다
  pptxState.file = null; pptxState.mediaInfo = null; pptxState.analyzing = false; pptxState.userTarget = null;
  renderPptxList();
  document.getElementById('pptxEstimate').style.display = 'none';
  document.getElementById('pptxResult').style.display = 'none';
  document.getElementById('pptxProgress').style.display = 'none';
};

async function scanPptxMedia() {
  if (!pptxState.file) return;
  const seq = ++pptxState.seq;
  pptxState.analyzing = true;
  renderPptxList();
  const est = document.getElementById('pptxEstimate');
  est.style.display = 'block';
  est.textContent = 'PPTX 안의 그림을 살펴보는 중…';
  try {
    await loadLib('jszip');
    const zip = await JSZip.loadAsync(pptxState.file);
    const mediaFiles = Object.keys(zip.files).filter(n => n.startsWith('ppt/media/') && !zip.files[n].dir);
    let totalBytes = 0;
    const items = [];
    for (const name of mediaFiles) {
      const ext = name.split('.').pop().toLowerCase();
      const blob = await zip.files[name].async('blob');
      totalBytes += blob.size;
      items.push({ name, ext, size: blob.size });
    }
    if (seq !== pptxState.seq) return;   // 그사이 다른 파일로 바뀜
    pptxState.mediaInfo = { items, totalBytes };

    // 슬라이더 범위 설정:
    // 최소 = 현재 파일의 2.5%(0.05MB 아래로는 안 내림), 최대 = 현재 크기
    const fileMB = pptxState.file.size / 1024 / 1024;

    pptxState.minMB = Math.max(0.05, fileMB * 0.025); // 현재 파일의 2.5%
    pptxState.maxMB = Math.max(pptxState.minMB, fileMB);

    const slider = document.getElementById('pptxTargetMB');
    slider.min = fmtMB(pptxState.minMB);
    slider.max = fmtMB(pptxState.maxMB);
    // 기본값: 50% 또는 3MB 중 작은 값. 사용자가 정한 값이 있으면 그 값(범위 안으로만 맞춤)
    const want = pptxState.userTarget != null ? pptxState.userTarget : Math.min(3, fileMB * 0.5);
    slider.value = fmtMB(Math.min(Math.max(want, pptxState.minMB), pptxState.maxMB));
    document.getElementById('pptxTargetMBVal').textContent = fmtMB(slider.value);

    document.getElementById('pptxTargetMin').textContent = '최소 ' + fmtBytes(pptxState.minMB * 1024 * 1024);
    document.getElementById('pptxTargetMax').textContent = '최대 ' + fmtBytes(pptxState.maxMB * 1024 * 1024);

    updatePptxEstimate();
  } catch (e) {
    if (seq !== pptxState.seq) return;
    console.error(e);
    est.style.display = 'none';
    showToast(/불러오지 못했어요/.test(e?.message || '') ? e.message : 'PPTX 파일을 열 수 없어요. 파일이 손상되지 않았는지 확인해 주세요.', 'error');
  } finally {
    if (seq === pptxState.seq) {
      pptxState.analyzing = false;
      renderPptxList();
    }
  }
}

function updatePptxEstimate() {
  if (!pptxState.mediaInfo) return;
  const info = pptxState.mediaInfo;
  const targetMB = +document.getElementById('pptxTargetMB').value;
  const targetBytes = targetMB * 1024 * 1024;
  document.getElementById('pptxEstimate').style.display = 'block';
  document.getElementById('pptxEstimate').innerHTML =
    `${ic('chart-column')} 그림 ${info.items.length}개 · 합계 ${fmtBytes(info.totalBytes)} (PPTX의 ${(info.totalBytes / pptxState.file.size * 100).toFixed(0)}%)<br>` +
    `목표 용량: <strong>${fmtBytes(targetBytes)}</strong> - 그림의 크기와 화질을 자동으로 조절해요`;
}

function setPptxProgress(pct, msg) { setProgressUI('pptx', pct, msg); }

// 전체 내용 SHA-256 (같은 그림 판정용). 사용할 수 없는 환경이면 null
async function hashBlob(blob) {
  try {
    if (!window.crypto?.subtle) return null;
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return blob.size + ':' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

// 동시에 처리할 이미지 수 제한 (큰 PPTX에서 메모리 폭증 방지)
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

// 원본 미디어를 한 번만 읽어 둠: 원본 Blob, 같은 그림 묶음, PNG 투명도 여부
async function preparePptxMedia(baseZip) {
  const mediaNames = Object.keys(baseZip.files).filter(n => n.startsWith('ppt/media/') && !baseZip.files[n].dir);
  const media = [];
  const byHash = new Map();   // hash → 대표 항목
  for (const name of mediaNames) {
    const ext = name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) continue;   // 영상·벡터 등은 손대지 않음
    const blob = await baseZip.files[name].async('blob');
    const hash = await hashBlob(blob);
    const item = { name, ext, blob, hash, dupOf: null, hasAlpha: null };
    if (hash && byHash.has(hash)) item.dupOf = byHash.get(hash);
    else if (hash) byHash.set(hash, item);
    media.push(item);
  }
  return media;
}

// 매번 "원본" 이미지에서 다시 압축 → 시도가 반복돼도 화질 손실이 쌓이지 않음
async function recompressPptxMedia(media, quality, maxWidth, onProgress) {
  const result = new Map();   // name → blob
  const uniques = media.filter(m => !m.dupOf);
  let done = 0;
  await mapLimit(uniques, 4, async (m) => {
    let outBlob = m.blob;
    try {
      if (m.ext === 'jpg' || m.ext === 'jpeg') {
        const bmp = await createImageBitmap(m.blob);
        const c = downscaleToCanvas(bmp, maxWidth);
        bmp.close?.();
        const recomp = await canvasToBlob(c, 'image/jpeg', quality);
        c.width = 0; c.height = 0;
        if (recomp && recomp.size > 0 && recomp.size < m.blob.size) outBlob = recomp;
      } else if (m.ext === 'png') {
        if (m.hasAlpha === null) m.hasAlpha = await pngHasAlpha(m.blob);   // 한 번만 검사
        const bmp = await createImageBitmap(m.blob);
        const c = downscaleToCanvas(bmp, maxWidth);
        bmp.close?.();
        // 투명 영역이 없는 PNG는 JPEG 데이터로 바꿔 넣음(파일 이름은 그대로 — 기존 동작 유지)
        const recomp = m.hasAlpha
          ? await canvasToBlob(c, 'image/png')
          : await canvasToBlob(c, 'image/jpeg', quality);
        c.width = 0; c.height = 0;
        if (recomp && recomp.size > 0 && recomp.size < m.blob.size) outBlob = recomp;
      }
    } catch (e) {
      console.warn('이미지 재압축 실패:', m.name, e);
    }
    result.set(m.name, outBlob);
    onProgress?.(++done, uniques.length);
  });
  // 내용이 완전히 같은 그림은 같은 결과를 씀
  for (const m of media) if (m.dupOf) result.set(m.name, result.get(m.dupOf.name));
  return result;
}

// XML 정리: 줄바꿈이 낀 들여쓰기 공백과 주석만 지움.
// (글자 사이 공백만 있는 텍스트 조각 <a:t> </a:t> 등은 내용이므로 건드리지 않음)
function minifyXml(xml) {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>[ \t]*\r?\n\s*</g, '><')
    .trim();
}

async function runPptx() {
  if (!pptxState.file || pptxState.analyzing) return;
  document.getElementById('pptxRunBtn').disabled = true;
  document.getElementById('pptxTargetMB').disabled = true;
  document.getElementById('pptxResult').style.display = 'none';

  const targetMB = +document.getElementById('pptxTargetMB').value;
  const targetBytes = targetMB * 1024 * 1024;
  const origSize = pptxState.file.size;

  try {
    setPptxProgress(3, '처리 도구 불러오는 중…');
    await loadLib('jszip');
    const fileBuf = await pptxState.file.arrayBuffer();

    // 목표 용량에 따라 탐색 범위 결정
    const ratio = targetBytes / origSize;

    let widths, qualities;
    if (ratio < 0.05) {
      widths = [300, 400, 500, 600, 800];
      qualities = [0.2, 0.25, 0.3, 0.35, 0.4];
    } else if (ratio < 0.1) {
      widths = [400, 600, 800, 1000, 1200];
      qualities = [0.3, 0.4, 0.45, 0.5, 0.6];
    } else if (ratio < 0.2) {
      widths = [600, 800, 1000, 1200, 1400, 1600];
      qualities = [0.35, 0.45, 0.55, 0.65, 0.75];
    } else {
      widths = [1000, 1200, 1400, 1600, 1800];
      qualities = [0.55, 0.65, 0.75, 0.8, 0.85];
    }
    const ladder = buildLadder(widths, qualities, false);

    setPptxProgress(8, 'PPTX 파일 여는 중…');
    const baseZip = await JSZip.loadAsync(fileBuf);

    setPptxProgress(12, '그림 확인하는 중…');
    const media = await preparePptxMedia(baseZip);

    // 문서 내용(XML) 미리 정리해서 캐시
    setPptxProgress(18, '문서 내용 정리하는 중…');
    const minifiedXmlCache = new Map();
    for (const fileName of Object.keys(baseZip.files)) {
      if ((fileName.endsWith('.xml') || fileName.endsWith('.rels')) && !baseZip.files[fileName].dir) {
        try {
          const xmlText = await baseZip.files[fileName].async('text');
          minifiedXmlCache.set(fileName, minifyXml(xmlText));
        } catch (e) {
          // 읽을 수 없는 파일은 원본 유지
        }
      }
    }

    const found = await searchBestUnderTarget(ladder, targetBytes, async ({ w, q }, n, maxSteps) => {
      const base = 20 + ((n - 1) / maxSteps) * 75;
      const span = 75 / maxSteps;
      setPptxProgress(base, `알맞은 크기 찾는 중 (${n}/${maxSteps}번째) - 폭 ${w}px · 화질 ${fmtQ(q)}`);

      // 시도마다 원본 PPTX에서 새로 시작
      const zip = await JSZip.loadAsync(fileBuf);
      const outMedia = await recompressPptxMedia(media, q, w, (d, t) =>
        setPptxProgress(base + span * 0.8 * (d / Math.max(1, t)), `알맞은 크기 찾는 중 (${n}/${maxSteps}번째) - 그림 ${d}/${t}`));
      for (const [name, blob] of outMedia) zip.file(name, blob);
      for (const [fileName, minified] of minifiedXmlCache) zip.file(fileName, minified);

      setPptxProgress(base + span * 0.85, `알맞은 크기 찾는 중 (${n}/${maxSteps}번째) - 파일 다시 묶는 중…`);
      return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
    });

    setPptxProgress(100, '끝났어요');

    const { blob: bestBlob, params: bestParams, reached } = found;
    const fname = pptxState.file.name.replace(/\.pptx$/i, '') + '_compressed.pptx';

    const compressionRatio = ((1 - bestBlob.size / origSize) * 100).toFixed(1);
    const r = document.getElementById('pptxResult');
    r.className = 'result' + (reached ? '' : ' warning');
    r.style.display = 'block';
    r.innerHTML = `<span class="res-head">${ic(reached ? 'circle-check' : 'triangle-alert')} ${escHtml(fname)}</span> 내려받기를 시작했어요<br>
      원본 ${fmtBytes(origSize)} → 결과 ${fmtBytes(bestBlob.size)} (${compressionRatio}% 줄어듦)<br>
      적용: 폭 ${bestParams.w}px · 화질 ${fmtQ(bestParams.q)}<br>
      <span style="font-size:0.78rem; color:var(--fg-muted)">그림의 크기·화질을 줄이고 파일을 다시 묶었어요</span>
      <span class="res-note">${reached
        ? '목표 용량 안에서 가장 좋은 화질로 만들었어요.'
        : '가장 작게 줄여도 목표 용량보다 커요. 시도한 것 중 가장 작은 파일을 내려받았어요. 영상·글꼴처럼 줄일 수 없는 내용이 많으면 이렇게 될 수 있어요.'}</span>`;

    // 줄인 PPTX 자동 내려받기
    downloadBlob(bestBlob, fname);
    showToast(reached ? '다 만들었어요. 내려받기를 시작했어요.' : '목표 용량보다 큰 파일이 나왔어요. 결과 안내를 확인해 주세요.', reached ? 'success' : undefined);
  } catch (e) {
    console.error(e);
    const r = document.getElementById('pptxResult');
    r.className = 'result error';
    r.style.display = 'block';
    r.innerHTML = `${ic('circle-x')} 줄이지 못했어요: <span></span>`;
    r.querySelector('span').textContent = e.message || String(e);
    showToast('줄이지 못했어요', 'error');
  } finally {
    document.getElementById('pptxRunBtn').disabled = !pptxState.mediaInfo;
    document.getElementById('pptxTargetMB').disabled = false;
    setTimeout(() => { document.getElementById('pptxProgress').style.display = 'none'; }, 1500);
  }
}

window.runPptx = runPptx;
window.switchTab = switchTab;
