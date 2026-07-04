# eduin VIVES — 프로젝트 개요

> **배포**: Cloudflare Pages · `pages_build_output_dir = "public"` · 폴더 경로 = URL 경로  
> **빌드**: 번들러·라우터 없음. 정적 파일 직접 서빙.

---

## 폴더 구조

```
public/
├── apps/              ← 앱 페이지 (22개 폴더)
│   ├── blocks-universe/
│   ├── timer/
│   └── …
├── common/            ← 공통 CSS·JS
│   ├── hero-theme.css
│   ├── app-shell.css
│   ├── app-shell.js
│   ├── theme.js
│   ├── init.js
│   └── seo-injector.js
├── og-images/         ← 앱별 OG 이미지 (1200×630)
├── downloads/         ← 크롬 확장 zip 등 다운로드 파일
├── index.html         ← 홈 (카테고리 트리 사이드바)
└── apps.json          ← 앱 메타데이터 단일 소스

functions/api/         ← Cloudflare Workers (서버리스 API)
scripts/               ← 빌드·생성 스크립트 (Node.js)
docs/                  ← 개발 문서
```

---

## 앱 목록

### 교육 · 시뮬레이션 (`edu-sim`)
| ID | 이름 | 설명 |
|---|---|---|
| `moon-phase-v2` | 달의 위상 3D | 달의 위상 3D 입체 시뮬레이터 |
| `volcano` | 화산 지도 | 3D 위성지도로 세계 화산 11개 탐험 |
| `step-squad` | 계단수 | 계단수 개념을 블록으로 시각화 + 퀴즈 |
| `break-make` | 가르기 모으기 | 구슬 조작으로 수 가르기·모으기 + 도전 모드·도감 |
| `clubs` | 넘버블록스 클럽 | 1~100 수의 클럽 탐색 + 퀴즈 |

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
| `book-share` | 도서 공유 | ISBN 도서 정보 조회·파일 저장·공유 |
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
| `immersive` | 풀뷰포트 (크롬만 주입) | moon-phase, volcano, step-squad, break-make, clubs |

**폭 플래그** (`data-width`): `narrow`(480px) · `medium`(720px) · `wide`(1120px)  
**기능 플래그**: `data-focus`(아이템→전체화면 `enterFocus()`) · `data-print`(A4 인쇄 베이스라인)

### 공통 파일 (모든 앱 `<head>` 필수)
```html
<link rel="stylesheet" href="/common/hero-theme.css">
<link rel="stylesheet" href="/common/app-shell.css">
<script src="/common/theme.js"></script>
<script src="/common/init.js"></script>
<script src="/common/app-shell.js" defer></script>
<script src="/common/seo-injector.js" defer></script>
```

> **예외**: `immersive` 유형 중 step-squad·clubs·break-make는 독자 CSS(Dongle 폰트·`--bg`)를 사용하므로 `hero-theme.css`·`app-shell.css`를 포함하지 않음.

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
