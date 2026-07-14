#!/usr/bin/env node
/**
 * scaffold-app.js
 * eduin VIVES 새 앱 스캐폴더 (Astro).
 *  - 셸 유형(베이스) 먼저 고르고 기능을 채우는 방식.
 *  - src/pages/apps/<id>/index.astro 생성 (AppLayout 래핑) + apps.json 등록 + 후처리(og/sitemap) 자동.
 *  - 정적 SEO 태그는 AppLayout이 담당하므로 inject-seo 후처리 없음.
 *  - 모달/외부 항목은 페이지 없이 apps.json 항목만 등록.
 *
 * 대화형:   node scripts/scaffold-app.js
 * 비대화형: node scripts/scaffold-app.js --id my-app --name "내 앱" --base column --width narrow \
 *             --category edu --subcategory edu-work --emoji 🧮 --desc "..." [--focus] [--print]
 * 모달 항목: node scripts/scaffold-app.js --kind modal --id ext-tool --name "외부 도구" \
 *             --category utility --subcategory util-life --href https://... --link-label "바로가기 ↗" [--external]
 *
 * 외부 의존성 없음.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APPS_JSON = path.join(ROOT, 'public', 'apps.json');
const APPS_DIR = path.join(ROOT, 'src', 'pages', 'apps');

const BASES = ['column', 'split', 'sidebar', 'gallery', 'immersive'];
const WIDTHS = ['narrow', 'medium', 'wide'];

/* ── CLI 플래그 파싱 ── */
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── 베이스별 본문 골격 ── */
function bodyForBase(base, opts) {
  const header =
    '  <div class="app-header">\n' +
    '    <div class="app-badge">◆ ' + escapeHtml(opts.badge) + '</div>\n' +
    '    <h1 class="app-title">' + opts.emoji + ' ' + escapeHtml(opts.name) + '</h1>\n' +
    '    <p class="app-desc">' + escapeHtml(opts.desc) + '</p>\n' +
    '  </div>\n';

  const focusStage = opts.focus
    ? '\n  <!-- focus 전환: 아이템 클릭 시 enterFocus() 호출, 닫기는 셸 ✕/Esc -->\n' +
      '  <div class="focus-stage">\n    <!-- 전체화면 콘텐츠 -->\n  </div>\n'
    : '';

  if (base === 'immersive') {
    // 레이아웃 미적용 — 앱이 뷰포트 소유. 셸은 플로팅 크롬만 주입.
    return '  <!-- immersive: 앱이 전체 레이아웃을 소유합니다 (예: 지도/캔버스/3D) -->\n' +
           '  <!-- 헤더가 필요하면 .app-header를 직접 배치하세요 -->\n' + focusStage;
  }

  if (base === 'sidebar') {
    return '  <div class="app-shell-layout">\n' +
           '    <aside class="app-aside">\n' +
           '      <!-- 내비/목록 (모바일은 ☰ 드로어) -->\n' +
           '    </aside>\n' +
           '    <main class="app-main">\n' +
           header.replace(/^/gm, '  ') +
           '      <!-- 메인 콘텐츠 -->\n' +
           '    </main>\n' +
           '  </div>\n' + focusStage;
  }

  let inner;
  if (base === 'split') {
    inner =
      '    <div class="app-split">\n' +
      '      <div><!-- 왼쪽: 입력 --></div>\n' +
      '      <div><!-- 오른쪽: 미리보기 --></div>\n' +
      '    </div>\n';
  } else if (base === 'gallery') {
    inner = '    <div class="app-grid">\n      <!-- 카드 항목들 -->\n    </div>\n';
  } else { // column
    inner = '    <!-- 앱 콘텐츠 -->\n';
  }
  return '  <main class="app-main">\n' + header + inner + '  </main>\n' + focusStage;
}

/* ── Astro 페이지 (AppLayout 래핑) ──
   공통 head/스크립트(hero-theme·app-shell·theme·init·seo-injector·lucide·sync)와
   정적 SEO 메타는 AppLayout이 주입하므로 여기선 레이아웃 props + 본문만 생성한다. */
function buildAstro(opts) {
  const layoutProps = [
    'title="' + escapeAttr(opts.name) + ' — eduin VIVES"',
    'description="' + escapeAttr(opts.seoDesc) + '"',
    'image="https://eduin.info/og-images/' + opts.id + '.png"',
    'bodyShell="' + opts.base + '"',
  ];
  if (opts.base === 'column' || opts.base === 'gallery') layoutProps.push('bodyWidth="' + opts.width + '"');
  if (opts.print) layoutProps.push('bodyPrint={true}');
  if (opts.focus) layoutProps.push('bodyFocus={true}');

  return '---\n' +
    "import AppLayout from '../../../layouts/AppLayout.astro';\n" +
    '---\n' +
    '<AppLayout\n' +
    layoutProps.map((p) => '  ' + p).join('\n') + '\n' +
    '>\n' +
    '  <Fragment slot="head">\n' +
    '    <style is:global="">\n      /* 앱 전용 스타일 */\n    </style>\n' +
    '  </Fragment>\n\n' +
    '  <!-- 플로팅 크롬(홈·테마·공유)은 app-shell.js가 주입합니다 -->\n' +
    bodyForBase(opts.base, opts) +
    '</AppLayout>\n';
}

/* ── 후처리 파이프라인 ── */
function runStep(label, args) {
  try {
    execFileSync('node', args, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (e) {
    console.warn('   ⚠️  ' + label + ' 실패 (계속): ' + e.message);
    return false;
  }
}

async function main() {
  const flags = parseArgs(process.argv);
  if (!fs.existsSync(APPS_JSON)) { console.error('❌ apps.json 없음:', APPS_JSON); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(APPS_JSON, 'utf8'));
  const categories = data.categories || [];
  const interactive = !flags.id && !flags.kind;

  let rl;
  const q = async (prompt, def) => {
    if (!interactive) return def;
    const a = await ask(rl, prompt);
    return a || def;
  };
  if (interactive) rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n🛠  eduin VIVES — New App Scaffolder\n' + '─'.repeat(40));

  const kind = flags.kind || (interactive ? (await ask(rl, '📦 종류 (page/modal) [page]: ')) || 'page' : 'page');

  // 공통 필드
  const id = flags.id || await ask(rl, '📌 App ID (slug): ');
  if (!id) { console.error('❌ App ID 필수'); if (rl) rl.close(); process.exit(1); }
  if (data.apps.some(a => a.id === id)) { console.error('❌ "' + id + '" 이미 존재'); if (rl) rl.close(); process.exit(1); }

  const name = flags.name || await ask(rl, '📝 이름: ') || id;

  // 카테고리
  let category = flags.category;
  if (!category && interactive) {
    console.log('\n  카테고리: ' + categories.map(c => c.id).join(' / '));
    category = await ask(rl, '📂 category: ');
  }
  const catObj = categories.find(c => c.id === category);
  if (!catObj) console.warn('⚠️  알 수 없는 category "' + category + '"');

  // 서브카테고리
  let subcategory = flags.subcategory;
  if (!subcategory && interactive && catObj && catObj.subcategories) {
    console.log('  서브카테고리: ' + catObj.subcategories.map(s => s.id + '(' + s.label + ')').join(' / '));
    subcategory = await ask(rl, '📁 subcategory: ');
  }

  const emoji = flags.emoji || await q('🎭 이모지 [📦]: ', '📦') || '📦';
  const lucideIcon = flags.lucide || flags['lucide-icon'] || (interactive ? await ask(rl, '🔮 Lucide Icon (예: puzzle) [옵션]: ') : '') || '';
  const desc = flags.desc || await q('💬 한 줄 설명: ', name);

  let entry;

  if (kind === 'modal' || kind === 'external') {
    // 셸 없는 항목: apps.json만
    const href = flags.href || await ask(rl, '🔗 href (외부 URL 또는 /downloads/..): ');
    const linkLabel = flags['link-label'] || await q('🔖 링크 라벨 [바로가기 ↗]: ', '바로가기 ↗');
    const modalDesc = flags['modal-desc'] || await q('📄 모달 설명: ', desc);
    entry = {
      id, type: 'modal', emoji, title: name, desc,
      href, linkLabel,
      category, subcategory,
      badge: catObj ? catObj.label.replace(/^\S+\s/, '') : '',
      modalDesc,
      features: [],
    };
    if (flags.external || /^https?:\/\//.test(href)) entry.external = true;
    if (flags['modal-desc'] === undefined && !interactive) entry.modalDesc = modalDesc;
  } else {
    // page: 셸 기반 HTML
    let base = flags.base;
    if (!base && interactive) {
      console.log('\n  셸 베이스: ' + BASES.join(' / '));
      base = await ask(rl, '🧱 base [column]: ') || 'column';
    }
    base = base || 'column';
    if (!BASES.includes(base)) { console.error('❌ base는 ' + BASES.join('/')); if (rl) rl.close(); process.exit(1); }

    let width = flags.width || 'medium';
    if (!flags.width && interactive && (base === 'column' || base === 'gallery')) {
      width = await ask(rl, '📏 width (narrow/medium/wide) [medium]: ') || 'medium';
    }
    if (!WIDTHS.includes(width)) width = 'medium';

    const focus = !!flags.focus || (interactive && /^y/i.test(await ask(rl, '🔳 focus(아이템→전체화면)? (y/N): ')));
    const print = !!flags.print || (interactive && /^y/i.test(await ask(rl, '🖨  print(A4 인쇄)? (y/N): ')));

    const seoTitle = flags['seo-title'] || await q('🔍 SEO 제목 [' + name + ']: ', name);
    const seoDesc = flags['seo-desc'] || await q('📄 SEO 설명: ', desc);
    const badge = catObj ? catObj.label.replace(/^\S+\s/, '') : (category || '');

    const astro = buildAstro({ id, name, emoji, desc, base, width, focus, print, seoTitle, seoDesc, badge });
    const appDir = path.join(APPS_DIR, id);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'index.astro'), astro, 'utf8');
    console.log('   📁 생성: src/pages/apps/' + id + '/index.astro  (base=' + base + (base==='column'||base==='gallery'?', width='+width:'') + (focus?', focus':'') + (print?', print':'') + ')');

    entry = {
      id, emoji, title: name, desc,
      href: '/apps/' + id + '/',
      category, subcategory,
      badge,
      seo: { title: seoTitle, description: seoDesc, keywords: [] },
      ogImage: '/og-images/' + id + '.png',
    };
  }

  if (rl) rl.close();

  if (lucideIcon) entry.lucideIcon = lucideIcon;

  data.apps.push(entry);
  fs.writeFileSync(APPS_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('   📋 apps.json 등록 (subcategory=' + (subcategory || '없음') + ')');

  // 후처리 — 정적 SEO는 AppLayout이 담당하므로 inject 없음. 모달은 페이지가 없으니 og 생략.
  console.log('\n── 후처리 ──');
  if (kind !== 'modal' && kind !== 'external') {
    runStep('og(' + id + ')', ['scripts/generate-og.cjs', '--id', id]);
  }
  runStep('sitemap', ['scripts/generate-sitemap.cjs']);

  console.log('\n✅ "' + name + '" 스캐폴드 완료!');
  if (kind !== 'modal' && kind !== 'external') {
    console.log('   다음: src/pages/apps/' + id + '/index.astro 편집 → npm run dev 로 확인');
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
