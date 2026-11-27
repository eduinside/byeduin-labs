// 협의 도우미 - 등록부·확인서 HWPX 만들기 (docs/meet-date-plan.md §5, §11)
// 브라우저에서 만든다.
//   - 머리(header.xml: 글꼴·글자 모양·문단 모양·테두리)는 ./hwpx-header.xml 정적 파일
//     (kordoc 범용 출력에 함초롬돋움·회색 칸·가운데/오른쪽 문단 모양을 더한 것)
//   - 본문(section0.xml)은 여기서 문자열로 짠다. 칸 수·줄 수가 바뀌어도 그대로 맞춘다.
//   - 서명 그림: PNG를 BinData/에 넣고 content.hpf에 등록, 표 칸 안에 hp:pic(글자처럼 취급)으로 둔다.
//   - 묶기는 JSZip(3.10.1, cdnjs). mimetype은 맨 앞·무압축, 폴더 항목 없음.
// buildSection()·buildCertSection()은 DOM·JSZip 없이 동작해 Node에서도 시험할 수 있다.
(function (root) {
  'use strict';

  // 글자 모양(hwpx-header.xml): 0 보통 10pt, 1 굵게 10pt, 5 굵게 18pt
  // 문단 모양: 0 양쪽, 8 가운데, 9 오른쪽 / 테두리: 2 실선, 3 실선+회색 바탕
  const CH = { body: 0, bold: 1, title: 5 };
  const PA = { body: 0, center: 8, right: 9 };
  const BF = { cell: 2, head: 3 };
  const TEXT_W = 48000; // 본문 폭(A4 59528 - 여백 5670 - 4252 = 49606) 안쪽
  const SIGN_W = 8000, SIGN_H = 3200; // 서명 그림 약 28×11mm (캔버스 5:2)

  const SEC_PR = '<hp:secPr textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="2835" footer="2835" gutter="0" left="5670" right="4252" top="5670" bottom="4252"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>';

  function x(s) {
    // XML에 넣을 글. 제어 문자는 뺀다(한글이 파일을 못 여는 원인).
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let picId = 9400000;
  function pic(binId) {
    const id = ++picId, w = SIGN_W, h = SIGN_H;
    return '<hp:pic id="' + id + '" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="' + id + '" reverse="0" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">' +
      '<hp:offset x="0" y="0"/><hp:orgSz width="' + w + '" height="' + h + '"/><hp:curSz width="' + w + '" height="' + h + '"/><hp:flip horizontal="0" vertical="0"/>' +
      '<hp:rotationInfo angle="0" centerX="' + w / 2 + '" centerY="' + h / 2 + '" rotateimage="1"/>' +
      '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>' +
      '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + w + '" y="0"/><hc:pt2 x="' + w + '" y="' + h + '"/><hc:pt3 x="0" y="' + h + '"/></hp:imgRect>' +
      '<hp:imgClip left="0" right="' + w + '" top="0" bottom="' + h + '"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="' + w + '" dimheight="' + h + '"/>' +
      '<hc:img binaryItemIDRef="' + x(binId) + '" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/>' +
      '<hp:sz width="' + w + '" widthRelTo="ABSOLUTE" height="' + h + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>';
  }

  function pOpen(o, i) {
    return '<hp:p paraPrIDRef="' + (o.pa ?? PA.body) + '" styleIDRef="0"' + (o.pageBreak && i === 0 ? ' pageBreak="1"' : '') + '>';
  }
  // o: {pa, ch, first(구역 설정 붙임), pageBreak(새 쪽에서 시작), img(그림 id, 글 뒤에 붙임)}
  function para(text, opt) {
    const o = opt || {};
    const lines = String(text == null ? '' : text).split(/\r?\n/);
    return lines.map((ln, i) => {
      const last = i === lines.length - 1;
      return pOpen(o, i) + '<hp:run charPrIDRef="' + (o.ch ?? CH.body) + '">' +
        (o.first && i === 0 ? SEC_PR : '') + '<hp:t>' + x(ln) + '</hp:t></hp:run>' +
        (o.img && last ? '<hp:run charPrIDRef="' + (o.ch ?? CH.body) + '">' + pic(o.img) + '</hp:run>' : '') + '</hp:p>';
    }).join('');
  }

  let tblId = 1000;
  // rows: [[{text, head, center, img}]], widths: HWPUNIT 배열(합 = TEXT_W)
  function table(rows, widths, opt) {
    const o = opt || {};
    const cols = widths.length;
    const rowH = o.rowH || 1500;
    let xml = '<hp:p paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0">' +
      '<hp:tbl id="' + (++tblId) + '" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="' + (o.repeatHeader ? 1 : 0) + '" rowCnt="' + rows.length + '" colCnt="' + cols + '" cellSpacing="0" borderFillIDRef="' + BF.cell + '" noShading="0">' +
      '<hp:sz width="' + TEXT_W + '" widthRelTo="ABSOLUTE" height="' + rowH * rows.length + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="1000"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>';
    rows.forEach((cells, r) => {
      const h = (o.rowHeights && o.rowHeights[r]) || rowH;
      xml += '<hp:tr>';
      cells.forEach((c, ci) => {
        const head = !!c.head;
        const pa = c.center || head || c.img ? PA.center : PA.body;
        const ch = head ? CH.bold : CH.body;
        xml += '<hp:tc name="" header="' + (o.headerRow && r === 0 ? 1 : 0) + '" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="' + (head ? BF.head : BF.cell) + '">' +
          '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' +
          para(c.img ? '' : c.text, { pa, ch, img: c.img }) + '</hp:subList>' +
          '<hp:cellAddr colAddr="' + ci + '" rowAddr="' + r + '"/><hp:cellSpan colSpan="1" rowSpan="1"/>' +
          '<hp:cellSz width="' + widths[ci] + '" height="' + h + '"/><hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>';
      });
      xml += '</hp:tr>';
    });
    return xml + '</hp:tbl></hp:run></hp:p>';
  }

  // 비율 → HWPUNIT 폭(합이 정확히 TEXT_W가 되게 마지막 칸에서 맞춤)
  function widthsOf(ratios) {
    const sum = ratios.reduce((a, b) => a + b, 0) || 1;
    const w = ratios.map((r) => Math.floor((TEXT_W * r) / sum));
    w[w.length - 1] += TEXT_W - w.reduce((a, b) => a + b, 0);
    return w;
  }
  // 셀 값: 문자열 또는 {img:'그림id'}
  const cellOf = (v, extra) => (v && typeof v === 'object' && v.img ? { img: v.img, ...extra } : { text: v == null ? '' : v, ...extra });

  function wrapSec(body) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n' +
      '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">' +
      body + '</hs:sec>';
  }

  /**
   * 명단형 등록부 본문.
   * d = {
   *   title: '협의회 참석 등록부',
   *   info: [['협의명','…'],['일시','…'],['장소','…']],   // 값이 빈 줄은 뺀다
   *   head: '머리말(선택)',
   *   columns: [{label:'번호', w:1, center:true}, …],     // w = 너비 비율
   *   rows: [['1','○○초','홍길동', {img:'s1'}], …],       // columns 순서대로, 그림은 {img}
   *   minRows: 10,                                          // 빈 줄을 채워 최소 줄 수 맞춤
   *   foot: '위와 같이 …확인합니다.', date: '2026. 12. 5.', owner: '담당자 이름(선택)'
   * }
   */
  function buildSection(d) {
    tblId = 1000; picId = 9400000;
    let body = para(d.title || '등록부', { pa: PA.center, ch: CH.title, first: true });
    body += para('', {});

    const info = (d.info || []).filter((r) => r && String(r[1] || '').trim());
    if (info.length) {
      body += table(info.map((r) => [{ text: r[0], head: true }, { text: r[1] }]), widthsOf([1, 4]));
    }
    if (d.head && String(d.head).trim()) body += para(d.head, {}) + para('', {});

    const cols = d.columns || [];
    const rows = (d.rows || []).slice();
    const minRows = Math.max(0, d.minRows || 0);
    while (rows.length < minRows) rows.push(cols.map(() => ''));
    const trs = [cols.map((c) => ({ text: c.label, head: true }))].concat(
      rows.map((r) => cols.map((c, i) => cellOf(r[i], { center: !!c.center }))));
    const heights = trs.map((_, i) => (i === 0 ? 1500 : 3800)); // 서명 그림이 들어갈 높이
    body += table(trs, widthsOf(cols.map((c) => c.w || 1)), { headerRow: true, repeatHeader: true, rowHeights: heights });

    if (d.foot && String(d.foot).trim()) body += para('', {}) + para(d.foot, { pa: PA.center });
    if (d.date) body += para('', {}) + para(d.date, { pa: PA.right });
    if (d.owner !== undefined) body += para('담당자 ' + (d.owner || '　　　　') + '　(서명)', { pa: PA.right });
    return wrapSec(body);
  }

  /**
   * 개인 확인서(한 사람 한 쪽). list = [{
   *   title: '활동 확인서', rows: [['활동명','…'],['성명','홍길동'],['활동 일시','…\n…'],['서명',{img:'s1'}|'']],
   *   foot: '위와 같이 활동하였음을 확인합니다.', date: '2026. 12. 5.', owner: '담당자 이름'
   * }]
   */
  function buildCertSection(list) {
    tblId = 1000; picId = 9400000;
    let body = '';
    (list.length ? list : [{ title: '확인서', rows: [] }]).forEach((d, i) => {
      body += para(d.title || '확인서', { pa: PA.center, ch: CH.title, first: i === 0, pageBreak: i > 0 });
      body += para('', {}) + para('', {});
      const rows = (d.rows || []).filter((r) => r && (r[1] && typeof r[1] === 'object' ? true : String(r[1] == null ? '' : r[1]).trim() || r[2]));
      if (rows.length) {
        body += table(rows.map((r) => [{ text: r[0], head: true }, cellOf(r[1], { center: !!(r[1] && r[1].img) })]),
          widthsOf([1, 3.4]), { rowHeights: rows.map((r) => (r[1] && typeof r[1] === 'object' ? 4200 : 2000)) });
      }
      if (d.foot && String(d.foot).trim()) body += para('', {}) + para('', {}) + para(d.foot, { pa: PA.center });
      if (d.date) body += para('', {}) + para('', {}) + para(d.date, { pa: PA.center });
      if (d.owner !== undefined) body += para('', {}) + para('담당자 ' + (d.owner || '　　　　') + '　(서명)', { pa: PA.right });
    });
    return wrapSec(body);
  }

  const FILES = {
    version: '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.4" application="eduin-meeting-helper" appVersion="1.0"/>',
    container: '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>',
    hpf: (imgIds) => '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"><opf:metadata><opf:meta name="generator" content="eduin-meeting-helper"/></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>' +
      (imgIds || []).map((id) => '<opf:item id="' + x(id) + '" href="BinData/' + x(id) + '.png" media-type="image/png" isEmbeded="1"/>').join('') +
      '</opf:manifest><opf:spine><opf:itemref idref="header" linear="no"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>',
  };

  const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  let zipReady = null, headerXml = null;
  function loadJSZip() {
    if (root.JSZip) return Promise.resolve(root.JSZip);
    if (!zipReady) {
      zipReady = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = JSZIP_SRC; s.async = true;
        s.onload = () => (root.JSZip ? res(root.JSZip) : rej(new Error('jszip')));
        s.onerror = () => { zipReady = null; rej(new Error('jszip')); };
        document.head.appendChild(s);
      });
    }
    return zipReady;
  }
  async function loadHeader() {
    if (headerXml) return headerXml;
    const r = await fetch('/apps/meeting-helper/hwpx-header.xml?v=1');
    if (!r.ok) throw new Error('header');
    return (headerXml = await r.text());
  }
  // 'data:image/png;base64,…' → Uint8Array (PNG가 아니면 null)
  function pngBytes(dataUrl) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) return null;
    const bin = atob(m[1]);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u[0] === 0x89 && u[1] === 0x50 ? u : null;
  }

  async function pack(title, section, images) {
    const [JSZip, header] = await Promise.all([loadJSZip(), loadHeader()]);
    const imgs = (images || []).filter((im) => im && /^[a-z][a-z0-9]{0,15}$/.test(im.id) && im.bytes);
    const zip = new JSZip();
    const o = { createFolders: false }; // 폴더 항목 없이(한글 저장본과 같게)
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE', createFolders: false });
    zip.file('version.xml', FILES.version, o);
    zip.file('META-INF/container.xml', FILES.container, o);
    zip.file('Contents/content.hpf', FILES.hpf(imgs.map((im) => im.id)), o);
    zip.file('Contents/header.xml', header, o);
    zip.file('Contents/section0.xml', section, o);
    for (const im of imgs) zip.file('BinData/' + im.id + '.png', im.bytes, { binary: true, createFolders: false });
    zip.file('Preview/PrvText.txt', String(title || '') + '\r\n', o);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
  }

  /** 명단형 등록부 HWPX Blob. images = [{id:'s1', bytes:Uint8Array}] */
  function buildRoster(d, images) { return pack(d.title, buildSection(d), images); }
  /** 개인 확인서 HWPX Blob(한 사람 한 쪽) */
  function buildCerts(list, images) { return pack(list[0] && list[0].title, buildCertSection(list), images); }

  const api = { buildSection, buildCertSection, buildRoster, buildCerts, pngBytes, FILES, _widthsOf: widthsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MeetHwpx = api;
})(typeof window !== 'undefined' ? window : globalThis);
