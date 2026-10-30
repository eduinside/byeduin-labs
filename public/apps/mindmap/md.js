/* =====================================================
   마인드맵 ↔ 마크다운 변환기 (window.MindmapMD)
   /apps/mindmap/md.js — 마인드맵 앱과 MD 편집기가 같이 쓴다(판단 규칙 하나로 통일).
   계획: docs/mindmap-plan.md 6절

   MindmapMD.toMd(tree)                 {topic, children} → '<!-- mindmap -->\n# 주제\n- 가지\n  - 작은 가지'
   MindmapMD.fromMd(md, fallbackTitle)  → { tree, count, depth, dropped } (제목·목록만 트리로, 문단·표·코드는 버림)
   MindmapMD.isMindmap(md)              마인드맵으로 보낼 만한 글인지
   MindmapMD.MARK                       첫 줄 표시 '<!-- mindmap -->'
   MindmapMD.MAX_DEPTH                  가지 단계 상한(5). 더 깊은 줄은 5단계에 붙인다
   ===================================================== */
(function (global) {
  'use strict';
  var MARK = '<!-- mindmap -->';
  var TOPIC_MAX = 200;
  var NODE_MAX = 500;
  var MAX_DEPTH = 5; // 가운데 주제 아래 가지 단계(운영자 결정 2026-10-31)

  // 노드 글: 줄바꿈은 공백으로, 앞뒤 공백 정리
  function oneLine(s) {
    return String(s == null ? '' : s).replace(/\s*[\r\n]+\s*/g, ' ').trim();
  }

  // 마크다운 꾸밈을 걷어 낸 글자(링크는 글자만, 그림은 뺌)
  function plain(s) {
    return oneLine(s)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(\*|_)(\S.*?\S|\S)\1/g, '$2')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\\([\\`*_{}\[\]()#+\-.!>|])/g, '$1')
      .trim()
      .slice(0, TOPIC_MAX);
  }

  // 목록 첫머리에 오면 목록으로 읽히는 글자를 막는다(내보낸 글을 다시 읽을 때 깨지지 않게)
  function escTopic(s) {
    return oneLine(s).replace(/^([#>*+\-])(\s)/, '\\$1$2').replace(/^(\d+)([.)])(\s)/, '$1\\$2$3');
  }

  function toMd(tree) {
    var out = [MARK, '# ' + escTopic(tree && tree.topic || '마인드맵')];
    (function walk(list, d) {
      (list || []).forEach(function (n) {
        out.push(new Array(d + 1).join('  ') + '- ' + escTopic(n.topic));
        walk(n.children, d + 1);
      });
    })(tree && tree.children, 0);
    return out.join('\n') + '\n';
  }

  // 줄을 제목·목록·기타로 나눈다
  function scan(md) {
    var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    var items = [], dropped = 0, inCode = false, inComment = false, other = 0, tables = 0, codes = 0;
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var t = raw.trim();
      if (inComment) { if (t.indexOf('-->') >= 0) inComment = false; continue; }
      if (/^(```|~~~)/.test(t)) { if (!inCode) codes++; inCode = !inCode; continue; }
      if (inCode) { dropped++; continue; }
      if (!t) continue;
      if (t.indexOf('<!--') === 0) { if (t.indexOf('-->') < 0) inComment = true; continue; }
      var h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(t);
      if (h) { items.push({ kind: 'h', level: h[1].length, text: plain(h[2]) }); continue; }
      var li = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(raw.replace(/\t/g, '    '));
      if (li) { items.push({ kind: 'li', indent: li[1].length, text: plain(li[2]) }); continue; }
      if (/^\|/.test(t)) tables++;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) continue; // 가로줄은 무시
      other++; dropped++;
    }
    return { items: items, dropped: dropped, other: other, tables: tables, codes: codes };
  }

  function fromMd(md, fallbackTitle) {
    var s = scan(md);
    var items = s.items.filter(function (it) { return it.text; });
    var heads = items.filter(function (it) { return it.kind === 'h'; });
    var minH = heads.length ? Math.min.apply(null, heads.map(function (h) { return h.level; })) : 0;
    var topHeads = heads.filter(function (h) { return h.level === minH; });
    // 가장 큰 제목이 하나뿐이고 맨 앞에 있으면 그 제목이 가운데 주제
    var rootFromHead = topHeads.length === 1 && items[0] === topHeads[0];
    var root = { topic: rootFromHead ? topHeads[0].text : (plain(String(fallbackTitle || '').replace(/\.(md|markdown|txt)$/i, '')) || '마인드맵'), children: [] };
    var stack = [{ depth: 0, node: root }];
    var base = 0;          // 지금 제목의 깊이(목록은 그 아래)
    var indents = [];      // 지금 목록의 들여쓰기 단계
    var count = 1, maxDepth = 0;

    for (var i = 0; i < items.length && count < NODE_MAX; i++) {
      var it = items[i], depth;
      if (it === topHeads[0] && rootFromHead) { indents = []; base = 0; continue; }
      if (it.kind === 'h') {
        depth = it.level - minH + (rootFromHead ? 0 : 1);
        base = depth;
        indents = [];
      } else {
        while (indents.length && indents[indents.length - 1] > it.indent) indents.pop();
        if (!indents.length || indents[indents.length - 1] < it.indent) indents.push(it.indent);
        depth = base + indents.length;
      }
      // 가지는 MAX_DEPTH단계까지 — 더 깊은 줄은 마지막 단계에 나란히 붙인다(글은 버리지 않음)
      if (depth > MAX_DEPTH) depth = MAX_DEPTH;
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
      var parent = stack[stack.length - 1];
      depth = parent.depth + 1; // 건너뛴 단계(# 다음 ###)는 한 단계로 붙인다
      var node = { topic: it.text, children: [] };
      parent.node.children.push(node);
      stack.push({ depth: depth, node: node });
      if (it.kind === 'h') base = depth;
      count++;
      if (depth > maxDepth) maxDepth = depth;
    }
    return { tree: root, count: count, depth: maxDepth, dropped: s.dropped };
  }

  // 마인드맵으로 보낼 만한 글: 표시가 있거나, 제목·목록이 대부분이고 가지가 2단계 이상
  function isMindmap(md) {
    var text = String(md || '');
    var first = text.replace(/^\s+/, '').split('\n')[0].trim();
    if (first === MARK) return true;
    var s = scan(text);
    if (s.tables || s.codes) return false;
    var structural = s.items.length;
    if (structural < 5) return false;
    if (structural / (structural + s.other) < 0.8) return false;
    return fromMd(text).depth >= 2;
  }

  global.MindmapMD = { MARK: MARK, MAX_DEPTH: MAX_DEPTH, toMd: toMd, fromMd: fromMd, isMindmap: isMindmap, plain: plain };
})(window);
