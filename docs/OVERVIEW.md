# eduin VIVES — 프로젝트 개요

> **배포**: Cloudflare Pages · 빌드 `npm run build`(Astro) · `pages_build_output_dir = "dist"`  
> **빌드**: Astro 정적 출력(어댑터 없음, 전 페이지 프리렌더). URL 경로는 종전과 동일(`/apps/<id>/`).  
> **주의**: `@astrojs/cloudflare` 어댑터를 쓰지 말 것 — SSR 페이지가 없고, 어댑터의 `_worker.js`/Workers 배포는 `functions/` Pages Functions(`/api/*` 전체)를 무력화한다. wrangler 설정은 `wrangler.toml` 하나만 유지(`wrangler.jsonc` 금지 — 존재 시 우선 적용되어 D1/R2 바인딩이 유실된 사고 있음, 2026-07).

---

## 폴더 구조

```
src/
├── pages/
│   ├── index.astro        ← 홈 (카테고리 트리 사이드바)
│   └── apps/<id>/index.astro ← 앱 페이지 (36개)
└── layouts/AppLayout.astro ← 공통 헤드(SEO 메타·공통 CSS/JS)와 <body data-shell> 래퍼

public/                    ← 빌드 시 dist/로 그대로 복사 (경로 유지)
├── apps/              ← 앱 정적 자산(잔존 HTML 서브페이지·js·json)
│   ├── blocks-universe/   ← break-make.html·step-squad.html·clubs.html 등
│   └── qr/                ← manifest.json·sw.js (PWA)
├── common/            ← 공통 CSS·JS
│   ├── hero-theme.css
│   ├── app-shell.css
│   ├── app-shell.js
│   ├── theme.js
│   ├── init.js
│   ├── sync.js
│   └── seo-injector.js    ← 런타임 앱 헤더 아이콘 블롭 주입 + 보조 메타(AppLayout이 로드)
├── og-images/         ← 앱별 OG 이미지 (1200×630)
├── downloads/         ← 크롬 확장 zip 등 다운로드 파일
└── apps.json          ← 앱 메타데이터 단일 소스

functions/api/         ← Cloudflare Pages Functions (서버리스 API)
scripts/               ← 빌드·생성 스크립트 (Node.js)
docs/                  ← 개발 문서
```

---

## 앱 목록

### 교육 · 시뮬레이션 (`edu-sim`, 15종 — 주제순: 수학 → 천체·우주 → 지구과학 → 전기 → 생태 → 실과 → 세계 → 창의·AI)
| ID | 이름 | 설명 |
|---|---|---|
| `break-make` | 가르기 모으기 | 구슬 조작으로 수 가르기·모으기 + 도전 모드·도감 |
| `step-squad` | 계단수 | 계단수 개념을 블록으로 시각화 + 퀴즈 |
| `clubs` | 넘버블록스 클럽 | 1~100 수의 클럽 탐색 + 퀴즈 |
| `fraction-bar` | 분수 막대 | 막대·피자를 자르고 칠하며 분수 크기 비교 |
| `shape-move` | 도형의 이동 | 밀기·뒤집기·돌리기로 도형 이동 애니메이션 |
| `chance-lab` | 가능성 실험실 | 동전·주사위·회전판 1000번 실험으로 가능성 체험 |
| `moon-phase-v2` | 달의 위상 3D | 달을 직접 돌려 위상 이해 + 일식·월식 |
| `moon-phase` | Moon Phase | 오늘의 달 위상 시뮬레이터(월령 자동 계산) |
| `solar-system` | 태양계 여행 | 여덟 행성 공전·크기·거리 비교 + 행성 도감 |
| `volcano` | 화산 탐험대 | 3D 위성지도로 세계 화산 11개 탐험 |
| `circuit-lab` | 전기회로 공작소 | 전지·전구·스위치 연결로 직렬·병렬 밝기 비교 |
| `eco-web` | 생태계 탐험대 | 먹이그물 잇기·피라미드·평형 시나리오 종합 실험 |
| `food-bike` | 식품구성자전거 | 음식을 담아 바퀴를 채우는 균형 식단 게임 |
| `world-landmarks` | 세계 탐험대 | 3D 위성지도로 세계 랜드마크 11곳 + 여권 수집 |
| `idea-lab` | 발명 아이디어 공작소 | 발명 마법 4가지 + AI 코치로 발명품 구상·이름·그림 완성 |

### 교육 · 학습지원 (`edu-learn`)
| ID | 이름 | 설명 |
|---|---|---|
| `blocks-universe` | Blocks Universe | BBC 블록스 4개 시리즈 351편 · AI 검색 · 재생목록 |
| `flash-deck` | 플래시덱 | 플래시카드 덱 제작 및 학습 |
| `chalkboard` | 칠판 | 텍스트·선으로 자유 판서 |
| `math-sheet` | 연산연습지 | 사칙연산 세로셈 학습지 생성·PDF 출력·공유 |
| `read-tree` | Read Tree | ORT 읽기 진도를 코드 하나로 기록(로그인 없음) |

### 교육 · 업무경감 (`edu-work`)
| ID | 이름 | 설명 |
|---|---|---|
| `scoring-table` | 채점표 | 대회·발표 채점 양식 배포·공동 채점·결과 수합 |
| `file-tools` | 파일 도구 | 스캔 이미지·PPTX 이미지 최적화 |
| `timer` | 타이머 | 반복 알람 타이머 |
| `allowance-calculator` | 수당 계산기 | 세전·세후 수당·기타소득 세금 자동 계산 |
| `search` | 교육문서 검색 | AI 기반 교육문서 검색·출처 확인 |
| `login-helper` | 에듀나비 로그인 | 에듀나비 교원업무지원 로그인 도우미 (모달·외부 링크) |

### 생활편의 (`util-life`)
| ID | 이름 | 설명 |
|---|---|---|
| `md-editor` | 마크다운 편집기 | 마크다운 열기·편집·미리보기·공유 |
| `qr` | QR | QR 생성·스캔·단축주소 (PWA 지원) |

### 크롬 확장 (`util-chrome`)
| ID | 이름 | 설명 |
|---|---|---|
| `content-id-viewer` | 콘텐츠 ID 조회 | 에듀나비 콘텐츠 ID 조회 크롬 확장 (다운로드) |
| `mp4-finder` | MP4 파인더 | 웹페이지 숨겨진 MP4 링크 발견 (다운로드) |

### 소셜 (`util-social`)
| ID | 이름 | 설명 |
|---|---|---|
| `book-share` | 도서 공유 | ISBN 도서 정보 조회·파일 저장·공유 — 알라딘 조회는 D1 `book_cache` 90일 캐시 경유, 호출량 차단 시 429 안내 후 중단 (`docs/book-share-aladin-plan.md`) |
| `bubble-chat` | 버블챗 | P2P 실시간 채팅 |
| `madang` | 마당 | 패들렛형 실시간 응답 보드 — rev 조건부 폴링, 텍스트·HTML·사진·그림(R2) 카드, 이모지 반응, 저학년 모드, 사전승인·잠금·이름숨김·발표모드·복제, QR 초대·코드 신원·자동검열 |
| `edulink` | 에듀링크 | 교육용 단축주소·설문·체험 지도 (모달·외부 링크) |

### 크리에이티브 (`util-creative`)
| ID | 이름 | 설명 |
|---|---|---|
| `yt-thumb` | 유튜브 썸네일 | 유튜브 썸네일 추출기 |
| `grid-maker` | 그리드 메이커 | 이미지 그리드 분할 저장 |
| `signage-maker` | 사이니지 메이커 | 사이니지용 세로 이미지 AI 생성기 |

### 노션 도구 (`util-notion`)
| ID | 이름 | 설명 |
|---|---|---|
| `embed` | 임베드 | 외부 URL → 반응형 iframe → 노션 임베드 |
| `notion-image-downloader` | 노션 이미지 다운로드 | 노션 DB 이미지 일괄 다운로드 |
| `notion-styler` | 노션 스타일러 | 노션 수식 LaTeX 스타일러 |
| `shortcut` | 빠른 버튼 | 웹 링크 → 딥링크 버튼 변환·저장 |

---

## 셸 유형 시스템

`app-shell.js`가 `<body data-shell="…">` 속성을 읽어 레이아웃·크롬을 자동 주입.

| `data-shell` | 레이아웃 | 대표 앱 |
|---|---|---|
| `column` | 중앙 단일 컬럼 | qr, timer, math-sheet 등 다수 |
| `split` | 2-페인 (입력 \| 미리보기) | md-editor, notion-styler |
| `sidebar` | 내비 사이드바 + 메인 | search |
| `gallery` | 반응형 카드 그리드 | blocks-universe, chalkboard, bubble-chat |
| `immersive` | 풀뷰포트 (크롬만 주입) | edu-sim 15종 전체(moon-phase, volcano, step-squad, break-make, clubs, fraction-bar, shape-move, chance-lab, moon-phase-v2, solar-system, circuit-lab, eco-web, food-bike, world-landmarks, idea-lab) |

**폭 플래그** (`data-width`): `narrow`(480px) · `medium`(720px) · `wide`(1120px)  
**기능 플래그**: `data-focus`(아이템→전체화면 `enterFocus()`) · `data-print`(A4 인쇄 베이스라인)

### 공통 파일 — `src/layouts/AppLayout.astro`가 일괄 로드
모든 앱 페이지는 `AppLayout`으로 감싸며, 레이아웃이 SEO 메타(title·description·og·canonical)와 아래 공통 파일을 `<head>`에 넣는다. 개별 페이지에서 중복 로드하지 말 것.
```html
<link rel="stylesheet" href="/common/hero-theme.css">
<link rel="stylesheet" href="/common/app-shell.css">
<script src="/common/theme.js"></script>
<script src="/common/init.js"></script>
<script src="/common/app-shell.js" defer></script>
<script src="/common/seo-injector.js" defer></script>   <!-- 앱 헤더 아이콘 블롭 주입(비-immersive) -->
<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
<script src="/common/sync.js"></script>
```
`AppLayout` props: `title`·`description`·`image`·`bodyShell`(기본 column)·`bodyWidth`(미지정 시 `data-width` 미출력 — sidebar·immersive는 지정하지 말 것)·`bodyPrint`(A4 인쇄 플래그, math-sheet·scoring-table).

> **예외**: `public/apps/blocks-universe/`의 정적 서브페이지(step-squad·clubs·break-make)는 Astro 미경유 원본 HTML이며 독자 CSS(Dongle 폰트·`--bg`)를 사용.

---

## 주요 API 엔드포인트

| 경로 | 역할 |
|---|---|
| `POST /api/bu-translate` | 에피소드 설명 AI 한국어 번역 |
| `POST /api/bu-recommend` | 에피소드 AI 추천 검색 |
| `POST /api/signage-prompt` | 사이니지 이미지 AI 생성 |
| `POST /api/flash-recommend` | 플래시덱 카드 AI 추천 |
| `GET /api/yt-playlist` | 유튜브 재생목록 파싱 |
| `GET /api/yt-video-info` | 유튜브 영상 정보 |
| `POST /api/shorten` | 단축 URL 생성 (short.io) |
| `POST /api/search` | 교육문서 RAG 검색(2단계 라우터) + 단일 문서 요약·질문 |
| `GET /api/tree` | 교육문서 리포 파일 트리(서버사이드, GitHub rate limit 회피) |
| `GET /api/recent-docs` | 최근 업데이트된 교육문서 (커밋 기반) |
| `GET /api/notices` | 공지사항 |
| `GET·PUT·DELETE /api/readtree` | Read Tree 읽음 기록 동기화 (D1, set 모드) |
| `GET·PUT·DELETE /api/flash-deck`·`/api/blocks-universe`·`/api/timer`·`/api/search-sync`·`/api/chalkboard`·`/api/signage` | 앱 상태 코드 동기화 (D1, doc 모드) |
| `GET·PUT·DELETE /api/math-sheet`·`/api/md-editor` | 코드별 다중 문서 라이브러리 (D1, set 모드) |
| `GET·POST /api/madang` | 마당 — 실시간 응답 보드 (D1, `board_id` 파티션·HMAC 소유권·OpenAI 검열, rev 조건부 폴링) |
| `POST /api/madang-upload` | 마당 사진·그림 카드 업로드 (R2 `byeduin-media`, 400KB/보드당 60MB 상한) |
| `GET /api/madang-img/[[path]]` | 마당 사진·그림 카드 스트리밍 (GET 폴링과 동일한 접근제어 재사용) |

> 위 코드 동기화 엔드포인트(`/api/readtree`~`/api/md-editor`)는 `functions/api/_sync.js`(createDocSync/createSetSync)의 한 줄 래퍼다. `/api/madang`은 패턴이 달라(여러 사용자 카드가 한 보드에 모임 + 소유권·접근제어) 전용 모듈 [`functions/api/madang.js`](../functions/api/madang.js)로 구현했고, 공용 헬퍼는 [`functions/api/_madang-common.js`](../functions/api/_madang-common.js)로 분리해 업로드·이미지 엔드포인트와 공유한다.
>
> **주의(2026-07-04)**: `madang-img`는 폴더 이름 자체를 `[board]`처럼 대괄호로 만들면 Cloudflare Pages Functions 빌드가 깨져 배포 전체가 정적 사이트로 떨어진 적이 있다(`/api/*` 전체 404). 다중 세그먼트 동적 라우트는 반드시 `[[path]].js` 형태의 **단일 파일 catch-all**로 작성할 것 — 디렉터리 자체를 `[param]`으로 만들지 말 것.
>
> **AI 호출 빈도 제한 (Rate Limiting)**: `functions/api/_ai.js` 모듈을 통하는 모든 AI API 호출은 `CF-Connecting-IP` 헤더를 바탕으로 한 엣지 메모리 sharded rate limiting 시스템의 감시를 받습니다. 무차별적인 자동화 공격 및 비용 과다 방지를 위해 **텍스트 생성 분당 30회 / 이미지 생성 분당 5회**의 한도를 엄격히 초과할 시 `429 Too Many Requests` 에러를 반환합니다.

---

## 데이터 동기화 (D1 · VivesSync)

로그인·개인정보 없이 **6자리 익명 코드 하나**로 여러 기기에서 앱 상태를 이어쓰는 공용 계층.

- **DB**: byeduin 전용 Cloudflare **D1** 1개(`BYEDUIN_DB`, [`wrangler.toml`](../wrangler.toml)). 앱별 테이블 접두사로 한 DB를 공유. 마이그레이션은 [`migrations/`](../migrations/).
- **서버**: [`functions/api/_sync.js`](../functions/api/_sync.js) — `createDocSync`(코드당 문서 1개)·`createSetSync`(코드당 다수 항목). LWW 머지·멱등 upsert·정규식 검증·용량 상한 내장.
- **클라이언트**: [`public/common/sync.js`](../public/common/sync.js) → 전역 `VivesSync`. 통합 코드 `vives:code` 공유. 헬퍼: `mountDocSync`(상태 자동 동기화 + 헤더 버튼)·`mountCodeButton`(코드 버튼만)·`docStore`(다중 문서)·`createSet`(항목).
- **원칙**: 로컬(localStorage/IndexedDB) 우선, 서버는 백업·다기기 채널. 오프라인·장애 시 조용히 무시(앱은 항상 동작).
- **적용 앱(9)**: read-tree·flash-deck·blocks-universe·timer·search·chalkboard·signage-maker·math-sheet·md-editor.
- 상세: [`docs/d1-sync-pattern.md`](d1-sync-pattern.md)

---

## 주요 변경 이력

### 2026-08 — idea-lab 그림 그리기 실패 수정 (죽은 Gemini 이미지 폴백 복구)
- **`imagen-3.0-generate-002`(`:predict`) 폴백이 완전히 죽어 있었음**(모델이 더 이상 존재하지 않아 404) — Timely가 조금이라도 실패하면(429/402/모델 파라미터 오류 등) 안전망 없이 바로 전체 실패로 이어졌음. `gemini-2.5-flash-image`를 표준 `generateContent` + `responseModalities:["IMAGE"]`로 호출하도록 `_ai.js`를 수정해 실제 동작하는 폴백으로 복구.
- **이미지 크기 상한 고정**: `image_config: { image_size: '1K', aspect_ratio: '1:1' }` 추가 — provider가 기본값으로 2K/4K를 골라 페이로드가 더 커지는 경우를 방지(단, 이 모델은 1K에서도 실측 1.1~1.8MB급이라 절감 효과는 제한적).
- **그림체를 크레파스 → 플랫 일러스트로 변경**(`idea-lab.js` 이미지 프롬프트): 크레파스 질감은 노이즈가 많아 PNG 압축이 잘 안 됐음 — 굵은 윤곽선·단색 면 채색 스타일로 바꿔 결과물 용량을 실측 약 45% 절감(1.6MB → 0.85~0.9MB대).
- 관련 조사·실측 내용은 [`docs/timely-ai-pattern.md`](timely-ai-pattern.md) §7에 정리.

### 2026-08 — Timely AI 게이트웨이 에러 분기 보강 + 연동 패턴 문서화
- **402/429 상태코드 분기**: `_ai.js`의 `callTimely()` 헬퍼로 Timely 호출을 통합하고, 429(rate limit)는 400ms 후 1회 재시도, 402(크레딧 소진)는 재시도 없이 즉시 Gemini 폴백 + 강조 로그를 남기도록 개선. 기존엔 모든 실패를 동일하게 취급해 크레딧 소진 같은 운영 이슈가 조용히 묻힐 수 있었음.
- **연동 패턴 문서 신설**: Timely GPT가 OpenRouter를 감싼 재판매 게이트웨이라는 점, 엔드포인트·인증·모델명·rate limit 동작, CF Pages 무료 CPU 예산(요청당 10ms) 제약을 정리한 [`docs/timely-ai-pattern.md`](timely-ai-pattern.md) 작성 — 신규 AI 프록시 앱을 만들 때 참고.

### 2026-07 — Astro 전환 (정적 사이트 재작성)
`public/apps/<id>/index.html` 36개를 `src/pages/apps/<id>/index.astro`로 이식하고 공통 헤드를 `src/layouts/AppLayout.astro`로 통합. URL 구조·`public/` 자산 경로·`functions/` API는 전부 종전과 동일.
- **출력**: Astro 정적 빌드(어댑터 없음) → `dist/`. Pages 배포 출력 디렉터리 `dist`로 변경(`wrangler.toml`).
- **어댑터 사고 교정**: 초기 이식에서 `@astrojs/cloudflare` + `wrangler.jsonc`(Workers)가 함께 들어와 ① 산출물이 `dist/client`로 갈라지고 ② `wrangler.jsonc`가 `wrangler.toml`을 가려 D1/R2 바인딩이 유실되며 ③ Workers 배포 시 `functions/`가 통째로 무시되는 상태였음 → 어댑터·jsonc 제거, 정적 출력 + Pages Functions 유지로 정리.
- **이식 누락 복구**: 원본에 없던 `data-width="narrow"`가 전 페이지 기본값으로 주입돼 search(sidebar)가 480px로 좁아지던 문제(기본값 제거), math-sheet·scoring-table의 `data-print` 누락(`bodyPrint` prop 신설), `seo-injector.js` 미로드로 앱 헤더 Lucide 아이콘 블롭이 사라진 문제(AppLayout에 복원) 수정.
- **정리**: Lucide CDN을 jsdelivr 단일 소스로 통일(페이지별 중복 로드 제거), md-editor의 폐기된 `chrome` 아이콘 → `save`, 스타터 잔재·일회용 마이그레이션 스크립트 삭제, `npm run inject`(정적 HTML SEO 주입) 폐기 — SEO 메타는 AppLayout이 빌드 시 출력.
- **로컬 개발**: `npm run dev`(astro dev, API 없음) / `npm run dev:cf`(빌드 후 `wrangler pages dev dist`, D1·R2 포함 — 최초 1회 `wrangler d1 migrations apply byeduin --local`).

### 2026-07 — 교육 시뮬레이션 앱 2·3단계(Phase 2 & 3) 비주얼 폴리싱 및 보안 보완 완료
`docs/simulation-apps-plan.md` 및 `docs/sim-apps-audit-2026-07.md` 보완 계획에 따라 2단계 그래픽 마감 및 3단계 AI API 보안 강화 작업을 완료했습니다.

- **전기회로 공작소 (circuit-lab)**: 전구 점등 시 광량 그라디언트 글로우 효과로 광원 시각 효과를 극대화하고, 스위치 🎚️ 단자 접점과 나이프 레버 등의 SVG 세부 디테일을 개선했습니다.
- **분수 막대 (fraction-bar)**: 초콜릿 막대의 3D 입체 홈 및 질감 데코레이션을 추가하고, 피자 모드에 도우 크러스트와 토핑(A: 페퍼로니/노란반점, B: 블랙 올리브)을 추가하여 일러스트 그래픽 품질을 혁신했습니다.
- **태양계 여행 (solar-system)**: 공전 궤도 위 행성들에 호버 및 상시 라벨을 추가하고 토성/천왕성의 고리(Saturn horizontal, Uranus vertical)가 행성을 입체적으로 감싸도록 3D 마스크 클리핑을 적용했습니다. 퀴즈 행성 카드의 대표 무늬(수성 크레이터, 금성 구름선, 화성 극관, 해왕성 대흑점)를 추가했습니다.
- **가능성 실험실 (chance-lab)**: 동전 도안을 단순 텍스트에서 은은한 금/은화 디자인 기호 SVG로 교체하고, 던질 때 dynamic 3D 궤적으로 포물선 회전하며 날아가 떨어지는 애니메이션을 추가했습니다. 누적 확률 그래프에 수학적 이론값 기준선 백분율(%) 표시 및 범례(Legend)를 추가했습니다.
- **식품구성자전거 (food-bike)**: 조악했던 자전거 뼈대 선과 🚴 이모지를 정교한 자전거 프레임 SVG 및 페달을 밟고 구르는 라이더 캐릭터 SVG로 재작성하고 상태별 표정을 연동했습니다. 하단의 어색한 세로 줄무늬 바코드식 도로 배경을 실제 수평 차선이 흘러가는 도로 및 바퀴살 오버레이로 개선했습니다.
- **세계 탐험대 (world-landmarks)**: 위성 지도가 완전히 준비되어 타일 로딩이 끝날 때까지 로딩 화면이 대기하도록 MapLibre `idle` 이벤트를 도입하고(2.5초 안전 타임아웃), 여권 및 사이드바에 대한 완전한 다크 모드 색상 테마를 추가했습니다.
- **배경 질감 연출 (공통)**: `shape-move`, `fraction-bar`, `chance-lab` 등 immersive 앱들의 공허한 캔버스 배경에 도트 및 격자눈금 CSS 패턴을 추가해 프리미엄 연구실 무드 보드를 연출했습니다.
- **텍스트 포맷 마크다운 제거**: 도전 미션과 결과 정리 화면의 단순 텍스트 영역에 노출되던 `**` 마크다운 강조 기호를 HTML `<strong>` 태그로 일괄 변환 완료했습니다.
- **AI 프록시 보안·비용 가드 (3단계)**: `_ai.js` 공용 모듈에 `CF-Connecting-IP` 기반의 엣지 인메모리 sharded rate limiting 시스템을 구축했습니다. 이를 통해 8대 AI 프록시 API(idea-lab, search, signage, spell-checker, flash-card, blocks-universe 등) 전반에 걸쳐 텍스트 분당 30회, 이미지 분당 5회 한도 초과 시 즉각 `429 Too Many Requests` 상태코드를 응답하도록 공통 보안 대책을 적용했습니다.
- **Lucide 아이콘 기반 랜딩 페이지 고도화**: 랜딩 페이지의 모든 앱 카드 아이콘을 이모지에서 세련된 Lucide 라인 아트 아이콘으로 일괄 개편했습니다. 이때 시각적 인지성을 높이기 위해 카테고리별 소프트 컬러 배경 블롭(Blob) 디자인(예: 시뮬레이션-블루, 학습지원-그린, 업무경감-퍼플 등)과 호버 네이온 글로우 효과를 추가하여 기기별 일관성을 확보했습니다. 신규 스캐폴딩 스크립트(`scaffold-app.js`)에서도 `--lucide` 옵션을 지원하도록 대응시켰습니다.

### 2026-07 — 교육 시뮬레이션 앱(edu-sim) 15종 점검·버그 수정·홈 개선
`docs/sim-apps-audit-2026-07.md` 조사를 바탕으로 두 세션에 걸쳐 진행.

- **정확성·신뢰성 버그 수정** — club-badge(clubs) 퀴즈 오답 선택지가 실제로는 정답 클럽에 속해 정답을 골라도 오답 처리되던 버그 수정(오답 풀을 `!check(n)`으로 제한) + 정답 하이라이트를 `data-club-id` 비교로 교체 + 출제 범위 1~100(0 제외). moon-phase 날짜 입력 UTC 파싱으로 인한 KST 오프셋 수정 + 슬라이더 조작 시 시뮬레이션 날짜 역산 동기화. break-make 십몇 단계 도전 모드가 무동작이던 것을 비활성화 처리(유효 조합이 "10과 몇" 하나뿐이라 도전 모드 성립 불가)로 명확화.
- **그래픽·레이아웃 보완** — circuit-lab 전지 리드선 y1 오타로 화면 상단까지 뻗던 세로선 버그 수정 + viewBox 도입해 격자 중앙·확대. fraction-bar `getBBox` 기반 동적 viewBox로 막대·피자 중앙·최대 확대. shape-move 모눈 크기 상한 완화(560px → `min(92vh, 860px)`). moon-phase-v2 화면 배율 `k` 도입으로 궤도·지구·달 비례 확대(드래그 판정 동기화) + 햇빛을 방사형 광원+광선 화살표로 교체. eco-web 빈 캔버스 드롭존 안내 추가. chance-lab 인트로 `.intro-tag` 배지 CSS 누락 보완.
- **idea-lab 셸 전환** — `column`(중앙 컬럼) → `immersive`(풀스크린, chance-lab 패턴의 좌측 무대·우측 사이드바, 무대가 선택 상태·완성 그림을 실시간 반영)로 전환. 이로써 edu-sim 15종 전체가 immersive 셸로 통일됨.
- **apps.json 정리** — edu-sim 15종을 주제순(수학 → 천체·우주 → 지구과학 → 전기 → 생태 → 실과 → 세계 → 창의·AI)으로 재정렬. idea-lab·world-landmarks 홈 카드 설명(`desc`)이 다른 앱 대비 지나치게 길어 다른 항목과 비슷한 길이로 축약.
- **홈 화면 '최근 방문' 섹션** — 항상 4열을 강제하며 화면이 좁아질수록 카드가 찌그러지던 문제 수정. 다른 카드 섹션과 동일한 기본 그리드(3열 기준, ≥1024px 4열·≤640px 2열·≤400px 1열)를 그대로 따르도록 하고, 화면폭 구간별 `nth-child` 숨김으로 그 구간의 열 수만큼만(4→3→2→1) 표시 개수를 조절.
- 상세 내역·역할 분담(Fable 직접 처리 vs 위임 가능 작업) 제안은 [`docs/sim-apps-audit-2026-07.md`](sim-apps-audit-2026-07.md) 참고.

### 2026-07 — 마당 v2: 성능 재설계 + 이모지 반응·저학년 모드 + 사진/그림 카드 + 교사 통제·발표모드
계획서: [`docs/madang-v2-plan.md`](madang-v2-plan.md). Phase 1~4 전부 구현·운영 배포 완료.

- **Phase 1(성능)** — `rev` 조건부 폴링(무변경 시 초소형 응답, 마이그레이션 0010) + GET `db.batch()` 통합 + 댓글 전문 분리(`?comments=CARD_ID`). 검열 AbortController 2.5초 타임아웃 + 로컬 금칙어 프리필터 + `waitUntil` 사후검열(hidden 처리). 클라이언트: 적응형 폴링 백오프, HTML 카드 iframe IntersectionObserver 지연로딩(완전 로드 전 숨김), `insertSorted` 이진탐색화.
- **Phase 2(참여 UX)** — 이모지 반응(`madang_likes.emoji`, 마이그레이션 0011, 기존 좋아요는 ❤️로 이관) + 기존 `like` 하위호환. 마당 개설 시 대상(일반/저학년용) 선택 → 저학년은 입장 시 자동 별명(형용사+동물+숫자) 기본. 초대 모달에 전체화면 QR(프로젝터용) + 링크 PIN 포함 옵션(기본 미포함). 저학년 모드 어린이 친화 오류 문구 + 오프라인 게시 로컬 대기열(1건, 재연결 자동 재시도).
- **Phase 3(사진·그림 카드)** — R2 공용 버킷 `byeduin-media`(바인딩 `MEDIA_R2`) 신설. `POST /api/madang-upload`(클라이언트 canvas 리사이즈 1280px·WebP·400KB 상한, 보드당 60MB 총량 상한) + `GET /api/madang-img/[[path]].js`(GET 폴링과 동일 접근제어 재사용, catch-all 라우트). 카드·보드 삭제 시 R2 cascade 삭제(`ctx.waitUntil`). 카드 작성 모달에 📷 사진(카메라/파일)·🎨 그림(6색 미니 캔버스, 되돌리기 1단계) 탭.
- **Phase 4(교사 통제)** — 사전 승인모드(`settings.approval`, 참여자 카드는 pending으로 저장돼 본인+개설자만 보임 — 서버가 필터링), 잠금(`settings.frozen`, post/editCard/addComment 차단), 이름숨김(`settings.hideNames`, 비개설자 응답에서 익명 치환), 발표 모드(클라이언트, 툴바 숨김+카드 슬라이드쇼+새 카드 하이라이트, `#CODE?present=1` 직접 진입), 마당 복제(`action:'duplicate'`, 카드 제외 설정만 복사).
- 공용 헬퍼 [`functions/api/_madang-common.js`](../functions/api/_madang-common.js) 분리(접근제어·HMAC 토큰 — madang.js/madang-upload.js/madang-img가 공유).
- **배포 사고 및 교정(2026-07-04)**: `functions/api/madang-img/[board]/[key].js`처럼 디렉터리 이름을 `[board]`로 만들었더니 Cloudflare Pages Functions 빌드가 깨져 배포 전체가 Function 없는 정적 사이트로 떨어짐(`/api/*` 전체 404, 기존 `/api/notices`까지 포함). `[[path]].js` 단일 파일 catch-all로 교체해 해결 — 위 "주요 API 엔드포인트" 절 참고.

### 2026-06 — 마당 분류 레이아웃·참여자·툴바 개편
- **분류 칼럼 레이아웃**(자유 벽돌 / 분류 칼럼) — 카드를 섹션 칼럼으로 나눔. 마이그레이션 0008(`madang_cards.section`). 영역명은 헤더(박스 없음)·미분류 칼럼 없음. **카드 정렬**(최신순/오래된순/무작위) 설정.
- **참여자 목록**(개설자 전용) + **닉네임 변경**(내 카드·댓글 이름까지 갱신) — 마이그레이션 0009(`madang_members`).
- 배경·레이아웃 **실시간 전파**(폴링으로 접속 중 기기가 따라옴). 링크 카드유형 제거 → 텍스트 내 URL **자동 링크**(새창).
- VivesSync 로그아웃·방 이탈 후에도 글쓰기·소유권 유지(`madang:code` 백업 신원, 읽기는 미발급·쓰기만 발급).
- 상단 툴바를 **공유(초대·공유중단·내보내기) · 더보기(닉네임·참여자·설정) 드롭다운**으로 통합.

### 2026-06 — 마당 chalkboard식 개편 + 댓글·좋아요
- UI를 chalkboard 패턴으로 재구성: 랜딩(내가 만든/참여중 마당 목록·localStorage), **풀스크린 보드**(URL에 코드 `#CODE`·상단 크롬 숨김), 동기화 코드 있을 때만 마당 생성(없으면 방문만).
- **배경 패턴 6종**(화이트보드·칠판·다크·점선·모눈·크라프트) 개설자 설정 선택.
- **댓글·좋아요**(개설자 토글로 켜면 노출) — 마이그레이션 0007(`madang_comments`·`madang_likes`), OpenAI 검열, 코드 HMAC 권한, 카드 삭제·마당 삭제 시 cascade.
- 초대 QR은 단축 없이 원본 URL. 내보내기에 PNG(전체화면 캡처) 추가.

### 2026-06 — 마당(madang) 신규 — 실시간 응답 보드
패들렛형 소셜 앱 추가([`/apps/madang/`](../public/apps/madang/index.html)). 싱크 사용자가 마당을 열고 QR·코드·PIN으로 초대하면 참여자 응답이 카드로 실시간(폴링 2.8s) 누적. **기존 doc/set 동기화와 달리** 여러 사용자 카드가 한 보드에 모이고 소유권·접근제어가 필요해 전용 모듈 [`functions/api/madang.js`](../functions/api/madang.js)로 구현(`board_id` 파티션, 코드 HMAC로 개설자/작성자 판정 — 코드 원본 미저장).
- 카드 유형: 텍스트·링크·HTML(sandbox iframe 격리). **OpenAI Moderation**(omni-moderation-latest) 자동 검열 통과 시 즉시 게시.
- 개설자: 공유/공유중단(중단 시 링크로도 진입 불가), PIN, 허용유형, **자동종료(기본 1주일)**, CSV/PDF 내보내기, 마당 삭제.
- DB 마이그레이션 0006(`madang_boards`·`madang_cards`). 시크릿 `MADANG_PEPPER`(HMAC pepper). 상세: [`docs/d1-sync-pattern.md`](d1-sync-pattern.md) §5.
- 추후: R2 첨부(이미지·파일), 가로/세로/분류 레이아웃.

### 2026-06 — D1 코드 동기화 도입 (VivesSync)
로그인·개인정보 없이 6자리 익명 코드로 다기기 동기화하는 공용 계층을 도입. byeduin 전용 D1 1개(`BYEDUIN_DB`)에 앱별 테이블 접두사로 공유. 공용 헬퍼 [`functions/api/_sync.js`](../functions/api/_sync.js)·[`public/common/sync.js`](../public/common/sync.js)(`VivesSync`). 우상단 통합 **🔄 동기화 버튼**으로 코드 관리 통일.
- read-tree는 **로그인 화면을 제거**하고 로컬 우선 + 버튼 동기화로 전환.
- math-sheet·md-editor는 코드별 다중 문서(열기/저장에 싱크 시 서버+로컬·미싱크 시 로컬만).
- signage-maker는 이미지 제외 **메타데이터만** 동기화.
- 마이그레이션 0001~0005, 적용 앱 9개. 상세: [`docs/d1-sync-pattern.md`](d1-sync-pattern.md).

### 2026-06 — 에듀서치 검색 품질 개선 (1단계)
**문제**: "양이 적은데도 검색이 안 되고, 특정 문서 답변도 부정확". 원인은 `search.js`가 사실상 검색(retrieval)을 하지 않고 **GitHub 트리 순서 앞 10개 파일(`files.slice(0, 10)`)을 질문과 무관하게** 컨텍스트로 넣고 있었음. 게다가 파일당 4000자(문서 Q&A 6000자)로 잘려 긴 문서 뒷부분 답변이 손실되고, '대화'인데 이전 맥락을 서버에 전달하지 않아 후속 질문이 매번 단발성으로 처리됨.

**1단계 개선 (임베딩/벡터DB 없이)**:
- **2단계 라우터 검색**: `slice(0,10)` 폐기 → ① 후보 본문 fetch 후 *제목·소제목·미리보기* 카탈로그 생성 → ② 카탈로그로 관련 문서 최대 5개를 LLM(lite)이 선별 → ③ 선택 문서 **전체 본문**으로 최종 답변. 문서 수가 5개 이하면 선별을 건너뛰고 전부 사용.
- **잘림 상한 완화**: 답변 문서 4000→12000자, 단일 문서 요약·질문 6000→24000자.
- **대화 맥락 전달**: 클라이언트에 멀티턴 버퍼(`activeMessages`) 추가 → 최근 8턴을 `history`로 전송, 라우터·답변 프롬프트가 후속 질문을 맥락으로 해석. `newChat`에서 초기화, `loadConv`/문서 질문에서 복원.
- **답변 모델 승격**: 선별은 `gemini-flash-lite`(비용), 최종 답변·단일 문서 분석은 `gemini-flash`로. `_ai.js`의 `generateContent`에 `timelyModel`/`geminiModel` 오버라이드 추가(기본값 lite 유지 → 기존 호출부 영향 없음).
- **인용 안정화**: 취약한 `**출처:**` 정규식 추출 폐기 → 라우터가 선별한 경로를 참조 문서로 반환.
- **대용량 방어**: 후보가 30개 초과면 경로 어휘 점수로 사전 컷(타임아웃/비용 방지). 라우터 실패 시 어휘 상위로 폴백.
- **모바일 사이드바 겹침 수정**: 폭 ≤640px에서 자체 사이드바(`.app-sidebar`)가 `position:fixed` 드로어로 뜰 때 기본 배경이 `rgba(…,0.02)`(거의 투명)이라 채팅 본문이 비쳐 '겹침'처럼 보이던 문제 → 드로어 상태에서 `background: var(--bg)` 불투명 강제. 공유 셸(`app-shell.css` `.app-aside`)은 불투명 `--bg-sec` + 별도 백드롭이라 정상이며, 자체 사이드바를 쓰는 앱은 search가 유일.

**관련 파일**: [`functions/api/search.js`](../functions/api/search.js) · [`functions/api/_ai.js`](../functions/api/_ai.js) · [`public/apps/search/index.html`](../public/apps/search/index.html)

**2단계 가능 방향 (백로그 — 문서가 수십~수백 개로 늘면)**: 진짜 NotebookLM식 시맨틱 RAG.
- **임베딩 + 벡터 검색**: Cloudflare **Workers AI**(`@cf/baai/bge-m3`, 한국어 강함)로 임베딩 → **Vectorize**에 저장(코퍼스가 작으면 KV에 벡터 JSON도 가능). 질문도 임베딩해 코사인 유사도 top-K **청크**만 검색 → 라우터의 "본문 전부 fetch" 비용·지연 제거.
- **청킹**: 문서를 헤딩/문단 단위로 분할 색인 → 잘림 없이 관련 부분만 정밀 검색.
- **재색인**: GitHub push 웹훅 또는 cron으로 증분 색인.
- **질의 재작성/HyDE**: 후속 질문을 검색 전 독립형 질의로 재작성(현재는 라우터 프롬프트에 history만 주입).
- **평가셋**: "정답이 있는 질문 N개" 회귀 테스트로 변경 전후 적중률 비교.

### 2026-06 — Break & Make 신규 + 효과음 확대
- **Break & Make**(`break-make`) 신규: 구슬 교구로 수 가르기·모으기 조작 학습 (개념/가르기/모으기/나의 기록 탭, 한자리·10·십몇 단계, 도전 모드, 별·도장 도감, `localStorage` 저장). step-squad 인라인 홈·공유 영역 계승
- **Web Audio 효과음 + 음소거**: break-make에 신규 적용 후 step-squad·clubs에도 동일 패턴 확대(조작·정답·오답음 + 🔊/🔇 토글, 상태 `localStorage` 저장)
- **접근성**: `prefers-reduced-motion` 대응, 음소거·도전 토글 `aria-pressed`, `focus-visible` (break-make)

### 2026-06 — Blocks Universe 개선
- **AI 번역 사전 적재**: 영문 전용 231편·한글 영상+영문 설명 31편 → `descKo` / `titleKo` 번역 추가 (전체 351편 완비)
- **3유형 UI**: 영문 카드 제목 유지 / 모달 EN 기본값 / 토글 순서 `EN | 🤖 한글번역` / 언어 전환 시 영상 재시작 없음
- **공유 URL 수정**: 하드코딩 `/blocks-universe/` → `location.href` 기반으로 경로 변경에 견고하게 대응

### 2026-06 — 앱 모듈화 + 셸 시스템
- `public/<id>/` 22개 앱 → `public/apps/<id>/` 통합 이동
- `public/common/app-shell.css` + `app-shell.js` 신규: 셸 유형 5종 + 폭·focus·print 플래그
- 플로팅 크롬(홈·테마·공유 버튼) 자동 주입 → 각 앱 복붙 제거
- `qr` PWA: `/qr/` → `/apps/qr/` 경로 갱신 및 재활성화
- `public/chrome-extentions/` → `public/downloads/` 이름 변경
- `generate-sitemap.js`: `app.type === 'modal'` 기준 스킵으로 일반화
- `scripts/scaffold-app.js`: 새 경로·셸 유형·서브카테고리 선택 지원

### 2026-06 — 홈 데이터화
- `apps.json`에 `categories[].subcategories` 중첩 구조 추가
- 각 앱에 `subcategory` 필드 추가
- `index.html` 하드코딩 `SUBCATS` 제거 → `apps.json` 단일 소스 기반 렌더링
- 새 앱 스캐폴드 시 홈 서브카테고리에 자동 배치
