/**
 * og-card.ts — 앱별 공유(OG) 이미지 1200×630을 빌드 때 그린다.
 *
 * src/pages/og/[id].png.ts가 apps.json의 앱마다 불러 dist/og/<id>.png를 만든다.
 * Satori(HTML·CSS 모양 노드 → SVG) → sharp(SVG → PNG). 브라우저가 필요 없다.
 * 디자인·분류 색은 docs/og-image-plan.md 참고.
 */
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { lucideNodes, SITE_NAME, type AppEntry } from './app-meta';

const W = 1200;
const H = 630;
const PAD = 84;

const COLORS: Record<string, string> = {
  'edu-sim': '#6d5df5',
  'edu-learn': '#0a8fd1',
  'edu-work': '#0f9f6e',
  'util-life': '#006fee',
  'util-chrome': '#e8590c',
  'util-social': '#d6336c',
  'util-creative': '#e09400',
  'util-notion': '#3f3f46',
};

/* ── 글꼴·로고는 한 번만 읽는다 ── */
let assets: { fonts: any[]; logo: string } | null = null;
function loadAssets() {
  if (assets) return assets;
  const root = process.cwd();
  const font = (file: string) => fs.readFileSync(path.join(root, 'node_modules/pretendard/dist/public/static', file));
  assets = {
    fonts: [
      { name: 'Pretendard', data: font('Pretendard-Medium.otf'), weight: 500, style: 'normal' },
      { name: 'Pretendard', data: font('Pretendard-SemiBold.otf'), weight: 600, style: 'normal' },
      { name: 'Pretendard', data: font('Pretendard-Bold.otf'), weight: 700, style: 'normal' },
      { name: 'Pretendard', data: font('Pretendard-ExtraBold.otf'), weight: 800, style: 'normal' },
    ],
    logo: 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public/logo-64.png')).toString('base64'),
  };
  return assets;
}

/* ── 작은 노드 도우미 (React 없이 Satori 입력 만들기) ── */
type Node = { type: string; props: Record<string, any> };
const h = (type: string, style: Record<string, any>, ...children: any[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function icon(name: string, size: number, color: string, style: Record<string, any> = {}): Node | null {
  const nodes = lucideNodes(name) || lucideNodes('hash');
  if (!nodes) return null;
  return {
    type: 'svg',
    props: {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style,
      children: nodes.map(([tag, attrs]) => ({ type: tag, props: { ...attrs, key: undefined } })),
    },
  };
}

/** 제목 글자 폭을 em 단위로 대강 잰다(한글·전각 1, 영문·숫자 0.58, 공백 0.28). */
function emWidth(s: string) {
  let w = 0;
  for (const ch of s) w += /\s/.test(ch) ? 0.28 : /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 1 : 0.58;
  return w;
}

/** '칠판 (Chalkboard)' → ['칠판', 'Chalkboard'], 'Rec Note - 녹음·전사 노트' → ['Rec Note', '녹음·전사 노트'] */
export function splitTitle(title = '') {
  const m = title.match(/^(.*?)\s*\(([^()]*)\)\s*$/) || title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? [m[1], m[2]] : [title, ''];
}

function card(app: AppEntry): Node {
  const { logo } = loadAssets();
  const c = COLORS[app.subcategory || ''] || '#006fee';
  const [main, sub] = splitTitle(app.title);
  const maxW = W - PAD * 2;
  // 한 줄에 들어가도록 제목 크기를 줄인다(84 → 최소 60). 그래도 길면 두 줄.
  const titleSize = Math.max(60, Math.min(84, Math.floor((maxW - 16) / emWidth(main))));
  // 앱 페이지는 주소 그대로, 내려받기 파일 등은 도메인만
  const href = app.href || '';
  const url = /^\/apps\//.test(href) ? 'eduin.info' + href.replace(/\/$/, '')
    : href.startsWith('/') ? 'eduin.info' : href.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  return h('div', {
    width: W, height: H, position: 'relative', backgroundColor: '#fbfbfc',
    fontFamily: 'Pretendard', color: '#18181b', overflow: 'hidden',
  },
    // 오른쪽 위 분류 색 번짐
    h('div', {
      position: 'absolute', width: 820, height: 820, right: -230, top: -290, borderRadius: 410,
      backgroundImage: `radial-gradient(circle, ${rgba(c, 0.22)} 0%, ${rgba(c, 0.07)} 45%, ${rgba(c, 0)} 70%)`,
    }),
    // 크게 흐린 아이콘
    h('div', { position: 'absolute', right: 70, top: 115, opacity: 0.13, transform: 'rotate(-8deg)' },
      icon(app.lucideIcon || 'hash', 390, c)),

    // 본문
    h('div', { position: 'absolute', left: PAD, top: 76, width: maxW, height: H - 76 - 62, flexDirection: 'column' },
      h('div', {
        width: 112, height: 112, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
        backgroundImage: `linear-gradient(140deg, ${c}, ${rgba(c, 0.75)})`,
        boxShadow: `0 18px 40px -12px ${rgba(c, 0.55)}`,
      }, icon(app.lucideIcon || 'hash', 58, '#ffffff')),
      app.badge
        ? h('div', {
            alignSelf: 'flex-start', marginTop: 36, padding: '8px 18px', borderRadius: 99,
            fontSize: 24, fontWeight: 600, color: c, backgroundColor: rgba(c, 0.09),
          }, app.badge)
        : h('div', { height: 36 }),
      h('div', { marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 18 },
        h('div', { fontSize: titleSize, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.12, wordBreak: 'keep-all' }, main),
        ...(sub ? [h('div', { fontSize: 36, fontWeight: 500, color: '#a1a1aa', letterSpacing: '-0.01em', paddingBottom: Math.round(titleSize * 0.14) }, sub)] : []),
      ),
      app.desc
        ? h('div', { marginTop: 16, maxWidth: 920, fontSize: 36, fontWeight: 500, color: '#52525b', letterSpacing: '-0.02em', lineHeight: 1.35, wordBreak: 'keep-all' }, app.desc)
        : h('div', {}),
      h('div', { marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between', fontSize: 24 },
        h('div', { alignItems: 'center', fontWeight: 700, color: '#27272a' },
          { type: 'img', props: { src: logo, width: 36, height: 36, style: { borderRadius: 9, marginRight: 12 } } },
          SITE_NAME),
        h('div', { color: '#a1a1aa', fontWeight: 500 }, url),
      ),
    ),
  );
}

export async function renderOgPng(app: AppEntry): Promise<Buffer> {
  const svg = await satori(card(app) as any, { width: W, height: H, fonts: loadAssets().fonts });
  // palette(256색)로 줄이면 번짐 그라데이션에 띠가 생겨 풀컬러로 둔다
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
