/* ── gather.html 전용 로직 ── */

/* ── 상태 ── */
let list = [];
const LS_ITEMS = 'bookwishlist_items';

/* ── 공유 데이터 디코딩 (index.html에서 복사) ── */
function decodeShareData(encoded) {
  // 1. base64url 방식 (현재 인코딩)
  try {
    const raw = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - raw.length % 4) % 4;
    const payload = decodeURIComponent(atob(raw + '='.repeat(pad)));
    const data = JSON.parse(payload);
    if (Array.isArray(data)) return data;
  } catch {}

  // 2. 표준 base64 방식 (구버전 링크 호환)
  try {
    const payload = decodeURIComponent(atob(encoded));
    const data = JSON.parse(payload);
    if (Array.isArray(data)) return data;
  } catch {}

  // 3. URL이 브라우저에서 %2B 등으로 인코딩된 경우 먼저 디코딩
  try {
    const decoded = decodeURIComponent(encoded);
    const raw = decoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - raw.length % 4) % 4;
    const payload = decodeURIComponent(atob(raw + '='.repeat(pad)));
    const data = JSON.parse(payload);
    if (Array.isArray(data)) return data;
  } catch {}

  return null;
}

/* ── 링크 파싱 ── */
function parseLinks(text) {
  const lines = text.split(/[\n\r]+/).filter(l => l.trim());
  const links = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 단축URL 또는 공유 링크 형태
    if (/^https?:\/\//.test(trimmed) || trimmed.startsWith('#share=')) {
      links.push(trimmed);
    }
  }

  return [...new Set(links)]; // 중복 제거
}

/* ── Short.io API를 통한 URL 역추적 ── */
async function resolveShortURL(shortURL) {
  try {
    const res = await fetch('/.netlify/functions/resolve-short-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortURL }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'URL 추적 실패');
    }

    const data = await res.json();
    return data.resolvedURL;
  } catch (e) {
    throw new Error('링크 추적 오류: ' + e.message);
  }
}

/* ── 링크 처리 및 책 정보 추출 ── */
async function resolveAndDecodeLink(link) {
  // 공유 링크 형태 (#share=...)
  if (link.includes('#share=')) {
    const encoded = link.split('#share=')[1];
    const data = decodeShareData(encoded);
    return (data && Array.isArray(data)) ? data : [];
  }

  // 단축URL 형태
  if (/^https?:\/\//.test(link)) {
    try {
      const resolvedURL = await resolveShortURL(link);

      // 최종 URL에서 공유 데이터 추출
      if (resolvedURL.includes('#share=')) {
        const encoded = resolvedURL.split('#share=')[1];
        const data = decodeShareData(encoded);
        return (data && Array.isArray(data)) ? data : [];
      }
    } catch (e) {
      console.error('링크 처리 오류:', link, e);
    }
  }

  return [];
}

/* ── 데이터 수집 및 병합 ── */
async function startGather() {
  const linkText = document.getElementById('linkInput').value;
  const links = parseLinks(linkText);

  if (links.length === 0) {
    showToast('유효한 링크가 없습니다.');
    return;
  }

  const gatherBtn = document.getElementById('gatherBtn');
  gatherBtn.disabled = true;

  const pw = document.getElementById('gatherProgressWrap');
  pw.classList.add('visible');

  let collected = 0, errors = 0;
  const collectedBooks = [];

  for (let i = 0; i < links.length; i++) {
    setGatherProgress(i + 1, links.length);

    try {
      const books = await resolveAndDecodeLink(links[i]);
      if (Array.isArray(books) && books.length > 0) {
        collectedBooks.push(...books);
        collected++;
      }
    } catch (e) {
      errors++;
      console.error('링크 처리 실패:', links[i], e);
    }

    // 다음 링크 처리 전 딜레이
    if (i < links.length - 1) {
      await sleep(300);
    }
  }

  // 중복 제거 (ISBN 기준)
  const seenISBNs = new Set();
  const uniqueBooks = collectedBooks.filter(b => {
    if (seenISBNs.has(b.isbn13)) return false;
    seenISBNs.add(b.isbn13);
    return true;
  });

  // 결과 표시
  gatherBtn.disabled = false;
  pw.classList.remove('visible');

  if (uniqueBooks.length > 0) {
    list = uniqueBooks;
    saveList();
    renderTable();
    document.getElementById('tableSection').style.display = '';
    showToast(`✓ ${uniqueBooks.length}권 수집 완료${errors ? ` (실패 ${errors}건)` : ''}`);
  } else {
    showToast('수집된 책이 없습니다.');
  }
}

/* ── 진행 상태 표시 ── */
function setGatherProgress(current, total) {
  const percentage = (current / total * 100);
  document.getElementById('gatherProgressFill').style.width = percentage + '%';
  document.getElementById('gatherProgressText').textContent = `수집 중… ${current} / ${total}`;
}

/* ── 테이블 렌더 (index.html에서 복사) ── */
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const section = document.getElementById('tableSection');

  const validList = list.filter(b => !b.error);
  const errorList = list.filter(b => b.error);

  if (list.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';

  // 행 렌더링
  let num = 0;
  tbody.innerHTML = list.map((b, idx) => {
    if (!b.error) num++;
    return `<tr class="${b.error ? 'error-row' : ''}">
      <td class="num">${b.error ? '–' : num}</td>
      <td class="title">${escHtml(b.title)}</td>
      <td>${escHtml(b.author || '')}</td>
      <td>${escHtml(b.publisher)}</td>
      <td class="price">${b.priceStandard ? b.priceStandard.toLocaleString() + '원' : '–'}</td>
      <td class="qty">${b.error ? '' : `<input class="qty-input" type="number" min="0" max="999" value="${b.qty}" data-idx="${idx}" onchange="updateQty(this)">`}</td>
      <td class="del"><button class="del-btn" title="삭제" onclick="deleteRow(${idx})">✕</button></td>
    </tr>`;
  }).join('');

  // 통계 (표 아래)
  const totalQty = validList.reduce((s, b) => s + (b.qty || 0), 0);
  const totalPrice = validList.reduce((s, b) => s + (b.priceStandard || 0) * (b.qty || 0), 0);
  document.getElementById('statsRow').innerHTML =
    `<span>총 <strong>${validList.length}종</strong></span>` +
    `<span>주문수량 <strong>${totalQty}권</strong></span>` +
    `<span>합계 <strong>${totalPrice.toLocaleString()}원</strong></span>` +
    (errorList.length ? `<span style="color:var(--danger)">조회 실패 <strong>${errorList.length}건</strong></span>` : '');
}

/* ── 수량 업데이트 ── */
function updateQty(input) {
  const idx = parseInt(input.dataset.idx, 10);
  const val = Math.max(0, parseInt(input.value, 10) || 0);
  input.value = val;
  list[idx].qty = val;
  saveList();
  renderTable(); // 통계 갱신
}

/* ── 행 삭제 ── */
function deleteRow(idx) {
  list.splice(idx, 1);
  saveList();
  renderTable();
}

/* ── localStorage 저장 ── */
function saveList() {
  localStorage.setItem(LS_ITEMS, JSON.stringify(list));
}

/* ── 엑셀 내보내기 (index.html에서 복사) ── */
function exportExcel() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 로딩 중...'); return; }
  const valid = list.filter(b => !b.error);
  if (valid.length === 0) { showToast('내보낼 항목이 없습니다.'); return; }

  const rows = valid.map((b, i) => ({
    '순번': i + 1,
    '도서명': b.title,
    '저자': b.author || '',
    '출판사': b.publisher,
    '정가': b.priceStandard,
    '주문수량': b.qty,
    'ISBN': b.isbn13,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 5 },   // 순번
    { wch: 40 },  // 도서명
    { wch: 20 },  // 저자
    { wch: 16 },  // 출판사
    { wch: 10 },  // 정가
    { wch: 10 },  // 주문수량
    { wch: 16 },  // ISBN
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '도서 정보');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `도서 정보_${today}.xlsx`);
  showToast('엑셀 파일을 내려받았습니다.');
}

/* ── 유틸리티 ── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function goHome() {
  window.location.href = './';
}

/* ── 링크로 공유 ── */
function shareList() {
  const validList = list.filter(b => !b.error);
  if (validList.length === 0) { showToast('공유할 책이 없습니다.'); return; }

  // Base64url 인코딩
  const json = JSON.stringify(validList);
  const encoded = btoa(encodeURIComponent(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encoded}`;

  // 클립보드에 복사
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('공유 링크가 복사되었습니다.');
  }).catch(() => {
    // 폴백: 사용자가 직접 복사할 수 있도록 프롬프트
    const msg = prompt('공유 링크를 복사하세요:', shareUrl);
  });
}

/* ── 전체 초기화 ── */
function confirmReset() {
  if (confirm('정말로 모든 데이터를 삭제하시겠습니까?')) {
    list = [];
    localStorage.removeItem(LS_ITEMS);
    renderTable();
    document.getElementById('tableSection').style.display = 'none';
    document.getElementById('linkInput').value = '';
    showToast('초기화 완료');
  }
}

/* ── 초기화 ── */
(function init() {
  // localStorage에서 저장된 데이터 복원
  const saved = localStorage.getItem(LS_ITEMS);
  if (saved) {
    try { list = JSON.parse(saved); } catch { list = []; }
  }
  renderTable();
})();
