/**
 * Numberblocks Finder — app.js (좌측 사이드바 구조)
 * 사이드바 필터 + 메인 그리드 + 모달 + 즐겨찾기 + AI 검색 + vives-share
 */

/* ══════════════════════════════════════════ §1 상수 */
const PAGE_SIZE = 20;
const LS_FAV = 'nb_favorites';
const LS_VISITED = 'nb_visited';

const SEASON_RANGES = [[1,1,15],[2,16,25],[3,26,35],[4,36,45],[5,46,55],[6,56,75],[7,76,95],[8,96,999]];

const LEVELS = [
  {id:'step1', label:'🔴 Red', color:'#ef4444'},
  {id:'step2', label:'🟠 Orange', color:'#f97316'},
  {id:'step3', label:'🟡 Yellow', color:'#eab308'},
  {id:'step4', label:'🟢 Green', color:'#22c55e'},
  {id:'step5', label:'🔵 Blue+', color:'#3b82f6'},
];

const DOMAINS = [
  {id:'number', label:'🔢 수와 연산'},
  {id:'geometry', label:'🔺 도형'},
  {id:'measurement', label:'📏 측정'},
  {id:'pattern', label:'🧩 규칙성'},
  {id:'data', label:'📊 자료'},
];

const LEVEL_COLOR = Object.fromEntries(LEVELS.map(l => [l.id, l.color]));

/* ══════════════════════════════════════════ §2 상태 */
let allEpisodes = [];
const state = {
  activeSeasons: [],
  activeLevels: [],
  activeTags: [],
  favoritesOnly: false,
  q: '',
  page: 1,
  geminiActive: false,
  geminiResults: [],
  modal: null,
};

/* ══════════════════════════════════════════ §3 유틸리티 */
function computeSeason(ep) {
  const n = parseInt(ep.id.replace('ep_',''),10);
  for (const [s,lo,hi] of SEASON_RANGES) {
    if(n>=lo && n<=hi) return s;
  }
  return 8;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(LS_FAV) || '[]'); }
  catch { return []; }
}

function getVisited() {
  try { return JSON.parse(localStorage.getItem(LS_VISITED) || '[]'); }
  catch { return []; }
}

function getYoutubeThumbnail(url) {
  if(!url || !url.includes('youtu')) return null;
  const id = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1];
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function showToast(msg) {
  const t = document.getElementById('nbToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ══════════════════════════════════════════ §4 필터링 */
function getFilteredEpisodes() {
  if(state.geminiActive && state.geminiResults.length) {
    const ids = new Set(state.geminiResults);
    return allEpisodes.filter(ep => ids.has(ep.id));
  }

  let results = allEpisodes;

  // 필터링
  if(state.activeSeasons.length) {
    results = results.filter(ep => state.activeSeasons.includes(ep.season));
  }
  if(state.activeLevels.length) {
    results = results.filter(ep => state.activeLevels.includes(ep.levelId));
  }
  if(state.activeTags.length) {
    results = results.filter(ep => state.activeTags.includes(ep.domainId));
  }
  if(state.favoritesOnly) {
    const favSet = new Set(getFavorites());
    results = results.filter(ep => favSet.has(ep.id));
  }

  // 검색
  const q = state.q.trim().toLowerCase();
  if(q) {
    results = results.filter(ep =>
      ep.title.toLowerCase().includes(q) ||
      (ep.topic || '').toLowerCase().includes(q) ||
      (ep.idea || '').toLowerCase().includes(q)
    );
  }

  return results;
}

/* ══════════════════════════════════════════ §5 카드 렌더링 */
function createCardHTML(ep) {
  const isFav = getFavorites().includes(ep.id);
  const isVisited = getVisited().includes(ep.id);
  const lvlColor = LEVEL_COLOR[ep.levelId] || 'var(--primary)';

  return `<article class="ep-card${isVisited?' ep-visited':''}" data-id="${ep.id}" role="button" tabindex="0" aria-label="${escHtml(ep.title)}">
  <div class="ep-thumb-wrap">
    <img src="${escHtml(ep.img||'')}" alt="${escHtml(ep.title)}" class="ep-thumb" loading="lazy" decoding="async">
    <span class="ep-season-tag">S${ep.season}</span>
  </div>
  <div class="ep-body">
    <h3 class="ep-title">${escHtml(ep.title)}</h3>
    <div class="ep-badges">
      <span class="ep-badge ep-level-badge" style="--lvl-color:${lvlColor}">${escHtml(ep.levelName.split(' ')[0]||'')}</span>
      <span class="ep-badge ep-grade-badge">${escHtml(ep.korGrade||'')}</span>
    </div>
    <p class="ep-idea">${escHtml(ep.idea||'')}</p>
  </div>
  <button class="ep-fav-btn${isFav?' is-fav':''}" data-id="${ep.id}">${isFav?'★':'☆'}</button>
</article>`;
}

function renderGrid(reset=false) {
  const grid = document.getElementById('episodeGrid');
  const empty = document.getElementById('emptyState');
  const sentinel = document.getElementById('scrollSentinel');
  const filtered = getFilteredEpisodes();

  if(reset) {
    state.page = 1;
    grid.innerHTML = '';
  }

  if(!filtered.length) {
    empty.classList.remove('hidden');
    sentinel.style.display = 'none';
    return;
  }
  empty.classList.add('hidden');

  const start = (state.page-1)*PAGE_SIZE;
  const end = Math.min(state.page*PAGE_SIZE, filtered.length);
  const slice = filtered.slice(start, end);

  grid.insertAdjacentHTML('beforeend', slice.map(createCardHTML).join(''));

  sentinel.style.display = end < filtered.length ? 'block' : 'none';
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById('scrollSentinel');
  new IntersectionObserver(entries => {
    if(!entries[0].isIntersecting) return;
    const total = getFilteredEpisodes().length;
    if(state.page*PAGE_SIZE < total) {
      state.page++;
      renderGrid(false);
    }
  }, {rootMargin:'250px'}).observe(sentinel);
}

/* ══════════════════════════════════════════ §6 사이드바 필터 */
function renderSidebarFilters() {
  // 시즌
  const seasonDiv = document.getElementById('seasonFilters');
  seasonDiv.innerHTML = Array.from({length:8}, (_,i) => {
    const s = i+1;
    const isActive = state.activeSeasons.includes(s);
    return `<button class="filter-btn${isActive?' active':''}" data-season="${s}">시즌 ${s}</button>`;
  }).join('');
  seasonDiv.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleSeason(+btn.dataset.season));
  });

  // 수준
  const levelDiv = document.getElementById('levelFilters');
  levelDiv.innerHTML = LEVELS.map(l => {
    const isActive = state.activeLevels.includes(l.id);
    return `<button class="filter-btn${isActive?' active':''}" data-level="${l.id}">${l.label}</button>`;
  }).join('');
  levelDiv.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleLevel(btn.dataset.level));
  });

  // 태그
  const tagDiv = document.getElementById('tagFilters');
  tagDiv.innerHTML = DOMAINS.map(d => {
    const isActive = state.activeTags.includes(d.id);
    return `<button class="filter-btn${isActive?' active':''}" data-tag="${d.id}">${d.label}</button>`;
  }).join('');
  tagDiv.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleTag(btn.dataset.tag));
  });
}

function toggleSeason(s) {
  const idx = state.activeSeasons.indexOf(s);
  if(idx===-1) state.activeSeasons.push(s);
  else state.activeSeasons.splice(idx,1);
  renderSidebarFilters();
  updateContentHeader();
  renderGrid(true);
}

function toggleLevel(l) {
  const idx = state.activeLevels.indexOf(l);
  if(idx===-1) state.activeLevels.push(l);
  else state.activeLevels.splice(idx,1);
  renderSidebarFilters();
  updateContentHeader();
  renderGrid(true);
}

function toggleTag(t) {
  const idx = state.activeTags.indexOf(t);
  if(idx===-1) state.activeTags.push(t);
  else state.activeTags.splice(idx,1);
  renderSidebarFilters();
  updateContentHeader();
  renderGrid(true);
}

function updateContentHeader() {
  const filtered = getFilteredEpisodes();
  const title = document.getElementById('contentTitle');
  const subtitle = document.getElementById('contentSubtitle');

  let titleText = '모든 에피소드';
  if(state.activeSeasons.length) titleText = `시즌 ${state.activeSeasons.join(', ')}`;
  else if(state.activeLevels.length) titleText = LEVELS.filter(l => state.activeLevels.includes(l.id)).map(l => l.label).join(' / ');
  else if(state.activeTags.length) titleText = DOMAINS.filter(d => state.activeTags.includes(d.id)).map(d => d.label).join(' / ');
  if(state.favoritesOnly) titleText += ' (즐겨찾기)';

  title.textContent = titleText;
  subtitle.textContent = filtered.length ? `${filtered.length}개 에피소드` : '';
}

/* ══════════════════════════════════════════ §7 모달 */
function openModal(epId) {
  const ep = allEpisodes.find(e => e.id === epId);
  if(!ep) return;
  state.modal = epId;

  // 모든 콘텐츠 초기화 (캐싱 버그 방지)
  const modal = document.getElementById('episodeModal');
  modal.classList.remove('hidden');

  // 제목, 설명
  document.getElementById('modalTitle').textContent = ep.title;
  document.getElementById('modalIdea').textContent = ep.description || ep.idea || '';

  // 배지 (시즌 중복 제거)
  const lvlColor = LEVEL_COLOR[ep.levelId] || 'var(--primary)';
  document.getElementById('modalBadges').innerHTML = `
    <span class="ep-badge ep-level-badge" style="--lvl-color:${lvlColor}">${escHtml(ep.levelName||'')}</span>
    <span class="ep-badge ep-grade-badge">${escHtml(ep.korGrade||'')}</span>
  `;

  // 비디오 (초기화)
  const videoWrap = document.getElementById('modalVideoWrap');
  const langToggle = document.getElementById('modalLangToggle');
  const btnKr = document.getElementById('btnLangKr');
  const btnEn = document.getElementById('btnLangEn');

  // 비디오 초기화
  videoWrap.style.display = '';
  document.getElementById('modalIframe').src = 'about:blank';

  const hasKr = ep.videoKr && ep.videoKr !== '#' && ep.videoKr.includes('youtu');
  const hasEn = ep.video && ep.video !== '#' && ep.video.includes('youtu');

  btnKr.style.display = hasKr ? '' : 'none';
  btnEn.style.display = hasEn ? '' : 'none';
  langToggle.style.display = (hasKr||hasEn) ? '' : 'none';

  if(!hasKr && !hasEn) {
    videoWrap.style.display = 'none';
    langToggle.style.display = 'none';
  } else if(hasKr) {
    setModalVideo(ep, 'kr');
    btnKr.classList.add('active');
    btnEn.classList.remove('active');
  } else if(hasEn) {
    setModalVideo(ep, 'en');
    btnEn.classList.add('active');
    btnKr.classList.remove('active');
  }

  // 원본 링크
  const origLink = document.getElementById('modalOrigLink');
  origLink.href = ep.link || '#';
  origLink.style.display = ep.link ? '' : 'none';

  // 즐겨찾기 버튼
  updateModalFavBtn(epId);

  // 표시
  document.body.style.overflow = 'hidden';
  addVisited(epId);
}

function setModalVideo(ep, lang) {
  const url = lang==='kr' ? ep.videoKr : ep.video;
  const id = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1];
  const iframe = document.getElementById('modalIframe');
  iframe.src = id ? `https://www.youtube.com/embed/${id}?rel=0` : 'about:blank';
}

function closeModal() {
  document.getElementById('episodeModal').classList.add('hidden');
  document.getElementById('modalIframe').src = 'about:blank';
  document.body.style.overflow = '';
  state.modal = null;
}

function updateModalFavBtn(epId) {
  const isFav = getFavorites().includes(epId);
  const btn = document.getElementById('modalFavBtn');
  if(btn) {
    btn.textContent = isFav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기';
    btn.classList.toggle('is-fav', isFav);
  }
}

/* ══════════════════════════════════════════ §8 즐겨찾기 */
function toggleFavorite(epId, cardEl) {
  let favs = getFavorites();
  const idx = favs.indexOf(epId);
  const ep = allEpisodes.find(e => e.id === epId);
  const epTitle = ep ? ep.title : epId;

  if(idx===-1) {
    favs.push(epId);
    console.log(`✅ 즐겨찾기 추가: ${epTitle} (${epId})`);
    showToast('즐겨찾기에 추가됨 ★');
  } else {
    favs.splice(idx,1);
    console.log(`❌ 즐겨찾기 제거: ${epTitle} (${epId})`);
    showToast('즐겨찾기에서 제거됨');
  }
  console.log(`현재 즐겨찾기 (${favs.length}개):`, favs);
  localStorage.setItem(LS_FAV, JSON.stringify(favs));

  const isFav = favs.includes(epId);

  // 전달된 cardEl 업데이트
  if(cardEl) {
    const btn = cardEl.querySelector('.ep-fav-btn');
    if(btn) {
      btn.textContent = isFav ? '★' : '☆';
      btn.classList.toggle('is-fav', isFav);
    }
  } else {
    // cardEl이 없으면 DOM에서 찾아서 업데이트
    const card = document.querySelector(`[data-id="${epId}"]`);
    if(card) {
      const btn = card.querySelector('.ep-fav-btn');
      if(btn) {
        btn.textContent = isFav ? '★' : '☆';
        btn.classList.toggle('is-fav', isFav);
      }
    }
  }

  if(state.modal === epId) updateModalFavBtn(epId);
  if(state.favoritesOnly) renderGrid(true);
}

function addVisited(id) {
  const v = getVisited();
  if(!v.includes(id)) {
    v.push(id);
    localStorage.setItem(LS_VISITED, JSON.stringify(v));
  }
}

/* ══════════════════════════════════════════ §9 공유 */
function shareEpisode(epId) {
  const payload = JSON.stringify({ep:epId});
  const encoded = btoa(encodeURIComponent(payload)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const url = `${location.origin}/numberblocks/#share=${encoded}`;
  fetch('/api/shorten', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({url})
  }).then(r => r.json()).then(d => {
    navigator.clipboard.writeText(d.shortURL || url).then(() => {
      showToast('링크 복사됨 ✓');
    }).catch(() => showToast('URL: '+url));
  }).catch(() => {
    navigator.clipboard.writeText(url).then(() => showToast('링크 복사됨 ✓'));
  });
}

/* ══════════════════════════════════════════ §10 MD 내보내기 */
function exportToMD() {
  const filtered = getFilteredEpisodes();
  if(!filtered.length) {showToast('내보낼 에피소드 없음'); return;}

  const today = new Date().toISOString().slice(0,10);
  let md = `# Numberblocks 에피소드\n> ${today} · ${filtered.length}개\n\n`;
  filtered.forEach((ep,i) => {
    md += `${i+1}. **[${ep.title}](${ep.link||'#'})**\n${ep.idea || ''}\n`;
    if(ep.videoKr && ep.videoKr!=='#') md += `- 🇰🇷 [한글](${ep.videoKr})\n`;
    if(ep.video) md += `- 🇬🇧 [영문](${ep.video})\n`;
  });

  const payload = JSON.stringify({data:{content:md, filename:`numberblocks-${today}.md`}, permission:'clone'});
  const encoded = btoa(encodeURIComponent(payload)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  location.href = `/md-editor/#share=${encoded}`;
}

/* ══════════════════════════════════════════ §11 검색 */
let searchTimer;
function onSearchInput(e) {
  state.q = e.target.value;
  state.geminiActive = false;
  state.geminiResults = [];
  document.getElementById('geminiBanner').classList.add('hidden');

  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    updateContentHeader();
    renderGrid(true);
    const q = state.q.trim();
    if(q.length >= 3 && getFilteredEpisodes().length === 0) {
      runGeminiSearch(q);
    }
  }, 300);
}

async function runGeminiSearch(q) {
  const aiBtn = document.getElementById('sidebarAiBtn');
  if(aiBtn) aiBtn.classList.add('loading');
  try {
    const res = await fetch('/api/gemini-search', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({q, episodes:allEpisodes.map(e => ({id:e.id, title:e.title, idea:e.idea||'', topic:e.topic||''}))})
    });
    if(!res.ok) throw new Error();
    const {ids} = await res.json();
    if(Array.isArray(ids) && ids.length) {
      state.geminiActive = true;
      state.geminiResults = ids;
      document.getElementById('geminiBannerText').textContent = `"${q}" — ${ids.length}개`;
      document.getElementById('geminiBanner').classList.remove('hidden');
      renderGrid(true);
    }
  } catch {}
  finally {
    if(aiBtn) aiBtn.classList.remove('loading');
  }
}

/* ══════════════════════════════════════════ §12 초기화 */
async function loadData() {
  try {
    const res = await fetch('Numberblocks_Episodes.json');
    const data = await res.json();
    allEpisodes = data.map((ep, idx) => ({
      id: `ep_${parseInt(ep.Episode)}`,
      season: parseInt(ep.Season),
      episode: parseInt(ep.Episode),
      title: ep.Title_KO || ep.Title_EN,
      title_en: ep.Title_EN,
      title_ko: ep.Title_KO,
      description: ep.Description || '',
      idea: ep.Description ? ep.Description.substring(0, 100) : '',
      link: ep.Official_Homepage || '',
      img: getYoutubeThumbnail(ep.YouTube_KO) || getYoutubeThumbnail(ep.YouTube_EN) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Crect fill='%23eee' width='320' height='180'/%3E%3Ctext x='50%25' y='50%25' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3EEp ${ep.Episode}%3C/text%3E%3C/svg%3E`,
      videoKr: ep.YouTube_KO ? (ep.YouTube_KO.includes('youtu') ? ep.YouTube_KO : '#') : '#',
      video: ep.YouTube_EN ? (ep.YouTube_EN.includes('youtu') ? ep.YouTube_EN : '#') : '#',
      korGrade: `시즌 ${ep.Season}`,
      grade: `Season ${ep.Season}`,
      levelId: 'step1',
      levelName: 'Red Level (1단계)',
      domainId: 'number',
      domainName: '수와 연산',
      topic: ep.Title_KO || ep.Title_EN,
    }));
  } catch (e) {
    console.error('로드 실패:', e);
    showToast('로드 실패');
    return;
  }

  // vives-share 해시 확인
  const hash = location.hash;
  if(hash.startsWith('#share=')) {
    history.replaceState(null, '', location.pathname);
    try {
      const encoded = hash.slice(7);
      const raw = encoded.replace(/-/g,'+').replace(/_/g,'/');
      const pad = (4 - raw.length%4)%4;
      const payload = JSON.parse(decodeURIComponent(atob(raw+'='.repeat(pad))));
      if(payload && payload.ep) {
        setTimeout(() => openModal(payload.ep), 100);
      }
    } catch {}
  }

  renderSidebarFilters();
  updateContentHeader();
  renderGrid(true);
  setupInfiniteScroll();
}

document.addEventListener('DOMContentLoaded', () => {
  // 사이드바 토글
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  if(mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => sidebar.classList.add('open'));
  if(sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', () => sidebar.classList.remove('open'));

  // 필터 아코디언 토글
  document.querySelectorAll('.filter-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterOptions = btn.nextElementSibling;
      const toggleIcon = btn.querySelector('.toggle-icon');
      if(filterOptions) {
        filterOptions.classList.toggle('open');
        toggleIcon.classList.toggle('rotated');
      }
    });
  });

  // 검색
  const searchInput = document.getElementById('sidebarSearchInput');
  if(searchInput) searchInput.addEventListener('input', onSearchInput);

  // 즐겨찾기 체크박스
  const favChk = document.getElementById('favoritesCheckbox');
  if(favChk) favChk.addEventListener('change', () => {
    state.favoritesOnly = favChk.checked;
    updateContentHeader();
    renderGrid(true);
  });

  // 모달
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('episodeModal').addEventListener('click', e => {
    if(e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if(e.key==='Escape' && state.modal) closeModal();
  });

  document.getElementById('btnLangKr').addEventListener('click', () => {
    const ep = allEpisodes.find(e => e.id === state.modal);
    if(!ep) return;
    setModalVideo(ep, 'kr');
    document.getElementById('btnLangKr').classList.add('active');
    document.getElementById('btnLangEn').classList.remove('active');
  });

  document.getElementById('btnLangEn').addEventListener('click', () => {
    const ep = allEpisodes.find(e => e.id === state.modal);
    if(!ep) return;
    setModalVideo(ep, 'en');
    document.getElementById('btnLangEn').classList.add('active');
    document.getElementById('btnLangKr').classList.remove('active');
  });

  document.getElementById('modalFavBtn').addEventListener('click', () => {
    if(state.modal) toggleFavorite(state.modal, null);
  });

  document.getElementById('modalShareBtn').addEventListener('click', () => {
    if(state.modal) shareEpisode(state.modal);
  });

  // 에피소드 그리드 - 모든 클릭 처리 (이벤트 위임)
  // ep-fav-btn에도 data-id가 있으므로 반드시 .ep-card로 카드를 찾아야 함
  document.getElementById('episodeGrid').addEventListener('click', e => {
    const card = e.target.closest('.ep-card');
    if(!card) return;

    const favBtn = e.target.closest('.ep-fav-btn');
    if(favBtn) {
      // 즐겨찾기 버튼 클릭
      e.stopPropagation();
      const epId = card.getAttribute('data-id');
      toggleFavorite(epId, card);
    } else {
      // 카드 클릭 (즐겨찾기 버튼 제외)
      const epId = card.getAttribute('data-id');
      addVisited(epId);
      card.classList.add('ep-visited');
      openModal(epId);
    }
  });

  // MD 버튼
  document.getElementById('sidebarMdBtn').addEventListener('click', exportToMD);

  // Gemini 배너
  document.getElementById('geminiClearBtn').addEventListener('click', () => {
    state.geminiActive = false;
    state.geminiResults = [];
    document.getElementById('geminiBanner').classList.add('hidden');
    renderGrid(true);
  });

  // AI 버튼
  document.getElementById('sidebarAiBtn').addEventListener('click', () => {
    const q = document.getElementById('sidebarSearchInput').value.trim();
    if(q.length < 2) {showToast('검색어 입력'); return;}
    runGeminiSearch(q);
  });

  loadData();
});
