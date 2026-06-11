# eduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음 + 앱 소개·공지 홈. 순수 정적 사이트 (HTML + CSS + JS, 빌드 없음). 프로덕션 정본 도메인: **[eduin.info](https://eduin.info)** (`by.eduin.info`·`www`는 301 리다이렉트).

**로컬 실행**: `npm run dev` (Cloudflare Pages Functions 로컬 서버 기동)  
**배포**: [Cloudflare Pages](https://byeduin-vives.pages.dev) (자동 배포: main 브랜치)  
**개발 진행**: [`docs/DEVPLAN.md`](docs/DEVPLAN.md) 및 [`docs/app-development-guide.md`](docs/app-development-guide.md) 참고  

---

## 앱 목록 (26개)

### 📚 교육 (13)

#### 🌐 시뮬레이션
| 앱 | 경로 | 설명 |
|---|---|---|
| **Moon Phase** | `/moon-phase/` | 달의 위상 시뮬레이터 |
| **화산 탐험대** | `/volcano/` | 3D 위성지도로 세계 화산 11개 탐험 · 초등 과학 4학년 연계 |
| **Step Squad** | `/blocks-universe/step-squad.html` | 계단수 개념 블록 시각화 + 퀴즈 |
| **Club Badge** | `/blocks-universe/clubs.html` | 1~100 수의 넘버블록스 클럽 탐색 + 퀴즈 |

#### 📖 학습지원
| 앱 | 경로 | 설명 |
|---|---|---|
| **Blocks Universe** | `/blocks-universe/` | 넘버블록스·알파블록스·컬러블록스·원더블록스 351편 에피소드 탐색 · AI 검색 · 순차재생 |
| **Flash Deck** | `/flash-deck/` | 플래시카드 학습 앱 |
| **Chalkboard** | `/chalkboard/` | 칠판/화이트보드 메모 |

#### 💼 업무경감
| 앱 | 경로 | 설명 |
|---|---|---|
| **채점표** | `/scoring-table/` | 대회·발표 채점 양식 배포, 공동 채점, 결과 수합 (링크 공유 + xlsx) |
| **파일 최적화 도구** | `/file-tools/` | 스캔 이미지 및 대용량 PPTX 이미지 최적화 |
| **Smart Timer** | `/timer/` | 반복 알람 타이머 |
| **수당 계산기** | `/allowance-calculator/` | 세전·세후 수당 및 기타소득 세금(8.8%) 자동 판별 계산기 |
| **Login Helper** | `https://blog.eduin.info/450` | 에듀나비 교원업무지원 자동 로그인 프로그램 (모달) |
| **에듀서치** | `/search/` | 교육문서 AI 검색 (Gemini RAG) |

### 🛠 유틸리티 (13)

#### 🔧 생활편의
| 앱 | 경로 | 설명 |
|---|---|---|
| **MD Editor** | `/md-editor/` | 마크다운 편집기 (JSON·CSV·XML·HTML 불러오기, **HWP·PDF·DOCX·PPTX·XLSX 변환** via Corepin API, 파일 공유) |
| **QR Master** | `/qr/` | QR 코드 생성, 카메라/이미지 스캔, 단축주소 |

#### 🧩 크롬확장
| 앱 | 경로 | 설명 |
|---|---|---|
| **Content ID Viewer** | `/chrome-extentions/content-id-viewer-for-edunavi.zip` | 에듀나비 콘텐츠 ID 조회 (Chrome 확장) |
| **MP4 Finder** | `/chrome-extentions/mp4-finder.zip` | 웹페이지 내 MP4 링크 자동 감지 및 클립보드 복사 (Chrome 확장) |

#### 💬 소셜
| 앱 | 경로 | 설명 |
|---|---|---|
| **도서 정보 나눔** | `/book-share/` | ISBN으로 도서 정보 조회 및 공유 |
| **Bubble Chat** | `/bubble-chat/` | P2P 실시간 채팅 |
| **에듀링크** | `https://dgedu.link/` | 교육용 단축주소·설문조사·체험 지도 서비스 |

#### 🎨 크리에이티브
| 앱 | 경로 | 설명 |
|---|---|---|
| **YT Thumbnail** | `/yt-thumb/` | 유튜브 썸네일 추출 및 아카이빙 |
| **Grid Maker** | `/grid-maker/` | 이미지 그리드 분할 |
| **Signage Maker** | `/signage-maker/` | 학교 사이니지용 AI 세로 이미지 생성기 (Gemini) |

#### 📐 노션도구
| 앱 | 경로 | 설명 |
|---|---|---|
| **임베드 생성기** | `/embed/` | 외부 URL을 반응형 iframe으로 감싸 노션 임베드 블록에 삽입 (base64url 해시, 서버 상태 없음) |
| **Notion Image DL** | `/notion-image-downloader/` | Notion DB 이미지 일괄 다운로드 |
| **Notion Styler** | `/notion-styler/` | LaTeX 수식 스타일링 및 HTML 생성 |

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

```
public/common/
├── hero-theme.css   — HeroUI CSS 변수, 공통 컴포넌트 (.top-overlay, .app-header 등)
├── theme.js         — 테마 전환 (auto/light/dark), 페이지 공유 기능
├── init.js          — 공통 파비콘 강제 설정 및 구글 애널리틱스 초기화
└── seo-injector.js  — 런타임 클라이언트 사이드 동적 SEO 및 JSON-LD 메타태그 완성
```

모든 앱은 좌상단 홈 버튼 + 우상단 테마 전환·공유 버튼을 공통으로 사용하며, 페이지 로드 시 `seo-injector.js`를 통해 SEO 메타데이터가 동적으로 완성됩니다.

---

## 🛠 유지보수 및 개발용 명령어

프로젝트에는 개발 편의성과 SEO 배포 자동화를 위해 아래와 같은 패키지 스크립트들이 준비되어 있습니다:

- **로컬 개발 서버 실행**: `npm run dev`
- **신규 미니 앱 스캐폴딩 생성**: `npm run scaffold` (대화형 CLI를 통한 앱 생성 및 `apps.json` 자동 추가)
- **각 하위 앱 HTML에 SEO 태그 일괄 정적 주입**: `npm run inject`
- **OG 이미지 빌드 (앱별 + 홈 기본 `og-default.png`, 소스 `brand/logo-seo.png`)**: `npm run og`
- **브랜드 로고·파비콘 재생성 (소스 `brand/logo.png`)**: `node scripts/generate-icons.js`
- **`sitemap.xml` 재생성 및 업데이트**: `npm run sitemap`

---

## 📖 개발 문서

* [개발 계획 및 진행 현황](docs/DEVPLAN.md) — 과거 개발 마일스톤, 성능 분석, 알려진 이슈
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