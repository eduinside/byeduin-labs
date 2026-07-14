# eduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음 + 앱 소개·공지 홈. **Astro 기반 정적 사이트** — 앱 페이지는 `src/pages/apps/<id>/index.astro`, 빌드 시 전 페이지 프리렌더(`dist/`), 서버 API는 `functions/`(Cloudflare Pages Functions). 프로덕션 정본 도메인: **[eduin.info](https://eduin.info)** (`by.eduin.info`·`www`는 301 리다이렉트).

**로컬 실행**: `npm run dev` (Astro dev 서버 — `/api/*` 미기동) · `npm run dev:cf` (빌드 후 Pages Functions·D1 포함 로컬 서버, 최초 1회 `npx wrangler d1 migrations apply byeduin --local`)  
**배포**: Cloudflare Pages (자동 배포: main 브랜치, 빌드 명령 `npm run build`, 출력 `dist`)  
**개발 진행**: [`docs/OVERVIEW.md`](docs/OVERVIEW.md)(아키텍처·API·변경 이력) 및 [`docs/app-development-guide.md`](docs/app-development-guide.md) 참고  

---

## 앱 목록 (43개)

### 📚 교육 (26)

#### 🌐 시뮬레이션
| 앱 | 경로 | 설명 |
|---|---|---|
| **Break & Make** | `/apps/blocks-universe/break-make.html` | 구슬을 톡톡 옮기며 수 가르기·모으기를 익혀요 |
| **Step Squad** | `/apps/blocks-universe/step-squad.html` | 계단수 개념을 블록으로 시각화하고 퀴즈로 확인 |
| **Club Badge** | `/apps/blocks-universe/clubs.html` | 1~100 수가 어떤 넘버블록스 클럽에 속하는지 탐색하고 퀴즈로 확인 |
| **분수 막대** | `/apps/fraction-bar/` | 막대와 피자를 자르고 칠하며 분수 크기 비교 |
| **도형의 이동** | `/apps/shape-move/` | 밀기·뒤집기·돌리기로 도형을 움직여 보세요 |
| **가능성 실험실** | `/apps/chance-lab/` | 동전·주사위·회전판 1000번 실험으로 가능성 체험 |
| **달의 위상 3D** | `/apps/moon-phase-v2/` | 달을 직접 돌려 위상을 이해하고 일식·월식까지 |
| **Moon Phase** | `/apps/moon-phase/` | 오늘의 달 위상 시뮬레이터 |
| **태양계 여행** | `/apps/solar-system/` | 여덟 행성 공전·크기·거리 비교와 행성 도감 |
| **화산 탐험대** | `/apps/volcano/` | 3D 위성지도로 세계 화산 11개 탐험 |
| **전기회로 공작소** | `/apps/circuit-lab/` | 전지·전구·스위치를 이어 불을 켜고 직렬·병렬 밝기 비교 |
| **생태계 탐험대** | `/apps/eco-web/` | 먹이그물 잇기·피라미드·평형 시나리오 종합 실험 |
| **식품구성자전거** | `/apps/food-bike/` | 음식을 담아 바퀴를 채우는 균형 식단 게임 |
| **세계 탐험대** | `/apps/world-landmarks/` | 3D 지도로 랜드마크 11곳 탐험 + 24개국 국기·수도·음식·문화 조사 보고서 만들기 |
| **발명 아이디어 공작소** | `/apps/idea-lab/` | 발명 마법 4가지와 AI 코치로 나만의 발명품 구상하기 |

#### 📖 학습지원
| 앱 | 경로 | 설명 |
|---|---|---|
| **Blocks Universe** | `/apps/blocks-universe/` | 블록스 4개 시리즈 351편 에피소드 탐색 · AI 검색 · 순차재생 |
| **Flash Deck** | `/apps/flash-deck/` | 플래시카드 덱 제작 및 학습 |
| **Chalkboard** | `/apps/chalkboard/` | 칠판 위에 텍스트와 선으로 생각을 자유롭게 펼쳐보세요 (코드 동기화) |
| **Read Tree** | `/apps/read-tree/` | ORT(옥스포드 리딩 트리) 읽기 진도를 코드 하나로 기록·관리 (로그인·개인정보 없음) |
| **연산연습지** | `/apps/math-sheet/` | 사칙연산 세로셈 학습지 생성·PDF 출력·링크/QR 공유 (코드 동기화) |

#### 💼 업무경감
| 앱 | 경로 | 설명 |
|---|---|---|
| **채점표** | `/apps/scoring-table/` | 대회·발표 채점 양식 배포, 공동 채점, 결과 수합 |
| **파일 최적화 도구** | `/apps/file-tools/` | 스캔 이미지 및 대용량 PPTX 이미지 최적화 |
| **Smart Timer** | `/apps/timer/` | 반복 알람 타이머 · 다음 알람 표시 · 켜기/끄기 |
| **기타소득 세금 계산기** | `/apps/allowance-calculator/` | 세전·세후 수당 및 기타소득 세금(8.8%) 자동 판별 계산기 |
| **Login Helper** | `https://blog.eduin.info/450` | 에듀나비 교원업무지원 로그인 도우미 (모달) |
| **에듀서치** | `/apps/search/` | 교육문서를 AI로 검색하고 근거 출처를 함께 확인 |

### 🛠 유틸리티 (17)

#### 🔧 생활편의
| 앱 | 경로 | 설명 |
|---|---|---|
| **MD Editor** | `/apps/md-editor/` | 마크다운 파일 열기·편집·미리보기·공유 |
| **QR Master** | `/apps/qr/` | 생성부터 스캔, 단축주소까지 한 번에 |
| **AI 맞춤법 검사** | `/apps/spell-checker/` | AI가 한국어 맞춤법·문법을 교정하고 이유를 설명합니다. GAS·외부 앱에서 API로도 호출 가능. |

#### 🧩 크롬확장
| 앱 | 경로 | 설명 |
|---|---|---|
| **Content ID Viewer** | `/downloads/content-id-viewer-for-edunavi.zip` | 에듀나비 콘텐츠 ID 조회 크롬 확장 (모달) |
| **MP4 Finder** | `/downloads/mp4-finder.zip` | 웹페이지에 숨겨진 MP4 링크를 발견하여 알려줍니다 (모달) |

#### 💬 소셜
| 앱 | 경로 | 설명 |
|---|---|---|
| **도서 정보 나눔** | `/apps/book-share/` | ISBN으로 도서 정보 자동 조회, 파일 저장 및 링크 공유 |
| **Bubble Chat** | `/apps/bubble-chat/` | P2P 기반 실시간 채팅, 코드 공유로 쉽게 접속 |
| **에듀링크** | `https://dgedu.link/` | 교육용 단축주소·설문조사·체험 지도 서비스 (모달) |
| **마당** | `/apps/madang/` | QR로 초대하면 응답이 실시간 카드로 쌓이는 패들렛형 보드 — 텍스트·HTML·사진·그림 카드, 이모지 반응, 저학년 모드(자동 별명), 교사 통제(사전승인·잠금·이름숨김·발표모드), 코드=신원·OpenAI 자동 검열 |

#### 🎨 크리에이티브
| 앱 | 경로 | 설명 |
|---|---|---|
| **YT Thumbnail** | `/apps/yt-thumb/` | 유튜브 썸네일 추출기 |
| **Grid Maker** | `/apps/grid-maker/` | 이미지를 그리드로 분할 저장 |
| **Signage Maker** | `/apps/signage-maker/` | 사이니지용 세로 이미지 AI 생성기 (Gemini) |
| **패들렛 일괄 업로더** | `/apps/padlet-bulk-uploader/` | 텍스트를 붙여넣으면 내 패들렛 보드에 항목을 한 번에 업로드 (Padlet API) |

#### 📐 노션도구
| 앱 | 경로 | 설명 |
|---|---|---|
| **임베드 생성기** | `/apps/embed/` | 외부 URL을 반응형 iframe으로 감싸 노션 임베드 블록에 삽입 |
| **Notion Image DL** | `/apps/notion-image-downloader/` | 노션 DB 이미지 일괄 다운로드 |
| **Notion Styler** | `/apps/notion-styler/` | 노션 수식 LaTeX 스타일러 |
| **빠른 버튼 만들기** | `/apps/shortcut/` | 복사한 웹 링크를 앱을 바로 여는 딥링크 버튼으로 변환·저장 (모바일 런처) |

> 홈 화면에는 외부 연동·확장 항목(에듀링크, Content ID Viewer, MP4 Finder, Login Helper)도 모달로 노출됩니다.

---

## 홈 & 공지사항

홈은 **트리 사이드바**(2단계 카테고리 탐색) + 앱 카드 그리드 + **공지사항(아코디언)** 으로 구성됩니다. 공지는 [티스토리 블로그](https://blog.eduin.info)에 글을 올리면 RSS로 자동 노출됩니다.

- **UI**: 헤더 클릭 시 펼쳐지는 아코디언(한 번에 하나) → 본문 요약 미리보기 + "글 보러가기"(새 창). 펼친 항목은 흰 배경으로 강조.
- **설정**: [`public/notices.json`](public/notices.json)
  - `mode`: `recent`(최신글만) · `pinned`(지정글만) · `both`(지정글📌 + 최신글)
  - `recentLimit`: 최신글 개수(1–20) · `pinned`: 상단 고정 지정글 `[{ title, link }]`
- **RSS 프록시**: [`functions/api/notices.js`](functions/api/notices.js) — `blog.eduin.info/rss` 우선, 실패 시 `eduin.tistory.com/rss` 폴백. 정규식으로 제목·링크·날짜·요약 추출, 30분 캐시(서버사이드 중계로 CORS 우회).

---

## 공통 리소스

앱 페이지는 `src/pages/apps/<id>/index.astro`에 있고(URL = `/apps/<id>/`), 앱별 정적 자산(스크립트·데이터·서브페이지 등)과 공통 리소스는 `public/`에, 다운로드 자산은 `public/downloads/`에 둡니다.

```
public/common/
├── hero-theme.css   — HeroUI CSS 변수, 공통 컴포넌트 (.app-header, .overlay-btn 등)
├── app-shell.css    — 셸 레이아웃 (베이스 5종 + 캐논 폭 + focus + print)
├── app-shell.js     — 플로팅 크롬 자동 주입 + 사이드바 드로어 + focus 유틸
├── theme.js         — 테마 전환 (auto/light/dark), 페이지 공유 기능
├── init.js          — 공통 파비콘 강제 설정 및 구글 애널리틱스 초기화
├── seo-injector.js  — 런타임 클라이언트 사이드 동적 SEO 및 JSON-LD 메타태그 완성
└── sync.js          — 코드 기반 다기기 동기화 (전역 VivesSync) → 아래 "코드 동기화" 참고
```

**셸 유형 시스템**: 앱은 `<body data-shell="...">`로 레이아웃 베이스를 고릅니다.
- 베이스(5): `column`(중앙 컬럼) · `split`(2-페인) · `sidebar`(내비+메인) · `gallery`(카드 그리드) · `immersive`(풀뷰포트, 크롬만)
- 직교 플래그: `data-width="narrow|medium|wide"`(캐논 480/720/1120) · `data-print`(A4) · `data-focus`+`enterFocus()`(아이템→전체화면)

좌상단 홈 + 우상단 테마·공유 버튼은 `app-shell.js`가 자동 주입하므로 앱이 마크업을 복붙하지 않습니다. 페이지 로드 시 `seo-injector.js`가 SEO 메타데이터를 완성합니다.

---

## 🛠 유지보수 및 개발용 명령어

프로젝트에는 개발 편의성과 SEO 배포 자동화를 위해 아래와 같은 패키지 스크립트들이 준비되어 있습니다:

- **로컬 개발 서버 실행**: `npm run dev`
- **신규 미니 앱 스캐폴딩 생성**: `npm run scaffold` — 베이스/폭/플래그/카테고리·서브카테고리를 고르면 `src/pages/apps/<id>/index.astro`(AppLayout 래핑) 생성 + `apps.json` 등록 + **og·sitemap 자동 실행**(한 커맨드). 비대화형: `node scripts/scaffold-app.cjs --id ... --base column --width narrow --category edu --subcategory edu-work ...`. 모달/외부 항목: `--kind modal`. (정적 SEO 메타는 AppLayout이 담당하므로 별도 inject 단계 없음)
- **OG 이미지 빌드 (전체 또는 `--id <id>` 단일, 홈 기본 `og-default.png`)**: `npm run og` / `node scripts/generate-og.cjs --id <id>`
- **브랜드 로고·파비콘 재생성 (소스 `brand/logo.png`)**: `node scripts/generate-icons.cjs`
- **`sitemap.xml` 재생성 및 업데이트**: `npm run sitemap`

> 유지보수 스크립트는 CommonJS이며 `.cjs` 확장자를 씁니다(루트 `package.json`이 `"type": "module"`이라 `.js`는 ESM으로 처리됨).

---

## 🔄 코드 동기화 (VivesSync · D1)

로그인·개인정보 없이 **6자리 익명 코드 하나**로 여러 기기에서 앱 상태를 이어쓰는 공용 계층. 우상단 **🔄 동기화 버튼**으로 코드를 연결/발급/해제합니다.

- **저장소**: byeduin 전용 Cloudflare **D1** 1개(`BYEDUIN_DB`, [`wrangler.toml`](wrangler.toml)) — 앱별 테이블 접두사로 공유. 스키마는 [`migrations/`](migrations/).
- **서버**: [`functions/api/_sync.js`](functions/api/_sync.js) — `createDocSync`(문서 1개)·`createSetSync`(다수 항목). LWW 머지·멱등 upsert·검증·용량 상한 내장. 각 앱 엔드포인트는 한 줄 래퍼.
- **클라이언트**: [`public/common/sync.js`](public/common/sync.js) → 전역 `VivesSync`. 헬퍼: `mountDocSync`(상태 자동 동기화)·`mountCodeButton`(코드 버튼)·`docStore`(다중 문서)·`createSet`(항목). 로컬 우선, 오프라인·장애 시 무시.
- **적용 앱(9)**: read-tree · flash-deck · blocks-universe · timer · search · chalkboard · signage-maker(메타데이터만) · math-sheet · md-editor.
- **상세 설계·적용 가이드**: [`docs/d1-sync-pattern.md`](docs/d1-sync-pattern.md)

---

## 📖 개발 문서

* [프로젝트 개요](docs/OVERVIEW.md) — 폴더 구조, 셸 시스템, API 엔드포인트, 데이터 동기화, 변경 이력
* [코드 동기화 패턴](docs/d1-sync-pattern.md) — D1·VivesSync 설계 원칙, 모드(doc/set), 새 앱 적용 가이드
* [디자인 시스템 사양](docs/design-system.md) — 색상 토큰, 타이포그래피, 반응형 크기, 공통 컴포넌트 마크업 규칙
* [신규 앱 개발 가이드](docs/app-development-guide.md) — 신규 미니 앱 추가를 위한 스캐폴딩 가이드 및 체크리스트

---

## 오픈소스 출처 & 라이선스

모든 외부 라이브러리는 CDN을 통해 로드됩니다. 빌드 단계 없음.

| 라이브러리 | 버전 | 라이선스 | 사용 앱 |
|---|---|---|---|
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | MIT | 이미지 최적화 도구, Grid Maker, YT Thumbnail |
| [UTIF.js](https://github.com/photopea/UTIF.js) | 3.1.0 | MIT | 이미지 최적화 도구 |
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | Apache-2.0 | 이미지 최적화 도구 |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT | 이미지 최적화 도구 |
| [SheetJS (xlsx)](https://sheetjs.com/) | latest | Apache-2.0 | 채점표, 도서 정보 나눔 |
| [PeerJS](https://peerjs.com/) | 1.5.2 | MIT | Bubble Chat |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | 1.0.0 | MIT | Bubble Chat, QR Master |
| [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache-2.0 | QR Master |
| [marked](https://marked.js.org/) | latest | MIT | MD Editor, 에듀서치 |
| [KaTeX](https://katex.org/) | 0.16.8 | MIT | Notion Styler |
| [React](https://react.dev/) | 18 | MIT | Notion Styler |
| [Babel Standalone](https://babeljs.io/docs/babel-standalone) | latest | MIT | Notion Styler |
| [Tailwind CSS](https://tailwindcss.com/) | CDN | MIT | Grid Maker, Notion Styler |
| [Lucide](https://lucide.dev/) | latest | ISC | Grid Maker, Smart Timer |
| [MapLibre GL JS](https://maplibre.org/) | 4.x | BSD-2-Clause | 화산 탐험대 |
| [Google Fonts](https://fonts.google.com/) | — | SIL OFL | 전체 (JetBrains Mono, Noto Sans KR, Dongle) |