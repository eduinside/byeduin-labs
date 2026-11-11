/* 진로 탐험대 (career-talk) - 화면 로직. 계획: docs/career-talk-plan.md
   흐름: 인트로 → 눈높이 → 직업 고르기 → 인터뷰(talk) → 돌아보기(reflect) → 추천 → 스케치 → 탐험 카드 → 내 기록
   서버는 무상태(/api/career-talk). 대화 기록은 이 기기의 localStorage('career-talk:v1')에만 둔다.
   그림(b64)은 용량 때문에 저장하지 않고 이번 방문 동안 메모리에만 둔다.
   @icons arrow-left search external-link compass sparkles printer share-2 trash-2
   @icons play list-checks message-circle triangle-alert wifi-off hourglass timer wrench info pencil
   @icons arrow-right book-open lightbulb heart-handshake */
(function () {
  'use strict';

  var API = '/api/career-talk';
  // 그림 data URL: 지금 모델은 JPEG(/9j/로 시작), 그 밖은 PNG로 본다
  function b64Src(b64) { return (String(b64).startsWith('/9j/') ? 'data:image/jpeg;base64,' : 'data:image/png;base64,') + b64; }
  var TEXT_TIMEOUT_MS = 30000;
  var IMAGE_TIMEOUT_MS = 75000;
  var SLOW_MS = 8000;
  var REDACTED = '[지움]';
  var REFLECT_CHOICE = '지금까지 이야기 돌아보기';
  var REFLECT_OPEN = 6;      // 학생 턴 6회 뒤 돌아보기 버튼
  var REFLECT_MAX = 4;       // 돌아보기 안 학생 턴 상한
  var TALKS_MAX = 20;
  var LEVELS = {
    easy: { name: '쉬운 말', max: 8, count: 2, custom: 0 },
    mid: { name: '보통', max: 12, count: 3, custom: 40 },
    high: { name: '자세히', max: 12, count: 3, custom: 60 },
  };
  var PHASE_ORDER = ['greet', 'work', 'day', 'heart', 'path', 'ask', 'wrap'];
  var PHASE_LABEL = { greet: '인사', work: '하는 일', day: '하루·일터', heart: '좋은 점·힘든 점', path: '되는 길', ask: '나에게 묻기', wrap: '마무리' };
  // 서버(functions/api/career-talk.js)와 같은 표
  var PHASE_BY_TURN = {
    mid: ['work', 'work', 'day', 'day', 'heart', 'heart', 'path', 'path', 'ask', 'ask', 'wrap', 'wrap'],
    easy: ['work', 'work', 'day', 'day', 'heart', 'path', 'ask', 'wrap'],
  };
  var SAFE_HELP = '도움이 필요하면 선생님이나 보호자에게 지금 이야기해 주세요.';

  var $ = function (id) { return document.getElementById(id); };
  var icon = function (n) { return SimKit.icon(n); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, html, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sk-btn ' + (cls || '');
    b.innerHTML = html;
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nowIso() { return new Date().toISOString(); }
  function dateText(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }
  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

  /* ══════════ 데이터 ══════════ */
  var DATA = null, JOBS = {}, CATS = {};
  var dataReady = fetch('/apps/career-talk/jobs.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('jobs'); return r.json(); })
    .then(function (d) {
      DATA = d;
      d.jobs.forEach(function (j) { JOBS[j.id] = j; });
      d.categories.forEach(function (c) { CATS[c.id] = c; });
      return d;
    });

  /* ══════════ 저장 ══════════ */
  function cleanTurns(arr, max) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (t) { return t && (t.who === 'ai' || t.who === 'me') && typeof t.text === 'string' && t.text.trim(); })
      .slice(-max).map(function (t) { return { who: t.who, text: t.text.slice(0, 200) }; });
  }
  function cleanList(arr, max, len) {
    return Array.isArray(arr) ? arr.filter(function (s) { return typeof s === 'string' && s.trim(); }).slice(0, max).map(function (s) { return s.slice(0, len); }) : [];
  }
  function cleanRecs(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    arr.forEach(function (r) {
      if (r && JOBS[r.id] && out.length < 3 && !out.some(function (o) { return o.id === r.id; })) out.push({ id: r.id, reason: str(r.reason, 60) });
    });
    return out;
  }
  function cleanTalk(t) {
    if (!t || typeof t !== 'object' || !JOBS[t.jobId]) return null;
    return {
      id: str(t.id, 40) || ('t_' + Date.now().toString(36)),
      jobId: t.jobId,
      level: LEVELS[t.level] ? t.level : 'mid',
      mode: t.mode === 'reflect' ? 'reflect' : 'talk',
      turns: cleanTurns(t.turns, 28),
      choices: cleanList(t.choices, 3, 40),
      phase: PHASE_ORDER.indexOf(t.phase) >= 0 ? t.phase : 'greet',
      rturns: cleanTurns(t.rturns, 10),
      rchoices: cleanList(t.rchoices, 2, 40),
      summary: cleanList(t.summary, 3, 60),
      recommend: cleanRecs(t.recommend),
      story: str(t.story, 400),
      scene: str(t.scene, 80),
      sketchCount: SimKit.clean.int(t.sketchCount, 0, 2, 0),
      imageOk: t.imageOk === true,
      done: t.done === true,
      createdAt: str(t.createdAt, 40) || nowIso(),
      updatedAt: str(t.updatedAt, 40) || nowIso(),
    };
  }
  var store = SimKit.store('career-talk:v1', {
    defaults: { level: '', talks: [] },
    validate: function (raw, def) {
      if (!raw || typeof raw !== 'object') return null;
      def.level = LEVELS[raw.level] ? raw.level : '';
      def.talks = Array.isArray(raw.talks) ? raw.talks.map(cleanTalk).filter(Boolean).slice(0, TALKS_MAX) : [];
      return def;
    },
  });
  var state = null;   // 데이터를 읽은 뒤 load
  var warnedSave = false;
  function save() {
    if (!store.save(state) && !warnedSave) {
      warnedSave = true;
      SimKit.toast('저장 공간이 부족해서 이번 방문 동안만 기억해요.', 'no');
    }
  }
  function touch(rec) { rec.updatedAt = nowIso(); save(); }

  /* ══════════ 화면 ══════════ */
  var screens = SimKit.screens({
    focus: true,
    onShow: function (id) {
      document.body.classList.toggle('ct-locked', id === 'scTalk');
      if (id !== 'scTalk') document.body.classList.remove('ct-reflect');
      if (id !== 'scTalk') window.scrollTo(0, 0);
      document.querySelectorAll('.screen.active.sk-screen, .screen.active.ct-page').forEach(function (s) { s.scrollTop = 0; });
    },
  });
  function setLevelClass(level) {
    document.body.classList.remove('lv-easy', 'lv-mid', 'lv-high');
    document.body.classList.add('lv-' + (level || 'mid'));
  }

  /* ══════════ 서버 호출 ══════════ */
  function timeoutSignal(ms) {
    if (window.AbortSignal && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
  }
  async function api(action, payload, timeoutMs) {
    var res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, payload)),
      signal: timeoutSignal(timeoutMs || TEXT_TIMEOUT_MS),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(data.error || '요청 실패');
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  }
  // 400(요청 문제)·429(한도)는 다시 해도 같으니 한 번만, 그 밖(502 파싱 실패·연결 오류)은 한 번 더
  async function apiRetry(action, payload, timeoutMs) {
    try { return await api(action, payload, timeoutMs); } catch (e) {
      if (e.status === 400 || e.status === 403 || e.status === 429 || e.status === 413) throw e;
      return api(action, payload, timeoutMs);
    }
  }
  function failNote(err) {
    if (err && err.status === 429) return { icon: 'hourglass', text: (err.message || '지금 쓰는 친구가 많아요.') + ' 준비된 질문으로 이어 가요.' };
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) return { icon: 'timer', text: '응답이 늦어요. 잠시 뒤 다시 해 보고, 지금은 준비된 질문으로 이어 가요.' };
    if (err && err.status) return { icon: 'wrench', text: 'AI가 잠깐 쉬고 있어요. 잠시 뒤 다시 해 보고, 지금은 준비된 질문으로 이어 가요.' };
    return { icon: 'wifi-off', text: '인터넷 연결이 불안정해요. 준비된 질문으로 이어 가요.' };
  }

  /* ══════════ 인트로·눈높이 ══════════ */
  var levelReturn = 'scPick';
  function goIntro() {
    $('btnIntroRecords').hidden = !state.talks.length;
    screens.show('scIntro');
  }
  function goLevel(back) {
    levelReturn = back || 'scPick';
    document.querySelectorAll('.ct-level-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.level === state.level ? 'true' : 'false');
    });
    screens.show('scLevel');
  }

  /* ══════════ 직업 고르기 ══════════ */
  var listMode = null; // null | { cat } | { q }
  function careernetUrl(job) { return 'https://www.career.go.kr/cloud/jm/job/view?seq=' + encodeURIComponent(job.cnet.seq); }
  function jobCard(job) {
    var c = el('div', 'ct-job');
    var top = el('div', 'ct-job-top');
    top.appendChild(el('span', 'ct-job-emoji', job.emoji)).setAttribute('aria-hidden', 'true');
    top.appendChild(el('span', 'ct-job-name', job.name));
    c.appendChild(top);
    c.appendChild(el('p', 'ct-job-line', job.line));
    var go = btn('sk-btn--primary sk-btn--block', icon('message-circle') + '이야기하기', function () { startTalk(job.id); });
    go.setAttribute('aria-label', SimKit.josa(job.name, '과/와') + ' 이야기하기');
    c.appendChild(go);
    if (job.cnet) {
      var a = el('a', 'ct-cnet');
      a.href = careernetUrl(job);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = '커리어넷에서 더 알아보기' + icon('external-link');
      a.setAttribute('aria-label', job.name + ' 커리어넷에서 더 알아보기 (새 창)');
      c.appendChild(a);
    }
    return c;
  }
  function lastOpenTalk() {
    return state.talks.filter(function (t) { return !t.done; }).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; })[0] || null;
  }
  function goPick() {
    setLevelClass(state.level);
    $('btnLevel').innerHTML = icon('pencil') + '눈높이: ' + LEVELS[state.level || 'mid'].name;
    $('btnRecords').innerHTML = icon('list-checks') + '내 기록 ' + state.talks.length;
    var last = lastOpenTalk();
    $('resumeBox').hidden = !last;
    if (last) {
      var j = JOBS[last.jobId];
      $('resumeText').textContent = '지난 이야기: ' + j.emoji + ' ' + j.persona + ' ' + j.name;
      $('btnResume').onclick = function () { openTalk(last); };
    }
    var fl = $('featuredList');
    fl.innerHTML = '';
    DATA.featured.forEach(function (id) { if (JOBS[id]) fl.appendChild(jobCard(JOBS[id])); });
    var cl = $('catList');
    cl.innerHTML = '';
    DATA.categories.forEach(function (c) {
      var n = DATA.jobs.filter(function (j) { return j.cat === c.id; }).length;
      var b = btn('ct-cat', '<span class="e" aria-hidden="true">' + c.emoji + '</span><span>' + esc(c.name) + ' <small>(' + n + ')</small></span>', function () {
        listMode = { cat: c.id };
        $('jobSearch').value = '';
        renderList();
      });
      cl.appendChild(b);
    });
    renderList();
    screens.show('scPick');
  }
  function renderList() {
    var q = $('jobSearch').value.trim();
    if (q) listMode = { q: q };
    else if (listMode && listMode.q) listMode = null;
    $('pickHome').hidden = !!listMode;
    $('pickList').hidden = !listMode;
    if (!listMode) return;
    var list, title;
    if (listMode.cat) {
      var c = CATS[listMode.cat];
      list = DATA.jobs.filter(function (j) { return j.cat === c.id; });
      title = c.emoji + ' ' + c.name;
    } else {
      var key = listMode.q.replace(/\s/g, '');
      list = DATA.jobs.filter(function (j) { return j.name.replace(/\s/g, '').indexOf(key) >= 0; });
      title = '\'' + listMode.q + '\' 찾은 직업 ' + list.length + '개';
    }
    $('listTitle').textContent = title;
    var box = $('jobList');
    box.innerHTML = '';
    if (!list.length) box.appendChild(el('p', 'ct-empty', '찾는 직업이 목록에 없어요. 다른 낱말로 찾거나 분류에서 골라 보세요.'));
    list.forEach(function (j) { box.appendChild(jobCard(j)); });
  }

  /* ══════════ 인터뷰 ══════════ */
  var rec = null;          // 지금 열린 기록
  var busy = false;
  var customOpen = false;
  var images = {};         // 기록 id → 그림 b64(이번 방문만)

  function L() { return LEVELS[rec.level]; }
  function meCount(turns) { return turns.filter(function (t) { return t.who === 'me'; }).length; }
  function phaseOf(level, n) {
    var list = PHASE_BY_TURN[level === 'easy' ? 'easy' : 'mid'];
    return list[Math.min(Math.max(n, 1), list.length) - 1];
  }
  function fallbackChoices(phase, level) {
    var set = DATA.fallback[phase] || DATA.fallback.work;
    return level === 'easy' ? [set[0], set[2]] : set.slice(0, 3);
  }
  function starters(job, level) { return level === 'easy' ? [job.starters[0], job.starters[2]] : job.starters.slice(0, 3); }

  function newTalk(jobId) {
    var job = JOBS[jobId];
    var level = state.level || 'mid';
    var t = cleanTalk({
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      jobId: jobId, level: level, mode: 'talk',
      turns: [{ who: 'ai', text: job.greeting }],
      choices: starters(job, level), phase: 'greet',
    });
    state.talks.unshift(t);
    if (state.talks.length > TALKS_MAX) {
      var oldest = state.talks.slice().sort(function (a, b) { return a.updatedAt < b.updatedAt ? -1 : 1; })[0];
      state.talks.splice(state.talks.indexOf(oldest), 1);
      SimKit.toast('기록이 ' + TALKS_MAX + '개를 넘어서 가장 오래된 기록 하나를 지웠어요.');
    }
    save();
    return t;
  }
  function startTalk(jobId) {
    rec = newTalk(jobId);
    openTalk(rec);
  }
  function openTalk(r) {
    rec = r;
    customOpen = false;
    setLevelClass(rec.level);
    screens.show('scTalk');
    if (rec.mode === 'reflect') { renderReflect(); return; }
    document.body.classList.remove('ct-reflect');
    renderTalk();
  }

  function renderHead(reflect) {
    var job = JOBS[rec.jobId];
    $('btnTalkBack').innerHTML = icon('arrow-left') + '<span class="t">직업 고르기로</span>';
    $('btnTalkBack').setAttribute('aria-label', '직업 고르기로');
    var who = $('talkWho');
    who.innerHTML = '';
    who.appendChild(el('span', 'e', reflect ? '🧭' : job.emoji)).setAttribute('aria-hidden', 'true');
    who.appendChild(el('span', 'n', reflect ? '길잡이 선생님' : job.persona + ' ' + job.name));
    who.appendChild(el('span', 'ct-ai', 'AI')).title = 'AI가 연기하는 가상 인물';
    var st = $('talkSteps');
    st.innerHTML = '';
    if (reflect) {
      var rn = meCount(rec.rturns);
      st.appendChild(el('span', 'lbl', '돌아보기'));
      st.appendChild(el('span', 'cnt', '이야기 ' + rn + '/' + REFLECT_MAX));
      return;
    }
    var idx = PHASE_ORDER.indexOf(rec.phase);
    var dots = el('span', 'ct-dots');
    dots.setAttribute('role', 'img');
    dots.setAttribute('aria-label', '단계 ' + (idx + 1) + '/' + PHASE_ORDER.length + ': ' + PHASE_LABEL[rec.phase]);
    PHASE_ORDER.forEach(function (p, i) { dots.appendChild(el('span', 'ct-dot' + (i < idx ? ' done' : i === idx ? ' now' : ''))); });
    st.appendChild(dots);
    st.appendChild(el('span', 'lbl', PHASE_LABEL[rec.phase]));
    st.appendChild(el('span', 'cnt', '질문 ' + meCount(rec.turns) + '/' + L().max));
  }

  function msgNode(t, emoji) {
    var m = el('div', 'ct-msg ' + t.who);
    if (t.who === 'ai') {
      var a = el('span', 'ct-ava', emoji);
      a.setAttribute('aria-hidden', 'true');
      m.appendChild(a);
    }
    var red = t.who === 'me' && t.text === REDACTED;
    if (red) m.classList.add('redacted');
    m.appendChild(el('div', 'ct-bubble', red ? '(지운 말)' : t.text));
    return m;
  }
  function logBox() { return $('talkLogIn'); }
  function scrollLog() { var l = $('talkLog'); l.scrollTop = l.scrollHeight; }
  function markLatest() {
    var box = logBox();
    box.querySelectorAll('.ct-msg.latest').forEach(function (m) { m.classList.remove('latest'); });
    var ais = box.querySelectorAll('.ct-msg.ai:not(.typing)');
    if (ais.length) ais[ais.length - 1].classList.add('latest');
  }
  function wiggle() {
    var a = logBox().querySelector('.ct-msg.latest .ct-ava');
    if (!a || SimKit.motion && SimKit.motion.reduced && SimKit.motion.reduced()) return;
    a.classList.remove('talking'); void a.offsetWidth; a.classList.add('talking');
  }
  function addNote(iconName, text) {
    var n = el('div', 'ct-note');
    n.innerHTML = icon(iconName) + esc(text);
    logBox().appendChild(n);
    scrollLog();
  }
  function addSafeCard(text) {
    var c = el('div', 'ct-safe');
    c.setAttribute('role', 'note');
    c.innerHTML = '<strong>' + icon('heart-handshake') + '잠깐만요</strong>';
    c.appendChild(document.createTextNode(text));
    c.appendChild(el('span', 'help', SAFE_HELP));
    logBox().appendChild(c);
    scrollLog();
  }
  function addTyping() {
    var job = JOBS[rec.jobId];
    var m = el('div', 'ct-msg ai typing');
    m.appendChild(el('span', 'ct-ava', rec.mode === 'reflect' ? '🧭' : job.emoji)).setAttribute('aria-hidden', 'true');
    var b = el('div', 'ct-bubble');
    b.innerHTML = '<span class="ct-dots3" aria-label="생각하는 중"><span>●</span><span>●</span><span>●</span></span>';
    m.appendChild(b);
    logBox().appendChild(m);
    scrollLog();
    var timer = setTimeout(function () { b.textContent = '조금만 기다려 주세요…'; }, SLOW_MS);
    return function () { clearTimeout(timer); m.remove(); };
  }
  function addMine(text) {
    var m = msgNode({ who: 'me', text: text });
    logBox().appendChild(m);
    scrollLog();
    return m;
  }

  function renderTalk() {
    var job = JOBS[rec.jobId];
    renderHead(false);
    var box = logBox();
    box.innerHTML = '';
    rec.turns.forEach(function (t) { box.appendChild(msgNode(t, job.emoji)); });
    markLatest();
    renderTalkPanel();
    requestAnimationFrame(scrollLog);
  }

  // 응답 뒤 선택지를 다시 그리면 누르던 버튼이 사라져 초점이 body로 간다 → 키보드로 이어 가게 첫 선택지로
  function keepFocus(fn) {
    var a = document.activeElement;
    var inPanel = !a || a === document.body || $('talkPanel').contains(a);
    fn();
    if (!inPanel || screens.current() !== 'scTalk') return;
    if (!$('customBox').hidden) return;
    var first = $('talkPanel').querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
  function setBusy(b) {
    busy = b;
    $('talkPanel').querySelectorAll('button, input').forEach(function (x) { x.disabled = b; });
  }

  function renderCustom(show) {
    var box = $('customBox');
    var max = L().custom;
    box.hidden = !show || !max;
    var input = $('customInput');
    input.maxLength = max || 0;
    updateCount();
    if (!box.hidden) setTimeout(function () { input.focus(); }, 30);
  }
  function updateCount() {
    var input = $('customInput');
    $('customCount').textContent = input.value.length + '/' + (L().custom || 0);
  }

  function renderTalkPanel() {
    var lv = L();
    var n = meCount(rec.turns);
    var list = $('choiceList');
    var extra = $('panelExtra');
    list.innerHTML = '';
    extra.innerHTML = '';
    if (n >= lv.max) {
      // 상한: 돌아보기로만 갈 수 있다
      list.appendChild(el('p', 'ct-muted', '이야기를 다 나눴어요. 이제 지금까지 이야기를 돌아봐요.'));
      extra.appendChild(btn('sk-btn--primary ct-big', icon('compass') + REFLECT_CHOICE, enterReflect));
      renderCustom(false);
      return;
    }
    rec.choices.forEach(function (c) {
      if (c === REFLECT_CHOICE) {
        list.appendChild(btn('act', icon('compass') + esc(c), enterReflect));
        return;
      }
      var b = btn(/\?$/.test(c) ? '' : 'mine', esc(c), function () { sendTalk(c, false); });
      list.appendChild(b);
    });
    if (lv.custom) {
      var o = btn(customOpen ? 'active' : '', icon('pencil') + '다른 질문 할래요', function () {
        customOpen = !customOpen;
        o.setAttribute('aria-expanded', customOpen ? 'true' : 'false');
        o.classList.toggle('active', customOpen);
        renderCustom(customOpen);
      });
      o.setAttribute('aria-expanded', customOpen ? 'true' : 'false');
      o.setAttribute('aria-controls', 'customBox');
      list.appendChild(o);
    }
    renderCustom(customOpen);
    if (n >= REFLECT_OPEN && rec.choices.indexOf(REFLECT_CHOICE) < 0) {
      extra.appendChild(btn('', icon('compass') + REFLECT_CHOICE, enterReflect));
    }
  }

  async function sendTalk(text, custom) {
    if (busy || !text) return;
    var job = JOBS[rec.jobId];
    var lv = L();
    var r = rec;
    var n = meCount(r.turns) + 1;
    if (n > lv.max) return;
    setBusy(true);
    var mine = addMine(text);
    var stopTyping = addTyping();
    try {
      var d = await apiRetry('talk', { level: r.level, jobId: r.jobId, turns: r.turns, pick: text, custom: !!custom });
      stopTyping();
      if (rec !== r) return;
      if (d.flag === 'rephrase') {
        mine.remove();
        SimKit.toast(d.say || '표현을 다시 골라 볼까요?', 'no');
        if (custom) $('customInput').focus();
        return;
      }
      if (d.flag === 'safety') {
        mine.remove();
        addSafeCard(d.say);
        if (Array.isArray(d.choices) && d.choices.length) r.choices = d.choices;
        if (custom) $('customInput').value = '';
        touch(r);
        renderTalkPanel();
        return;
      }
      r.turns.push({ who: 'me', text: d.redact ? REDACTED : text });
      r.turns.push({ who: 'ai', text: d.say });
      r.phase = PHASE_ORDER.indexOf(d.phase) >= 0 ? d.phase : phaseOf(r.level, n);
      r.choices = Array.isArray(d.choices) && d.choices.length ? d.choices.slice(0, 3) : fallbackChoices(r.phase, r.level);
      if (custom) { $('customInput').value = ''; customOpen = false; }
      touch(r);
      renderTalk();
      wiggle();
    } catch (e) {
      stopTyping();
      mine.remove();
      if (rec !== r) return;
      if (e.code === 'turn_limit') { enterReflect(); return; }
      var note = failNote(e);
      addNote(note.icon, note.text);
      r.choices = fallbackChoices(phaseOf(r.level, n), r.level);
      touch(r);
      renderTalkPanel();
    } finally {
      if (rec === r) keepFocus(function () { setBusy(false); });
      if (rec === r && customOpen && custom) $('customInput').focus();
    }
  }

  /* ══════════ 돌아보기 ══════════ */
  function fallbackSummary(r) {
    var job = JOBS[r.jobId];
    var asked = r.turns.filter(function (t) { return t.who === 'me' && t.text !== REDACTED; }).map(function (t) { return t.text; });
    return [
      job.honorific + '에게 ' + asked.length + '가지를 물어봤어요.',
      job.name + ': ' + job.line + '.',
      '궁금한 것을 끝까지 물어보는 모습이 보였어요.',
    ];
  }
  function enterReflect() {
    if (busy) return;
    rec.mode = 'reflect';
    customOpen = false;
    touch(rec);
    renderReflect();
    if (!rec.rturns.length) firstReflect();
  }
  function renderReflect() {
    document.body.classList.add('ct-reflect');
    renderHead(true);
    var box = logBox();
    box.innerHTML = '';
    if (rec.summary.length) {
      var s = el('div', 'ct-summary');
      s.innerHTML = '<h3>' + icon('book-open') + '지금까지 이야기</h3>';
      var ol = el('ol');
      var heads = ['물어본 것', '알게 된 것', '내 이야기에서 보인 것'];
      rec.summary.forEach(function (line, i) {
        var li = el('li');
        li.appendChild(el('b', '', heads[i] || ''));
        li.appendChild(document.createTextNode(line));
        ol.appendChild(li);
      });
      s.appendChild(ol);
      box.appendChild(s);
    }
    rec.rturns.forEach(function (t) { box.appendChild(msgNode(t, '🧭')); });
    markLatest();
    renderReflectPanel();
    requestAnimationFrame(scrollLog);
  }
  function renderReflectPanel() {
    var job = JOBS[rec.jobId];
    var rn = meCount(rec.rturns);
    var list = $('choiceList');
    var extra = $('panelExtra');
    list.innerHTML = '';
    extra.innerHTML = '';
    if (rn < REFLECT_MAX) {
      rec.rchoices.forEach(function (c) { list.appendChild(btn('', esc(c), function () { sendReflect(c, false); })); });
    }
    list.appendChild(btn('act', icon('lightbulb') + '비슷한 직업도 알고 싶어요', goRecommend));
    list.appendChild(btn('act', icon('sparkles') + '미래의 내 모습을 그려 볼래요', goSketch));
    if (meCount(rec.turns) < L().max) {
      list.appendChild(btn('act back', icon('arrow-left') + esc('다시 ' + SimKit.josa(job.honorific, '과/와') + ' 이야기할래요'), backToTalk));
    }
    if (L().custom && rn < REFLECT_MAX) {
      var o = btn(customOpen ? 'active' : '', icon('pencil') + '다른 질문 할래요', function () {
        customOpen = !customOpen;
        o.classList.toggle('active', customOpen);
        o.setAttribute('aria-expanded', customOpen ? 'true' : 'false');
        renderCustom(customOpen);
      });
      o.setAttribute('aria-expanded', customOpen ? 'true' : 'false');
      o.setAttribute('aria-controls', 'customBox');
      list.appendChild(o);
      renderCustom(customOpen);
    } else renderCustom(false);
    if (rec.recommend.length || rec.story) extra.appendChild(btn('', icon('list-checks') + '탐험 카드 완성하기', goCard));
  }
  function backToTalk() {
    rec.mode = 'talk';
    customOpen = false;
    touch(rec);
    openTalk(rec);
  }
  async function firstReflect() {
    var r = rec;
    setBusy(true);
    var stop = addTyping();
    try {
      var d = await apiRetry('reflect', { level: r.level, jobId: r.jobId, turns: r.turns, rturns: [] });
      stop();
      if (rec !== r) return;
      if (d.flag) {
        r.summary = fallbackSummary(r);
        r.rturns = [{ who: 'ai', text: '지금까지 나눈 이야기를 함께 돌아봐요. 아래에서 하고 싶은 것을 골라 보세요.' }];
        if (d.flag === 'safety') addSafeCard(d.say);
      } else {
        r.summary = d.summary || fallbackSummary(r);
        r.rturns = [{ who: 'ai', text: d.say }];
        r.rchoices = Array.isArray(d.choices) ? d.choices.slice(0, 2) : [];
      }
      touch(r);
      renderReflect();
      wiggle();
    } catch (e) {
      stop();
      if (rec !== r) return;
      r.summary = fallbackSummary(r);
      r.rturns = [{ who: 'ai', text: '지금은 길잡이 선생님이 잠깐 쉬고 있어요. 아래에서 다음 할 일을 골라 보세요.' }];
      r.rchoices = [];
      touch(r);
      renderReflect();
      var note = failNote(e);
      addNote(note.icon, note.text.replace(/ 준비된 질문으로 이어 가요\.| 지금은 준비된 질문으로 이어 가요\./, ''));
    } finally {
      if (rec === r) keepFocus(function () { setBusy(false); });
    }
  }
  async function sendReflect(text, custom) {
    if (busy || !text) return;
    var r = rec;
    if (meCount(r.rturns) >= REFLECT_MAX) return;
    setBusy(true);
    var mine = addMine(text);
    var stop = addTyping();
    try {
      var d = await apiRetry('reflect', { level: r.level, jobId: r.jobId, turns: r.turns, rturns: r.rturns, pick: text, custom: !!custom });
      stop();
      if (rec !== r) return;
      if (d.flag === 'rephrase') { mine.remove(); SimKit.toast(d.say, 'no'); return; }
      if (d.flag === 'safety') { mine.remove(); addSafeCard(d.say); if (custom) $('customInput').value = ''; return; }
      r.rturns.push({ who: 'me', text: d.redact ? REDACTED : text });
      r.rturns.push({ who: 'ai', text: d.say });
      r.rchoices = Array.isArray(d.choices) ? d.choices.slice(0, 2) : [];
      if (custom) { $('customInput').value = ''; customOpen = false; }
      touch(r);
      renderReflect();
      wiggle();
    } catch (e) {
      stop();
      mine.remove();
      if (rec !== r) return;
      var note = failNote(e);
      addNote(note.icon, '길잡이 선생님이 대답하지 못했어요. 아래 버튼으로 다음 할 일을 골라 보세요.');
      r.rchoices = [];
      renderReflectPanel();
    } finally {
      if (rec === r) keepFocus(function () { setBusy(false); });
    }
  }

  /* ══════════ 추천 ══════════ */
  function fallbackRecommend(r) {
    var job = JOBS[r.jobId];
    var ids = job.related.concat(DATA.jobs.filter(function (j) { return j.cat === job.cat; }).map(function (j) { return j.id; }));
    var out = [];
    ids.forEach(function (id) {
      if (out.length < 3 && id !== job.id && JOBS[id] && !out.some(function (o) { return o.id === id; })) out.push({ id: id, reason: SimKit.josa(job.name, '과/와') + ' 비슷한 일을 하는 직업이에요' });
    });
    return out;
  }
  async function goRecommend() {
    if (busy) return;
    var r = rec;
    screens.show('scRec');
    $('btnRecBack').innerHTML = icon('arrow-left') + '돌아보기로';
    var list = $('recList');
    if (!r.recommend.length) {
      list.innerHTML = '<div class="ct-art" style="aspect-ratio:auto;min-height:160px"><div class="ct-spin"></div><div class="msg">대화를 살펴보며 고르는 중이에요…</div></div>';
      try {
        var d = await apiRetry('recommend', { level: r.level, jobId: r.jobId, turns: r.turns, rturns: r.rturns });
        r.recommend = cleanRecs(d.jobs);
      } catch (e) {
        SimKit.toast(e.status === 429 ? e.message : '추천을 만들지 못해서 비슷한 직업을 보여 줄게요.');
      }
      if (r.recommend.length < 3) r.recommend = cleanRecs(r.recommend.concat(fallbackRecommend(r)));
      touch(r);
      if (screens.current() !== 'scRec' || rec !== r) return;
    }
    list.innerHTML = '';
    r.recommend.forEach(function (x) {
      var j = JOBS[x.id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ct-rec';
      b.innerHTML = '<span class="e" aria-hidden="true">' + j.emoji + '</span><span class="n">' + esc(j.name) + '</span><span class="r">' + esc(x.reason) + '</span><span class="go">' + esc(SimKit.josa(j.persona + ' ' + j.honorific, '과/와')) + ' 이야기하기' + icon('arrow-right') + '</span>';
      b.addEventListener('click', function () { startTalk(j.id); });
      list.appendChild(b);
    });
  }

  /* ══════════ 스케치 ══════════ */
  function fallbackStory(r) {
    var job = JOBS[r.jobId];
    var place = job.facts.place.split(',')[0].trim();
    return {
      // 서버(career-talk.js)의 대체 글과 같은 '~합니다'체
      story: '10년 뒤 나는 ' + SimKit.josa(job.name, '으로/로') + ' 일합니다. ' + place + '에서 하루를 시작합니다. 힘든 날도 있지만 ' + job.facts.joy.split(',')[0].trim() + ' 가장 뿌듯합니다. 오늘도 내가 좋아하는 일을 해서 행복합니다.',
      scene: '',
    };
  }
  function emojiArt(job, msg) {
    var box = $('artBox');
    box.className = 'ct-art';
    box.innerHTML = '<div class="big" aria-hidden="true">' + job.emoji + '🧒</div>';
    box.appendChild(el('div', 'msg', msg));
  }
  function renderStory(r) {
    var box = $('storyBox');
    box.innerHTML = '<h3>' + icon('sparkles') + '미래의 나</h3>';
    box.appendChild(el('p', '', r.story)).style.margin = '0';
  }
  function renderArt(r) {
    var job = JOBS[r.jobId];
    var redraw = $('btnRedraw');
    redraw.hidden = true;
    if (images[r.id]) {
      var box = $('artBox');
      box.className = 'ct-art has-img';
      box.innerHTML = '';
      var img = el('img');
      img.src = b64Src(images[r.id]);
      img.alt = '10년 뒤 나의 하루를 그린 그림';
      box.appendChild(img);
      return;
    }
    if (r.imageOk) { emojiArt(job, '그림은 저장하지 않아서 이모지 카드로 보여 줘요.'); return; }
    if (!r.scene) { emojiArt(job, '이모지 카드로 완성했어요.'); return; }
    if (r.sketchCount >= 2) { emojiArt(job, '그림이 잘 그려지지 않아 이모지 카드로 완성했어요.'); return; }
    if (r.sketchCount === 1) { emojiArt(job, '그림이 잘 그려지지 않았어요. 한 번 더 그려 볼 수 있어요.'); redraw.hidden = false; return; }
    drawImage(r);
  }
  async function drawImage(r) {
    if (r.imageOk || r.sketchCount >= 2 || !r.scene) return;
    r.sketchCount += 1;
    touch(r);
    var box = $('artBox');
    box.className = 'ct-art';
    box.innerHTML = '<div class="ct-spin"></div><div class="msg">그림을 그리는 중이에요. 20초쯤 걸려요.</div>';
    $('btnRedraw').hidden = true;
    try {
      var d = await api('sketch', { part: 'image', level: r.level, jobId: r.jobId, scene: r.scene }, IMAGE_TIMEOUT_MS);
      if (!d.b64) throw new Error('empty');
      images[r.id] = d.b64;
      r.imageOk = true;
      touch(r);
    } catch (e) {
      console.warn('[career-talk] 그림 실패:', e && (e.status || e.name), e && e.message);
      if (e && e.code === 'scene') r.scene = '';
      if (e && e.status === 429) SimKit.toast(e.message, 'no');
      touch(r);
    }
    if (screens.current() === 'scSketch' && rec === r) renderArt(r);
  }
  async function goSketch() {
    if (busy) return;
    var r = rec;
    screens.show('scSketch');
    $('btnSketchBack').innerHTML = icon('arrow-left') + '돌아보기로';
    var job = JOBS[r.jobId];
    if (!r.story) {
      $('storyBox').innerHTML = '<div class="ct-spin" style="margin:8px auto"></div><p class="ct-muted" style="text-align:center">대화를 바탕으로 글을 쓰는 중이에요…</p>';
      $('artBox').className = 'ct-art';
      $('artBox').innerHTML = '<div class="big" aria-hidden="true">' + job.emoji + '🧒</div>';
      $('btnRedraw').hidden = true;
      try {
        var d = await apiRetry('sketch', { part: 'text', level: r.level, jobId: r.jobId, turns: r.turns, rturns: r.rturns });
        r.story = str(d.story, 400);
        r.scene = str(d.scene, 80);
      } catch (e) {
        if (e.status === 429) SimKit.toast(e.message, 'no');
        var f = fallbackStory(r);
        r.story = f.story;
        r.scene = '';
      }
      if (!r.story) r.story = fallbackStory(r).story;
      touch(r);
      if (screens.current() !== 'scSketch' || rec !== r) return;
    }
    renderStory(r);
    renderArt(r);
  }

  /* ══════════ 탐험 카드 ══════════ */
  var cardData = null;   // { rec | shared }
  function renderCard(c, shared) {
    var job = JOBS[c.jobId];
    var box = $('cardBox');
    box.innerHTML = '';
    var head = el('div', 'ct-card-head');
    head.appendChild(el('span', 'e', job.emoji)).setAttribute('aria-hidden', 'true');
    var t = el('div');
    t.appendChild(el('div', 't', '진로 탐험대 탐험 카드'));
    t.appendChild(el('div', 'n', job.name));
    t.appendChild(el('div', 'd', shared ? '친구의 탐험 카드' : job.persona + ' ' + SimKit.josa(job.honorific, '과/와') + ' 이야기했어요 · ' + (c.date || '')));
    head.appendChild(t);
    var art = el('div', 'ct-card-art');
    if (!shared && images[c.id]) {
      var img = el('img');
      img.src = b64Src(images[c.id]);
      img.alt = '10년 뒤 나의 하루 그림';
      art.appendChild(img);
    } else {
      art.textContent = job.emoji + '🧒';
      art.setAttribute('aria-hidden', 'true');
    }
    head.appendChild(art);
    box.appendChild(head);

    var h1 = el('h4'); h1.innerHTML = icon('book-open') + '알게 된 것';
    box.appendChild(h1);
    var ul = el('ul');
    (c.summary.length ? c.summary : ['돌아보기를 하면 여기에 정리돼요.']).forEach(function (s) { ul.appendChild(el('li', '', s)); });
    box.appendChild(ul);

    var h2 = el('h4'); h2.innerHTML = icon('lightbulb') + '더 알아볼 직업';
    box.appendChild(h2);
    if (c.recommend.length) {
      var rs = el('div', 'ct-card-recs');
      c.recommend.forEach(function (x) {
        var j = JOBS[x.id];
        var d = el('div');
        d.appendChild(el('b', '', j.emoji)).setAttribute('aria-hidden', 'true');
        d.appendChild(el('strong', '', j.name));
        if (x.reason) { d.appendChild(document.createElement('br')); d.appendChild(el('span', '', x.reason)); }
        rs.appendChild(d);
      });
      box.appendChild(rs);
    } else box.appendChild(el('p', 'ct-muted', '돌아보기에서 \'비슷한 직업도 알고 싶어요\'를 누르면 채워져요.'));

    var h3 = el('h4'); h3.innerHTML = icon('sparkles') + '10년 뒤 나의 하루';
    box.appendChild(h3);
    box.appendChild(el('p', c.story ? '' : 'ct-muted', c.story || '돌아보기에서 \'미래의 내 모습을 그려 볼래요\'를 누르면 채워져요.'));
    box.appendChild(el('div', 'ct-card-foot', 'eduin VIVES 진로 탐험대 · AI와 나눈 이야기로 만든 카드예요'));
  }
  function goCard() {
    if (busy) return;
    rec.done = true;
    touch(rec);
    cardData = { rec: rec };
    $('cardShared').hidden = true;
    renderCard({ id: rec.id, jobId: rec.jobId, summary: rec.summary, recommend: rec.recommend, story: rec.story, date: dateText(rec.updatedAt) }, false);
    var b = $('cardBtns');
    b.innerHTML = '';
    b.appendChild(btn('sk-btn--primary', icon('share-2') + '카드 공유하기', function () { window.shareCurrentPage(); }));
    b.appendChild(btn('', icon('printer') + '인쇄하기', function () { window.print(); }));
    var r = rec;
    if (!r.story) b.appendChild(btn('', icon('sparkles') + '미래의 내 모습 그려 보기', function () { rec = r; goSketch(); }));
    if (!r.recommend.length) b.appendChild(btn('', icon('lightbulb') + '비슷한 직업 알아보기', function () { rec = r; goRecommend(); }));
    b.appendChild(btn('', icon('list-checks') + '내 기록', goRecords));
    b.appendChild(btn('', icon('arrow-left') + '새 직업 고르기', goPick));
    screens.show('scCard');
  }
  function showSharedCard(p) {
    cardData = { shared: p };
    $('cardShared').hidden = false;
    renderCard({ id: '', jobId: p.jobId, summary: p.summary, recommend: p.recommend, story: p.story, date: '' }, true);
    var b = $('cardBtns');
    b.innerHTML = '';
    var job = JOBS[p.jobId];
    b.appendChild(btn('sk-btn--primary ct-big', icon('message-circle') + esc('나도 ' + SimKit.josa(job.name, '과/와') + ' 이야기하기'), function () {
      if (!state.level) { pendingJob = p.jobId; goLevel('job'); } else startTalk(p.jobId);
    }));
    b.appendChild(btn('', icon('arrow-left') + '직업 고르기', function () { if (!state.level) goLevel(); else goPick(); }));
    screens.show('scCard');
  }
  function cleanShared(p) {
    if (!p || !JOBS[p.jobId]) return null;
    return { v: 1, jobId: p.jobId, summary: cleanList(p.summary, 3, 60), recommend: cleanRecs(p.recommend).map(function (r) { return { id: r.id, reason: r.reason.slice(0, 30) }; }), story: str(p.story, 400) };
  }
  // 공유는 탐험 카드만(대화 원문·직접 쓴 글은 넣지 않는다)
  SimKit.share.bind(function () {
    if (screens.current() !== 'scCard' || !cardData) return null;
    if (cardData.shared) return cardData.shared;
    var r = cardData.rec;
    return { v: 1, jobId: r.jobId, summary: r.summary, recommend: r.recommend.map(function (x) { return { id: x.id, reason: x.reason.slice(0, 30) }; }), story: r.story };
  }, { title: '진로 탐험대 - 나의 탐험 카드', shorten: true, native: false, emptyMessage: '탐험 카드를 완성하면 카드를 공유할 수 있어요.', copiedMessage: '카드 링크를 복사했어요.' });

  /* ══════════ 내 기록 ══════════ */
  function goRecords() {
    var box = $('recordList');
    box.innerHTML = '';
    var list = state.talks.slice().sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    if (!list.length) box.appendChild(el('p', 'ct-empty', '아직 기록이 없어요. 직업인을 골라 이야기해 보세요.'));
    list.forEach(function (t) {
      var j = JOBS[t.jobId];
      var row = el('div', 'ct-record');
      row.appendChild(el('span', 'e', j.emoji)).setAttribute('aria-hidden', 'true');
      var info = el('div', 'info');
      info.appendChild(el('div', 'n', j.persona + ' ' + j.name));
      info.appendChild(el('div', 's', dateText(t.updatedAt) + ' · ' + LEVELS[t.level].name + ' · ' + (t.done ? '카드 완성' : t.mode === 'reflect' ? '돌아보는 중' : '질문 ' + meCount(t.turns) + '/' + LEVELS[t.level].max)));
      row.appendChild(info);
      var acts = el('div', 'acts');
      acts.appendChild(btn('sk-btn--sm', icon('play') + '이어 하기', function () { openTalk(t); }));
      if (t.done) acts.appendChild(btn('sk-btn--sm', icon('list-checks') + '카드', function () { rec = t; goCard(); }));
      var del = btn('sk-btn--sm sk-btn--danger', icon('trash-2'), function () {
        if (!window.confirm(j.name + ' 기록을 지울까요? 지운 기록은 되돌릴 수 없어요.')) return;
        state.talks.splice(state.talks.indexOf(t), 1);
        delete images[t.id];
        save();
        goRecords();
      });
      del.setAttribute('aria-label', j.name + ' 기록 지우기');
      acts.appendChild(del);
      row.appendChild(acts);
      box.appendChild(row);
    });
    screens.show('scRecords');
  }

  /* ══════════ 화면 키보드(visualViewport) ══════════ */
  function syncViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty('--ct-vh', Math.round(vv.height) + 'px');
    if (screens.current() === 'scTalk') { window.scrollTo(0, 0); scrollLog(); }
  }

  /* ══════════ 연결 ══════════ */
  var pendingJob = null;
  function bind() {
    $('btnStart').disabled = true;
    $('btnStart').addEventListener('click', function () { if (!state.level) goLevel(); else goPick(); });
    $('btnIntroRecords').addEventListener('click', goRecords);
    document.querySelectorAll('.ct-level-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.level = b.dataset.level;
        save();
        setLevelClass(state.level);
        if (levelReturn === 'job' && pendingJob) { var id = pendingJob; pendingJob = null; startTalk(id); return; }
        goPick();
      });
    });
    $('btnLevel').addEventListener('click', function () { goLevel(); });
    $('btnRecords').addEventListener('click', goRecords);
    $('btnRecordsPick').addEventListener('click', goPick);
    $('searchIcon').innerHTML = icon('search');
    $('jobSearch').addEventListener('input', renderList);
    $('btnListBack').innerHTML = icon('arrow-left') + '처음 목록으로';
    $('btnListBack').addEventListener('click', function () { listMode = null; $('jobSearch').value = ''; renderList(); });
    $('btnTalkBack').addEventListener('click', function () { if (!busy) goPick(); });
    var input = $('customInput');
    input.addEventListener('input', updateCount);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendCustom(); }
    });
    input.addEventListener('focus', function () { document.body.classList.add('ct-typing'); setTimeout(syncViewport, 300); });
    input.addEventListener('blur', function () { document.body.classList.remove('ct-typing'); });
    $('btnCustomSend').addEventListener('click', sendCustom);
    $('recIcon').innerHTML = icon('info');
    $('btnRecBack').addEventListener('click', function () { openTalk(rec); });
    $('btnRecSketch').addEventListener('click', goSketch);
    $('btnRecCard').addEventListener('click', goCard);
    $('btnSketchBack').addEventListener('click', function () { openTalk(rec); });
    $('btnSketchCard').addEventListener('click', goCard);
    $('btnRedraw').addEventListener('click', function () { drawImage(rec); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', syncViewport);
  }
  function sendCustom() {
    var v = $('customInput').value.trim().slice(0, L().custom || 0);
    if (!v) { $('customInput').focus(); return; }
    if (rec.mode === 'reflect') sendReflect(v, true); else sendTalk(v, true);
  }

  SimKit.ready(function () {
    bind();
    dataReady.then(function () {
      state = store.load();
      $('btnStart').disabled = false;
      setLevelClass(state.level);
      var shared = cleanShared(SimKit.share.read({ version: 1 }));
      if (shared) { showSharedCard(shared); return; }
      goIntro();
    }).catch(function () {
      $('btnStart').disabled = true;
      SimKit.toast('직업 목록을 불러오지 못했어요. 새로고침해 주세요.', 'no');
    });
  });
})();
