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
const RECENT_KEY = 'bu_recent';
const RECENT_MAX = 50;

let DATA = null;            // { meta, episodes }
let byId = new Map();
const state = { series: null, season: 0, level: 0, theme: false, favOnly: false, recentOnly: false, q: '', aiIds: null };
// localStorage 값이 깨져 있어도 앱이 멈추지 않도록 형식 검사 후 기본값으로 대체
function loadJSON(key, def, ok) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return def;
    const v = JSON.parse(raw);
    return ok(v) ? v : def;
  } catch { return def; }
}
const isIdArr = (v) => Array.isArray(v) && v.every(x => typeof x === 'string');
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const loadPlaylist = () => {
  const p = loadJSON(PL_KEY, null, (v) => isObj(v) && isIdArr(v.ids));
  return p ? { title: typeof p.title === 'string' ? p.title : '', ids: p.ids } : { title: '', ids: [] };
};
let favs = new Set(loadJSON(FAV_KEY, [], isIdArr));
let recent = loadJSON(RECENT_KEY, [], isIdArr); // id 배열, 최신순
let playlist = loadPlaylist();
let modalEp = null;
let modalLang = 'ko';
let navIds = [];   // 모달 이전/다음 탐색 대상 (열 때의 필터 결과)
let dragSrc = null;

const $ = (id) => document.getElementById(id);
const thumb = (ep, q) => `https://img.youtube.com/vi/${ep.yt}/${q || 'hqdefault'}.jpg`;
const seriesOf = (ep) => SERIES.find(s => s.id === ep.series);
const dispTitle = (ep) => ep.ytKo ? (ep.titleKo || ep.title) : ep.title;
// season 0 = 특집 (정규 시즌 외). state.season: 0=전체, -1=특집, n=시즌 n
const seLabel = (ep) => ep.season ? `S${ep.season} · E${ep.ep}` : '특집';
const seasonMatch = (ep) => !state.season || (state.season === -1 ? ep.season === 0 : ep.season === state.season);
const playVid = (ep) => ep.ytKo || ep.yt;   // 재생용 영상 ID (한글판 우선)

/* ── 영상 길이 (YouTube Data API, localStorage 캐시) ── */
let durations = loadJSON(DUR_KEY, {}, isObj);

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
      // 길이는 덧붙임 정보라 실패해도 조용히 넘어간다(목록·재생은 그대로 동작)
      const data = await VUI.apiFetch('/api/yt-duration?ids=' + missing.slice(i, i + 50).join(','), { timeout: 10000 });
      if (data && isObj(data.durations)) Object.assign(durations, data.durations);
    } catch { return; }
  }
  try { localStorage.setItem(DUR_KEY, JSON.stringify(durations)); } catch { /* 용량 초과 시 캐시 생략 */ }
}

/* ── 토스트 (공용 VUI.toast) ──
   opts: 'error' | 표시 시간(ms) | { type, duration }. 0 = 다음 토스트가 덮을 때까지(최대 30초) */
function toast(msg, opts) { VUI.toast(msg, opts === 0 ? 30000 : opts); }
function hideToast() { VUI.toast.hide(); }
const escAttr = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ── 데이터 로드 ── */
async function init() {
  try {
    DATA = await VUI.apiFetch('episodes.json', { timeout: 30000 });
    if (!DATA || !Array.isArray(DATA.episodes) || !isObj(DATA.meta)) throw new Error('형식 오류');
  } catch (e) {
    DATA = null;
    $('epGrid').innerHTML = '<p class="empty-state" role="alert">에피소드 목록을 불러오지 못했어요. 새로고침해 주세요.</p>';
    if (e && e.code) toast(e.message, 'error');
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
  state.theme = false; state.aiIds = null; state.q = ''; state.favOnly = false; state.recentOnly = false;
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
    btn.type = 'button';
    btn.className = 'series-tab' + (state.series === s.id ? ' active' : '');
    btn.setAttribute('aria-pressed', String(state.series === s.id));
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
    c.type = 'button';
    c.className = 'chip' + (cls ? ' ' + cls : '') + (active ? ' active' : '');
    c.setAttribute('aria-pressed', String(!!active));
    c.style.setProperty('--sc', s.color);
    c.textContent = label;
    c.onclick = onClick;
    chips.appendChild(c);
  };
  mk('전체', state.season === 0 && !state.theme, () => { state.season = 0; state.theme = false; state.aiIds = null; renderToolbar(); renderGrid(); });
  for (let i = 1; i <= m.seasons; i++) {
    mk(`시즌 ${i}`, state.season === i && !state.theme, () => { state.season = i; state.theme = false; state.aiIds = null; renderToolbar(); renderGrid(); });
  }
  if (DATA.episodes.some(e => e.series === state.series && e.season === 0)) {
    mk('⭐ 특집', state.season === -1 && !state.theme, () => { state.season = -1; state.theme = false; state.aiIds = null; renderToolbar(); renderGrid(); });
  }
  if (state.series === 'numberblocks') {
    mk('✖️ 구구단', state.theme, () => { state.theme = !state.theme; state.season = 0; state.aiIds = null; renderToolbar(); renderGrid(); }, 'theme-chip');
  }

  const seg = $('levelSeg');
  seg.innerHTML = '';
  const levels = [...new Set(DATA.episodes.filter(e => e.series === state.series && e.level).map(e => e.level))].sort();
  const mkSeg = (label, val) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = state.level === val ? 'active' : '';
    b.setAttribute('aria-pressed', String(state.level === val));
    b.textContent = label;
    b.onclick = () => { state.level = val; renderToolbar(); renderGrid(); };
    seg.appendChild(b);
  };
  mkSeg('레벨 전체', 0);
  levels.forEach(lv => mkSeg('Lv' + lv, lv));
  if (state.level && !levels.includes(state.level)) state.level = 0;

  $('favToggle').classList.toggle('active', state.favOnly);
  $('favToggle').setAttribute('aria-pressed', String(state.favOnly));
  $('recentToggle').classList.toggle('active', state.recentOnly);
  $('recentToggle').setAttribute('aria-pressed', String(state.recentOnly));
}

/* ── 필터링 + 그리드 ── */
function filtered() {
  if (!state.series) return [];
  const q = state.q.trim().toLowerCase();
  return DATA.episodes.filter(ep => {
    if (ep.series !== state.series) return false;
    if (state.aiIds && !state.aiIds.has(ep.id)) return false;
    if (state.theme && ep.theme !== 'TimesTables') return false;
    if (!state.theme && !seasonMatch(ep)) return false;
    if (state.level && ep.level !== state.level) return false;
    if (state.favOnly && !favs.has(ep.id)) return false;
    if (state.recentOnly && !recent.includes(ep.id)) return false;
    if (q && !state.aiIds && ![ep.title, ep.titleKo, ep.desc, ep.descKo].join('\n').toLowerCase().includes(q)) return false;
    return true;
  });
}

// 그리드에 보이는 순서 그대로 (최근시청은 최근순 정렬)
function visibleList() {
  const list = filtered();
  return state.recentOnly ? list.slice().sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id)) : list;
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
    banner.innerHTML = `✨ AI 검색 결과 ${state.aiIds.size}편 <button type="button" onclick="clearAiIds()" aria-label="AI 검색 결과 지우기">✕ 초기화</button>`;
  } else {
    banner?.remove();
  }

  const list = visibleList();
  const s = SERIES.find(x => x.id === state.series);
  $('resultInfo').textContent = `${s.ko} · ${list.length}편`;
  const grid = $('epGrid');
  grid.innerHTML = '';
  $('emptyState').hidden = list.length > 0;

  const frag = document.createDocumentFragment();
  for (const ep of list) {
    const card = document.createElement('article');
    card.className = 'ep-card';
    card.dataset.id = ep.id;
    card.style.setProperty('--sc', s.color);
    const favOn = favs.has(ep.id);
    // 카드 전체를 덮는 투명 '열기' 버튼(.ep-open) + 그 위의 즐겨찾기 버튼. 키보드는 열기 → 즐겨찾기 순서
    card.innerHTML = `
      <button type="button" class="ep-open" aria-label="${escAttr(dispTitle(ep))} (${seLabel(ep)}${ep.ytKo ? ', 한글판' : ''}${ep.level ? ', 레벨 ' + ep.level : ''}) 보기"></button>
      <div class="ep-thumb">
        <img src="${thumb(ep, 'mqdefault')}" alt="" loading="lazy">
        <span class="ep-se">${seLabel(ep)}</span>
        ${ep.ytKo ? '<span class="ep-ko-badge">한글판</span>' : ''}
        <button type="button" class="ep-fav ${favOn ? 'on' : ''}" aria-pressed="${favOn}" aria-label="즐겨찾기: ${escAttr(dispTitle(ep))}" title="즐겨찾기">${favOn ? '★' : '☆'}</button>
      </div>
      <div class="ep-body">
        <div class="ep-title" aria-hidden="true">${dispTitle(ep)}</div>
        <div class="ep-sub">
          ${ep.level ? `<span class="ep-level" style="background:${LEVEL_COLORS[ep.level]}">Lv${ep.level}</span>` : ''}
          ${ep.ytKo && ep.titleKo ? `<span class="ep-en">${ep.title}</span>` : ''}
        </div>
      </div>`;
    card.querySelector('.ep-fav').onclick = (e) => { e.stopPropagation(); toggleFav(ep.id); };
    card.querySelector('.ep-open').onclick = () => openEpisode(ep.id);
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

/* ── 웰컴 섹션 ── */
function renderWelcome() {
  if (document.getElementById('welcomeSection')) return;
  const total = DATA ? DATA.episodes.length : 372;
  const seriesBtns = SERIES.map(s =>
    `<button type="button" class="wf-random-btn" style="--sc:${s.color}" onclick="randomPlay('${s.id}')" aria-label="${s.ko} 랜덤 재생">${s.emoji} ${s.ko}</button>`
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
  // 랜덤 재생은 내 재생목록을 바꾸므로, 비어 있지 않으면 먼저 확인
  if (playlist.ids.length &&
      !confirm(`🔀 ${s.ko} 랜덤 재생을 시작하면 지금 재생목록(${playlist.ids.length}편)이 랜덤 목록으로 바뀝니다.\n계속할까요?`)) return;
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
    if (!state.theme && !seasonMatch(ep)) return false;
    if (state.level && ep.level !== state.level) return false;
    return true;
  });
  const episodes = base.map(e => ({
    id: e.id, title: e.title, titleKo: e.titleKo,
    desc: e.desc, descKo: e.descKo, level: e.level,
  }));
  if (!episodes.length) { hideToast(); toast('필터 결과가 없습니다. 필터를 조정해 주세요', 4000); return; }

  try {
    const data = await VUI.apiFetch('/api/bu-recommend', { json: { q, episodes }, timeout: 40000 });
    const allowed = new Set(base.map(e => e.id));   // 보낸 후보(현재 시리즈·필터) 안의 id만
    const ids = data && Array.isArray(data.ids) ? [...new Set(data.ids.filter(id => typeof id === 'string' && allowed.has(id)))] : null;
    if (!ids) throw new Error('추천 결과를 읽지 못했어요. 잠시 후 다시 해 주세요.');
    if (!ids.length) { toast('관련 에피소드를 찾지 못했어요', 4000); return; }
    state.aiIds = new Set(ids);
    renderGrid();
    toast(`✨ AI 검색 결과 ${ids.length}편`);
  } catch (e) {
    toast(`AI 검색 실패: ${e.message}`, 'error');
  }
}

function clearAiIds() {
  state.aiIds = null;
  renderGrid();
}

/* ── 즐겨찾기 ── */
function toggleFav(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* 저장 불가 시 화면만 반영 */ }
  // 다시 그리면 누른 버튼이 사라지므로, 키보드 포커스를 같은 자리 버튼으로 되돌린다
  const a = document.activeElement;
  const refocus = a && a.id === 'mFav' ? 'modal' : a && a.classList && a.classList.contains('ep-fav') ? 'card' : null;
  renderGrid();
  if (modalEp && modalEp.id === id) renderModalActions();
  if (refocus === 'modal') $('mFav')?.focus();
  else if (refocus === 'card') document.querySelector(`.ep-card[data-id="${CSS.escape(id)}"] .ep-fav`)?.focus();
  toast(favs.has(id) ? '⭐ 즐겨찾기에 넣었어요' : '즐겨찾기에서 뺐어요', 1800);
}

/* ── 상세 모달 ── */
function openEpisode(id, updateHash = true) {
  const ep = byId.get(id);
  if (!ep) return;
  // 이전/다음 탐색 목록: 모달을 처음 열 때의 필터 결과로 고정 (최근시청 갱신으로 순서가 바뀌지 않게)
  if (!modalEp) navIds = visibleList().map(e => e.id);
  modalEp = ep;
  modalLang = ep.ytKo ? 'ko' : 'en'; // 한글 영상 있을 때만 한글 기본값
  // 최근시청 기록
  recent = [id, ...recent.filter(x => x !== id)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderModalNav();
  renderModal();
  $('epModal').hidden = false;
  epDialog.open();   // 이미 열려 있으면(이전/다음) 아무 일 없음
  document.body.style.overflow = 'hidden';
  if (updateHash) history.replaceState(null, '', '#v=' + id);
}

function closeModal() {
  if (!modalEp && $('epModal').hidden) return;
  const lastId = modalEp && modalEp.id;
  epDialog.close();   // 포커스를 연 버튼으로 되돌림(ESC로 닫혔으면 이미 닫힌 상태라 무시)
  $('epModal').hidden = true;
  $('modalVideoWrap').innerHTML = '';
  document.body.style.overflow = '';
  modalEp = null;
  navIds = [];
  history.replaceState(null, '', location.pathname);
  // 연 카드가 다시 그려져 사라졌으면 같은 에피소드 카드(없으면 목록 첫 카드)로
  if (!document.activeElement || document.activeElement === document.body) {
    const btn = (lastId && document.querySelector(`.ep-card[data-id="${CSS.escape(lastId)}"] .ep-open`))
      || document.querySelector('.ep-open');
    btn?.focus();
  }
}

/* 현재 필터 안에서 이전/다음 영상 */
function renderModalNav() {
  const i = modalEp ? navIds.indexOf(modalEp.id) : -1;
  $('modalNav').hidden = i < 0 || navIds.length < 2;
  if (i < 0) return;
  $('modalNavPos').textContent = `${i + 1} / ${navIds.length}`;
  $('modalPrev').disabled = i === 0;
  $('modalNext').disabled = i === navIds.length - 1;
}
function stepModal(dir) {
  if (!modalEp) return;
  const id = navIds[navIds.indexOf(modalEp.id) + dir];
  if (id) openEpisode(id);
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
    <span class="mtag">${ep.season ? `시즌 ${ep.season} · ${ep.ep}화` : '⭐ 특집'}</span>
    ${ep.level ? `<span class="mtag" style="color:${LEVEL_COLORS[ep.level]}">Lv${ep.level}</span>` : ''}
    ${ep.theme === 'TimesTables' ? '<span class="mtag">✖️ 구구단</span>' : ''}
    ${showLangToggle ? `
      <span class="lang-toggle">
        ${isAiDesc ? `
          <button type="button" id="langEn" class="${useKo ? '' : 'active'}" aria-pressed="${!useKo}" aria-label="영어 설명">EN</button>
          <button type="button" id="langKo" class="${useKo ? 'active' : ''} ai-lang" aria-pressed="${useKo}" title="AI 번역 설명">🤖 한글번역</button>
        ` : `
          <button type="button" id="langKo" class="${useKo ? 'active' : ''}" aria-pressed="${useKo}">한글</button>
          <button type="button" id="langEn" class="${useKo ? '' : 'active'}" aria-pressed="${!useKo}" aria-label="영어">EN</button>
        `}
      </span>` : ''}`;
  if (showLangToggle) {
    $('langKo').onclick = async () => {
      modalLang = 'ko';
      // 영문 설명만 있고 한글 번역이 없으면 AI 번역 요청 (사전 번역 없는 예외 경우)
      if (ep.desc && !ep.descKo) {
        renderModal(isAiDesc);
        $('modalDesc').textContent = '✨ 번역 중…';
        try {
          const data = await VUI.apiFetch('/api/bu-translate', { json: { text: ep.desc }, timeout: 30000 });
          if (data && typeof data.ko === 'string' && data.ko) ep.descKo = data.ko;
        } catch (e) { toast(`번역하지 못해 영문 설명을 보여 드려요. (${e.message})`, 'error'); }
        if (modalEp !== ep) return;   // 번역을 기다리는 사이 다른 편으로 넘어감
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
    <button type="button" class="m-act${favOn ? ' on-fav' : ''}" id="mFav" aria-pressed="${favOn}">⭐ ${favOn ? '즐겨찾기 해제' : '즐겨찾기'}</button>
    <button type="button" class="m-act" id="mShare">🔗 공유</button>
    <button type="button" class="m-act${inPl ? ' on-pl' : ''}" id="mPl" aria-pressed="${inPl}">${inPl ? '✅ 재생목록에 있음' : '➕ 재생목록'}</button>
    ${ep.official ? `<a class="m-act" href="${ep.official}" target="_blank" rel="noopener">🌐 공식 페이지</a>` : ''}`;
  $('mFav').onclick = () => toggleFav(ep.id);
  $('mShare').onclick = () => shareEpisode(ep);
  $('mPl').onclick = () => togglePlaylist(ep.id);
}

async function shareEpisode(ep) {
  const url = location.href.split('#')[0] + `#v=${ep.id}`;
  if (navigator.share) {
    try { await navigator.share({ title: dispTitle(ep), url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; /* 그 밖의 실패는 복사로 */ }
  }
  // 복사 실패 시 링크·QR 창(VUI)이 열린다
  await VUI.share.copyOrShow(url, { title: '🔗 에피소드 공유', desc: dispTitle(ep) });
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
  plDialog.open();   // 'open' 클래스 + 포커스 가두기·ESC
  $('plFab').setAttribute('aria-expanded', 'true');
  document.body.classList.add('pl-open');
  ensureDurations(playlist.ids.filter(id => byId.has(id)).map(id => playVid(byId.get(id))))
    .then(() => { if ($('plDrawer').classList.contains('open')) renderPlDrawer(); });
}
function closePlDrawer() {
  plDialog.close();
  $('plDrawer').classList.remove('open');
  $('plFab').setAttribute('aria-expanded', 'false');
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
    const t = escAttr(dispTitle(ep));
    row.innerHTML = `
      <span class="pl-drag" title="드래그해서 순서 변경" aria-hidden="true">⠿</span>
      <button type="button" class="pl-open" aria-label="${i + 1}번 ${t} 보기">
        <img src="${thumb(ep, 'default')}" alt="">
        <span class="pl-item-title">${i + 1}. ${dispTitle(ep)}
          ${dur ? `<small class="pl-item-dur">${fmtDur(dur)}</small>` : ''}</span>
      </button>
      <span class="pl-move">
        <button type="button" class="pl-del-btn pl-up-btn" title="위로" aria-label="${t} 위로 이동"${i === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="pl-del-btn pl-down-btn" title="아래로" aria-label="${t} 아래로 이동"${i === playlist.ids.length - 1 ? ' disabled' : ''}>▼</button>
      </span>
      <button type="button" class="pl-del-btn pl-rm-btn" title="제거" aria-label="${t} 재생목록에서 제거">✕</button>`;
    // 터치 기기·키보드는 드래그를 못 하므로 ▲▼ 버튼으로 순서 변경(누른 뒤에도 같은 항목 버튼에 포커스 유지)
    row.querySelector('.pl-up-btn').onclick = (e) => { e.stopPropagation(); movePl(i, -1, '.pl-up-btn'); };
    row.querySelector('.pl-down-btn').onclick = (e) => { e.stopPropagation(); movePl(i, 1, '.pl-down-btn'); };
    row.querySelector('.pl-rm-btn').onclick = (e) => {
      e.stopPropagation(); playlist.ids.splice(i, 1); savePl(); renderPlDrawer();
      toast('재생목록에서 뺐어요', 1800);
      const rows = $('plList').querySelectorAll('.pl-item');
      const next = rows[Math.min(i, rows.length - 1)];
      (next ? next.querySelector('.pl-rm-btn') : $('plCloseBtn')).focus();
    };
    row.querySelector('.pl-open').onclick = () => { closePlDrawer(); openEpisode(id); };
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

function movePl(i, dir, focusSel) {
  const j = i + dir;
  if (j < 0 || j >= playlist.ids.length) return;
  [playlist.ids[i], playlist.ids[j]] = [playlist.ids[j], playlist.ids[i]];
  savePl(); renderPlDrawer();
  if (focusSel) {
    const row = $('plList').querySelectorAll('.pl-item')[j];
    const b = row && row.querySelector(focusSel);
    (b && !b.disabled ? b : row && row.querySelector('.pl-open'))?.focus();
  }
}

/* ── 재생목록 공유 (VUI.share: base64url + 단축 + 복사 실패 시 링크·QR 창) ──
   새 링크는 UTF-8 base64url(VUI.share.encode). 예전 링크(btoa(encodeURIComponent(json)))도 decode가 읽는다. */
async function sharePlaylist() {
  if (playlist.ids.length === 0) { toast('재생목록이 비어 있어요'); return; }
  savePl();
  const payload = VUI.share.encode({ t: playlist.title, ids: playlist.ids });
  const longURL = location.href.split('#')[0] + `#list=${payload}`;
  toast('⏳ 공유 링크를 만드는 중이에요…', 0);
  await VUI.share.link(longURL, {
    title: '🔗 재생목록 공유',
    desc: '링크를 연 사람은 이 재생목록을 가져올 수 있어요.',
    copiedMessage: '🔗 재생목록 링크를 복사했어요',
  });
}

function importPlaylist(payload) {
  const p = VUI.share.decode(payload, (o) => o && Array.isArray(o.ids));
  history.replaceState(null, '', location.pathname);
  if (!p || p.ids.length === 0) { toast('재생목록 링크가 올바르지 않아요', 'error'); return; }
  const valid = p.ids.filter(id => typeof id === 'string' && byId.has(id));
  if (!valid.length) { toast('이 링크의 에피소드를 찾지 못했어요', 'error'); return; }
  const name = (typeof p.t === 'string' && p.t.trim() ? p.t.trim() : '공유된 재생목록').slice(0, 80);
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
let durCache = loadJSON(DUR_KEY, {}, isObj);

function clearWatchdog() {
  clearTimeout(watchdogTimer);
  watchdogTimer = null;
}

async function fetchDuration(videoId) {
  if (durCache[videoId]) return durCache[videoId];
  try {
    const data = await VUI.apiFetch(`/api/yt-duration?ids=${encodeURIComponent(videoId)}`, { timeout: 10000 });
    const sec = Number(data?.durations?.[videoId]) || 0;
    if (sec > 0) {
      durCache[videoId] = sec;
      try { localStorage.setItem(DUR_KEY, JSON.stringify(durCache)); } catch { /* 캐시 생략 */ }
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
  if (!queue.length) { toast('재생할 수 있는 에피소드가 없어요'); return; }
  queueIdx = 0;
  closePlDrawer();
  $('playerOverlay').hidden = false;
  playerDialog.open();
  document.body.classList.add('player-open');
  document.body.style.overflow = 'hidden';
  $('playerTitle').textContent = title || '재생목록';
  ensureDurations(queue.map(id => playVid(byId.get(id)))).then(renderPlayerUi);
  await loadYtApi();
  if ($('playerOverlay').hidden) return;   // 불러오는 사이 닫음
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
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'pq-item' + (i === queueIdx ? ' current' : '');
    if (i === queueIdx) d.setAttribute('aria-current', 'true');
    d.setAttribute('aria-label', `${i + 1}번 ${dispTitle(e)}${i === queueIdx ? ' (재생 중)' : ''}`);
    const dd = durations[playVid(e)];
    d.innerHTML = `<img src="${thumb(e, 'default')}" alt="" title="${escAttr(dispTitle(e))}">
      ${dd ? `<span class="pq-dur">${fmtDur(dd)}</span>` : ''}`;
    d.onclick = () => { playAt(i); q.children[i]?.focus(); };
    q.appendChild(d);
  });
  const cur = q.children[queueIdx];
  if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function closePlayer() {
  clearWatchdog();
  stopWatchdog();
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  playerDialog.close();
  $('playerStage').innerHTML = '';
  $('playerOverlay').hidden = true;
  document.body.classList.remove('player-open');
  document.body.style.overflow = '';
  // 연 버튼(랜덤 재생 등)이 다시 그려져 사라졌으면 재생목록 버튼으로
  if (!document.activeElement || document.activeElement === document.body) $('plFab').focus();
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

/* ── 대화상자 접근성 (VUI.modal: role·포커스 가두기·ESC·포커스 복귀) ── */
const epDialog = VUI.modal.bind('#epModal', {
  manual: true, dialog: '.modal-card', initialFocus: '#modalCloseBtn',
  onClose: () => closeModal(),
});
const plDialog = VUI.modal.bind('#plDrawer', {
  className: 'open', initialFocus: '#plCloseBtn',
  onClose: () => closePlDrawer(),
});
const playerDialog = VUI.modal.bind('#playerOverlay', {
  manual: true, initialFocus: '#playerCloseBtn',
  onClose: () => closePlayer(),
});

/* ── 이벤트 바인딩 ── */
function bind() {
  $('favToggle').onclick = () => { state.favOnly = !state.favOnly; state.recentOnly = false; state.aiIds = null; renderToolbar(); renderGrid(); };
  $('recentToggle').onclick = () => { state.recentOnly = !state.recentOnly; state.favOnly = false; state.aiIds = null; renderToolbar(); renderGrid(); };
  let debounce = null;
  $('searchInput').oninput = (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = e.target.value; state.aiIds = null; renderGrid(); }, 180);
  };
  $('aiSearchBtn').onclick = () => aiRecommend();
  $('epModal').onclick = (e) => { if (e.target === $('epModal')) closeModal(); };
  $('modalCloseBtn').onclick = closeModal;
  $('modalPrev').onclick = () => stepModal(-1);
  $('modalNext').onclick = () => stepModal(1);
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
  // ESC 닫기는 VUI.modal이 맡는다(맨 위 창부터). 여기서는 상세 창의 ←/→ 이전·다음만
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !$('epModal').hidden && $('playerOverlay').hidden
        && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      stepModal(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
}

bind();
init();

// 선택 동기화: 헤더 '동기화' 버튼 (즐겨찾기·재생목록·최근을 코드 하나로 기기 간 이어쓰기)
function reloadSyncedState() {
  favs = new Set(loadJSON(FAV_KEY, [], isIdArr));
  recent = loadJSON(RECENT_KEY, [], isIdArr);
  playlist = loadPlaylist();
  updatePlFab();
  if ($('plDrawer').classList.contains('open')) renderPlDrawer();
  if (DATA) { renderToolbar(); renderGrid(); }
}
if (window.VivesSync) VivesSync.mountDocSync({
  apiUrl: '/api/blocks-universe',
  keys: [FAV_KEY, PL_KEY, RECENT_KEY],
  appName: '즐겨찾기·재생목록',
  onApplied: reloadSyncedState,
});

// '← 시리즈 선택' 버튼을 좌상단 홈 버튼 옆으로 이동(셸 주입 이후)
document.addEventListener('DOMContentLoaded', function () {
  var back = document.getElementById('welcomeBack');
  var left = document.querySelector('.top-overlay-left');
  if (back && left) left.appendChild(back);
});
