# OG 이미지 새 디자인·빌드 자동 생성 계획

> 작성: 2026-11-02 · 관련: [OVERVIEW.md](OVERVIEW.md), [app-development-guide.md](app-development-guide.md)

## 1. 문제

- `scripts/generate-og.cjs`(node-canvas)가 이모지·한글 글꼴을 못 찾아 이미지가 깨짐
  (이모지 자리에 `01F58A` 같은 코드 상자, 한글은 대체 글꼴로 자간이 벌어짐).
- 손으로 돌려 PNG 50장을 커밋하는 방식 → 앱 이름·설명을 바꿔도 이미지는 옛 내용 그대로.
  59개 앱 중 9개는 OG 이미지가 없음.
- `canvas` 패키지는 Windows에서 Python·VS Build Tools가 있어야 설치됨.
- 디자인이 어두운 바탕에 가운데 정렬 글자뿐이라 사이트 카드(lucide 아이콘 블롭)와 따로 놂.

## 2. 방식

**빌드 때 `apps.json`에서 앱마다 PNG를 만든다. 이미지는 커밋하지 않는다.**

| 항목 | 내용 |
|---|---|
| 엔드포인트 | `src/pages/og/[id].png.ts` — `getStaticPaths()`가 `apps.json`의 앱 전부를 돌려 `dist/og/<id>.png` 생성 |
| 그리기 | `src/components/og-card.ts` — Satori(HTML·CSS 모양의 노드 → SVG) → sharp(SVG → PNG) |
| 글꼴 | `pretendard` npm 패키지의 OTF(Medium·SemiBold·ExtraBold) |
| 아이콘 | `apps.json`의 `lucideIcon`(59개 모두 있음). `app-meta.ts`의 lucide 노드를 그대로 씀 |
| 주소 | `/og/<id>.png` (앱 id로 정해지므로 `apps.json`의 `ogImage` 필드는 없앰) |
| 옛 주소 | `public/_redirects`에서 `/og-images/*` → `/og/:splat` 301 (이미 공유된 링크용) |
| 캐시 | `_headers`의 `/og-images/*` 규칙을 `/og/*`로 옮김(7일) |

Satori·sharp 모두 브라우저 없이 동작해 Cloudflare Pages 빌드에서도 돈다. 무료 티어 영향 없음(정적 파일).

## 3. 디자인

- 1200×630, 밝은 바탕(#fbfbfc) + 오른쪽 위에 분류 색 원형 번짐, 오른쪽에 아이콘을 크게 흐리게.
- 왼쪽 위 아이콘 타일(분류 색 그라데이션, 흰 아이콘) → 배지(`badge`) → 제목 → 설명(`desc`).
- 제목 `칠판 (Chalkboard)`은 괄호를 떼어 영문을 작은 회색 부제로. 한 줄에 안 들어가면 부제를 다음 줄로.
- 아래: 로고 + `eduin VIVES`, 오른쪽에 `eduin.info/apps/<id>`.
- 분류 색(subcategory):

| 분류 | 색 |
|---|---|
| edu-sim 시뮬레이션 | #6d5df5 |
| edu-learn 학습지원 | #0a8fd1 |
| edu-work 업무경감 | #0f9f6e |
| util-life 생활편의 | #006fee |
| util-chrome 크롬확장 | #e8590c |
| util-social 소셜 | #d6336c |
| util-creative 크리에이티브 | #e09400 |
| util-notion 노션도구 | #3f3f46 |

## 4. 바꿀 곳

- `src/layouts/AppLayout.astro` — 기본 이미지를 `/og/<app.id>.png`로.
- 앱 페이지 46개 — `image="https://eduin.info/og-images/<id>.png"` 줄 삭제(레이아웃 기본값 사용).
- `public/common/seo-injector.js` — 런타임 주입도 `/og/<id>.png`.
- `public/apps.json` — `ogImage` 필드 삭제.
- `scripts/scaffold-app.cjs` — `ogImage`·`image=`·`generate-og` 단계 삭제.
- `scripts/generate-og.cjs`, `public/og-images/` 삭제. `generate-og-default.cjs`는 canvas 대신 sharp로.
- `package.json` — `canvas` 빼고 `satori`·`pretendard`·`sharp` 추가. `og` 스크립트는 기본 이미지만.
- 문서: OVERVIEW, README, app-development-guide.

## 5. 손대지 않는 것

- 홈 기본 이미지 `og-default.png`(브랜드 아트워크) — 디자인은 그대로, 생성 스크립트만 sharp로.
  `generate-icons.cjs`(로고·파비콘)도 canvas를 쓰던 곳이라 같이 sharp로 옮김.

## 6. 정적 HTML

`public/apps/blocks-universe/{break-make,clubs,step-squad}.html`은 og-default를 직접 적고 있었음 →
각자 `/og/<id>.png`로 바꿈(apps.json에 별도 앱으로 있음). `blocks-universe/index.astro`의 `image=` 지정은 지움.
