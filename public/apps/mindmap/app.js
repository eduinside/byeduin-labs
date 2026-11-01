/* =====================================================
   마인드맵 (/apps/mindmap/) — 계획: docs/mindmap-plan.md
   편집기: Mind Elixir 5.15.1 (MIT, window.MindElixir.default)
   저장: localStorage 'vives-mindmap' → VivesSync doc(/api/mindmap)
   공유: #share= { data:{ md }, permission:'view'|'clone', from? } — 내용은 마크다운 개요(MindmapMD)
   ===================================================== */
(function () {
  'use strict';

  var KEY = 'vives-mindmap';
  var NODE_MAX = 500;
  var MAP_MAX = 100;
  var SHARE_URL_MAX = 8000;
  var MD = window.MindmapMD;
  var XM = window.MindmapXmind;

  // Mind Elixir 오른쪽 클릭 메뉴 글(내장 한국어 대신 화면 글투에 맞춘 문구)
  var KO = {
    addChild: '작은 가지 추가', addParent: '위에 가지 끼우기', addSibling: '옆 가지 추가',
    removeNode: '지우기', focus: '이 가지만 보기', cancelFocus: '전체 보기',
    moveUp: '위로', moveDown: '아래로', link: '화살표 잇기', linkBidirectional: '양쪽 화살표 잇기',
    clickTips: '이을 가지를 눌러 주세요', summary: '묶음 표시',
  };

  var mind = null;       // Mind Elixir 인스턴스
  var cur = null;        // 열린 맵 기록(공유받은 맵은 id 없음)
  var viewOnly = false;  // 공유받은 맵 보기(저장 안 함)
  var sharedTree = null; // 보기만 고른 복제 허용 맵(나중에 '내 목록에 담기')
  var saveTimer = 0;
  var warnedMax = false;
  var importName = '';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, type) { VUI.toast(msg, typeof type === 'string' ? { type: type } : type); }
  function lib() { return window.MindElixir && window.MindElixir.default; }
  function nid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowIso() { return new Date().toISOString(); }
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  /* ── 저장소 ── */
  function load() {
    var d = VUI.storage.get(KEY, null, function (v) { return v && Array.isArray(v.maps); });
    return d || { maps: [] };
  }
  var store = load();
  function persist() { store.updatedAt = nowIso(); VUI.storage.set(KEY, store); }
  function findMap(id) { return store.maps.find(function (m) { return m.id === id; }) || null; }

  /* ── 트리 ↔ Mind Elixir 노드 ── */
  function treeToNode(t, isRoot) {
    var n = { id: isRoot ? 'root' : 'n' + nid(), topic: t.topic || '', children: (t.children || []).map(function (c) { return treeToNode(c); }) };
    if (isRoot) n.root = true;
    return n;
  }
  function nodeToTree(n) {
    return { topic: n.topic || '', children: (n.children || []).map(nodeToTree) };
  }
  function countNodes(n) {
    return 1 + (n.children || []).reduce(function (s, c) { return s + countNodes(c); }, 0);
  }
  function pickData(d) {
    return { nodeData: d.nodeData, direction: d.direction, arrows: d.arrows || [], summaries: d.summaries || [] };
  }
  function newRecord(tree) {
    return {
      id: 'm' + nid(),
      data: { nodeData: treeToNode(tree, true), direction: 2, arrows: [], summaries: [] },
      theme: 'light', createdAt: nowIso(), updatedAt: nowIso(),
    };
  }
  function addRecord(rec) {
    if (store.maps.length >= MAP_MAX) {
      toast('마인드맵은 ' + MAP_MAX + '개까지 저장할 수 있어요. 안 쓰는 것을 지운 뒤 다시 해 주세요.', 'error');
      return null;
    }
    store.maps.push(rec);
    persist();
    return rec;
  }

  /* ── 홈 ── */
  function renderHome() {
    var el = $('map-list');
    if (!store.maps.length) {
      el.innerHTML = '<div class="empty-state">' + VUI.icon('network') +
        '<div>아직 마인드맵이 없어요.<br>\'새 마인드맵\'이나 \'AI로 초안 만들기\'로 시작해 보세요.</div></div>';
      return;
    }
    el.innerHTML = store.maps.slice().sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; }).map(function (m) {
      var root = m.data.nodeData;
      var kids = (root.children || []).slice(0, 4).map(function (c) { return '<span class="thumb-kid">' + esc(c.topic) + '</span>'; }).join('');
      var title = root.topic || '제목 없음';
      return '<div class="map-card">' +
        '<div class="map-thumb' + (m.theme === 'dark' ? ' dark' : '') + '" aria-hidden="true"><span class="thumb-root">' + esc(title) + '</span>' +
        (kids ? '<span class="thumb-kids">' + kids + '</span>' : '') + '</div>' +
        '<div class="map-info"><div>' +
        '<button type="button" class="map-open" onclick="MM.open(\'' + m.id + '\')" aria-label="' + esc(title) + ' 고치기">' + esc(title) + '</button>' +
        '<div class="map-meta">가지 ' + (countNodes(root) - 1) + '개 · ' + fmtDate(m.updatedAt) + '</div></div>' +
        '<div class="map-actions">' +
        '<button class="mm-btn mm-btn-primary mm-btn-sm" onclick="MM.open(\'' + m.id + '\')">' + VUI.icon('eye') + ' 보기</button>' +
        '<button class="map-del" onclick="MM.remove(\'' + m.id + '\')" aria-label="' + esc(title) + ' 지우기">' + VUI.icon('trash-2') + '</button>' +
        '</div></div></div>';
    }).join('');
  }

  function showView(name) {
    $('view-home').classList.toggle('active', name === 'home');
    $('view-map').classList.toggle('active', name === 'map');
    document.body.classList.toggle('in-map', name === 'map');
  }

  /* ── 맵 열기 ── */
  // 바탕색은 칠판 앱과 같게: 밝은 색 = 화이트보드(#f7f7f4), 칠판 색 = 칠판(#1a3323)
  function themeOf(name) {
    var L = lib();
    var base = name === 'dark' ? L.DARK_THEME : L.THEME;
    var bg = name === 'dark' ? '#1a3323' : '#f7f7f4';
    return Object.assign({}, base, { cssVar: Object.assign({}, base.cssVar, { '--bgcolor': bg }) });
  }
  function applyTheme() {
    var dark = cur && cur.theme === 'dark';
    document.body.classList.toggle('mm-dark', dark);
    $('type-label').textContent = dark ? '칠판' : '화이트보드';
    $('btn-type').setAttribute('aria-label', dark ? '지금 칠판 - 눌러서 화이트보드로 바꾸기' : '지금 화이트보드 - 눌러서 칠판으로 바꾸기');
  }
  function mount(data, editable) {
    var L = lib();
    if (!L) { toast('마인드맵 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.', 'error'); return false; }
    if (mind) { try { mind.destroy(); } catch (e) {} mind = null; }
    $('mm-map').innerHTML = '';
    mind = new L({
      el: '#mm-map',
      direction: data.direction === 1 ? 1 : 2,
      editable: editable,
      draggable: editable,
      before: editable ? DEPTH_GUARD : {},
      contextMenu: editable ? { locale: KO, focus: true, link: true, extend: [{ name: 'AI에게 묻기', onclick: function () { openAsk(); } }] } : false,
      toolBar: false,
      keypress: editable,
      allowUndo: true,
      newTopicName: '새 가지',
      theme: themeOf(cur.theme),
      alignment: 'root',
    });
    var err = mind.init({ nodeData: data.nodeData, direction: data.direction, arrows: data.arrows || [], summaries: data.summaries || [] });
    if (err) { toast('마인드맵을 열지 못했어요.', 'error'); return false; }
    if (editable) {
      // 되돌리기·다시 하기는 'operation' 알림이 없어 저장이 안 되므로 감싸서 저장한다(버튼·Ctrl+Z 모두)
      ['undo', 'redo'].forEach(function (k) {
        var orig = mind[k];
        if (typeof orig === 'function') mind[k] = function () { var r = orig.apply(this, arguments); scheduleSave(); updateTools(); return r; };
      });
      mind.bus.addListener('operation', scheduleSave);
      mind.bus.addListener('operation', updateTools);
      mind.bus.addListener('selectNodes', updateTools);
      mind.bus.addListener('unselectNodes', updateTools);
    }
    updateTools();
    // 오른쪽 클릭 메뉴에서 'AI에게 묻기'를 맨 위로(라이브러리는 덧붙인 항목을 맨 아래에 둔다)
    var aiItem = Array.prototype.find.call($('mm-map').querySelectorAll('.context-menu li'), function (li) { return li.textContent.trim() === 'AI에게 묻기'; });
    if (aiItem) aiItem.parentElement.insertBefore(aiItem, aiItem.parentElement.firstChild);
    applyTheme();
    $('tb-title').textContent = data.nodeData.topic || '';
    setTimeout(fit, 30);
    return true;
  }

  function open(id) {
    var m = findMap(id);
    if (!m) return;
    cur = m; viewOnly = false; sharedTree = null;
    document.body.classList.remove('is-view-only');
    $('btn-take').hidden = true;
    showView('map');
    $('tb-status').textContent = '';
    if (!mount(m.data, true)) goHome();
  }

  // 공유받은 맵: 고칠 수 없게 열고, 복제 허용이면 '내 목록에 담기'를 보인다
  function openShared(tree, canTake) {
    cur = { id: null, theme: 'light', data: { nodeData: treeToNode(tree, true), direction: 2 } };
    viewOnly = true;
    sharedTree = canTake ? tree : null;
    document.body.classList.add('is-view-only');
    $('btn-take').hidden = !canTake;
    showView('map');
    if (!mount(cur.data, false)) goHome();
  }

  function goHome() {
    if (saveTimer) { clearTimeout(saveTimer); saveNow(); }
    if (mind) { try { mind.destroy(); } catch (e) {} mind = null; }
    cur = null; viewOnly = false; sharedTree = null;
    document.body.classList.remove('is-view-only', 'mm-dark');
    closeMenu();
    showView('home');
    renderHome();
  }

  /* ── 저장 ── */
  function scheduleSave() {
    if (viewOnly || !cur || !cur.id) return;
    $('tb-status').textContent = '저장 중…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }
  function saveNow() {
    saveTimer = 0;
    if (viewOnly || !cur || !cur.id || !mind) return;
    var data = pickData(mind.getData());
    var n = countNodes(data.nodeData);
    if (n > NODE_MAX && !warnedMax) {
      warnedMax = true;
      toast('가지가 ' + NODE_MAX + '개를 넘었어요. 너무 크면 저장·공유가 안 될 수 있으니 맵을 나눠 주세요.', 'error');
    }
    cur.data = data;
    cur.updatedAt = nowIso();
    persist();
    $('tb-title').textContent = data.nodeData.topic || '';
    $('tb-status').textContent = '저장됨';
  }

  /* ── 가지 단계 제한(가운데 주제 아래 5단계까지) ── */
  function levelOf(obj) { var d = 0; while (obj && obj.parent) { d++; obj = obj.parent; } return d; }
  function heightOf(obj) {
    return (obj.children || []).reduce(function (h, c) { return Math.max(h, 1 + heightOf(c)); }, 0);
  }
  function tooDeep() { toast('가지는 ' + MD.MAX_DEPTH + '단계까지 만들 수 있어요.'); return false; }
  // 옮길 가지들이 to 아래(또는 옆)에 붙었을 때 가장 깊은 단계
  function deepestAfter(from, newLevel) {
    return Math.max.apply(null, from.map(function (t) { return newLevel + heightOf(t.nodeObj); }));
  }
  var DEPTH_GUARD = {
    addChild: function (el) {
      var t = el || mind.currentNode;
      return !t || levelOf(t.nodeObj) < MD.MAX_DEPTH || tooDeep();
    },
    insertParent: function (el) {
      var t = el || mind.currentNode;
      return !t || levelOf(t.nodeObj) + heightOf(t.nodeObj) < MD.MAX_DEPTH || tooDeep();
    },
    moveNodeIn: function (from, to) {
      return deepestAfter(from, levelOf(to.nodeObj) + 1) <= MD.MAX_DEPTH || tooDeep();
    },
    moveNodeBefore: function (from, to) {
      return deepestAfter(from, levelOf(to.nodeObj)) <= MD.MAX_DEPTH || tooDeep();
    },
    moveNodeAfter: function (from, to) {
      return deepestAfter(from, levelOf(to.nodeObj)) <= MD.MAX_DEPTH || tooDeep();
    },
  };

  /* ── 편집 도구 ── */
  function rootEl() { return mind && mind.findEle(mind.nodeData.id); }
  // 가운데 주제를 골랐거나 아무것도 안 골랐으면 '옆 가지'는 쓸 수 없다
  function updateTools() {
    var n = mind && mind.currentNode;
    $('btn-sibling').disabled = !n || !!(n.nodeObj && n.nodeObj.root) || !(n.nodeObj && n.nodeObj.parent);
    $('btn-ask').disabled = !n;
  }
  function addChild() {
    if (!mind || viewOnly) return;
    if (!mind.currentNode) mind.selectNode(rootEl());
    mind.addChild();
  }
  function addSibling() {
    if (!mind || viewOnly) return;
    var n = mind.currentNode;
    if (!n || n.nodeObj && n.nodeObj.root) { toast('가운데 주제 옆에는 가지를 둘 수 없어요. 작은 가지를 추가해 주세요.'); return; }
    mind.insertSibling('after');
  }
  function removeNode() {
    if (!mind || viewOnly) return;
    var list = (mind.currentNodes || []).filter(function (t) { return !(t.nodeObj && t.nodeObj.root); });
    if (!list.length) { toast('지울 가지를 먼저 눌러 고르세요. 가운데 주제는 지울 수 없어요.'); return; }
    mind.removeNodes(list);
  }
  function undo() { if (mind && !viewOnly) mind.undo(); }
  function fit() {
    if (!mind) return;
    mind.scaleFit();
    if (mind.scaleVal > 1.6) mind.scale(1.6);
    mind.toCenter();
  }
  /* 빈 곳을 왼쪽 버튼으로 끌면 화면 이동(손 모양).
     Mind Elixir 5.15.1은 편집 중 빈 곳 왼쪽 누름을 늘 '여러 개 고르기'로 받아(mouseSelectionButton과 상관없이)
     이동이 안 되므로, 라이브러리보다 먼저(capture) 받아 직접 옮긴다. 가지·접기 단추·글 고치는 칸은 그대로 둔다. */
  var pan = null;
  function isBlank(t) {
    return !t.closest('me-tpc, me-epd, .circle, #input-box, .context-menu, [contenteditable="plaintext-only"]');
  }
  var mapEl = $('mm-map');
  mapEl.addEventListener('pointerdown', function (e) {
    if (!mind || e.pointerType !== 'mouse' || e.button !== 0 || !isBlank(e.target)) return;
    e.stopPropagation();
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    mapEl.setPointerCapture(e.pointerId);
    mapEl.classList.add('is-panning');
  }, true);
  mapEl.addEventListener('pointermove', function (e) {
    if (!pan || e.pointerId !== pan.id) return;
    e.stopPropagation();
    var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    pan.moved = true;
    pan.x = e.clientX; pan.y = e.clientY;
    mind.move(dx, dy);
  }, true);
  function endPan(e) {
    if (!pan || e.pointerId !== pan.id) return;
    e.stopPropagation();
    if (!pan.moved && mind) mind.clearSelection(); // 빈 곳을 누르기만 하면 고른 가지 풀기
    pan = null;
    mapEl.classList.remove('is-panning');
  }
  mapEl.addEventListener('pointerup', endPan, true);
  mapEl.addEventListener('pointercancel', endPan, true);

  /* 가지를 끌어 가운데 주제에 놓기. Mind Elixir는 가운데 주제(부모 없는 노드)를 놓을 곳으로 받지 않으므로
     끌기 중(유령 표시가 보일 때) 가운데 주제 위에서 놓으면 큰 가지로 옮긴다. */
  function dragging() {
    var g = mapEl.querySelector('.mind-elixir-ghost');
    return g && g.style.display === 'block';
  }
  function rootUnder(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.closest && el.closest('me-root') ? rootEl() : null;
  }
  mapEl.addEventListener('pointermove', function (e) {
    var r = rootEl();
    if (r) r.classList.toggle('mm-drop-root', !!(dragging() && rootUnder(e)));
  });
  mapEl.addEventListener('pointerup', function (e) {
    if (!mind || pan || !dragging()) return;
    var r = rootUnder(e);
    if (r) r.classList.remove('mm-drop-root');
    var nodes = (mind.currentNodes || []).filter(function (t) { return t.nodeObj && t.nodeObj.parent && t.nodeObj.parent !== mind.nodeData; });
    if (!r || !nodes.length) return;
    setTimeout(function () { if (mind) mind.moveNodeIn(nodes, rootEl()); }, 0); // 라이브러리의 끌기 마무리 뒤에
  }, true);

  // 오른쪽 아래 +/− (지도 앱처럼). 배율은 30%~300%
  function zoom(dir) {
    if (!mind) return;
    var v = Math.round(Math.max(0.3, Math.min(3, (mind.scaleVal || 1) * (dir > 0 ? 1.25 : 0.8))) * 100) / 100;
    mind.scale(v);
  }
  function toggleDirection() {
    if (!mind || viewOnly) return;
    if (mind.direction === 2) mind.initRight(); else mind.initSide();
    scheduleSave();
    setTimeout(fit, 30);
  }
  function toggleTheme() {
    if (!mind || !cur) return;
    cur.theme = cur.theme === 'dark' ? 'light' : 'dark';
    mind.changeTheme(themeOf(cur.theme));
    applyTheme();
    if (cur.id && !viewOnly) { cur.updatedAt = nowIso(); persist(); }
  }

  /* ── 공유·보내기 ── */
  function currentTree() {
    if (!mind) return null;
    return nodeToTree(mind.getData().nodeData);
  }
  function safeName(s) {
    return (String(s || '마인드맵').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || '마인드맵');
  }
  function share(permission) {
    closeMenu();
    var tree = currentTree();
    if (!tree) return;
    var url = location.origin + '/apps/mindmap/#share=' + VUI.share.encode({ data: { md: MD.toMd(tree) }, permission: permission });
    if (url.length > SHARE_URL_MAX) {
      toast('가지가 많아 링크로 보낼 수 없어요. MD 편집기로 보내 파일로 전달해 주세요.', { type: 'error', duration: 6000 });
      return;
    }
    VUI.share.link(url, permission === 'view'
      ? { title: '보기 전용 링크', desc: '받은 사람은 이 마인드맵을 전체 화면으로 볼 수 있어요.' }
      : { title: '복제 허용 링크', desc: '받은 사람이 자기 마인드맵 목록에 담아 고칠 수 있어요.' });
  }
  function sendToMd() {
    closeMenu();
    var tree = currentTree();
    if (!tree) return;
    if (saveTimer) { clearTimeout(saveTimer); saveNow(); }
    // QR 앱과 같은 MD 편집기 공유 형식({data:{content, filename}, permission})
    var encoded = VUI.share.encode({ data: { content: MD.toMd(tree), filename: safeName(tree.topic) + '.md' }, permission: 'clone' });
    location.href = '/apps/md-editor/#share=' + encoded;
  }
  function saveXmind() {
    closeMenu();
    var tree = currentTree();
    if (!tree) return;
    var d = mind.getData();
    var extras = (d.arrows && d.arrows.length) || (d.summaries && d.summaries.length);
    XM.toBlob(tree).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = safeName(tree.topic) + '.xmind';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast(extras ? 'XMind 파일로 저장했어요. 화살표·묶음 표시는 빠져요.' : 'XMind 파일로 저장했어요.', extras ? { duration: 6000 } : 'success');
    }).catch(function (err) {
      toast(err && err.message || 'XMind 파일을 만들지 못했어요.', 'error');
    });
  }
  function duplicate() {
    closeMenu();
    var tree = currentTree();
    if (!tree) return;
    if (saveTimer) { clearTimeout(saveTimer); saveNow(); }
    tree.topic = tree.topic + ' (복사본)';
    var rec = addRecord(newRecord(tree));
    if (!rec) return;
    rec.theme = cur.theme;
    persist();
    open(rec.id);
    toast('복사본을 만들었어요.');
  }
  function takeShared() {
    if (!sharedTree) return;
    var rec = addRecord(newRecord(sharedTree));
    if (!rec) return;
    open(rec.id);
    toast('내 목록에 담았어요. 이제 고칠 수 있어요.', 'success');
  }

  /* ── 더보기 메뉴 ── */
  function toggleMore(e) {
    e.stopPropagation();
    var menu = $('more-menu'), btn = $('btn-more');
    if (menu.classList.contains('open')) { closeMenu(); return; }
    var r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    var first = menu.querySelector('button');
    if (first) first.focus();
    setTimeout(function () { document.addEventListener('click', closeMenu, { once: true }); }, 0);
  }
  function closeMenu() {
    var menu = $('more-menu');
    if (!menu || !menu.classList.contains('open')) return;
    menu.classList.remove('open');
    $('btn-more').setAttribute('aria-expanded', 'false');
  }

  /* ── 모달 ── */
  var modals = {
    new: VUI.modal.bind('#modal-new', { className: 'open', backdropClose: true, dialog: '.mm-modal', initialFocus: '#new-topic' }),
    ai: VUI.modal.bind('#modal-ai', { className: 'open', backdropClose: true, dialog: '.mm-modal', initialFocus: '#ai-topic' }),
    import: VUI.modal.bind('#modal-import', { className: 'open', backdropClose: true, dialog: '.mm-modal', initialFocus: '#import-text' }),
    ask: VUI.modal.bind('#modal-ask', { className: 'open', backdropClose: true, dialog: '.mm-modal', initialFocus: '#ask-q' }),
  };
  function closeModal(name) { modals[name].close(); }

  function openNew() { $('new-topic').value = ''; modals.new.open(); }
  function createNew() {
    var topic = $('new-topic').value.trim();
    if (!topic) { toast('가운데 주제를 적어 주세요.'); $('new-topic').focus(); return; }
    var rec = addRecord(newRecord({ topic: topic, children: [] }));
    if (!rec) return;
    closeModal('new');
    open(rec.id);
    setTimeout(function () { if (mind) mind.selectNode(rootEl()); }, 60);
  }

  /* AI 초안: '초안 만들기' → 아래에 예시안(작은 마인드맵) → '이렇게 마인드맵 만들기'로 맵 화면 */
  var aiTree = null;
  var previewMind = null;
  function clearPreview() {
    if (previewMind) { try { previewMind.destroy(); } catch (e) {} previewMind = null; }
    $('ai-preview-map').innerHTML = '';
    $('ai-preview').hidden = true;
  }
  function setAiStep(hasDraft) {
    $('ai-use').hidden = !hasDraft;
    $('ai-run').textContent = hasDraft ? '다시 만들기' : '초안 만들기';
    $('ai-run').classList.toggle('mm-btn-primary', !hasDraft);
    $('ai-run').classList.toggle('mm-btn-ghost', hasDraft);
  }
  function showPreview(tree) {
    var L = lib();
    clearPreview();
    $('ai-preview').hidden = false; // 보이는 상태에서 그려야 크기가 맞는다
    $('ai-preview-count').textContent = '가지 ' + (countNodes(tree) - 1) + '개';
    if (!L) return;
    previewMind = new L({
      el: '#ai-preview-map', direction: 2, editable: false, draggable: false,
      contextMenu: false, toolBar: false, keypress: false, theme: themeOf('light'), alignment: 'root',
    });
    previewMind.init({ nodeData: treeToNode(tree, true) });
    fitPreview(0);
  }
  // scaleFit은 그릴 칸 높이로 나누므로 칸 크기가 잡힌 뒤에 맞춘다(0이면 배율 0이 되어 안 보임)
  function fitPreview(tries) {
    requestAnimationFrame(function () {
      var m = previewMind;
      if (!m) return;
      if (!m.container.offsetHeight || !m.nodes.offsetHeight) { if (tries < 20) setTimeout(function () { fitPreview(tries + 1); }, 50); return; }
      m.scaleFit();
      if (!(m.scaleVal > 0)) m.scale(0.6);
      m.toCenter();
    });
  }
  function openAi() {
    aiTree = null;
    clearPreview();
    setAiStep(false);
    modals.ai.open();
  }
  function useAi() {
    if (!aiTree) return;
    var rec = addRecord(newRecord(aiTree));
    if (!rec) return;
    closeModal('ai');
    clearPreview();
    aiTree = null;
    $('ai-topic').value = '';
    open(rec.id);
    toast('AI 초안으로 마인드맵을 만들었어요. 살펴보고 고쳐 주세요.', 'success');
  }
  async function runAi() {
    var topic = $('ai-topic').value.trim();
    if (!topic) { toast('주제를 적어 주세요.'); $('ai-topic').focus(); return; }
    var btn = $('ai-run');
    if (btn.disabled) return;
    btn.disabled = true; $('ai-use').disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 만드는 중…';
    try {
      var data = await VUI.apiFetch('/api/mindmap-draft', {
        json: { topic: topic, level: $('ai-level').value, depth: Number($('ai-depth').value) },
        timeout: 45000,
      });
      var r = data && typeof data.markdown === 'string' ? MD.fromMd(data.markdown, topic) : null;
      if (!r || r.count < 3) throw new Error('AI가 초안을 만들지 못했어요. 주제를 조금 바꿔 다시 해 주세요.');
      aiTree = r.tree;
      showPreview(aiTree);
    } catch (e) {
      if (e.code !== 'abort') toast(e.message || 'AI 초안을 만들지 못했어요.', 'error');
    } finally {
      btn.disabled = false; $('ai-use').disabled = false;
      setAiStep(!!aiTree);
    }
  }

  /* 가지에서 AI에게 묻기 (오른쪽 클릭 메뉴·상단 막대) */
  var LEVEL_KEY = 'mindmap-ai-level'; // 대상 학년(이 기기 편의 설정)
  var askNode = null;   // 물어본 가지(nodeObj)
  var askItems = [];    // 마지막 답(가지로 넣을 목록)
  var askBusy = false;
  function pathOf(obj) {
    var list = [];
    while (obj) { list.unshift(obj.topic || ''); obj = obj.parent; }
    return list;
  }
  function openAsk() {
    var n = mind && mind.currentNode;
    if (!n || viewOnly) { toast('물어볼 가지를 먼저 눌러 고르세요.'); return; }
    askNode = n.nodeObj;
    askItems = [];
    var path = pathOf(askNode);
    $('ask-path').innerHTML = path.slice(0, -1).map(esc).concat('<b>' + esc(path[path.length - 1]) + '</b>').join(' › ');
    $('ask-answer').hidden = true;
    $('ask-insert').hidden = true;
    $('ask-q').value = '';
    try { var lv = localStorage.getItem(LEVEL_KEY); if (lv) $('ask-level').value = lv; } catch (e) {}
    modals.ask.open();
  }
  async function ask(mode) {
    if (askBusy || !askNode) return;
    var q = $('ask-q').value.trim();
    if (mode === 'ask' && !q) { toast('궁금한 것을 적어 주세요.'); $('ask-q').focus(); return; }
    if (mode === 'expand' && levelOf(askNode) >= MD.MAX_DEPTH) { tooDeep(); return; }
    var level = $('ask-level').value;
    try { localStorage.setItem(LEVEL_KEY, level); } catch (e) {}
    var btn = mode === 'ask' ? $('ask-send') : document.querySelector('#modal-ask [data-mode="' + mode + '"]');
    var label = btn.innerHTML;
    askBusy = true;
    document.querySelectorAll('#modal-ask .ask-quick button, #ask-send').forEach(function (b) { b.disabled = true; });
    btn.innerHTML = '<span class="spinner"></span> 묻는 중…';
    try {
      var data = await VUI.apiFetch('/api/mindmap-ask', {
        json: {
          path: pathOf(askNode),
          children: (askNode.children || []).map(function (c) { return c.topic; }),
          mode: mode, question: q, level: level,
        },
        timeout: 45000,
      });
      var items = data && Array.isArray(data.items) ? data.items.filter(function (s) { return typeof s === 'string' && s.trim(); }) : [];
      if (!items.length) throw new Error('AI가 답을 만들지 못했어요. 다시 물어봐 주세요.');
      if (mode === 'expand') {
        var added = await insertItems(items);
        if (added) { closeModal('ask'); toast('작은 가지 ' + added + '개를 붙였어요. 마음에 안 들면 Ctrl+Z로 되돌리세요.', 'success'); }
        return;
      }
      askItems = items;
      var head = mode === 'ask' ? q : (mode === 'explain' ? '쉽게 설명' : '예시');
      $('ask-answer').innerHTML = '<p class="ask-q">' + esc(head) + '</p><ul>' + items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
      $('ask-answer').hidden = false;
      $('ask-insert').hidden = levelOf(askNode) >= MD.MAX_DEPTH;
    } catch (e) {
      if (e.code !== 'abort') toast(e.message || 'AI에게 묻지 못했어요.', 'error');
    } finally {
      askBusy = false;
      btn.innerHTML = label;
      document.querySelectorAll('#modal-ask .ask-quick button, #ask-send').forEach(function (b) { b.disabled = false; });
    }
  }
  // 물어본 가지 아래에 항목들을 작은 가지로 붙인다(지워졌거나 5단계면 안내)
  async function insertItems(items) {
    var el = mind && askNode && mind.findEle(askNode.id);
    if (!el) { toast('물어본 가지를 찾을 수 없어요. 지워졌는지 확인해 주세요.', 'error'); return 0; }
    if (levelOf(askNode) >= MD.MAX_DEPTH) { tooDeep(); return 0; }
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      await mind.addChild(el, { id: 'n' + nid(), topic: MD.plain(items[i]) });
      n++;
    }
    mind.selectNode(el);
    return n;
  }
  async function insertAnswer() {
    if (!askItems.length) return;
    var added = await insertItems(askItems);
    if (added) { closeModal('ask'); toast('답을 가지 ' + added + '개로 붙였어요.', 'success'); }
  }
  $('ask-q').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) ask('ask'); });

  /* 마크다운 가져오기 */
  function openImport() { $('import-text').value = ''; importName = ''; modals.import.open(); }
  $('import-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (/\.xmind$/i.test(f.name)) { importXmind(f); return; }
    if (f.size > 1024 * 1024) { toast('1MB보다 작은 파일을 골라 주세요.', 'error'); return; }
    var fr = new FileReader();
    fr.onload = function () { $('import-text').value = String(fr.result || ''); importName = f.name; };
    fr.readAsText(f, 'utf-8');
  });
  /* XMind 가져오기: 고르면 바로 새 마인드맵 */
  function importXmind(f) {
    if (f.size > 20 * 1024 * 1024) { toast('20MB보다 작은 파일을 골라 주세요.', 'error'); return; }
    toast('XMind 파일을 읽고 있어요.');
    f.arrayBuffer().then(function (buf) { return XM.fromFile(buf, f.name); }).then(function (r) {
      var rec = addRecord(newRecord(r.tree));
      if (!rec) return;
      closeModal('import');
      open(rec.id);
      toast(r.dropped ? '가지가 많아 앞쪽 ' + NODE_MAX + '개만 가져왔어요.' : 'XMind 파일을 마인드맵으로 가져왔어요.', r.dropped ? { duration: 6000 } : 'success');
    }).catch(function (err) {
      toast(err && err.message || 'XMind 파일을 읽지 못했어요.', 'error');
    });
  }
  function importMd(text, name) {
    var r = MD.fromMd(text, name || '가져온 마인드맵');
    if (r.count < 2) return null;
    var rec = addRecord(newRecord(r.tree));
    if (!rec) return null;
    open(rec.id);
    return r;
  }
  function doImport() {
    var text = $('import-text').value;
    if (!text.trim()) { toast('마크다운을 붙여 넣거나 파일을 골라 주세요.'); return; }
    closeModal('import');
    var r = importMd(text, importName);
    if (!r) { toast('가지로 바꿀 제목(#)이나 목록(-)을 찾지 못했어요.', 'error'); return; }
    toast(r.dropped ? '문단·표·코드는 빼고 가져왔어요.' : '마인드맵으로 가져왔어요.');
  }

  async function removeMap(id) {
    var m = findMap(id);
    if (!m) return;
    var ok = await VUI.confirm('\'' + (m.data.nodeData.topic || '제목 없음') + '\' 마인드맵을 지울까요? 지운 마인드맵은 되살릴 수 없어요.', { title: '마인드맵 지우기', ok: '지우기', danger: true });
    if (!ok) return;
    store.maps = store.maps.filter(function (x) { return x.id !== id; });
    persist();
    renderHome();
    toast('마인드맵을 지웠어요.');
  }

  /* ── 키보드 ── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('more-menu').classList.contains('open')) { closeMenu(); $('btn-more').focus(); }
  });
  $('new-topic').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) createNew(); });
  $('ai-topic').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) runAi(); });

  window.MM = {
    open: open, remove: removeMap, goHome: goHome,
    addChild: addChild, addSibling: addSibling, removeNode: removeNode, undo: undo,
    fit: fit, zoom: zoom, toggleDirection: toggleDirection, toggleTheme: toggleTheme,
    share: share, sendToMd: sendToMd, saveXmind: saveXmind, duplicate: duplicate, takeShared: takeShared, toggleMore: toggleMore,
    openNew: openNew, createNew: createNew, openAi: openAi, runAi: runAi, useAi: useAi, openAsk: openAsk, ask: ask, insertAnswer: insertAnswer,
    openImport: openImport, doImport: doImport, closeModal: closeModal,
  };

  /* ── 시작: 공유 링크 받기 → 목록 ── */
  async function receiveShare() {
    var hash = location.hash;
    if (hash.indexOf('#share=') !== 0) return;
    history.replaceState(null, '', location.pathname);
    var p = VUI.share.decode(hash.slice(7), function (o) { return o && o.data && typeof o.data.md === 'string'; });
    var r = p ? MD.fromMd(p.data.md.slice(0, 200000), p.data.name || '') : null;
    if (!r || r.count < 2) { toast('공유 링크를 읽을 수 없어요. 링크가 잘리지 않았는지 확인해 주세요.', 'error'); return; }
    // MD 편집기에서 보낸 글은 묻지 않고 내 목록에 새 맵으로
    if (p.from === 'md-editor') {
      if (importMd(p.data.md, p.data.name)) toast(r.dropped ? '문단·표·코드는 빼고 마인드맵으로 만들었어요.' : '마크다운으로 마인드맵을 만들었어요.', 'success');
      return;
    }
    if (p.permission === 'view') { openShared(r.tree, false); toast('보기 전용으로 열었어요. 고칠 수는 없어요.'); return; }
    var ok = await VUI.confirm('\'' + r.tree.topic + '\' 마인드맵을 받았어요. 내 목록에 담아 고칠 수 있어요.', {
      title: '공유받은 마인드맵', ok: '내 목록에 담기', cancel: '보기만',
    });
    if (ok) {
      var rec = addRecord(newRecord(r.tree));
      if (rec) { open(rec.id); toast('내 목록에 담았어요.', 'success'); }
    } else {
      openShared(r.tree, true);
    }
  }

  function init() {
    renderHome();
    receiveShare();
    if (window.VivesSync) VivesSync.mountDocSync({
      apiUrl: '/api/mindmap',
      keys: [KEY],
      appName: '마인드맵',
      onApplied: function () {
        store = load();
        renderHome();
        if (cur && cur.id && !viewOnly) {
          var m = findMap(cur.id);
          if (m) { cur = m; mount(m.data, true); }
          else goHome();
        }
      },
    });
  }
  // Mind Elixir(defer)가 먼저 읽히도록 DOMContentLoaded 뒤에 시작
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
