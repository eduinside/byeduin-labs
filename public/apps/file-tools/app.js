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
  // "시도 2/6 — 이미지 3/20"처럼 자주 바뀌는 뒷부분은 빼고 앞부분이 바뀔 때만 알림
  const phase = String(msg).split(' — ')[0];
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

// ─────────────── Tab 1: 스캔 최적화 ───────────────
const scanState = { files: [], format: 'pdf' };

bindDropzone(
  document.getElementById('scanDrop'),
  document.getElementById('scanInput'),
  (files) => {
    // PPTX 파일만 들어오면 PPTX 탭으로 이동
    if (files.every(f => f.name.toLowerCase().endsWith('.pptx'))) {
      switchTab('pptx');
      pptxState.file = files[0];
      renderPptxList();
      scanPptxMedia();
      return;
    }
    scanState.files.push(...files);
    renderScanList();
  }
);

document.querySelectorAll('#scanFormatToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    scanState.format = btn.dataset.fmt;
    document.querySelectorAll('#scanFormatToggle button').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    updateScanEstimate();
  });
});

document.getElementById('scanTargetMB').addEventListener('input', () => {
  const v = +document.getElementById('scanTargetMB').value;
  document.getElementById('scanTargetMBVal').textContent = v.toFixed(1);
  updateScanEstimate();
});

function renderScanList() {
  const el = document.getElementById('scanFileList');
  el.innerHTML = scanState.files.map((f, i) =>
    `<div class="file-list-item">
       <span>${escHtml(f.name)}</span>
       <span class="meta">${fmtBytes(f.size)} <button type="button" class="file-list-remove" onclick="removeScanFile(${i})" title="제거" aria-label="${escHtml(f.name)} 목록에서 빼기">×</button></span>
     </div>`).join('');
  const grid = document.getElementById('scanOptionsGrid');
  if (scanState.files.length > 0) {
    grid.style.display = 'grid';
    // 동적 슬라이더 범위 설정
    const totalSize = scanState.files.reduce((s, f) => s + f.size, 0);
    const minMB = (totalSize * 0.025) / (1024 * 1024);
    const maxMB = totalSize / (1024 * 1024);
    const slider = document.getElementById('scanTargetMB');
    slider.min = minMB.toFixed(1);
    slider.max = maxMB.toFixed(1);
    slider.value = Math.min(1.0, maxMB).toFixed(1);
    document.getElementById('scanTargetMBVal').textContent = slider.value;
  } else {
    grid.style.display = 'none';
  }
  document.getElementById('scanRunBtn').disabled = scanState.files.length === 0;
  updateScanEstimate();
}

window.removeScanFile = (i) => { scanState.files.splice(i, 1); renderScanList(); };
window.clearScan = () => {
  scanState.files = [];
  renderScanList();
  document.getElementById('scanResult').style.display = 'none';
  document.getElementById('scanProgress').style.display = 'none';
};

async function countPagesEstimate() {
  let pages = 0;
  for (const f of scanState.files) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      try {
        await loadLib('pdfjs');
        const buf = await f.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        pages += doc.numPages;
        doc.destroy();
      } catch { pages += 1; }
    } else {
      pages += 1; // TIFF: 간이 추정 (멀티페이지 TIFF는 처리 시 정확히 산출)
    }
  }
  return pages;
}

let _scanEstTimer;
function updateScanEstimate() {
  clearTimeout(_scanEstTimer);
  if (!scanState.files.length) {
    document.getElementById('scanEstimate').style.display = 'none';
    return;
  }
  _scanEstTimer = setTimeout(async () => {
    const pages = await countPagesEstimate();
    const targetMB = +document.getElementById('scanTargetMB').value;
    const origTotal = scanState.files.reduce((s, f) => s + f.size, 0);
    const targetBytes = targetMB * 1024 * 1024;
    const ratio = targetBytes / origTotal;

    // 목표 비율에 따라 자동 설정 (PPTX와 동일한 로직)
    let estQ, estW;
    if (ratio < 0.05) {
      estQ = 0.3; estW = 400;
    } else if (ratio < 0.1) {
      estQ = 0.4; estW = 600;
    } else if (ratio < 0.2) {
      estQ = 0.5; estW = 800;
    } else {
      estQ = 0.75; estW = 1600;
    }

    // 거친 추정: JPEG 평균 ~ 0.15 bytes/픽셀 × quality 가중치, PNG는 무손실이라 훨씬 큼
    const bytesPerPage = scanState.format === 'png'
      ? estW * (estW * 1.41) * 0.5
      : estW * (estW * 1.41) * (0.04 + estQ * 0.18);
    const est = bytesPerPage * pages * (scanState.format === 'pdf' ? 1.05 : 1);
    document.getElementById('scanEstimate').style.display = 'block';
    document.getElementById('scanEstimate').innerHTML =
      `📊 입력 ${scanState.files.length}개 · ${pages}페이지 · 예상 출력 <strong>≈ ${fmtBytes(est)}</strong> ` +
      `<span style="color:var(--fg-muted)">(품질 ${estQ.toFixed(2)}, ${estW}px · 목표 ${fmtBytes(targetBytes)})</span>`;
  }, 200);
}

function setScanProgress(pct, msg) { setProgressUI('scan', pct, msg); }

// 모든 입력을 페이지 단위 캔버스 배열로 변환
async function rasterizeAll(maxWidth, onProgress) {
  const pages = []; // { canvas, sourceName }
  let total = 0, done = 0;
  for (const f of scanState.files) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      const doc = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      total += doc.numPages;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(maxWidth / vp1.width, 4);
        const vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        pages.push({ canvas: c, sourceName: f.name.replace(/\.[^.]+$/, ''), pageIdx: i });
        done++;
        onProgress?.(done, total);
      }
      doc.destroy();
    } else if (ext === 'tif' || ext === 'tiff') {
      const buf = await f.arrayBuffer();
      const ifds = UTIF.decode(buf);
      total += ifds.length;
      for (let i = 0; i < ifds.length; i++) {
        UTIF.decodeImage(buf, ifds[i]);
        const rgba = UTIF.toRGBA8(ifds[i]);
        const w = ifds[i].width, h = ifds[i].height;
        const src = document.createElement('canvas');
        src.width = w; src.height = h;
        const imgData = new ImageData(new Uint8ClampedArray(rgba.buffer), w, h);
        src.getContext('2d').putImageData(imgData, 0, 0);
        const bmp = await createImageBitmap(src);
        src.width = 0; src.height = 0;   // 원본 크기 캔버스 메모리 즉시 반납
        const c = downscaleToCanvas(bmp, maxWidth);
        bmp.close?.();
        pages.push({ canvas: c, sourceName: f.name.replace(/\.[^.]+$/, ''), pageIdx: i + 1 });
        done++;
        onProgress?.(done, total);
      }
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      const bmp = await createImageBitmap(f);
      const c = downscaleToCanvas(bmp, maxWidth);
      bmp.close?.();
      total += 1;
      pages.push({ canvas: c, sourceName: f.name.replace(/\.[^.]+$/, ''), pageIdx: 1 });
      done++;
      onProgress?.(done, total);
    }
  }
  return pages;
}

function releasePages(pages) {
  for (const p of pages || []) { p.canvas.width = 0; p.canvas.height = 0; }
}

async function buildPdf(pages, quality) {
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();
  let totalSize = 0;
  for (const p of pages) {
    const blob = await canvasToBlob(p.canvas, 'image/jpeg', quality);
    if (!blob || blob.size === 0) throw new Error('이미지 변환 실패');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    totalSize += bytes.length;
    const img = await doc.embedJpg(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const out = await doc.save();
  const pdfBlob = new Blob([out], { type: 'application/pdf' });
  if (!pdfBlob || pdfBlob.size === 0) throw new Error('PDF 생성 실패');
  return { blob: pdfBlob, imgTotal: totalSize };
}

async function buildImageZip(pages, quality, mime, ext) {
  if (pages.length === 1) {
    const blob = await canvasToBlob(pages[0].canvas, mime, quality);
    if (!blob || blob.size === 0) throw new Error('이미지 변환 실패');
    return { blob, ext };
  }
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++) {
    const blob = await canvasToBlob(pages[i].canvas, mime, quality);
    if (!blob || blob.size === 0) throw new Error('이미지 변환 실패');
    const name = `${pages[i].sourceName}_p${pages[i].pageIdx}.${ext}`;
    zip.file(name, blob);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  if (!blob || blob.size === 0) throw new Error('압축파일 생성 실패');
  return { blob, ext: 'zip' };
}

async function runScan() {
  if (!scanState.files.length) return;
  document.getElementById('scanRunBtn').disabled = true;
  document.getElementById('scanTargetMB').disabled = true;
  document.getElementById('scanResult').style.display = 'none';

  const targetMB = +document.getElementById('scanTargetMB').value;
  const targetBytes = targetMB * 1024 * 1024;
  const fmt = scanState.format;
  const origTotal = scanState.files.reduce((s, f) => s + f.size, 0);
  const ratio = targetBytes / origTotal;

  // 목표 비율에 따라 탐색 범위 결정
  let widths, qualities;
  if (ratio < 0.05) {
    widths = [400, 600, 800, 1000];
    qualities = [0.3, 0.4, 0.5, 0.6];
  } else if (ratio < 0.1) {
    widths = [600, 800, 1000, 1200];
    qualities = [0.4, 0.5, 0.6, 0.7];
  } else if (ratio < 0.2) {
    widths = [800, 1000, 1200, 1600];
    qualities = [0.5, 0.6, 0.7, 0.8];
  } else {
    widths = [1200, 1600, 2000, 2400];
    qualities = [0.65, 0.75, 0.85, 0.95];
  }

  // PNG는 quality 무의미(무손실) — 폭만 바꿔가며 시도
  const ladder = buildLadder(widths, qualities, fmt === 'png');

  // 같은 폭으로 그린 페이지는 다시 그리지 않고 재사용 (메모리 때문에 최근 2개 폭만 보관)
  const rasterCache = new Map();
  const getPages = async (w) => {
    if (rasterCache.has(w)) return rasterCache.get(w);
    const pages = await rasterizeAll(w, () => {});
    rasterCache.set(w, pages);
    if (rasterCache.size > 2) {
      const oldKey = rasterCache.keys().next().value;
      releasePages(rasterCache.get(oldKey));
      rasterCache.delete(oldKey);
    }
    return pages;
  };

  try {
    setScanProgress(3, '처리 도구 불러오는 중…');
    const needs = [];
    const exts = scanState.files.map(f => f.name.split('.').pop().toLowerCase());
    if (exts.includes('pdf')) needs.push('pdfjs');
    if (exts.some(e => e === 'tif' || e === 'tiff')) needs.push('utif');
    if (fmt === 'pdf') needs.push('pdflib');
    else needs.push('jszip');
    await loadLibs(needs);

    setScanProgress(5, '페이지 라스터화 중…');

    const found = await searchBestUnderTarget(ladder, targetBytes, async ({ w, q }, n, maxSteps) => {
      setScanProgress(5 + ((n - 1) / maxSteps) * 90, `시도 ${n}/${maxSteps} — ${w}px${fmt === 'png' ? '' : ` / 품질 ${q.toFixed(2)}`}`);
      const pages = await getPages(w);
      const result = fmt === 'pdf'
        ? (await buildPdf(pages, q))
        : fmt === 'png'
          ? (await buildImageZip(pages, undefined, 'image/png', 'png'))
          : (await buildImageZip(pages, q, 'image/jpeg', 'jpg'));
      const blob = result.blob;
      blob._ext = result.ext;
      return blob;
    });

    setScanProgress(100, '완료');

    const bestBlob = found.blob, bestParams = found.params, reached = found.reached;
    const ext = fmt === 'pdf' ? 'pdf' : (bestBlob._ext || 'jpg');
    const baseName = scanState.files[0].name.replace(/\.[^.]+$/, '');
    const fname = `${baseName}_optimized.${ext}`;
    downloadBlob(bestBlob, fname);

    const compressionRatio = ((1 - bestBlob.size / origTotal) * 100).toFixed(1);
    const r = document.getElementById('scanResult');
    r.className = 'result' + (reached ? '' : ' warning');
    r.style.display = 'block';
    r.innerHTML = `✅ <strong>${escHtml(fname)}</strong> 다운로드<br>
      원본 ${fmtBytes(origTotal)} → 출력 ${fmtBytes(bestBlob.size)} (${compressionRatio}% 감소)<br>
      적용 옵션: ${bestParams.w}px${fmt === 'png' ? '' : ` / 품질 ${bestParams.q.toFixed(2)}`}<br>
      ${reached
        ? '✓ 목표 용량 안에서 가장 좋은 화질로 만들었어요'
        : '⚠️ 가장 작게 줄여도 목표 용량보다 커요. 시도한 것 중 가장 작은 파일을 내려받았어요. 목표 용량을 조금 올리거나 JPG/PDF 형식을 골라 보세요.'}`;

    showToast(reached ? '변환 완료 ✓' : '목표 용량에는 못 미쳤어요', reached ? 'success' : undefined);
  } catch (e) {
    console.error(e);
    const r = document.getElementById('scanResult');
    r.className = 'result error';
    r.style.display = 'block';
    r.textContent = '❌ 변환 중 오류: ' + (e.message || e);
    showToast('변환하지 못했어요', 'error');
  } finally {
    for (const pages of rasterCache.values()) releasePages(pages);
    rasterCache.clear();
    document.getElementById('scanRunBtn').disabled = false;
    document.getElementById('scanTargetMB').disabled = false;
    setTimeout(() => { document.getElementById('scanProgress').style.display = 'none'; }, 1500);
  }
}

window.runScan = runScan;

// ─────────────── Tab 2: PPTX 압축 ───────────────
const pptxState = { file: null, mediaInfo: null, minMB: 0.5, maxMB: 10 };

bindDropzone(
  document.getElementById('pptxDrop'),
  document.getElementById('pptxInput'),
  (files) => {
    // 스캔 타입 파일이 들어오면 스캔 탭으로 이동
    const scanExts = ['jpg', 'jpeg', 'png', 'pdf', 'tif', 'tiff'];
    if (files.every(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return scanExts.includes(ext);
    })) {
      switchTab('scan');
      scanState.files.push(...files);
      renderScanList();
      return;
    }
    pptxState.file = files[0];
    renderPptxList();
    scanPptxMedia();
  }
);

document.getElementById('pptxTargetMB').addEventListener('input', () => {
  const v = +document.getElementById('pptxTargetMB').value;
  document.getElementById('pptxTargetMBVal').textContent = v.toFixed(1);
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
       <span>${escHtml(f.name)}</span>
       <span class="meta">${fmtBytes(f.size)} <button type="button" class="file-list-remove" onclick="window.clearPptx()" title="제거" aria-label="${escHtml(f.name)} 빼기">×</button></span>
     </div>`;
  grid.style.display = 'grid';
  document.getElementById('pptxRunBtn').disabled = false;
}

window.clearPptx = () => {
  pptxState.file = null; pptxState.mediaInfo = null;
  renderPptxList();
  document.getElementById('pptxEstimate').style.display = 'none';
  document.getElementById('pptxResult').style.display = 'none';
  document.getElementById('pptxProgress').style.display = 'none';
};

async function scanPptxMedia() {
  if (!pptxState.file) return;
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
    pptxState.mediaInfo = { items, totalBytes };

    // 슬라이더 범위 설정:
    // 최소 = 현재 파일의 2.5%, 최대 = 현재 크기
    const fileMB = pptxState.file.size / 1024 / 1024;

    pptxState.minMB = Math.max(0.05, fileMB * 0.025); // 현재 파일의 2.5%
    pptxState.maxMB = fileMB;

    const slider = document.getElementById('pptxTargetMB');
    slider.min = pptxState.minMB.toFixed(2);
    slider.max = fileMB.toFixed(1);
    slider.value = Math.min(3, fileMB * 0.5); // 기본값: 50% 또는 3MB 중 작은 값
    document.getElementById('pptxTargetMBVal').textContent = (+slider.value).toFixed(1);

    document.getElementById('pptxTargetMin').textContent = fmtBytes(pptxState.minMB * 1024 * 1024);
    document.getElementById('pptxTargetMax').textContent = fmtBytes(pptxState.maxMB * 1024 * 1024);

    updatePptxEstimate();
  } catch (e) {
    console.error(e);
    showToast(/불러오지 못했어요/.test(e?.message || '') ? e.message : 'PPTX 파일을 열 수 없어요. 파일이 손상되지 않았는지 확인해 주세요.', 'error');
  }
}

function updatePptxEstimate() {
  if (!pptxState.mediaInfo) return;
  const info = pptxState.mediaInfo;
  const targetMB = +document.getElementById('pptxTargetMB').value;
  const targetBytes = targetMB * 1024 * 1024;
  document.getElementById('pptxEstimate').style.display = 'block';
  document.getElementById('pptxEstimate').innerHTML =
    `📊 이미지 ${info.items.length}개 · 합계 ${fmtBytes(info.totalBytes)} (PPTX의 ${(info.totalBytes / pptxState.file.size * 100).toFixed(0)}%)<br>` +
    `목표 용량: <strong>${fmtBytes(targetBytes)}</strong> — 이미지 폭과 품질을 자동 조절합니다`;
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
  if (!pptxState.file) return;
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

    setPptxProgress(8, 'PPTX 로드 중…');
    const baseZip = await JSZip.loadAsync(fileBuf);

    setPptxProgress(12, '이미지 확인 중…');
    const media = await preparePptxMedia(baseZip);

    // XML 미리 정리해서 캐시
    setPptxProgress(18, 'XML 정리 중…');
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
      setPptxProgress(base, `시도 ${n}/${maxSteps} — ${w}px / 품질 ${q.toFixed(2)}`);

      // 시도마다 원본 PPTX에서 새로 시작
      const zip = await JSZip.loadAsync(fileBuf);
      const outMedia = await recompressPptxMedia(media, q, w, (d, t) =>
        setPptxProgress(base + span * 0.8 * (d / Math.max(1, t)), `시도 ${n}/${maxSteps} — 이미지 ${d}/${t}`));
      for (const [name, blob] of outMedia) zip.file(name, blob);
      for (const [fileName, minified] of minifiedXmlCache) zip.file(fileName, minified);

      setPptxProgress(base + span * 0.85, `시도 ${n}/${maxSteps} — PPTX 재패키징 중…`);
      return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
    });

    setPptxProgress(100, '완료');

    const { blob: bestBlob, params: bestParams, reached } = found;
    const fname = pptxState.file.name.replace(/\.pptx$/i, '') + '_compressed.pptx';

    const compressionRatio = ((1 - bestBlob.size / origSize) * 100).toFixed(1);
    const r = document.getElementById('pptxResult');
    r.className = 'result' + (reached ? '' : ' warning');
    r.style.display = 'block';
    r.innerHTML = `✅ <strong>${escHtml(fname)}</strong><br>
      원본 ${fmtBytes(origSize)} → 출력 ${fmtBytes(bestBlob.size)} (${compressionRatio}% 감소)<br>
      적용 옵션: ${bestParams.w}px / 품질 ${bestParams.q.toFixed(2)}<br>
      <span style="font-size:0.78rem; color:var(--fg-muted)">이미지 폭·품질 조절 + XML 정리 + ZIP 재압축</span>
      ${reached
        ? '<br>✓ 목표 용량 안에서 가장 좋은 화질로 만들었어요'
        : '<br>⚠️ 가장 작게 줄여도 목표 용량보다 커요. 시도한 것 중 가장 작은 파일을 내려받았어요. 영상·글꼴처럼 줄일 수 없는 내용이 많으면 이렇게 될 수 있어요.'}`;

    // 압축된 PPTX 자동 다운로드
    downloadBlob(bestBlob, fname);
    showToast(reached ? '다운로드 완료 ✓' : '목표 용량에는 못 미쳤어요', reached ? 'success' : undefined);
  } catch (e) {
    console.error(e);
    const r = document.getElementById('pptxResult');
    r.className = 'result error';
    r.style.display = 'block';
    r.textContent = '❌ 압축 중 오류: ' + (e.message || e);
    showToast('압축하지 못했어요', 'error');
  } finally {
    document.getElementById('pptxRunBtn').disabled = false;
    document.getElementById('pptxTargetMB').disabled = false;
    setTimeout(() => { document.getElementById('pptxProgress').style.display = 'none'; }, 1500);
  }
}

window.runPptx = runPptx;
window.switchTab = switchTab;
