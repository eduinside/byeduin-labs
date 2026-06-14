/* Blocks Universe — 에피소드 탐색기 */
'use strict';

const SERIES = [
  { id: 'numberblocks', name: 'Numberblocks', ko: '넘버블록스', emoji: '🔢', color: '#f5a524' },
  { id: 'alphablocks', name: 'Alphablocks', ko: '알파블록스', emoji: '🔤', color: '#006fee' },
  { id: 'colourblocks', name: 'Colourblocks', ko: '컬러블록스', emoji: '🎨', color: '#17c964' },
  { id: 'wonderblocks', name: 'Wonderblocks', ko: '원더블록스', emoji: '✨', color: '#9353d3' },
];
const LEVEL_COLORS = { 1: '#f31260', 2: '#f5a524', 3: '#d6b300', 4: '#17c964', 5: '#006fee' };
const FAV_KEY = 'bu_favs';
const PL_KEY = 'bu_playlist';
const DUR_KEY = 'bu_dur';

let DATA = null;            // { meta, episodes }
let byId = new Map();
const state = { series: null, season: 0, level: 0, theme: false, favOnly: false, q: '', aiIds: null };
let favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
let playlist = JSON.parse(localStorage.getItem(PL_KEY) || '{"title":"","ids":[]}');
let modalEp = null;
let modalLang = 'ko';
let dragSrc = null;

const $ = (id) => document.getElementById(id);
const thumb = (ep, q) => `https://img.youtube.com/vi/${ep.yt}/${q || 'hqdefault'}.jpg`;
const seriesOf = (ep) => SERIES.find(s => s.id === ep.series);
const dispTitle = (ep) => ep.ytKo ? (ep.titleKo || ep.title) : ep.title;
const playVid = (ep) => ep.ytKo || ep.yt;   // 재생용 영상 ID (한글판 우선)

/* ── 영상 길이 (YouTube Data API, localStorage 캐시) ── */
let durations = JSON.parse(localStorage.getItem(DUR_KEY) || '{}');

function fmtDur(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

async function ensureDurations(vids) {
  const missing = [...new Set(vids)].filter(v => v && !durations[v]);
  if (!missing.length) return;
  for (let i = 0; i < missing.length; i += 50) {
    try {
      const res = await fetch('/api/yt-duration?ids=' + missing.slice(i, i + 50).join(','));
      if (!res.ok) return;
      const data = await res.json();
      Object.assign(durations, data.durations || {});
    } catch { return; }
  }
  localStorage.setItem(DUR_KEY, JSON.stringify(durations));
}

/* ── 토스트 ── */
let toastTimer = null;
function toast(msg, ms = 2400) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function hideToast() {
  clearTimeout(toastTimer);
  $('toast').classList.remove('show');
}

/* ── 데이터 로드 ── */
async function init() {
  try {
    const res = await fetch('episodes.json');
    DATA = await res.json();
  } catch {
    $('epGrid').innerHTML = '<p class="empty-state">데이터를 불러오지 못했습니다. 새로고침 해주세요.</p>';
    return;
  }
  DATA.episodes.forEach(ep => byId.set(ep.id, ep));

  renderSeriesTabs();
  renderToolbar();
  renderGrid();   // series=null → welcome section
  updatePlFab();
  handleHash();
}

function goToWelcome() {
  state.series = null; state.season = 0; state.level = 0;
  state.theme = false; state.aiIds = null; state.q = ''; state.favOnly = false;
  $('searchInput').value = '';
  renderSeriesTabs(); renderToolbar(); renderGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── 시리즈 탭 ── */
function renderSeriesTabs() {
  $('welcomeBack').hidden = !state.series;
  const nav = $('seriesTabs');
  nav.innerHTML = '';
  for (const s of SERIES) {
    const m = DATA.meta[s.id] || { count: 0, seasons: 0 };
    const btn = document.createElement('button');
    btn.className = 'series-tab' + (state.series === s.id ? ' active' : '');
    btn.style.setProperty('--sc', s.color);
    btn.innerHTML = `
      <span class="st-emoji">${s.emoji}</span>
      <span class="st-name">${s.name}</span>
      <span class="st-meta">${s.ko} · ${m.count}편 · ${m.seasons > 1 ? `시즌 1~${m.seasons}` : `시즌 ${m.seasons}`}</span>`;
    btn.onclick = () => {
      state.series = s.id;
      state.season = 0; state.theme = false; state.aiIds = null;
      renderSeriesTabs(); renderToolbar(); renderGrid();
    };
    nav.appendChild(btn);
  }
}

/* ── 툴바 (시즌 칩 + 레벨 + 즐겨찾기) ── */
function renderToolbar() {
  $('toolbar').hidden = !state.series;
  if (!state.series) return;
  const s = SERIES.find(x => x.id === state.series);
  const m = DATA.meta[state.series] || { seasons: 0 };
  const chips = $('seasonChips');
  chips.innerHTML = '';
  const mk = (label, active, onClick, cls = '') => {
    const c = document.createElement('button');
    c.className = 'chip' + (cls ? ' ' + cls : '') + (active ? ' active' : '');
    c.style.setProperty('--sc', s.color);
    c.textContent = label;
    c.onclick = onClick;
    chips.appendChild(c);
  };
  mk('전체', state.season === 0 && !state.theme, () => { state.season = 0; state.theme = false; state.aiIds = null; renderToolbar(); renderGrid(); });
  for (let i = 1; i <= m.seasons; i++) {
    mk(`시즌 ${i}`, state.season === i && !state.theme, () => { state.season = i; state.theme = false; state.aiIds = null; renderToolbar(); renderGrid(); });
  }
  if (state.series === 'numberblocks') {
    mk('✖️ 구구단', state.theme, () => { state.theme = !state.theme; state.season = 0; state.aiIds = null; renderToolbar(); renderGrid(); }, 'theme-chip');
  }

  const seg = $('levelSeg');
  seg.innerHTML = '';
  const levels = [...new Set(DATA.episodes.filter(e => e.series === state.series && e.level).map(e => e.level))].sort();
  const mkSeg = (label, val) => {
    const b = document.createElement('button');
    b.className = state.level === val ? 'active' : '';
    b.textContent = label;
    b.onclick = () => { state.level = val; renderToolbar(); renderGrid(); };
    seg.appendChild(b);
  };
  mkSeg('레벨 전체', 0);
  levels.forEach(lv => mkSeg('Lv' + lv, lv));
  if (state.level && !levels.includes(state.level)) state.level = 0;

  $('favToggle').classList.toggle('active', state.favOnly);
}

/* ── 필터링 + 그리드 ── */
function filtered() {
  if (!state.series) return [];
  const q = state.q.trim().toLowerCase();
  return DATA.episodes.filter(ep => {
    if (ep.series !== state.series) return false;
    if (state.aiIds && !state.aiIds.has(ep.id)) return false;
    if (state.theme && ep.theme !== 'TimesTables') return false;
    if (!state.theme && state.season && ep.season !== state.season) return false;
    if (state.level && ep.level !== state.level) return false;
    if (state.favOnly && !favs.has(ep.id)) return false;
    if (q && !state.aiIds && ![ep.title, ep.titleKo, ep.desc, ep.descKo].join('\n').toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderGrid() {
  // 시리즈 미선택: 웰컴 화면
  if (!state.series) {
    renderWelcome();
    $('resultInfo').textContent = '';
    $('epGrid').innerHTML = '';
    $('emptyState').hidden = true;
    return;
  }
  document.getElementById('welcomeSection')?.remove();

  // AI 배너
  let banner = document.getElementById('aiBanner');
  if (state.aiIds) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'aiBanner';
      banner.className = 'ai-banner';
      $('epGrid').before(banner);
    }
    banner.innerHTML = `✨ AI 검색 결과 ${state.aiIds.size}편 <button onclick="clearAiIds()">✕ 초기화</button>`;
  } else {
    banner?.remove();
  }

  const list = filtered();
  const s = SERIES.find(x => x.id === state.series);
  $('resultInfo').textContent = `${s.ko} · ${list.length}편`;
  const grid = $('epGrid');
  grid.innerHTML = '';
  $('emptyState').hidden = list.length > 0;

  const frag = document.createDocumentFragment();
  for (const ep of list) {
    const card = document.createElement('article');
    card.className = 'ep-card';
    card.style.setProperty('--sc', s.color);
    card.innerHTML = `
      <div class="ep-thumb">
        <img src="${thumb(ep, 'mqdefault')}" alt="" loading="lazy">
        <span class="ep-se">S${ep.season} · E${ep.ep}</span>
        ${ep.ytKo ? '<span class="ep-ko-badge">한글판</span>' : ''}
        <button class="ep-fav ${favs.has(ep.id) ? 'on' : ''}" title="즐겨찾기">${favs.has(ep.id) ? '★' : '☆'}</button>
      </div>
      <div class="ep-body">
        <div class="ep-title">${dispTitle(ep)}</div>
        <div class="ep-sub">
          ${ep.level ? `<span class="ep-level" style="background:${LEVEL_COLORS[ep.level]}">Lv${ep.level}</span>` : ''}
          ${ep.ytKo && ep.titleKo ? `<span class="ep-en">${ep.title}</span>` : ''}
        </div>
      </div>`;
    card.querySelector('.ep-fav').onclick = (e) => { e.stopPropagation(); toggleFav(ep.id); };
    card.onclick = () => openEpisode(ep.id);
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

/* ── 웰컴 섹션 ── */
function renderWelcome() {
  if (document.getElementById('welcomeSection')) return;
  const total = DATA ? DATA.episodes.length : 351;
  const seriesBtns = SERIES.map(s =>
    `<button class="wf-random-btn" style="--sc:${s.color}" onclick="randomPlay('${s.id}')">${s.emoji} ${s.ko}</button>`
  ).join('');
  const sec = document.createElement('div');
  sec.id = 'welcomeSection';
  sec.className = 'welcome-section';
  sec.innerHTML = `
    <p class="welcome-hint">위에서 시리즈를 선택하면 에피소드를 탐색할 수 있어요</p>
    <div class="welcome-features">
      <div class="welcome-feat">
        <div class="wf-icon">📺</div>
        <div class="wf-title">4개 시리즈 · ${total}편</div>
        <div class="wf-desc">넘버블록스·알파블록스·컬러블록스·원더블록스 전 에피소드</div>
      </div>
      <div class="welcome-feat">
        <div class="wf-icon">🔍</div>
        <div class="wf-title">시즌·레벨·즐겨찾기 필터</div>
        <div class="wf-desc">시즌별·학습 레벨별로 걸러서 탐색. 즐겨찾기로 모아보기</div>
      </div>
      <div class="welcome-feat">
        <div class="wf-icon">✨</div>
        <div class="wf-title">AI 검색</div>
        <div class="wf-desc">한글·영문 키워드로 검색하면 AI가 관련 에피소드를 추천</div>
      </div>
      <div class="welcome-feat">
        <div class="wf-icon">▶</div>
        <div class="wf-title">재생목록 · 순차재생</div>
        <div class="wf-desc">에피소드를 모아 재생목록으로 만들고, 연속으로 자동 재생</div>
      </div>
      <div class="welcome-feat">
        <div class="wf-icon">🔀</div>
        <div class="wf-title">랜덤 재생</div>
        <div class="wf-desc">시리즈를 골라 에피소드를 바로 랜덤 재생</div>
        <div class="wf-random-btns">${seriesBtns}</div>
      </div>
    </div>`;
  $('epGrid').before(sec);
}

function randomPlay(seriesId) {
  const s = SERIES.find(x => x.id === seriesId);
  if (!s || !DATA) return;
  state.series = seriesId; state.season = 0; state.theme = false; state.aiIds = null;
  renderSeriesTabs(); renderToolbar(); renderGrid();
  const eps = DATA.episodes.filter(ep => ep.series === seriesId);
  const shuffled = [...eps].sort(() => Math.random() - 0.5);
  playlist = { title: `🔀 ${s.ko} 랜덤 재생`, ids: shuffled.map(ep => ep.id) };
  savePl();
  startSequentialPlay(`🔀 ${s.ko} 랜덤 재생`);
}

/* ── AI 추천 ── */
async function aiRecommend() {
  if (!state.series) { toast('시리즈를 먼저 선택해주세요'); return; }
  const q = $('searchInput').value.trim();
  if (!q) { $('searchInput').focus(); toast('검색어를 입력한 후 AI 검색을 눌러주세요'); return; }

  toast('✨ AI가 에피소드를 추천하는 중…', 0);
  // 현재 시리즈+시즌+레벨 필터 기준 에피소드를 LLM에 전달
  const base = DATA.episodes.filter(ep => {
    if (ep.series !== state.series) return false;
    if (state.theme && ep.theme !== 'TimesTables') return false;
    if (!state.theme && state.season && ep.season !== state.season) return false;
    if (state.level && ep.level !== state.level) return false;
    return true;
  });
  const episodes = base.map(e => ({
    id: e.id, title: e.title, titleKo: e.titleKo,
    desc: e.desc, descKo: e.descKo, level: e.level,
  }));
  if (!episodes.length) { hideToast(); toast('필터 결과가 없습니다. 필터를 조정해 주세요', 4000); return; }

  try {
    const res = await fetch('/api/bu-recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, episodes }),
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.ids)) throw new Error(data.error || `HTTP ${res.status}`);
    if (!data.ids.length) { hideToast(); toast('관련 에피소드를 찾지 못했습니다', 4000); return; }
    state.aiIds = new Set(data.ids);
    renderGrid();
    hideToast();
    toast(`✨ AI 검색 결과 ${data.ids.length}편`);
  } catch (e) {
    hideToast();
    toast(`❌ AI 검색 실패: ${e.message}`, 5000);
  }
}

function clearAiIds() {
  state.aiIds = null;
  renderGrid();
}

/* ── 즐겨찾기 ── */
function toggleFav(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
  renderGrid();
  if (modalEp && modalEp.id === id) renderModalActions();
}

/* ── 상세 모달 ── */
function openEpisode(id, updateHash = true) {
  const ep = byId.get(id);
  if (!ep) return;
  modalEp = ep;
  modalLang = (ep.ytKo || ep.titleKo || ep.descKo) ? 'ko' : 'en';
  renderModal();
  $('epModal').hidden = false;
  document.body.style.overflow = 'hidden';
  if (updateHash) history.replaceState(null, '', '#v=' + id);
}

function closeModal() {
  $('epModal').hidden = true;
  $('modalVideoWrap').innerHTML = '';
  document.body.style.overflow = '';
  modalEp = null;
  history.replaceState(null, '', location.pathname);
}

function renderModal(skipVideo = false) {
  const ep = modalEp;
  const s = seriesOf(ep);
  const useKo = modalLang === 'ko';
  const vid = useKo && ep.ytKo ? ep.ytKo : ep.yt;

  if (!skipVideo) {
    $('modalVideoWrap').innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="${ep.title}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>`;
  }

  const hasKo = !!(ep.titleKo || ep.descKo || ep.ytKo);
  const showLangToggle = hasKo || !!(ep.desc);
  // Case 3: AI-translated only (no Korean video) → show AI indicator, skip video on toggle
  const isAiDesc = !!ep.descKo && !ep.ytKo;
  $('modalTags').innerHTML = `
    <span class="mtag series-tag" style="background:${s.color}">${s.emoji} ${s.name}</span>
    <span class="mtag">시즌 ${ep.season} · ${ep.ep}화</span>
    ${ep.level ? `<span class="mtag" style="color:${LEVEL_COLORS[ep.level]}">Lv${ep.level}</span>` : ''}
    ${ep.theme === 'TimesTables' ? '<span class="mtag">✖️ 구구단</span>' : ''}
    ${showLangToggle ? `
      <span class="lang-toggle">
        <button id="langKo" class="${useKo ? 'active' : ''}${isAiDesc ? ' ai-lang' : ''}"${isAiDesc ? ' title="AI 번역 설명"' : ''}>${isAiDesc ? '🤖 한글번역' : '한글'}</button>
        <button id="langEn" class="${useKo ? '' : 'active'}">EN</button>
      </span>` : ''}`;
  if (showLangToggle) {
    $('langKo').onclick = async () => {
      modalLang = 'ko';
      // 영문 설명만 있고 한글 번역이 없으면 AI 번역 요청 (사전 번역 없는 예외 경우)
      if (ep.desc && !ep.descKo) {
        renderModal(isAiDesc);
        $('modalDesc').textContent = '✨ 번역 중…';
        try {
          const res = await fetch('/api/bu-translate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: ep.desc }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ko) ep.descKo = data.ko;
          }
        } catch { /* 실패 시 영문 표시 */ }
      }
      renderModal(isAiDesc);
    };
    $('langEn').onclick = () => { modalLang = 'en'; renderModal(isAiDesc); };
  }

  $('modalTitle').textContent = useKo && ep.titleKo ? ep.titleKo : ep.title;
  $('modalTitleSub').textContent = useKo && ep.titleKo ? ep.title : (ep.titleKo || '');
  $('modalDesc').textContent = (useKo && ep.descKo ? ep.descKo : ep.desc) || '';

  renderModalActions();
}

function renderModalActions() {
  const ep = modalEp;
  const inPl = playlist.ids.includes(ep.id);
  const favOn = favs.has(ep.id);
  $('modalActions').innerHTML = `
    <button class="m-act${favOn ? ' on-fav' : ''}" id="mFav">⭐ ${favOn ? '즐겨찾기 해제' : '즐겨찾기'}</button>
    <button class="m-act" id="mShare">🔗 공유</button>
    <button class="m-act${inPl ? ' on-pl' : ''}" id="mPl">${inPl ? '✅ 재생목록에 있음' : '➕ 재생목록'}</button>
    ${ep.official ? `<a class="m-act" href="${ep.official}" target="_blank" rel="noopener">🌐 공식 페이지</a>` : ''}`;
  $('mFav').onclick = () => toggleFav(ep.id);
  $('mShare').onclick = () => shareEpisode(ep);
  $('mPl').onclick = () => togglePlaylist(ep.id);
}

async function shareEpisode(ep) {
  const url = location.href.split('#')[0] + `#v=${ep.id}`;
  if (navigator.share) {
    try { await navigator.share({ title: dispTitle(ep), url }); return; } catch { /* 취소 시 무시 */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('🔗 링크가 복사되었습니다');
  } catch {
    prompt('링크를 복사하세요:', url);
  }
}

/* ── 재생목록 ── */
function savePl() {
  localStorage.setItem(PL_KEY, JSON.stringify(playlist));
  updatePlFab();
}

function updatePlFab() {
  $('plCount').textContent = playlist.ids.length;
}

function togglePlaylist(id) {
  const i = playlist.ids.indexOf(id);
  if (i >= 0) { playlist.ids.splice(i, 1); toast('재생목록에서 제거했습니다'); }
  else { playlist.ids.push(id); toast('➕ 재생목록에 추가했습니다'); }
  savePl();
  if (modalEp) renderModalActions();
  if ($('plDrawer').classList.contains('open')) renderPlDrawer();
}

function openPlDrawer() {
  renderPlDrawer();
  $('plDrawer').classList.add('open');
  document.body.classList.add('pl-open');
  ensureDurations(playlist.ids.filter(id => byId.has(id)).map(id => playVid(byId.get(id))))
    .then(() => { if ($('plDrawer').classList.contains('open')) renderPlDrawer(); });
}
function closePlDrawer() {
  $('plDrawer').classList.remove('open');
  document.body.classList.remove('pl-open');
}

function renderPlDrawer() {
  const list = $('plList');
  list.innerHTML = '';
  if (playlist.ids.length === 0) {
    $('plTotal').textContent = '';
    list.innerHTML = '<p class="pl-empty">재생목록이 비어 있습니다.<br>에피소드 상세에서 ➕ 버튼으로 추가하세요.</p>';
    return;
  }
  const valid = playlist.ids.filter(id => byId.has(id));
  const total = valid.reduce((sum, id) => sum + (durations[playVid(byId.get(id))] || 0), 0);
  $('plTotal').textContent = `${valid.length}편${total ? ' · 총 ' + fmtDur(total) : ''}`;
  playlist.ids.forEach((id, i) => {
    const ep = byId.get(id);
    if (!ep) return;
    const dur = durations[playVid(ep)];
    const row = document.createElement('div');
    row.className = 'pl-item';
    row.draggable = true;
    row.innerHTML = `
      <span class="pl-drag" title="드래그해서 순서 변경">⠿</span>
      <img src="${thumb(ep, 'default')}" alt="">
      <span class="pl-item-title">${i + 1}. ${dispTitle(ep)}
        ${dur ? `<small class="pl-item-dur">${fmtDur(dur)}</small>` : ''}</span>
      <button class="pl-del-btn" title="제거">✕</button>`;
    row.querySelector('.pl-del-btn').onclick = (e) => {
      e.stopPropagation(); playlist.ids.splice(i, 1); savePl(); renderPlDrawer();
    };
    row.onclick = () => { closePlDrawer(); openEpisode(id); };
    row.addEventListener('dragstart', (e) => {
      dragSrc = i; e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.pl-item').forEach(el => el.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', (e) => {
      if (!row.contains(e.relatedTarget)) row.classList.remove('drag-over');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault(); row.classList.remove('drag-over');
      if (dragSrc !== null && dragSrc !== i) {
        const [moved] = playlist.ids.splice(dragSrc, 1);
        playlist.ids.splice(i, 0, moved);
        savePl(); renderPlDrawer();
      }
    });
    row.addEventListener('dragend', () => {
      dragSrc = null;
      list.querySelectorAll('.pl-item').forEach(el => el.classList.remove('dragging', 'drag-over'));
    });
    list.appendChild(row);
  });
}

function movePl(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= playlist.ids.length) return;
  [playlist.ids[i], playlist.ids[j]] = [playlist.ids[j], playlist.ids[i]];
  savePl(); renderPlDrawer();
}

/* ── 재생목록 공유 (vives-share 패턴: base64url + 단축) ── */
function b64uEncode(obj) {
  return btoa(encodeURIComponent(JSON.stringify(obj)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64uDecode(str) {
  try {
    const raw = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - raw.length % 4) % 4;
    return JSON.parse(decodeURIComponent(atob(raw + '='.repeat(pad))));
  } catch { return null; }
}

async function sharePlaylist() {
  if (playlist.ids.length === 0) { toast('재생목록이 비어 있습니다'); return; }
  savePl();
  const payload = b64uEncode({ t: playlist.title, ids: playlist.ids });
  const longURL = location.href.split('#')[0] + `#list=${payload}`;
  toast('⏳ 공유 링크 생성 중…', 0);
  let url = longURL;
  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longURL }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.shortURL) url = data.shortURL;
    }
  } catch { /* 단축 실패 시 원본 URL 사용 */ }
  try {
    await navigator.clipboard.writeText(url);
    toast(url === longURL ? '🔗 링크 복사됨 (단축 실패, 원본 링크)' : '🔗 단축 링크가 복사되었습니다');
  } catch {
    prompt('링크를 복사하세요:', url);
  }
}

function importPlaylist(payload) {
  const p = b64uDecode(payload);
  history.replaceState(null, '', location.pathname);
  if (!p || !Array.isArray(p.ids) || p.ids.length === 0) { toast('재생목록 링크가 올바르지 않습니다'); return; }
  const valid = p.ids.filter(id => byId.has(id));
  const name = p.t || '공유된 재생목록';
  if (!confirm(`📋 "${name}" (${valid.length}편) 재생목록을 가져올까요?\n현재 내 재생목록을 대체합니다.`)) return;
  playlist = { title: name, ids: valid };
  savePl();
  openPlDrawer();
  toast('✅ 재생목록을 가져왔습니다');
}

/* ── 순차재생 (YT IFrame API) ── */
let ytPlayer = null;
let queue = [];
let queueIdx = 0;
let ytApiReady = null;
let watchdogTimer = null;
let durCache = JSON.parse(localStorage.getItem(DUR_KEY) || '{}');

function clearWatchdog() {
  clearTimeout(watchdogTimer);
  watchdogTimer = null;
}

async function fetchDuration(videoId) {
  if (durCache[videoId]) return durCache[videoId];
  try {
    const res = await fetch(`/api/yt-duration?ids=${videoId}`);
    if (!res.ok) return 0;
    const data = await res.json();
    const sec = data.durations?.[videoId] || 0;
    if (sec > 0) {
      durCache[videoId] = sec;
      localStorage.setItem(DUR_KEY, JSON.stringify(durCache));
    }
    return sec;
  } catch { return 0; }
}

async function setWatchdog(videoId) {
  clearWatchdog();
  const dur = durations[videoId] || await fetchDuration(videoId);
  if (!dur || !ytPlayer?.getCurrentTime) return;
  // PLAYING 이벤트 직후 호출되므로 약간의 딜레이 후 현재 위치 파악
  setTimeout(() => {
    const elapsed = ytPlayer.getCurrentTime?.() || 0;
    const remaining = Math.max((dur - elapsed) * 1000 + 1500, 3000);
    watchdogTimer = setTimeout(() => {
      if (ytPlayer && !document.getElementById('playerOverlay').hidden) playNext();
    }, remaining);
  }, 400);
}

function loadYtApi() {
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(); return; }
    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiReady;
}

async function startSequentialPlay(title) {
  if (playlist.ids.length === 0) { toast('재생목록이 비어 있습니다'); return; }
  queue = playlist.ids.filter(id => byId.has(id));
  queueIdx = 0;
  closePlDrawer();
  $('playerOverlay').hidden = false;
  document.body.classList.add('player-open');
  document.body.style.overflow = 'hidden';
  $('playerTitle').textContent = title || '재생목록';
  ensureDurations(queue.map(id => playVid(byId.get(id)))).then(renderPlayerUi);
  await loadYtApi();
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  $('playerStage').innerHTML = '<div id="ytPlayerHost"></div>';
  ytPlayer = new YT.Player('ytPlayerHost', {
    videoId: currentVideoId(),
    playerVars: { autoplay: 1, rel: 0, origin: location.origin },
    events: {
      onReady: () => setWatchdog(currentVideoId()),
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) { clearWatchdog(); playNext(); }
        else if (e.data === YT.PlayerState.PLAYING) setWatchdog(currentVideoId());
        else if (e.data === YT.PlayerState.PAUSED) clearWatchdog();
      },
    },
  });
  renderPlayerUi();
}

function currentVideoId() {
  return playVid(byId.get(queue[queueIdx]));
}

let lastAdvance = 0;
function playAt(i) {
  if (i < 0 || i >= queue.length) return;
  clearWatchdog();
  lastAdvance = performance.now();
  queueIdx = i;
  if (ytPlayer && ytPlayer.loadVideoById) ytPlayer.loadVideoById(currentVideoId());
  renderPlayerUi();
}
function playNext() {
  // ENDED 이벤트와 워치독이 동시에 트리거해도 한 번만 넘어가도록
  if (performance.now() - lastAdvance < 1500) return;
  if (queueIdx + 1 < queue.length) playAt(queueIdx + 1);
  else { stopWatchdog(); toast('🎉 재생목록이 끝났습니다'); }
}

/* ENDED 이벤트가 누락되는 경우를 대비한 자동 넘김 워치독:
   Data API 길이(폴백: player.getDuration) 기준으로 끝나기 직전 감지 */
let watchdog = null;
function startWatchdog() {
  stopWatchdog();
  watchdog = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
    const d = durations[currentVideoId()] ||
      (typeof ytPlayer.getDuration === 'function' ? ytPlayer.getDuration() : 0);
    if (!d) return;
    const playing = ytPlayer.getPlayerState && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING;
    if (playing && ytPlayer.getCurrentTime() >= d - 0.8) playNext();
  }, 1000);
}
function stopWatchdog() {
  if (watchdog) { clearInterval(watchdog); watchdog = null; }
}

function renderPlayerUi() {
  const ep = byId.get(queue[queueIdx]);
  const dur = durations[currentVideoId()];
  $('pcInfo').textContent =
    `${queueIdx + 1} / ${queue.length} · ${dispTitle(ep)}${dur ? ' · ' + fmtDur(dur) : ''}`;
  $('pcPrev').disabled = queueIdx === 0;
  $('pcNext').disabled = queueIdx === queue.length - 1;
  const q = $('playerQueue');
  q.innerHTML = '';
  queue.forEach((id, i) => {
    const e = byId.get(id);
    const d = document.createElement('div');
    d.className = 'pq-item' + (i === queueIdx ? ' current' : '');
    const dd = durations[playVid(e)];
    d.innerHTML = `<img src="${thumb(e, 'default')}" alt="" title="${dispTitle(e)}">
      ${dd ? `<span class="pq-dur">${fmtDur(dd)}</span>` : ''}`;
    d.onclick = () => playAt(i);
    q.appendChild(d);
  });
  const cur = q.children[queueIdx];
  if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function closePlayer() {
  clearWatchdog();
  stopWatchdog();
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  $('playerStage').innerHTML = '';
  $('playerOverlay').hidden = true;
  document.body.classList.remove('player-open');
  document.body.style.overflow = '';
}

/* ── 해시 라우팅 ── */
function handleHash() {
  const h = location.hash.slice(1);
  if (h.startsWith('v=')) {
    const id = h.slice(2);
    if (byId.has(id)) {
      const ep = byId.get(id);
      state.series = ep.series; state.aiIds = null;
      renderSeriesTabs(); renderToolbar(); renderGrid();
      openEpisode(id, false);
    }
  } else if (h.startsWith('list=')) {
    importPlaylist(h.slice(5));
  }
}

/* ── 이벤트 바인딩 ── */
function bind() {
  $('favToggle').onclick = () => { state.favOnly = !state.favOnly; state.aiIds = null; renderToolbar(); renderGrid(); };
  let debounce = null;
  $('searchInput').oninput = (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = e.target.value; state.aiIds = null; renderGrid(); }, 180);
  };
  $('aiSearchBtn').onclick = () => aiRecommend();
  $('epModal').onclick = (e) => { if (e.target === $('epModal')) closeModal(); };
  $('modalCloseBtn').onclick = closeModal;
  $('plFab').onclick = openPlDrawer;
  $('plCloseBtn').onclick = closePlDrawer;
  $('plPlayBtn').onclick = () => startSequentialPlay('재생목록');
  $('plShareBtn').onclick = sharePlaylist;
  $('plClearBtn').onclick = () => {
    if (playlist.ids.length && confirm('재생목록을 비울까요?')) {
      playlist = { title: '', ids: [] };
      savePl(); renderPlDrawer();
    }
  };
  $('playerCloseBtn').onclick = closePlayer;
  $('pcPrev').onclick = () => playAt(queueIdx - 1);
  $('pcNext').onclick = () => playAt(queueIdx + 1);
  // sticky 툴바가 상단 오버레이 버튼과 겹치지 않도록 padding 동적 추가
  function updateStuck() {
    const sentinel = $('toolbarSentinel');
    const toolbar = $('toolbar');
    if (sentinel && toolbar && !toolbar.hidden)
      toolbar.classList.toggle('is-stuck', sentinel.getBoundingClientRect().top < 0);
  }
  window.addEventListener('scroll', updateStuck, { passive: true });
  updateStuck();
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('playerOverlay').hidden) closePlayer();
    else if (!$('epModal').hidden) closeModal();
    else if ($('plDrawer').classList.contains('open')) closePlDrawer();
  });
}

bind();
init();
