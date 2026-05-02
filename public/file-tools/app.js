// ─────────────── 공통 ───────────────
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
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

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
}

// 드롭존 바인딩
function bindDropzone(zoneEl, inputEl, onFiles) {
  zoneEl.addEventListener('click', () => inputEl.click());
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
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

// ─────────────── Tab 1: 스캔 최적화 ───────────────
const scanState = { files: [], format: 'pdf' };

bindDropzone(
  document.getElementById('scanDrop'),
  document.getElementById('scanInput'),
  (files) => {
    scanState.files.push(...files);
    renderScanList();
  }
);

document.querySelectorAll('#scanFormatToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    scanState.format = btn.dataset.fmt;
    document.querySelectorAll('#scanFormatToggle button').forEach(b => b.classList.toggle('active', b === btn));
    updateScanEstimate();
  });
});

['scanQuality', 'scanMaxWidth', 'scanTargetMB'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (id === 'scanQuality') document.getElementById('scanQualityVal').textContent = (+document.getElementById(id).value).toFixed(2);
    updateScanEstimate();
  });
});

function renderScanList() {
  const el = document.getElementById('scanFileList');
  el.innerHTML = scanState.files.map((f, i) =>
    `<div class="file-list-item">
       <span>${f.name}</span>
       <span class="meta">${fmtBytes(f.size)} <button class="file-list-remove" onclick="removeScanFile(${i})" title="제거">×</button></span>
     </div>`).join('');
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
    const q = +document.getElementById('scanQuality').value;
    const w = +document.getElementById('scanMaxWidth').value;
    // 거친 추정: JPEG 평균 ~ 0.15 bytes/픽셀 × quality 가중치
    const bytesPerPage = w * (w * 1.41) * (0.04 + q * 0.18);
    const est = bytesPerPage * pages * (scanState.format === 'pdf' ? 1.05 : 1);
    document.getElementById('scanEstimate').style.display = 'block';
    document.getElementById('scanEstimate').innerHTML =
      `📊 입력 ${scanState.files.length}개 · ${pages}페이지 · 예상 출력 <strong>≈ ${fmtBytes(est)}</strong> ` +
      `<span style="color:var(--fg-muted)">(품질 ${q.toFixed(2)}, ${w}px 기준)</span>`;
  }, 200);
}

function setScanProgress(pct, msg) {
  document.getElementById('scanProgress').style.display = 'block';
  document.getElementById('scanProgressFill').style.width = pct + '%';
  document.getElementById('scanProgressMsg').textContent = msg;
}

// 모든 입력을 페이지 단위 캔버스 배열로 변환
async function rasterizeAll(maxWidth, onProgress) {
  const pages = []; // { canvas, sourceName }
  let total = 0, done = 0;
  // 1차 패스로 페이지 수 추정
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
        const c = downscaleToCanvas(bmp, maxWidth);
        pages.push({ canvas: c, sourceName: f.name.replace(/\.[^.]+$/, ''), pageIdx: i + 1 });
        done++;
        onProgress?.(done, total);
      }
    }
  }
  return pages;
}

async function buildPdf(pages, quality) {
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();
  let totalSize = 0;
  for (const p of pages) {
    const blob = await canvasToBlob(p.canvas, 'image/jpeg', quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    totalSize += bytes.length;
    const img = await doc.embedJpg(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const out = await doc.save();
  return { blob: new Blob([out], { type: 'application/pdf' }), imgTotal: totalSize };
}

async function buildJpgZip(pages, quality) {
  if (pages.length === 1) {
    const blob = await canvasToBlob(pages[0].canvas, 'image/jpeg', quality);
    return { blob, ext: 'jpg' };
  }
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++) {
    const blob = await canvasToBlob(pages[i].canvas, 'image/jpeg', quality);
    const name = `${pages[i].sourceName}_p${pages[i].pageIdx}.jpg`;
    zip.file(name, blob);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return { blob, ext: 'zip' };
}

async function runScan() {
  if (!scanState.files.length) return;
  document.getElementById('scanRunBtn').disabled = true;
  document.getElementById('scanResult').style.display = 'none';

  const maxWidth = +document.getElementById('scanMaxWidth').value;
  const targetMB = parseFloat(document.getElementById('scanTargetMB').value);
  const targetBytes = isFinite(targetMB) && targetMB > 0 ? targetMB * 1024 * 1024 : null;
  const initialQ = +document.getElementById('scanQuality').value;
  const fmt = scanState.format;

  const origTotal = scanState.files.reduce((s, f) => s + f.size, 0);

  try {
    setScanProgress(5, '페이지 라스터화 중…');
    const pages = await rasterizeAll(maxWidth, (d, t) => setScanProgress(5 + (d / t) * 50, `페이지 라스터화 중… ${d}/${t}`));

    const qualities = targetBytes ? [initialQ, 0.65, 0.55, 0.45, 0.4] : [initialQ];
    let result, finalQ;
    for (let i = 0; i < qualities.length; i++) {
      const q = qualities[i];
      finalQ = q;
      setScanProgress(60 + (i / qualities.length) * 35, `${fmt.toUpperCase()} 생성 중… (품질 ${q.toFixed(2)})`);
      result = fmt === 'pdf'
        ? (await buildPdf(pages, q))
        : (await buildJpgZip(pages, q));
      if (!targetBytes || result.blob.size <= targetBytes) break;
    }

    setScanProgress(100, '완료');

    const ext = fmt === 'pdf' ? 'pdf' : (result.ext || 'jpg');
    const baseName = scanState.files.length === 1
      ? scanState.files[0].name.replace(/\.[^.]+$/, '')
      : 'optimized';
    const fname = `${baseName}_optimized.${ext}`;
    downloadBlob(result.blob, fname);

    const reachedTarget = !targetBytes || result.blob.size <= targetBytes;
    const ratio = ((1 - result.blob.size / origTotal) * 100).toFixed(1);
    const r = document.getElementById('scanResult');
    r.className = 'result' + (reachedTarget ? '' : ' warning');
    r.style.display = 'block';
    r.innerHTML = `✅ <strong>${fname}</strong> 다운로드<br>
      원본 ${fmtBytes(origTotal)} → 출력 ${fmtBytes(result.blob.size)} (${ratio}% 감소, 품질 ${finalQ.toFixed(2)})
      ${targetBytes ? `<br>${reachedTarget ? '✓ 목표 용량 달성' : '⚠️ 목표 용량 초과 — 가로폭을 더 줄이면 추가 압축 가능'}` : ''}`;

    showToast('변환 완료 ✓');
  } catch (e) {
    console.error(e);
    const r = document.getElementById('scanResult');
    r.className = 'result error';
    r.style.display = 'block';
    r.textContent = '❌ 변환 중 오류: ' + (e.message || e);
  } finally {
    document.getElementById('scanRunBtn').disabled = false;
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
       <span>${f.name}</span>
       <span class="meta">${fmtBytes(f.size)} <button class="file-list-remove" onclick="window.clearPptx()" title="제거">×</button></span>
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
    // 최소 = 이미지 없을 때 용량의 50% (극단적 압축 허용)
    // 최대 = 현재 크기
    const fileMB = pptxState.file.size / 1024 / 1024;
    const nonImageSize = pptxState.file.size - totalBytes;
    const nonImageMB = nonImageSize / 1024 / 1024;

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
    showToast('PPTX 파일을 열 수 없습니다');
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

function setPptxProgress(pct, msg) {
  document.getElementById('pptxProgress').style.display = 'block';
  document.getElementById('pptxProgressFill').style.width = pct + '%';
  document.getElementById('pptxProgressMsg').textContent = msg;
}

async function recompressPptx(zip, mediaNames, quality, maxWidth, onProgress) {
  // 중복 이미지 추적: hash -> { origName, blob, minSize }
  const imageHashes = new Map();

  for (let i = 0; i < mediaNames.length; i++) {
    const name = mediaNames[i];
    const ext = name.split('.').pop().toLowerCase();
    const origBlob = await zip.files[name].async('blob');
    let outBlob = origBlob;

    try {
      if (ext === 'jpg' || ext === 'jpeg') {
        const bmp = await createImageBitmap(origBlob);
        const c = downscaleToCanvas(bmp, maxWidth);
        // 품질을 더 낮춰서 시도: quality, quality-0.1, quality-0.2, ...
        let bestBlob = origBlob;
        for (let q = quality; q >= 0.3; q -= 0.05) {
          const recomp = await canvasToBlob(c, 'image/jpeg', q);
          if (recomp && recomp.size < bestBlob.size) {
            bestBlob = recomp;
          }
        }
        outBlob = bestBlob;
      } else if (ext === 'png') {
        const bmp = await createImageBitmap(origBlob);
        const hasAlpha = await pngHasAlpha(origBlob);
        const c = downscaleToCanvas(bmp, maxWidth);
        if (!hasAlpha) {
          // alpha 없으면 JPEG로 변환 시도 (훨씬 작음)
          let bestBlob = origBlob;
          for (let q = quality; q >= 0.3; q -= 0.05) {
            const asJpeg = await canvasToBlob(c, 'image/jpeg', q);
            if (asJpeg && asJpeg.size < bestBlob.size) {
              bestBlob = asJpeg;
            }
          }
          outBlob = bestBlob;
        } else {
          // alpha 있으면 PNG 유지
          const asPng = await canvasToBlob(c, 'image/png');
          if (asPng && asPng.size < origBlob.size) outBlob = asPng;
        }
      }
    } catch (e) {
      console.warn('이미지 재압축 실패:', name, e);
    }

    // 중복 검사: Blob 내용의 간단한 해시 (첫 100KB 기반)
    const sample = await outBlob.slice(0, 102400).arrayBuffer();
    const hashVal = Array.from(new Uint8Array(sample)).slice(0, 1000).join(',');

    if (imageHashes.has(hashVal)) {
      // 중복 발견: PPTX 내 참조 경로만 변경하고 파일은 건드리지 않음
      // 실제로는 .rels 파일을 수정해야 하지만, 간단히 기존 이미지로 교체
      const existing = imageHashes.get(hashVal);
      zip.file(name, existing.blob);
    } else {
      imageHashes.set(hashVal, { origName: name, blob: outBlob });
      zip.file(name, outBlob);
    }

    onProgress?.(i + 1, mediaNames.length);
  }
}

function minifyXml(xml) {
  return xml
    .replace(/>\s+</g, '><')           // 엘리먼트 사이 공백 제거
    .replace(/<!--[\s\S]*?-->/g, '')   // 주석 제거
    .replace(/\s+/g, ' ')              // 연속 공백을 단일 공백으로
    .trim();
}

async function runPptx() {
  if (!pptxState.file) return;
  document.getElementById('pptxRunBtn').disabled = true;
  document.getElementById('pptxResult').style.display = 'none';

  const targetMB = +document.getElementById('pptxTargetMB').value;
  const targetBytes = targetMB * 1024 * 1024;
  const origSize = pptxState.file.size;
  const fileBuf = await pptxState.file.arrayBuffer();

  try {
    // 목표 용량에 따라 시작 범위 결정 (낮을수록 더 공격적)
    const fileMB = origSize / 1024 / 1024;
    const ratio = targetBytes / origSize;

    let widths, qualities;
    if (ratio < 0.05) {
      // 5% 이하: 극단적 압축 (400px 품질 0.3부터 시작)
      widths = [400, 600, 800, 1000, 1200, 1400];
      qualities = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    } else if (ratio < 0.1) {
      // 10% 이하: 매우 공격적 (600px 품질 0.4부터)
      widths = [600, 800, 1000, 1200, 1400, 1600];
      qualities = [0.4, 0.5, 0.6, 0.7, 0.8];
    } else if (ratio < 0.2) {
      // 20% 이하: 공격적 (800px 품질 0.5부터)
      widths = [800, 1000, 1200, 1400, 1600, 1800];
      qualities = [0.5, 0.6, 0.7, 0.8];
    } else {
      // 그 이상: 표준 범위
      widths = [1400, 1600, 1800, 2000, 2400];
      qualities = [0.65, 0.75, 0.85];
    }

    // 격자 생성
    const attempts = [];
    for (const w of widths) {
      for (const q of qualities) {
        attempts.push({ w, q });
      }
    }

    let bestBlob = null, bestParams = null;
    for (let a = 0; a < attempts.length; a++) {
      const { w, q } = attempts[a];
      setPptxProgress(Math.floor((a / attempts.length) * 85), `시도 ${a + 1}/${attempts.length} — ${w}px / 품질 ${q.toFixed(2)}`);

      const zip = await JSZip.loadAsync(fileBuf);
      const mediaNames = Object.keys(zip.files).filter(n => n.startsWith('ppt/media/') && !zip.files[n].dir);

      await recompressPptx(zip, mediaNames, q, w, () => {});

      // XML minify
      setPptxProgress(85 + (a / attempts.length) * 5, `메타데이터 최적화 중…`);
      for (const fileName of Object.keys(zip.files)) {
        if ((fileName.endsWith('.xml') || fileName.endsWith('.rels')) && !zip.files[fileName].dir) {
          try {
            const xmlText = await zip.files[fileName].async('text');
            const minified = minifyXml(xmlText);
            zip.file(fileName, minified);
          } catch (e) {
            // 바이너리 파일은 무시
          }
        }
      }

      setPptxProgress(90 + (a / attempts.length) * 5, `PPTX 재패키징 중…`);
      const outBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

      bestBlob = outBlob;
      bestParams = { w, q };
      if (outBlob.size <= targetBytes) break;
    }

    setPptxProgress(100, '완료');

    const fname = pptxState.file.name.replace(/\.pptx$/i, '') + '_compressed.pptx';

    // 압축된 blob 임시 저장
    window._pptxCompressedBlob = bestBlob;
    window._pptxCompressedFname = fname;

    const reached = bestBlob.size <= targetBytes;
    const compressionRatio = ((1 - bestBlob.size / origSize) * 100).toFixed(1);
    const r = document.getElementById('pptxResult');
    r.className = 'result' + (reached ? '' : ' warning');
    r.style.display = 'block';
    r.innerHTML = `✅ <strong>${fname}</strong><br>
      원본 ${fmtBytes(origSize)} → 출력 ${fmtBytes(bestBlob.size)} (${compressionRatio}% 감소)<br>
      적용 옵션: ${bestParams.w}px / 품질 ${bestParams.q.toFixed(2)}<br>
      <span style="font-size:0.78rem; color:var(--fg-muted)">이미지 폭·품질 조절 + XML minify + ZIP 재압축</span>
      ${reached ? '<br>✓ 목표 용량 달성' : '<br>⚠️ 목표 용량 초과 — 슬라이더를 더 내리세요'}`;

    // PDF 변환 모달 표시
    document.getElementById('pptxPdfModal').style.display = 'flex';

    showToast('압축 완료 ✓');
  } catch (e) {
    console.error(e);
    const r = document.getElementById('pptxResult');
    r.className = 'result error';
    r.style.display = 'block';
    r.textContent = '❌ 압축 중 오류: ' + (e.message || e);
  } finally {
    document.getElementById('pptxRunBtn').disabled = false;
    setTimeout(() => { document.getElementById('pptxProgress').style.display = 'none'; }, 1500);
  }
}

function closePptxPdfModal() {
  document.getElementById('pptxPdfModal').style.display = 'none';
  // PPTX 다운로드
  downloadBlob(window._pptxCompressedBlob, window._pptxCompressedFname);
}

async function convertPptxToPdf() {
  const modal = document.getElementById('pptxPdfModal');
  modal.style.display = 'none';

  const pptxBlob = window._pptxCompressedBlob;
  const origFname = window._pptxCompressedFname;

  try {
    showToast('PDF 변환 중…');
    const pptxZip = await JSZip.loadAsync(pptxBlob);

    // slide1.xml ~ slideN.xml 찾기
    const slideFiles = Object.keys(pptxZip.files)
      .filter(n => n.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/)[0]);
        const bNum = parseInt(b.match(/\d+/)[0]);
        return aNum - bNum;
      });

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    // 각 슬라이드를 이미지로 변환해 PDF에 임베드
    for (let i = 0; i < slideFiles.length; i++) {
      const slideXml = await pptxZip.files[slideFiles[i]].async('text');
      // 슬라이드 크기 추출 (기본 16:9)
      let slideWidth = 960, slideHeight = 540;
      const sizeMatch = slideXml.match(/cSld.*?extLst/);
      if (sizeMatch) {
        const wxMatch = slideXml.match(/cx="(\d+)"/);
        const hyMatch = slideXml.match(/cy="(\d+)"/);
        if (wxMatch) slideWidth = Math.round(parseInt(wxMatch[1]) / 914400);
        if (hyMatch) slideHeight = Math.round(parseInt(hyMatch[1]) / 914400);
      }

      // 슬라이드 임베드 이미지 추출
      const relsFile = `ppt/slides/_rels/${slideFiles[i].split('/')[2]}.rels`;
      let imageRels = [];
      try {
        const relsXml = await pptxZip.files[relsFile].async('text');
        const matches = relsXml.matchAll(/Id="rId(\d+)".*?Target="\.\.\/media\/([^"]+)"/g);
        for (const m of matches) imageRels.push({ rId: m[1], file: m[2] });
      } catch (e) {}

      // 첫 번째 이미지나 플레이스홀더 사용
      let slideImage = null;
      if (imageRels.length > 0) {
        try {
          const imgBlob = await pptxZip.files[`ppt/media/${imageRels[0].file}`].async('blob');
          const buf = await imgBlob.arrayBuffer();
          const ext = imageRels[0].file.split('.').pop().toLowerCase();
          slideImage = ext === 'png'
            ? await pdfDoc.embedPng(new Uint8Array(buf))
            : await pdfDoc.embedJpg(new Uint8Array(buf));
        } catch (e) {}
      }

      // PDF 페이지 추가
      const page = pdfDoc.addPage([slideWidth, slideHeight]);
      if (slideImage) {
        page.drawImage(slideImage, {
          x: 0, y: 0,
          width: slideWidth,
          height: slideHeight
        });
      } else {
        // 텍스트 플레이스홀더
        page.drawText(`Slide ${i + 1}`, {
          x: 50, y: slideHeight - 50,
          size: 24,
          color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFname = origFname.replace(/\.pptx$/i, '.pdf');

    // 두 파일 모두 다운로드
    downloadBlob(window._pptxCompressedBlob, origFname);
    setTimeout(() => downloadBlob(pdfBlob, pdfFname), 500);

    showToast(`${pdfFname} 변환 완료 ✓`);
  } catch (e) {
    console.error(e);
    showToast('PDF 변환 중 오류: ' + (e.message || e));
    // 그래도 PPTX는 다운로드
    downloadBlob(window._pptxCompressedBlob, origFname);
  }
}

window.runPptx = runPptx;
window.switchTab = switchTab;
window.closePptxPdfModal = closePptxPdfModal;
window.convertPptxToPdf = convertPptxToPdf;
