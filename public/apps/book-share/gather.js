/* ── gather.html 전용 로직 ── */

/* ── 상태 ── */
let list = [];
const LS_ITEMS = 'bookwishlist_items';

/* ── 공유 데이터 디코딩 ──
   VUI.share.decode: 새 형식(UTF-8 base64url) → 옛 형식 btoa(encodeURIComponent()) → btoa(json).
   표준 base64·%2B 같은 URL 인코딩도 받아 준다(예전 링크 그대로). */
function decodeShareData(encoded) {
  return VUI.share.decode(encoded, d => Array.isArray(d));
}

/* ── 공유 데이터 검증: 디코드 직후 형식을 맞춘다(수량·가격은 숫자로 강제) ── */
function toInt(v, min, max, def) {
  if (window.VSafe) return VSafe.int(v, min, max, def);
  const n = Math.trunc(Number(v));
  return isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function cleanStr(v, max) {
  return (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, max) : '';
}
function sanitizeBook(b) {
  const book = {
    isbn13: cleanStr(b.isbn13, 20).replace(/[^0-9Xx]/g, ''),
    title: cleanStr(b.title, 300) || '(제목 없음)',
    author: cleanStr(b.author, 200),
    publisher: cleanStr(b.publisher, 200),
    priceStandard: toInt(b.priceStandard, 0, 10000000, 0),
    qty: toInt(b.qty, 0, 99999, 1),
  };
  if (b.error) book.error = true;
  if (Array.isArray(b._sources)) {
    book._sources = b._sources.filter(x => typeof x === 'string').slice(0, 200).map(x => x.slice(0, 500));
  }
  return book;
}
function sanitizeBooks(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 1000).filter(b => b && typeof b === 'object').map(sanitizeBook);
}

/* ── 링크 파싱 ──
   줄바꿈·공백·쉼표로 나눈다(공유 링크의 base64 데이터에는 공백·쉼표가 없다).
   링크 모양이 아닌 토막은 skipped로 세어 알린다. */
function parseLinks(text) {
  const links = [];
  let skipped = 0;

  for (const tok of text.split(/[\s,]+/)) {
    if (!tok) continue;
    // 단축URL 또는 공유 링크 형태
    if (/^https?:\/\//i.test(tok) || tok.startsWith('#share=')) {
      links.push(tok);
    } else {
      skipped++;
    }
  }

  return { links: [...new Set(links)], skipped }; // 중복 제거
}

/* ── Short.io API를 통한 URL 역추적 (실패하면 한국어 message의 Error) ── */
async function resolveShortURL(shortURL) {
  const data = await VUI.apiFetch('/api/resolve-short-url', { json: { shortURL } });
  return (data && typeof data.resolvedURL === 'string') ? data.resolvedURL : '';
}

/* ── 링크 처리 및 책 정보 추출 ──
   책을 하나도 얻지 못하면 이유(한국어)를 담은 Error를 던진다 → '실패 N건'과 실패 목록에 들어감 */
async function resolveAndDecodeLink(link) {
  // 단축코드 추출 (단축URL에서)
  let shortCode = '';
  const shortMatch = link.match(/\/([a-zA-Z0-9]+)$/);
  if (shortMatch) {
    shortCode = shortMatch[1];
  }

  // 공유 링크 형태 (#share=...)
  if (link.includes('#share=')) {
    const encoded = link.split('#share=')[1];
    const data = sanitizeBooks(decodeShareData(encoded));
    if (!data.length) throw new Error('링크 내용을 읽을 수 없어요(잘린 링크일 수 있어요)');
    // 공유 링크의 경우 source는 전체 링크
    return data.map(b => ({ ...b, _source: link }));
  }

  // 단축URL 형태
  if (/^https?:\/\//i.test(link)) {
    let resolvedURL;
    try {
      resolvedURL = await resolveShortURL(link);
    } catch (e) {
      console.error('링크 처리 오류:', link, e);
      throw new Error((e && e.message) || '단축 주소를 확인하지 못했어요');
    }

    // 최종 URL에서 공유 데이터 추출
    if (!resolvedURL || !resolvedURL.includes('#share=')) {
      throw new Error('도서 정보 나눔의 공유 링크가 아니에요');
    }
    const encoded = resolvedURL.split('#share=')[1];
    const data = sanitizeBooks(decodeShareData(encoded));
    if (!data.length) throw new Error('링크 내용을 읽을 수 없어요');
    // 단축코드를 source로 저장
    return data.map(b => ({ ...b, _source: shortCode }));
  }

  throw new Error('링크 형식이 아니에요');
}

/* ── 실패한 링크 목록 표시 ── */
function renderFailures(failed) {
  const box = document.getElementById('failBox');
  if (!box) return;
  if (!failed.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.innerHTML =
    `<p class="fail-box-title">${VUI.icon('triangle-alert')} 가져오지 못한 링크 ${failed.length}건</p>` +
    '<ul>' + failed.map(f =>
      `<li><span class="fail-link">${escHtml(f.link)}</span> <span class="fail-why">— ${escHtml(f.reason)}</span></li>`
    ).join('') + '</ul>';
  box.hidden = false;
}

/* ── 데이터 수집 및 병합 ── */
async function startGather() {
  const linkText = document.getElementById('linkInput').value;
  const { links, skipped } = parseLinks(linkText);
  const skippedMsg = skipped ? `링크가 아닌 글자 ${skipped}건 건너뜀` : '';

  if (links.length === 0) {
    showToast(skipped
      ? `붙여넣은 내용에 링크가 없어요(${skippedMsg}). https://로 시작하는 주소를 넣어 주세요.`
      : '공유 링크를 붙여넣어 주세요.', 'error');
    return;
  }
  renderFailures([]);

  const gatherBtn = document.getElementById('gatherBtn');
  gatherBtn.disabled = true;

  const pw = document.getElementById('gatherProgressWrap');
  pw.classList.add('visible');

  const failed = [];   // { link, reason }
  const collectedBooks = [];

  for (let i = 0; i < links.length; i++) {
    setGatherProgress(i + 1, links.length);

    try {
      const books = await resolveAndDecodeLink(links[i]);
      collectedBooks.push(...books);
    } catch (e) {
      failed.push({ link: links[i], reason: (e && e.message) || '알 수 없는 오류' });
      console.error('링크 처리 실패:', links[i], e);
    }

    // 다음 링크 처리 전 딜레이
    if (i < links.length - 1) {
      await sleep(300);
    }
  }

  // 중복 도서 수량 합산 및 출처 추적 (ISBN 기준)
  const booksByISBN = new Map();

  for (const book of collectedBooks) {
    const key = book.isbn13;
    if (booksByISBN.has(key)) {
      // 같은 ISBN 도서가 있으면 수량 합산 및 출처 추가
      const existing = booksByISBN.get(key);
      existing.qty = Math.min(99999, existing.qty + book.qty);
      // 출처 추가 (중복 제거)
      if (book._source && !existing._sources.includes(book._source)) {
        existing._sources.push(book._source);
      }
    } else {
      // 새로운 도서 추가
      const newBook = { ...book };
      newBook._sources = book._source ? [book._source] : [];
      booksByISBN.set(key, newBook);
    }
  }
  const uniqueBooks = Array.from(booksByISBN.values());

  // 결과 표시
  gatherBtn.disabled = false;
  pw.classList.remove('visible');
  renderFailures(failed);

  const extra = [];
  if (failed.length) extra.push(`실패 ${failed.length}건(아래 목록)`);
  if (skippedMsg) extra.push(skippedMsg);

  if (uniqueBooks.length > 0) {
    // 이 기기에 저장된 목록(도서 정보 나눔과 같은 저장소)을 바꾸기 전에 확인
    if (list.length > 0 && !(await VUI.confirm(
      `지금 이 기기에 저장된 목록(${list.length}줄)은 지워져요. 도서 정보 나눔 화면의 목록도 같은 목록이에요.`,
      { title: `수집한 ${uniqueBooks.length}권으로 목록을 바꿀까요?`, ok: '수집한 목록으로 바꾸기', cancel: '기존 목록 유지' }))) {
      showToast('기존 목록을 그대로 두었어요.' + (extra.length ? ' · ' + extra.join(' · ') : ''));
      return;
    }
    list = uniqueBooks.map(b => { const { _source, ...rest } = b; return rest; });
    saveList();
    renderTable();
    document.getElementById('tableSection').style.display = '';
    // 실패가 섞이면 성공색을 쓰지 않는다(기본 토스트)
    showToast([`링크 ${links.length - failed.length}개에서 ${uniqueBooks.length}권 수집`, ...extra].join(' · '));
  } else {
    showToast(['수집된 책이 없어요', ...extra].join(' · '), 'error');
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
  const arrow = document.getElementById('gatherArrow');

  const validList = list.filter(b => !b.error);
  const errorList = list.filter(b => b.error);

  const empty = document.getElementById('emptyState');

  if (list.length === 0) {
    section.style.display = 'none';
    arrow.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }

  section.style.display = '';
  arrow.style.display = '';
  if (empty) empty.style.display = 'none';

  // 행 렌더링
  let num = 0;
  tbody.innerHTML = list.map((b, idx) => {
    if (!b.error) num++;
    return `<tr class="${b.error ? 'error-row' : ''}">
      <td class="num">${b.error ? '–' : num}</td>
      <td class="title">${escHtml(b.title)}${b.isbn13 ? `<span class="isbn">ISBN ${escHtml(b.isbn13)}</span>` : ''}</td>
      <td class="author">${escHtml(b.author || '')}</td>
      <td class="publisher">${escHtml(b.publisher)}</td>
      <td class="price">${b.priceStandard ? b.priceStandard.toLocaleString() + '원' : '–'}</td>
      <td class="qty">${b.error ? '' : `<input class="qty-input" type="number" min="0" max="999" value="${b.qty}" data-idx="${idx}" aria-label="${escHtml(b.title)} 주문수량" onchange="updateQty(this)">`}</td>
      <td class="del"><button type="button" class="del-btn" title="삭제" aria-label="${escHtml(b.title)} 삭제" onclick="deleteRow(${idx})">${VUI.icon('x')}</button></td>
    </tr>`;
  }).join('');

  // 통계 (표 아래)
  const totalQty = validList.reduce((s, b) => s + (b.qty || 0), 0);
  const totalPrice = validList.reduce((s, b) => s + (b.priceStandard || 0) * (b.qty || 0), 0);
  document.getElementById('statsRow').innerHTML =
    `<span>총 <strong>${validList.length}종</strong></span>` +
    `<span>주문수량 <strong>${totalQty}권</strong></span>` +
    `<span>합계 <strong>${totalPrice.toLocaleString()}원</strong></span>` +
    (errorList.length ? `<span class="fail-stat">조회 실패 <strong>${errorList.length}건</strong></span>` : '');
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
  // 누른 버튼이 사라졌으니 같은 자리(없으면 위)의 삭제 버튼으로 포커스
  const btns = document.querySelectorAll('#tableBody .del-btn');
  const next = btns[Math.min(idx, btns.length - 1)] || document.getElementById('linkInput');
  if (next) next.focus();
}

/* ── localStorage 저장 ── */
function saveList() {
  try {
    localStorage.setItem(LS_ITEMS, JSON.stringify(list));
  } catch {
    showToast('브라우저 저장 공간이 부족해 목록을 저장하지 못했어요.', 'error');
  }
}

/* ── SheetJS: 엑셀 내려받기를 누를 때만 불러온다(첫 화면을 막지 않게) ── */
const XLSX_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
let xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxLoading) {
    xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = XLSX_SRC;
      s.async = true;
      s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX 없음'));
      s.onerror = () => { s.remove(); reject(new Error('불러오기 실패')); };
      document.head.appendChild(s);
    }).catch(e => { xlsxLoading = null; throw e; }); // 실패하면 다음 클릭 때 다시 시도
  }
  return xlsxLoading;
}

/* ── 엑셀 내보내기 (book-share index와 같은 형식 + 출처 열) ── */
async function exportExcel() {
  const valid = list.filter(b => !b.error);
  if (valid.length === 0) { showToast('내려받을 책이 없어요.'); return; }

  const btn = document.getElementById('excelBtn');
  if (btn) btn.disabled = true;
  try {
    await loadXLSX();
  } catch {
    showToast('엑셀 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.', 'error');
    return;
  } finally {
    if (btn) btn.disabled = false;
  }

  const rows = valid.map((b, i) => ({
    '순번': i + 1,
    '도서명': b.title,
    '저자': b.author || '',
    '출판사': b.publisher,
    '정가': b.priceStandard,
    '주문수량': b.qty,
    'ISBN': b.isbn13,
    '출처': (b._sources && b._sources.length > 0) ? b._sources.join(', ') : '',
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
    { wch: 30 },  // 출처
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '도서 정보');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `도서 정보_${today}.xlsx`);
  showToast('엑셀 파일을 내려받았어요.');
}

/* ── 유틸리티 ── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escHtml(str) {
  if (window.VSafe) return VSafe.esc(str);
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 공용 토스트(/common/ui.js)
function showToast(msg, type) { VUI.toast(msg, type); }

function goHome() {
  window.location.href = './';
}

/* ── 링크로 공유 ── */
async function shareList() {
  const validList = list.filter(b => !b.error);
  if (validList.length === 0) { showToast('공유할 책이 없어요.'); return; }

  // UTF-8 base64url(VUI.share.encode) — 받는 쪽(book-share)은 옛 형식도 읽는다
  const longUrl = `${window.location.origin}/apps/book-share/#share=${VUI.share.encode(validList)}`;

  // 단축(실패하면 원래 링크) → 복사. 복사가 안 되면 링크 창(입력칸 + 복사 버튼)
  const btn = document.getElementById('shareBtn');
  if (btn) btn.disabled = true;
  try {
    await VUI.share.link(longUrl, {
      title: '수집한 목록 공유',
      desc: `링크를 연 사람은 이 목록(${validList.length}권)을 도서 정보 나눔에서 볼 수 있어요.`,
    });
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── 전체 초기화 ── */
// 저장소(LS_ITEMS)를 도서 정보 나눔과 함께 쓰므로 그쪽 목록도 비워진다 — 확인 문구에 밝힌다
async function confirmReset() {
  const ok = await VUI.confirm(
    `수집한 목록 ${list.length}줄과 입력한 링크를 모두 지울까요? 되돌릴 수 없어요.\n도서 정보 나눔 화면의 목록도 같은 저장 공간을 써서 함께 지워져요.`,
    { title: '전체 초기화', ok: '모두 지우기', danger: true });
  if (!ok) return;
  list = [];
  try { localStorage.removeItem(LS_ITEMS); } catch {}
  renderTable();
  renderFailures([]);
  document.getElementById('tableSection').style.display = 'none';
  document.getElementById('linkInput').value = '';
  showToast('목록을 모두 지웠어요.');
}

/* ── 초기화 ── */
(function init() {
  // localStorage에서 저장된 데이터 복원
  try { list = sanitizeBooks(JSON.parse(localStorage.getItem(LS_ITEMS) || '[]')); } catch { list = []; }
  renderTable();
})();
