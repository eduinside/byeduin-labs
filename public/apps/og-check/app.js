/* 오픈그래프(og-check) — docs/og-check-plan.md
 * 1) /api/og-fetch로 HTML을 받아(또는 붙여넣은 HTML) DOMParser로 태그를 뽑는다.
 * 2) 미리보기 4종 · 태그 목록 · 규칙 점검(AI 없음)을 그린다.
 * 3) [AI 제안 받기] → /api/og-advise. 프롬프트는 화면에서 틀로 조립한다.
 * 페이지에서 나온 글은 모두 esc()를 거쳐 넣는다(남의 HTML이므로).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ic = (name) => (window.VUI && VUI.icon ? VUI.icon(name) : '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.VUI ? VUI.toast(m, t) : alert(m));

  const RECENT_KEY = 'og-check:recent';
  const state = { data: null, checks: [], ai: null, aiOff: new Set(), target: 'code' };

  // ── 글자 너비: 한글·한자·전각은 2, 나머지는 1로 센다(검색 결과 잘림은 픽셀 기준이라 근사) ──
  function units(s) {
    let n = 0;
    for (const ch of String(s || '')) n += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]/.test(ch) ? 2 : 1;
    return n;
  }
  function cutUnits(s, max) {
    s = String(s || '');
    if (units(s) <= max) return s;
    let out = '', n = 0;
    for (const ch of s) {
      const w = units(ch);
      if (n + w > max - 1) break;
      out += ch; n += w;
    }
    return out.trimEnd() + '…';
  }
  const len = (s) => [...String(s || '')].length;

  // ── 입력 탭 ──
  document.querySelectorAll('.og-input .og-tab').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.og-input .og-tab').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b); });
    document.querySelectorAll('.og-src').forEach((f) => { f.hidden = f.dataset.src !== b.dataset.src; });
  }));
  function showSrc(src) { document.querySelector(`.og-input .og-tab[data-src="${src}"]`).click(); }

  // ── 결과 탭 ──
  document.querySelectorAll('.og-rtabs .og-tab').forEach((b) => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  function showPanel(name) {
    document.querySelectorAll('.og-rtabs .og-tab').forEach((x) => { const on = x.dataset.panel === name; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); });
    document.querySelectorAll('.og-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  }

  function setStatus(msg, kind) {
    const el = $('status');
    el.className = 'og-status' + (kind === 'error' ? ' error' : '');
    el.innerHTML = kind === 'loading' ? `<span class="og-loading" aria-hidden="true"></span>${esc(msg)}` : esc(msg);
  }

  // ── 최근 주소 ──
  function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => typeof x === 'string').slice(0, 10); } catch { return []; } }
  function saveRecent(url) {
    const list = [url, ...readRecent().filter((x) => x !== url)].slice(0, 10);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
    renderRecent();
  }
  function renderRecent() {
    const list = readRecent();
    const el = $('recent');
    el.hidden = !list.length;
    el.innerHTML = list.length ? '<span class="og-label" style="margin:0">최근</span>'
      + list.map((u) => `<button type="button" class="og-chip" data-url="${esc(u)}" title="${esc(u)}">${esc(u.replace(/^https?:\/\//, ''))}</button>`).join('')
      + '<button type="button" class="og-clear">지우기</button>' : '';
  }
  $('recent').addEventListener('click', (e) => {
    const chip = e.target.closest('.og-chip');
    if (chip) { $('in-url').value = chip.dataset.url; runUrl(chip.dataset.url); return; }
    if (e.target.closest('.og-clear')) { try { localStorage.removeItem(RECENT_KEY); } catch {} renderRecent(); }
  });

  function normalizeUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; }
  }

  // ── 주소로 확인 ──
  $('form-url').addEventListener('submit', (e) => { e.preventDefault(); runUrl($('in-url').value); });
  $('form-html').addEventListener('submit', (e) => { e.preventDefault(); runHtml(); });

  let busy = false;
  async function runUrl(raw) {
    const url = normalizeUrl(raw);
    if (!url) { setStatus('주소를 확인해 주세요. 예: https://eduin.info', 'error'); return; }
    if (busy) return;
    busy = true;
    $('in-url').value = url;
    $('btn-check').disabled = true;
    setStatus('페이지를 가져오는 중이에요…', 'loading');
    try {
      const r = await VUI.apiFetch('/api/og-fetch', { json: { url, mode: 'page' }, timeout: 20000 });
      const html = r.html != null ? r.html : decodeB64(r.htmlB64, r.charset);
      setStatus('태그를 살펴보는 중이에요…', 'loading');
      const fetchInfo = { requested: url, finalUrl: r.finalUrl, status: r.status, redirects: r.redirects || [], ms: r.ms, bytes: r.bytes, truncated: r.truncated, contentType: r.contentType, charset: r.charset || 'utf-8' };
      await analyze(html, r.finalUrl, fetchInfo);
      saveRecent(url);
      const q = new URL(location.href);
      q.searchParams.set('url', url);
      history.replaceState(null, '', q.pathname + q.search);
      setStatus('');
    } catch (e) {
      const code = e.data && e.data.code;
      setStatus(e.message || '확인하지 못했어요.', 'error');
      if (code === 'private') { $('in-base').value = url; showSrc('html'); }
      else if (e.status === 403 || code === 'network') setStatus((e.message || '') + ' 사이트가 자동 확인을 막고 있다면 HTML 붙여넣기로 확인해 주세요.', 'error');
    } finally {
      busy = false;
      $('btn-check').disabled = false;
    }
  }

  async function runHtml() {
    const html = $('in-html').value;
    if (!html.trim()) { setStatus('HTML을 붙여 넣어 주세요.', 'error'); return; }
    const base = normalizeUrl($('in-base').value);
    setStatus('태그를 살펴보는 중이에요…', 'loading');
    try {
      await analyze(html, base || '', { pasted: true, finalUrl: base || '', redirects: [], bytes: new Blob([html]).size });
      setStatus('');
    } catch (e) {
      console.error(e);
      setStatus('HTML을 읽지 못했어요. 내용을 확인해 주세요.', 'error');
    }
  }

  function decodeB64(b64, charset) {
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
  }

  // ── 분석 ──
  function abs(v, base) {
    if (!v) return '';
    try { return new URL(v, base || undefined).href; } catch { return ''; }
  }
  const isAbs = (v) => /^https?:\/\//i.test(String(v || '').trim());

  function parse(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const baseEl = doc.querySelector('base[href]');
    const base = abs(baseEl && baseEl.getAttribute('href'), baseUrl) || baseUrl;

    const meta = {};   // key(소문자) → [값…]
    doc.querySelectorAll('meta').forEach((m) => {
      const key = (m.getAttribute('property') || m.getAttribute('name') || '').trim().toLowerCase();
      if (!key) return;
      const v = (m.getAttribute('content') || '').trim();
      (meta[key] = meta[key] || []).push(v);
    });
    const one = (k) => (meta[k] && meta[k].find((x) => x)) || '';

    const titles = [...doc.querySelectorAll('title')].map((t) => t.textContent.trim().replace(/\s+/g, ' '));
    const linkHref = (rel) => { const l = [...doc.querySelectorAll('link[rel]')].find((x) => x.getAttribute('rel').toLowerCase().split(/\s+/).includes(rel)); return l ? (l.getAttribute('href') || '').trim() : ''; };
    const iconLink = [...doc.querySelectorAll('link[rel]')].find((x) => /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(x.getAttribute('rel')));

    // JSON-LD @type 모으기(@graph·배열 포함)
    const ldTypes = [];
    let ldBroken = 0;
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const walk = (o) => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) { o.forEach(walk); return; }
          if (o['@type']) [].concat(o['@type']).forEach((t) => ldTypes.push(String(t)));
          if (o['@graph']) walk(o['@graph']);
        };
        walk(JSON.parse(s.textContent));
      } catch { ldBroken++; }
    });

    const h1s = [...doc.querySelectorAll('h1')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const imgs = [...doc.querySelectorAll('body img')];
    const imgNoAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
    const scripts = doc.querySelectorAll('script[src]').length;

    const body = doc.body ? doc.body.cloneNode(true) : null;
    if (body) body.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove());
    const text = body ? body.textContent.replace(/\s+/g, ' ').trim() : '';

    const ogImageRaw = one('og:image') || one('og:image:url') || one('og:image:secure_url');
    const twImageRaw = one('twitter:image') || one('twitter:image:src');

    return {
      base,
      meta, one,
      title: titles[0] || '',
      titleCount: titles.length,
      description: one('description'),
      canonical: linkHref('canonical'),
      robots: [one('robots'), one('googlebot')].filter(Boolean).join(', '),
      viewport: one('viewport'),
      lang: (doc.documentElement.getAttribute('lang') || '').trim(),
      charset: (doc.querySelector('meta[charset]')?.getAttribute('charset') || ''),
      favicon: iconLink ? (iconLink.getAttribute('href') || '').trim() : '',
      og: {
        title: one('og:title'), description: one('og:description'), image: ogImageRaw, url: one('og:url'),
        type: one('og:type'), site_name: one('og:site_name'), locale: one('og:locale'),
        imageWidth: one('og:image:width'), imageHeight: one('og:image:height'), imageAlt: one('og:image:alt'),
      },
      tw: {
        card: one('twitter:card'), title: one('twitter:title'), description: one('twitter:description'),
        image: twImageRaw, site: one('twitter:site'),
      },
      ldTypes, ldBroken, h1s, imgCount: imgs.length, imgNoAlt, scripts,
      text,
    };
  }

  // og:image 가로·세로(브라우저 표시) + 용량·형식(서버 HEAD)
  function probeImage(url) {
    const dims = new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      const t = setTimeout(() => resolve({ error: 'timeout' }), 12000);
      img.onload = () => { clearTimeout(t); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = () => { clearTimeout(t); resolve({ error: 'load' }); };
      img.src = url;
    });
    const head = url && isAbs(url)
      ? VUI.apiFetch('/api/og-fetch', { json: { url, mode: 'image' }, timeout: 15000 }).catch(() => null)
      : Promise.resolve(null);
    return Promise.all([dims, head]).then(([d, h]) => ({ url, dims: d, head: h }));
  }

  async function analyze(html, baseUrl, fetchInfo) {
    const p = parse(html, baseUrl);
    const imgUrl = abs(p.og.image || p.tw.image, p.base);
    const image = await probeImage(imgUrl);
    state.data = { p, fetch: fetchInfo, image, imgUrl, faviconUrl: abs(p.favicon || '/favicon.ico', p.base) };
    state.ai = null;
    state.aiOff = new Set();
    state.checks = runChecks(state.data);
    renderAll();
    $('result').hidden = false;
    showPanel('preview');
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── 규칙 점검 ──
  // level: error(문제) · warn(권장) · info(참고) · pass(통과)
  function runChecks(d) {
    const { p, fetch: f, image } = d;
    const out = [];
    const add = (level, title, why, fix) => out.push({ level, title, why, fix: fix || '' });
    const pageUrl = f.finalUrl || p.base || '';
    const hasBody = p.text.length > 0 || p.h1s.length > 0;

    if (f.status >= 400) add('error', `페이지가 오류(${f.status})로 응답해요`, '메신저와 검색 엔진도 같은 오류를 받아 미리보기를 만들지 못해요. 주소가 맞는지, 공개된 페이지인지 확인해 주세요.');

    // 제목
    const tu = units(p.title);
    if (!p.title) add('error', '<title>이 없어요', '검색 결과 제목과 브라우저 탭 이름으로 쓰여요. og:title이 없을 때 메신저도 이 값을 대신 써요.', '<title>페이지 이름 - 사이트 이름</title>');
    else if (tu > 60) add('warn', `<title>이 길어요(${len(p.title)}자)`, '검색 결과에서 뒷부분이 잘려요. 한글 기준 30자, 영문 기준 60자 안쪽이 좋아요.');
    else if (tu < 16) add('warn', `<title>이 짧아요(${len(p.title)}자)`, '무엇을 하는 페이지인지 드러나게 핵심 낱말과 사이트 이름을 함께 적어 주세요.');
    else add('pass', '<title> 길이가 알맞아요');
    if (p.titleCount > 1) add('warn', `<title>이 ${p.titleCount}개 있어요`, '서비스마다 다른 것을 골라 쓸 수 있어요. 하나로 줄여 주세요.');

    // 설명
    const du = units(p.description);
    if (!p.description) add('warn', 'meta description이 없어요', '검색 결과의 설명 글로 쓰여요. 없으면 검색 엔진이 본문에서 아무 문장이나 가져가요.', '<meta name="description" content="누가 무엇을 얻는지 한두 문장으로">');
    else if (du > 160) add('warn', `meta description이 길어요(${len(p.description)}자)`, '검색 결과에서 잘려요. 한글 기준 80자, 영문 기준 155자 안쪽이 좋아요.');
    else if (du < 50) add('warn', `meta description이 짧아요(${len(p.description)}자)`, '한두 문장으로 누가 무엇을 얻는지 적어 주세요.');
    else add('pass', 'meta description 길이가 알맞아요');

    // Open Graph
    if (!p.og.title) add('error', 'og:title이 없어요', '카카오톡·페이스북 미리보기 제목이에요. 없으면 <title>을 대신 쓰거나 주소만 보여요.', '<meta property="og:title" content="페이지 이름">');
    else add('pass', 'og:title이 있어요');
    if (!p.og.description) add('warn', 'og:description이 없어요', '미리보기 카드의 설명 줄이에요. meta description과 같아도 괜찮아요.', '<meta property="og:description" content="한두 문장 설명">');
    else add('pass', 'og:description이 있어요');

    if (!p.og.image) {
      add('error', 'og:image가 없어요', '링크 미리보기에 그림이 없으면 눈에 덜 띄고 작은 카드로 나와요. 1200×630 이미지를 넣어 주세요.', '<meta property="og:image" content="https://사이트주소/og-image.png">');
    } else {
      if (!isAbs(p.og.image)) add('error', 'og:image가 상대 주소예요', `지금 값: ${p.og.image}\n메신저 봇은 상대 주소를 제대로 읽지 못하는 경우가 많아요. https:// 로 시작하는 전체 주소로 적어 주세요.`, `<meta property="og:image" content="${d.imgUrl || 'https://사이트주소/og-image.png'}">`);
      if (/^http:\/\//i.test(d.imgUrl) && /^https:/i.test(pageUrl)) add('warn', 'og:image가 http 주소예요', 'https 페이지에서 http 이미지는 일부 서비스가 보여 주지 않아요.');
      const dims = image && image.dims;
      const headSt = image && image.head && image.head.status;
      if ((dims && dims.error) || (headSt && headSt >= 400)) {
        add('error', 'og:image가 열리지 않아요', `이미지 주소가 ${headSt >= 400 ? headSt + ' 오류를 내요' : '열리지 않아요'}. 주소와 공개 설정을 확인해 주세요.`);
      } else if (dims && dims.w) {
        const r = dims.w / dims.h;
        if (dims.w < 600 || dims.h < 315) add('warn', `og:image가 작아요(${dims.w}×${dims.h})`, '작은 이미지는 큰 카드 대신 작은 썸네일로 나와요. 1200×630을 권장해요.');
        else if (dims.w < 1200) add('info', `og:image가 권장 크기보다 작아요(${dims.w}×${dims.h})`, '고해상도 화면에서 흐려 보일 수 있어요. 1200×630을 권장해요.');
        else add('pass', `og:image 크기가 넉넉해요(${dims.w}×${dims.h})`);
        if (Math.abs(r - 1.91) / 1.91 > 0.15) add('warn', `og:image 비율이 ${r.toFixed(2)}:1이에요`, '대부분의 서비스가 1.91:1(1200×630)로 잘라 보여 줘서 위아래나 양옆이 잘려요.');
      }
      const bytes = image && image.head && image.head.bytes;
      if (bytes && bytes > 5 * 1024 * 1024) add('warn', `og:image 용량이 커요(${(bytes / 1048576).toFixed(1)}MB)`, '5MB가 넘으면 X(트위터) 등은 이미지를 빼고 보여 줘요. 1MB 안쪽으로 줄여 주세요.');
      const ct = image && image.head && image.head.contentType;
      if (ct && !/^image\//i.test(ct)) add('warn', 'og:image 주소가 이미지가 아닌 내용을 돌려줘요', `받은 형식: ${ct}. 로그인 페이지나 오류 페이지로 넘어가는지 확인해 주세요.`);
      if (!p.og.imageAlt) add('info', 'og:image:alt가 없어요', '화면 읽기 프로그램을 쓰는 사람에게 이미지 설명으로 읽혀요.', '<meta property="og:image:alt" content="이미지 설명">');
    }

    if (!p.og.url) add('warn', 'og:url이 없어요', '공유된 링크가 어떤 주소로 모일지 알려 줘요. 주소 뒤에 붙은 추적 값이 달라도 한 페이지로 묶여요.', `<meta property="og:url" content="${(pageUrl || 'https://사이트주소/페이지')}">`);
    else if (p.canonical && trimUrl(abs(p.og.url, p.base)) !== trimUrl(abs(p.canonical, p.base))) add('warn', 'og:url과 canonical이 달라요', `og:url: ${p.og.url}\ncanonical: ${p.canonical}\n같은 주소를 가리키게 맞춰 주세요.`);
    if (!p.og.type) add('warn', 'og:type이 없어요', '보통 페이지는 website, 글은 article로 적어요.', '<meta property="og:type" content="website">');
    if (!p.og.site_name) add('info', 'og:site_name이 없어요', '일부 메신저가 카드 위에 사이트 이름으로 보여 줘요.', '<meta property="og:site_name" content="사이트 이름">');
    if (!p.og.locale) add('info', 'og:locale이 없어요', '한국어 페이지라면 ko_KR로 적어 두면 좋아요.', '<meta property="og:locale" content="ko_KR">');

    // Twitter
    if (!p.tw.card) add('warn', 'twitter:card가 없어요', 'X(트위터)는 이 값이 없으면 큰 이미지 카드를 쓰지 않아요. 제목·설명·이미지는 og 값을 대신 써요.', '<meta name="twitter:card" content="summary_large_image">');
    else add('pass', `twitter:card가 있어요(${p.tw.card})`);

    // 기본
    if (/noindex/i.test(p.robots)) add('error', '검색 노출을 막아 두었어요(noindex)', `robots: ${p.robots}\n일부러 막은 것이 아니라면 이 태그를 지워 주세요.`);
    else if (/nofollow/i.test(p.robots)) add('info', '링크 따라가기를 막아 두었어요(nofollow)', `robots: ${p.robots}`);
    if (!p.canonical) add('info', 'canonical이 없어요', '같은 페이지가 여러 주소로 열릴 때 대표 주소를 알려 줘요.', `<link rel="canonical" href="${(pageUrl || 'https://사이트주소/페이지')}">`);
    if (!p.viewport) add('warn', 'viewport가 없어요', '휴대폰에서 글자가 아주 작게 보이고, 검색 엔진도 모바일에 맞지 않는 페이지로 봐요.', '<meta name="viewport" content="width=device-width, initial-scale=1">');
    if (!p.lang) add('warn', '<html lang>이 없어요', '검색 엔진과 화면 읽기 프로그램이 언어를 알 수 있게 적어 주세요.', '<html lang="ko">');
    if (!p.favicon) add('info', '파비콘 링크가 없어요', '검색 결과와 브라우저 탭의 작은 아이콘이에요. /favicon.ico가 있으면 그것을 써요.', '<link rel="icon" href="/favicon.ico">');
    if (!p.ldTypes.length) add('info', '구조화 데이터(JSON-LD)가 없어요', '검색 결과에 사이트 이름·이동 경로 등을 더 잘 보여 주게 돕는 정보예요. 꼭 필요한 것은 아니에요.');
    if (p.ldBroken) add('warn', `JSON-LD ${p.ldBroken}개를 읽지 못했어요`, '문법 오류가 있으면 검색 엔진이 무시해요.');

    // 중복
    ['og:title', 'og:description', 'og:image', 'og:url', 'description', 'twitter:card'].forEach((k) => {
      const n = (p.meta[k] || []).length;
      if (n > 1) add('warn', `${k}가 ${n}개 있어요`, '서비스마다 다른 값을 골라 쓸 수 있어요. 하나로 줄여 주세요.');
    });

    // 본문
    if (hasBody && !f.truncated) {
      if (!p.h1s.length) add('warn', '<h1>이 없어요', '페이지의 큰 제목이에요. 검색 엔진이 주제를 파악하는 데 써요.');
      else if (p.h1s.length > 1) add('info', `<h1>이 ${p.h1s.length}개예요`, '큰 제목은 보통 하나를 두는 편이 읽기 쉬워요.');
    }
    if (p.imgNoAlt) add('info', `alt가 없는 이미지가 ${p.imgNoAlt}개예요`, '이미지 설명(alt)은 화면 읽기 프로그램과 이미지 검색에 쓰여요.');

    // 자바스크립트로 그리는 페이지
    if (p.text.length < 80 && p.scripts > 0 && (!p.og.title || !p.og.image)) {
      add('warn', '자바스크립트로 화면을 그리는 페이지 같아요', '받은 HTML에 글이 거의 없어요. 화면에 보이는 태그도 자바스크립트가 나중에 넣는다면 메신저 봇은 읽지 못해요. 태그를 서버에서 보내는 HTML에 넣어 주세요(빌드 때 넣기·서버 렌더링).');
    }

    // 주소
    if (!f.pasted) {
      if (/^http:\/\//i.test(f.finalUrl)) add('warn', 'https가 아니에요', '브라우저가 안전하지 않은 사이트로 표시하고, 검색 순위에도 불리해요.');
      if (f.redirects.length >= 2) add('info', `주소가 ${f.redirects.length}번 넘어가요`, '넘어갈 때마다 늦어지고, 일부 봇은 중간에 멈춰요. 최종 주소를 바로 공유해 주세요.');
      if (f.truncated) add('info', 'HTML이 길어서 앞 512KB까지 살펴봤어요', '<head> 태그는 모두 읽었지만 본문 점검(h1·이미지)은 빠졌을 수 있어요.');
    }
    return out;
  }
  const trimUrl = (u) => String(u || '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();

  // ── 그리기 ──
  function renderAll() {
    renderSummary();
    renderPreviews();
    renderTags();
    renderChecks();
    $('ai-result').innerHTML = '';
    renderPrompt();
    const fb = $('fb-debug');
    const u = state.data.fetch.finalUrl;
    fb.href = 'https://developers.facebook.com/tools/debug/' + (u && !state.data.fetch.pasted ? '?q=' + encodeURIComponent(u) : '');
  }

  function tally() {
    const t = { error: 0, warn: 0, info: 0, pass: 0 };
    state.checks.forEach((c) => { t[c.level]++; });
    return t;
  }

  function renderSummary() {
    const { fetch: f } = state.data;
    const t = tally();
    let html = '';
    if (f.pasted) {
      html += `<div class="og-final">붙여 넣은 HTML${f.finalUrl ? ' · ' + esc(f.finalUrl) : ''}</div>`;
      html += `<div class="og-meta"><span>크기 <b>${fmtBytes(f.bytes)}</b></span></div>`;
    } else {
      html += `<div class="og-final"><a href="${esc(f.finalUrl)}" target="_blank" rel="noopener noreferrer">${esc(f.finalUrl)} ${ic('external-link')}</a></div>`;
      html += `<div class="og-meta"><span>상태 <b>${esc(f.status)}</b></span><span>응답 <b>${(f.ms / 1000).toFixed(1)}초</b></span><span>크기 <b>${fmtBytes(f.bytes)}${f.truncated ? '+' : ''}</b></span>${f.charset && f.charset !== 'utf-8' ? `<span>문자 <b>${esc(f.charset)}</b></span>` : ''}</div>`;
      if (f.redirects.length) {
        html += `<div class="og-redir">${f.redirects.map((r) => esc(r.url) + ` <span>(${r.status})</span>`).join(' → ')} → ${esc(f.finalUrl)} · ${f.redirects.length}번 이동</div>`;
      }
    }
    html += `<div class="og-tally"><span class="og-pill error">문제 ${t.error}</span><span class="og-pill warn">권장 ${t.warn}</span><span class="og-pill info">참고 ${t.info}</span><span class="og-pill pass">통과 ${t.pass}</span></div>`;
    $('summary').innerHTML = html;
    const b = $('checks-badge');
    b.textContent = t.error || t.warn || '';
    b.className = 'og-count' + (t.error ? '' : t.warn ? ' warn' : '');
  }
  const fmtBytes = (n) => (n == null ? '-' : n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : n >= 1024 ? Math.round(n / 1024) + 'KB' : n + 'B');

  function imgTag(url, cls, alt) {
    if (!url || !isAbs(url)) return `<div class="pv-noimg ${cls || ''}">이미지 없음</div>`;
    return `<img class="pv-img ${cls || ''}" src="${esc(url)}" alt="${esc(alt || '')}" referrerpolicy="no-referrer" loading="lazy" onerror="this.outerHTML='<div class=&quot;pv-noimg&quot;>이미지를 열지 못했어요</div>'">`;
  }

  function renderPreviews() {
    const { p, fetch: f, imgUrl, faviconUrl, image } = state.data;
    const pageUrl = f.finalUrl || p.base || '';
    let host = '', path = '';
    try { const u = new URL(abs(p.og.url, p.base) || pageUrl); host = u.hostname.replace(/^www\./, ''); path = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).map(decodeURIComponentSafe).join(' › '); } catch {}

    const t = p.og.title || p.title;
    const dsc = p.og.description || p.description;
    const fb = [];
    if (!p.og.title && p.title) fb.push('제목: &lt;title&gt; 대신');
    if (!p.og.description && p.description) fb.push('설명: description 대신');
    const fbHtml = fb.map((x) => `<span class="pv-fallback">${x}</span>`).join('');
    const T = (s, cls) => s ? `<div class="pv-t ${cls}">${esc(s)}</div>` : `<div class="pv-t pv-empty">제목 없음</div>`;
    const D = (s, cls) => s ? `<div class="pv-d ${cls}">${esc(s)}</div>` : '';

    // 1) 메신저 큰 카드
    const msg = `<div class="pv"><div class="pv-name">메신저 카드(카카오톡 유형) ${fbHtml}</div>
      <div class="pv-msg-wrap"><div class="pv-msg">${imgUrl ? imgTag(imgUrl) : ''}<div class="pv-body">${T(t, 'pv-clamp2')}${D(dsc, 'pv-clamp2')}<div class="pv-u">${esc(host)}</div></div></div></div></div>`;

    // 2) SNS: twitter 값 우선, card 종류에 따라 큰/작은
    const twT = p.tw.title || t, twD = p.tw.description || dsc;
    const twImg = abs(p.tw.image, p.base) || imgUrl;
    const small = p.tw.card === 'summary' || (image && image.dims && image.dims.w && image.dims.w < 400);
    const sns = `<div class="pv"><div class="pv-name">SNS 카드(페이스북·X 유형)${p.tw.card ? ` <span class="pv-fallback">twitter:card=${esc(p.tw.card)}</span>` : ''}</div>
      <div class="pv-sns ${small ? 'small' : ''}">${imgTag(twImg)}<div class="pv-body"><div class="pv-u">${esc(host)}</div>${T(twT, 'pv-clamp2')}${D(twD, small ? 'pv-clamp2' : 'pv-clamp1')}</div></div></div>`;

    // 3) 작은 카드(업무 메신저)
    const mini = `<div class="pv"><div class="pv-name">작은 카드(슬랙·디스코드 유형)</div>
      <div class="pv-mini"><div><div class="pv-s">${esc(p.og.site_name || host)}</div>${T(t, '')}${D(dsc, 'pv-clamp3')}</div>${imgUrl && isAbs(imgUrl) ? `<img class="pv-thumb" src="${esc(imgUrl)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</div></div>`;

    // 4) 검색 결과
    const serpT = cutUnits(p.title || t, 60);
    const serpD = cutUnits(p.description || p.text.slice(0, 200), 160);
    const serp = `<div class="pv"><div class="pv-name">검색 결과(구글 유형)${!p.description ? ' <span class="pv-fallback">설명: 본문에서 가져옴</span>' : ''}</div>
      <div class="pv-serp"><div class="pv-site"><span class="pv-fav">${faviconUrl ? `<img src="${esc(faviconUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span><div><div class="pv-sn">${esc(p.og.site_name || host)}</div><div class="pv-crumb">${esc(host)}${path ? ' › ' + esc(path) : ''}</div></div></div>
      ${serpT ? `<div class="pv-t">${esc(serpT)}</div>` : '<div class="pv-t pv-empty">제목 없음</div>'}${serpD ? `<div class="pv-d">${esc(serpD)}</div>` : ''}</div></div>`;

    $('previews').innerHTML = msg + sns + mini + serp;
  }
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

  function renderTags() {
    const { p, image, imgUrl } = state.data;
    const st = (lv) => lv ? `<span class="st-${lv}" title="${{ pass: '좋음', warn: '고치면 좋음', error: '문제', info: '참고' }[lv]}">${ic({ pass: 'circle-check', warn: 'triangle-alert', error: 'circle-x', info: 'info' }[lv])}</span>` : '';
    const row = (key, val, level, extra) => `<tr><td class="t-key">${esc(key)}</td><td class="t-val">${val ? esc(val) + `<button class="t-copy" data-copy="${esc(val)}" aria-label="${esc(key)} 값 복사">${ic('copy')}</button>` : '<span class="t-missing">없음</span>'}${extra || ''}</td><td class="t-len">${val ? len(val) + '자' : ''}</td><td class="t-st">${st(level)}</td></tr>`;
    const lenLv = (v, lo, hi, missing) => !v ? missing : (units(v) < lo || units(v) > hi ? 'warn' : 'pass');
    const table = (title, rows) => `<div class="og-group"><h3>${title}</h3><table class="og-table"><thead><tr><th>태그</th><th>값</th><th class="t-len">길이</th><th class="t-st"></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

    let imgExtra = '';
    if (imgUrl) {
      const dm = image && image.dims && image.dims.w ? `${image.dims.w}×${image.dims.h} · 비율 ${(image.dims.w / image.dims.h).toFixed(2)}:1` : '크기를 알 수 없음';
      const hd = image && image.head ? ` · ${fmtBytes(image.head.bytes)}${image.head.contentType ? ' · ' + esc(image.head.contentType.split(';')[0]) : ''}` : '';
      imgExtra = `<div class="og-note" style="margin-top:.2rem">${dm}${hd}</div>${isAbs(imgUrl) ? `<img class="t-thumb" src="${esc(imgUrl)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}`;
    }
    const ogImgLv = !p.og.image ? 'error' : !isAbs(p.og.image) ? 'error' : (image && image.dims && image.dims.error) ? 'error' : 'pass';

    const otherOg = Object.keys(p.meta).filter((k) => /^(og|article|profile|fb):/.test(k) && !['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'og:locale', 'og:image:alt'].includes(k));
    const otherTw = Object.keys(p.meta).filter((k) => /^twitter:/.test(k) && !['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].includes(k));

    const html = [
      table('기본', [
        row('<title>', p.title, lenLv(p.title, 16, 60, 'error')),
        row('description', p.description, lenLv(p.description, 50, 160, 'warn')),
        row('canonical', p.canonical, p.canonical ? 'pass' : 'info'),
        row('robots', p.robots, /noindex/i.test(p.robots) ? 'error' : ''),
        row('viewport', p.viewport, p.viewport ? 'pass' : 'warn'),
        row('<html lang>', p.lang, p.lang ? 'pass' : 'warn'),
        row('favicon', p.favicon, p.favicon ? 'pass' : 'info'),
      ]),
      table('Open Graph', [
        row('og:title', p.og.title, p.og.title ? 'pass' : 'error'),
        row('og:description', p.og.description, p.og.description ? 'pass' : 'warn'),
        row('og:image', p.og.image, ogImgLv, imgExtra),
        row('og:image:alt', p.og.imageAlt, p.og.imageAlt ? 'pass' : 'info'),
        row('og:url', p.og.url, p.og.url ? 'pass' : 'warn'),
        row('og:type', p.og.type, p.og.type ? 'pass' : 'warn'),
        row('og:site_name', p.og.site_name, p.og.site_name ? 'pass' : 'info'),
        row('og:locale', p.og.locale, p.og.locale ? 'pass' : 'info'),
        ...otherOg.map((k) => row(k, (p.meta[k] || []).join(' | '), '')),
      ]),
      table('Twitter(X)', [
        row('twitter:card', p.tw.card, p.tw.card ? 'pass' : 'warn'),
        row('twitter:title', p.tw.title, ''),
        row('twitter:description', p.tw.description, ''),
        row('twitter:image', p.tw.image, ''),
        ...otherTw.map((k) => row(k, (p.meta[k] || []).join(' | '), '')),
      ]),
      table('구조화 데이터·본문', [
        row('JSON-LD @type', p.ldTypes.join(', '), p.ldTypes.length ? 'pass' : 'info'),
        row('<h1>', p.h1s.length ? `${p.h1s.length}개 - ${p.h1s[0]}` : '', p.h1s.length === 1 ? 'pass' : p.h1s.length ? 'info' : 'warn'),
        row('이미지 alt', p.imgCount ? `${p.imgCount}개 중 alt 없음 ${p.imgNoAlt}개` : '', p.imgNoAlt ? 'info' : p.imgCount ? 'pass' : ''),
        row('본문 앞부분', p.text.slice(0, 160), ''),
      ]),
    ].join('');
    $('tags').innerHTML = html;
  }

  $('tags').addEventListener('click', (e) => {
    const b = e.target.closest('.t-copy');
    if (b) copy(b.dataset.copy, '값을 복사했어요');
  });

  function renderChecks() {
    const order = { error: 0, warn: 1, info: 2, pass: 3 };
    const icon = { error: 'circle-x', warn: 'triangle-alert', info: 'info', pass: 'circle-check' };
    const label = { error: '문제 - 꼭 고쳐 주세요', warn: '권장 - 고치면 더 좋아요', info: '참고', pass: '통과' };
    const groups = {};
    state.checks.slice().sort((a, b) => order[a.level] - order[b.level]).forEach((c) => { (groups[c.level] = groups[c.level] || []).push(c); });
    let html = '';
    ['error', 'warn', 'info', 'pass'].forEach((lv) => {
      if (!groups[lv]) return;
      html += `<div class="og-sec">${label[lv]} (${groups[lv].length})</div>`;
      html += groups[lv].map((c) => `<div class="og-check ${lv}"><span class="c-ic st-${lv}">${ic(icon[lv])}</span><div class="c-title">${esc(c.title)}</div>${c.why ? `<div class="c-why">${esc(c.why).replace(/\n/g, '<br>')}</div>` : ''}${c.fix ? `<pre>${esc(c.fix)}</pre>` : ''}</div>`).join('');
    });
    $('checks').innerHTML = html;
  }

  // ── AI 제안 ──
  function buildSummary() {
    const { p, fetch: f, image, imgUrl } = state.data;
    return {
      finalUrl: f.finalUrl || p.base || '',
      status: f.status || null,
      redirects: (f.redirects || []).length,
      title: p.title, description: p.description, canonical: p.canonical, robots: p.robots, lang: p.lang,
      viewport: !!p.viewport, favicon: !!p.favicon,
      og: { ...p.og, image: p.og.image, imageResolved: imgUrl },
      twitter: p.tw,
      image: image && image.dims && image.dims.w ? { width: image.dims.w, height: image.dims.h, bytes: image.head && image.head.bytes, type: image.head && image.head.contentType } : (imgUrl ? { error: '열리지 않음' } : null),
      jsonLdTypes: p.ldTypes,
      h1: p.h1s.slice(0, 3),
      bodyStart: p.text.slice(0, 1000),
      checks: state.checks.filter((c) => c.level !== 'pass').map((c) => `[${c.level}] ${c.title}`),
    };
  }

  $('btn-ai').addEventListener('click', async () => {
    if (!state.data) return;
    const btn = $('btn-ai');
    btn.disabled = true;
    $('ai-result').innerHTML = `<div class="og-card"><span class="og-loading" aria-hidden="true"></span>AI가 살펴보는 중이에요. 10초쯤 걸려요.</div>`;
    try {
      const r = await VUI.apiFetch('/api/og-advise', {
        json: { summary: buildSummary(), audience: $('ai-audience').value, pageKind: $('ai-kind').value },
        timeout: 45000,
      });
      state.ai = r;
      state.aiOff = new Set();
      renderAi();
      renderPrompt();
    } catch (e) {
      $('ai-result').innerHTML = '';
      toast(e.message || 'AI 제안을 받지 못했어요.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  function renderAi() {
    const ai = state.ai;
    if (!ai) { $('ai-result').innerHTML = ''; return; }
    const sev = { high: '중요', mid: '보통', low: '가벼움' };
    const items = ai.items.map((it, i) => `<label class="og-item ${state.aiOff.has(i) ? 'off' : ''}">
        <input type="checkbox" data-i="${i}" ${state.aiOff.has(i) ? '' : 'checked'} aria-label="${esc(it.tag)} 프롬프트에 넣기">
        <div class="i-head"><span class="i-tag">${esc(it.tag)}</span><span class="i-sev ${it.severity}">${sev[it.severity]}</span></div>
        <div class="i-row"><b>지금</b>${it.current ? esc(it.current) : '<span class="t-missing">없음</span>'}</div>
        <div class="i-row"><b>제안</b><span class="i-new">${esc(it.suggested)}</span></div>
        ${it.reason ? `<div class="i-row i-why">${esc(it.reason)}</div>` : ''}
      </label>`).join('');
    $('ai-result').innerHTML = `<div class="og-card">
        <h2 class="og-h2">${ic('sparkles')} 고칠 점</h2>
        ${ai.summary ? `<p class="og-ai-sum">${esc(ai.summary)}</p>` : ''}
        ${items || '<p class="og-note">AI가 고칠 점을 찾지 못했어요. 이미 잘 갖춰진 페이지일 수 있어요.</p>'}
        <p class="og-note">AI 제안은 틀릴 수 있어요. 체크한 항목이 아래 코드와 프롬프트에 들어가요.</p>
      </div>
      <div class="og-card">
        <h2 class="og-h2">${ic('code-2')} 고친 태그 코드</h2>
        <textarea id="code-out" class="hero-input og-textarea og-code" readonly aria-label="고친 태그 코드"></textarea>
        <div class="og-actions"><button id="btn-copy-code" class="hero-btn hero-btn-ghost">${ic('copy')} 코드 복사</button></div>
      </div>`;
    $('code-out').value = buildCode();
    $('btn-copy-code').addEventListener('click', () => copy($('code-out').value, '코드를 복사했어요'));
    $('ai-result').querySelectorAll('input[type=checkbox]').forEach((cb) => cb.addEventListener('change', () => {
      const i = Number(cb.dataset.i);
      if (cb.checked) state.aiOff.delete(i); else state.aiOff.add(i);
      cb.closest('.og-item').classList.toggle('off', !cb.checked);
      $('code-out').value = buildCode();
      renderPrompt();
    }));
  }

  const chosenItems = () => (state.ai ? state.ai.items.filter((_, i) => !state.aiOff.has(i)) : []);
  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function tagLine(it) {
    const k = it.tag.trim().replace(/^<|>$/g, '').toLowerCase();
    const v = it.suggested;
    if (k === 'title') return `<title>${attr(v)}</title>`;
    if (k === 'og:image' || k === 'twitter:image') {
      // AI가 '1200x630 https://…' 처럼 조건과 주소를 섞어 줄 때가 있어 주소만 뽑는다.
      const found = (v.match(/https?:\/\/[^\s"'<>]+/) || [])[0];
      const val = found || 'https://사이트주소/og-image.png';
      const line = k === 'og:image' ? `<meta property="og:image" content="${attr(val)}">` : `<meta name="twitter:image" content="${attr(val)}">`;
      return found && found === v.trim() ? line : `${line}  <!-- ${v.replace(/--/g, '-')} -->`;
    }
    if (/^(og|article|fb):/.test(k)) return `<meta property="${k}" content="${attr(v)}">`;
    if (/^twitter:/.test(k)) return `<meta name="${k}" content="${attr(v)}">`;
    if (/description$/.test(k)) return `<meta name="description" content="${attr(v)}">`;
    if (k === 'canonical' || k === 'link rel=canonical') return `<link rel="canonical" href="${attr(v)}">`;
    if (/lang/.test(k)) return `<html lang="${attr(v)}">`;
    if (k === 'viewport' || k === 'robots' || k === 'keywords' || k === 'author' || k === 'theme-color') return `<meta name="${k}" content="${attr(v)}">`;
    if (/favicon|icon/.test(k)) return `<link rel="icon" href="${attr(v)}">`;
    return `<!-- ${it.tag}: ${v.replace(/--/g, '-')} -->`;
  }
  function buildCode() {
    const items = chosenItems();
    if (!items.length) return '<!-- 체크한 항목이 없어요 -->';
    return '<!-- <head> 안에 넣거나 같은 태그를 이 값으로 바꾸세요 -->\n' + items.map(tagLine).join('\n');
  }

  // ── 프롬프트 ──
  document.querySelectorAll('.og-seg-btn').forEach((b) => b.addEventListener('click', () => {
    state.target = b.dataset.target;
    document.querySelectorAll('.og-seg-btn').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', on); });
    renderPrompt();
  }));
  $('btn-copy-prompt').addEventListener('click', () => copy($('prompt-out').value, '프롬프트를 복사했어요'));

  // AI 제안이 있으면 체크한 제안을, 없으면 규칙 점검의 문제·권장 항목을 쓴다.
  function promptLines() {
    const items = chosenItems();
    if (items.length) return items.map((it) => `- ${it.tag}: ${it.current ? `'${it.current}'` : '(없음)'} → '${it.suggested}'${it.reason ? ` (${it.reason})` : ''}`);
    return state.checks.filter((c) => c.level === 'error' || c.level === 'warn').map((c) => `- ${c.title}${c.fix ? ` → 예: ${c.fix.split('\n')[0]}` : ''}`);
  }

  function renderPrompt() {
    if (!state.data) return;
    const { p, fetch: f, image } = state.data;
    const url = f.finalUrl || p.base || '(주소)';
    const usingAi = chosenItems().length > 0;
    $('prompt-src').textContent = usingAi
      ? `AI 제안 중 체크한 ${chosenItems().length}개 항목으로 만들었어요.`
      : '지금은 규칙 점검 결과로 만들었어요. AI 제안을 받으면 바꿀 값까지 들어가요.';
    const lines = promptLines();
    const list = lines.length ? lines.join('\n') : '- (고칠 항목 없음: 지금 태그를 그대로 두고 빠진 것이 있는지 확인해 줘)';
    const t = p.og.title || p.title || '';
    let out = '', hint = '';

    if (state.target === 'code') {
      hint = 'Claude Code·Cursor·Copilot처럼 내 프로젝트 코드를 고치는 AI에 붙여 넣으세요.';
      out = `이 웹페이지의 링크 미리보기(Open Graph·Twitter 카드)와 검색 노출용 태그를 고쳐 줘.
주소: ${url}

바꾸거나 넣을 태그:
${list}

조건:
- 태그는 서버가 보내는 HTML의 <head> 안에 들어가야 해. 자바스크립트로 나중에 넣으면 카카오톡·페이스북 봇이 읽지 못해.
- 프로젝트가 쓰는 방식(예: Next.js metadata, Astro 레이아웃, Nuxt useHead, 정적 HTML)을 따라 고쳐 줘. 여러 페이지가 같은 레이아웃을 쓰면 페이지마다 값이 달라지게 해 줘.
- og:image와 og:url은 https:// 로 시작하는 전체 주소로. og:image는 1200×630 이미지.
- 같은 태그가 두 번 나오지 않게 해 줘.
- 다 고친 뒤 바꾼 파일과 최종 <head> 태그를 보여 줘.`;
    } else if (state.target === 'builder') {
      hint = '구글 사이트·노션·워드프레스·아임웹처럼 화면에서 만드는 사이트라면, 이 프롬프트를 ChatGPT·Claude 같은 대화형 AI에 넣어 어디서 바꾸는지 물어보세요.';
      out = `내가 운영하는 웹페이지의 링크 미리보기(카카오톡·SNS)와 검색 결과에 보이는 제목·설명·이미지를 바꾸고 싶어.
주소: ${url}
사이트를 만든 도구: (여기에 적기 - 예: 구글 사이트 도구, 노션, 워드프레스, 아임웹, 패들렛)

바꾸고 싶은 내용:
${list}

부탁:
- 이 도구의 어느 메뉴에서 위 값을 바꾸는지 단계별로 알려 줘(메뉴 이름 그대로).
- 이 도구에서 바꿀 수 없는 태그가 있으면 그렇다고 알려 주고, 대신 할 수 있는 방법을 알려 줘.
- 바꾼 뒤 카카오톡에 예전 미리보기가 남아 있을 때 새로 고치는 방법도 알려 줘.`;
    } else {
      hint = '그림 AI(Gemini·ChatGPT 그림 만들기 등)에 넣어 OG 이미지를 만든 뒤, 사이트에 올리고 og:image에 그 주소를 적으세요.';
      const idea = state.ai && state.ai.imageIdea;
      const dims = image && image.dims && image.dims.w ? `지금 이미지는 ${image.dims.w}×${image.dims.h}이고, 더 알맞게 바꾸려고 해.` : '지금은 링크 미리보기 이미지가 없어.';
      out = `웹페이지 링크 미리보기(Open Graph)용 이미지를 만들어 줘.
- 크기: 가로 1200 × 세로 630 픽셀(1.91:1), 가로 그림
- 페이지 제목: ${t || '(제목)'}
- 페이지 설명: ${p.og.description || p.description || '(설명)'}
- 사이트 주소: ${url}
${idea ? `- 장면: ${idea}\n` : ''}- 그림 안 글자는 제목 한 줄로, 크고 굵게(한국어 맞춤법 정확히). 작은 글자는 넣지 마.
- 메신저에서 작게 보여도 알아볼 수 있게 가운데에 핵심 그림 하나, 배경은 단순하게.
- 위아래 가장자리는 잘릴 수 있으니 중요한 것은 가운데 80% 안에.
${dims}`;
    }
    $('prompt-hint').textContent = hint;
    $('prompt-out').value = out;
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch { toast('복사하지 못했어요. 직접 선택해 복사해 주세요.', 'error'); }
  }

  // ── 시작 ──
  renderRecent();
  const qUrl = new URL(location.href).searchParams.get('url');
  if (qUrl) { $('in-url').value = qUrl; runUrl(qUrl); }
})();
