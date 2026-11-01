/* =====================================================
   마인드맵 ↔ XMind 파일 변환기 (window.MindmapXmind)
   /apps/mindmap/xmind.js — 계획: docs/mindmap-plan.md 11절
   JSZip 3.10.1은 처음 쓸 때 한 번만 불러온다.

   MindmapXmind.fromFile(arrayBuffer, name) → Promise<{ tree, count, depth, dropped }>
       XMind 2020 이후(content.json)와 XMind 8(content.xml) 모두 읽음. 첫 시트의 붙은 가지만
   MindmapXmind.toBlob(tree)                 → Promise<Blob>  두 버전에서 모두 열리는 .xmind
   실패하면 Error(message는 화면에 그대로 보여 줄 문구)
   ===================================================== */
(function (global) {
  'use strict';
  var JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  var TOPIC_MAX = 200;
  var NODE_MAX = 500;
  var MAX_DEPTH = (global.MindmapMD && global.MindmapMD.MAX_DEPTH) || 5;
  var XML_NS = 'urn:xmind:xmap:xmlns:content:2.0';

  var zipLoading = null;
  function loadZip() {
    if (global.JSZip) return Promise.resolve(global.JSZip);
    if (zipLoading) return zipLoading;
    zipLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = JSZIP_SRC;
      s.onload = function () { global.JSZip ? resolve(global.JSZip) : reject(new Error('파일 도구를 불러오지 못했어요.')); };
      s.onerror = function () { zipLoading = null; reject(new Error('파일 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); };
      document.head.appendChild(s);
    });
    return zipLoading;
  }

  function oneLine(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, TOPIC_MAX);
  }
  function fail(msg) { return new Error(msg); }

  /* ── 읽기: 공통 트리 만들기 ──
     getTitle(raw), getKids(raw) 로 형식 차이를 숨기고 {topic, children} 트리를 만든다 */
  function build(rawRoot, getTitle, getKids, fallbackTitle) {
    var count = 1, maxDepth = 0, dropped = 0;
    var root = { topic: oneLine(getTitle(rawRoot)) || fallbackTitle, children: [] };
    (function walk(rawList, parent, depth) {
      rawList.forEach(function (raw) {
        if (count >= NODE_MAX) { dropped++; return; }
        var node = { topic: oneLine(getTitle(raw)), children: [] };
        parent.children.push(node);
        count++;
        if (depth > maxDepth) maxDepth = depth;
        // MAX_DEPTH보다 깊은 가지는 마지막 단계에 나란히 붙인다(글은 버리지 않음)
        walk(getKids(raw), depth < MAX_DEPTH ? node : parent, Math.min(depth + 1, MAX_DEPTH));
      });
    })(getKids(rawRoot), root, 1);
    return { tree: root, count: count, depth: maxDepth, dropped: dropped };
  }

  // XMind 2020 이후: content.json = [ { rootTopic: { title, children: { attached: [...] } } }, ... ]
  function fromJson(text, fallbackTitle) {
    var sheets;
    try { sheets = JSON.parse(text); } catch (e) { throw fail('XMind 파일 내용을 읽지 못했어요.'); }
    var sheet = Array.isArray(sheets) ? sheets[0] : null;
    if (!sheet || !sheet.rootTopic) throw fail('XMind 파일에서 마인드맵을 찾지 못했어요.');
    return build(sheet.rootTopic,
      function (t) { return t && t.title; },
      function (t) { return (t && t.children && Array.isArray(t.children.attached)) ? t.children.attached : []; },
      fallbackTitle);
  }

  // XMind 8: content.xml = <xmap-content><sheet><topic><title/><children><topics type="attached"><topic>…
  function kidsByName(el, name) {
    return Array.prototype.filter.call(el.children || [], function (c) { return c.localName === name; });
  }
  function fromXml(text, fallbackTitle) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw fail('XMind 파일 내용을 읽지 못했어요.');
    var sheet = kidsByName(doc.documentElement, 'sheet')[0];
    var top = sheet && kidsByName(sheet, 'topic')[0];
    if (!top) throw fail('XMind 파일에서 마인드맵을 찾지 못했어요.');
    return build(top,
      function (t) { var ti = kidsByName(t, 'title')[0]; return ti ? ti.textContent : ''; },
      function (t) {
        var out = [];
        kidsByName(t, 'children').forEach(function (ch) {
          kidsByName(ch, 'topics').forEach(function (ts) {
            if ((ts.getAttribute('type') || 'attached') === 'attached') out = out.concat(kidsByName(ts, 'topic'));
          });
        });
        return out;
      },
      fallbackTitle);
  }

  function fromFile(buf, name) {
    var fallbackTitle = oneLine(String(name || '').replace(/\.xmind$/i, '')) || '가져온 마인드맵';
    return loadZip().then(function (JSZip) {
      return JSZip.loadAsync(buf).catch(function () { throw fail('XMind 파일이 아니거나 망가진 파일이에요.'); });
    }).then(function (zip) {
      var json = zip.file('content.json');
      var xml = zip.file('content.xml');
      if (!json && !xml) {
        if (zip.file('META-INF/manifest.xml') || zip.file('manifest.json')) throw fail('암호를 건 XMind 파일은 읽을 수 없어요. XMind에서 암호를 푼 뒤 다시 골라 주세요.');
        throw fail('XMind 파일에서 마인드맵을 찾지 못했어요.');
      }
      // 새 버전 파일은 content.xml에 '옛 버전으로는 못 연다'는 안내만 넣어 두므로 content.json을 먼저 읽는다
      return json
        ? json.async('string').then(function (t) { return fromJson(t, fallbackTitle); })
        : xml.async('string').then(function (t) { return fromXml(t, fallbackTitle); });
    });
  }

  /* ── 저장 ── */
  var seq = 0;
  function xid() { return 'mm' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 8); }
  function xmlEsc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function toJsonTopic(t, isRoot) {
    var o = { id: xid(), class: 'topic', title: oneLine(t.topic) };
    if (isRoot) o.structureClass = 'org.xmind.ui.map.unbalanced';
    if (t.children && t.children.length) o.children = { attached: t.children.map(function (c) { return toJsonTopic(c); }) };
    return o;
  }
  function toXmlTopic(t, isRoot) {
    var s = '<topic id="' + xid() + '"' + (isRoot ? ' structure-class="org.xmind.ui.map.unbalanced"' : '') + '>' +
      '<title>' + xmlEsc(oneLine(t.topic)) + '</title>';
    if (t.children && t.children.length) {
      s += '<children><topics type="attached">' + t.children.map(function (c) { return toXmlTopic(c); }).join('') + '</topics></children>';
    }
    return s + '</topic>';
  }

  function toBlob(tree) {
    return loadZip().then(function (JSZip) {
      var title = oneLine(tree.topic) || '마인드맵';
      var sheetId = xid();
      var content = [{ id: sheetId, class: 'sheet', title: title, rootTopic: toJsonTopic(tree, true) }];
      var contentXml = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
        '<xmap-content xmlns="' + XML_NS + '" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" version="2.0">' +
        '<sheet id="' + sheetId + '">' + toXmlTopic(tree, true) + '<title>' + xmlEsc(title) + '</title></sheet></xmap-content>';
      var zip = new JSZip();
      zip.file('content.json', JSON.stringify(content));
      zip.file('content.xml', contentXml);
      zip.file('metadata.json', JSON.stringify({ creator: { name: 'eduin VIVES 마인드맵', version: '1.0' } }));
      zip.file('manifest.json', JSON.stringify({ 'file-entries': { 'content.json': {}, 'metadata.json': {} } }));
      zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
        '<manifest xmlns="urn:xmind:xmap:xmlns:manifest:1.0">' +
        '<file-entry full-path="content.xml" media-type="text/xml"/>' +
        '<file-entry full-path="META-INF/" media-type=""/>' +
        '<file-entry full-path="META-INF/manifest.xml" media-type="text/xml"/>' +
        '</manifest>');
      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.xmind.workbook', compression: 'DEFLATE' });
    });
  }

  global.MindmapXmind = { fromFile: fromFile, toBlob: toBlob };
})(window);
