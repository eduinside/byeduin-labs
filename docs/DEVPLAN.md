# byeduin VIVES — 개발 계획

> 최초 작성: 2026-03-25 / 최종 업데이트: 2026-03-30

---

## 프로젝트 개요

**byeduin VIVES**는 바이브 코딩으로 만든 소형 웹 앱 모음이다.
순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).
독립 앱과 1개의 인트로 페이지로 구성된다.

서버: `npx serve public -l 3000` (로컬 개발용)
배포: Netlify 정적 호스팅

---

## 현재 앱 목록

| 앱 | 경로 | 카테고리 | 비고 |
|---|---|---|---|
| QR Master | `/qr/` | utility | QR 생성 + 스캔, 히스토리 |
| Smart Timer | `/timer/` | utility | 반복 알람 타이머 |
| 도서 정보 나눔 | `/book-share/` | utility | ISBN → 알라딘 조회 + 엑셀 + 링크 공유 |
| Grid Maker | `/grid-maker/` | creative | 이미지 그리드 분할, 드래그 업로드 |
| Moon Phase | `/moon-phase/` | edu | 달 위상 시뮬레이터 |
| YT Thumbnail | `/yt-thumb/` | creative | 유튜브 썸네일 추출 |
| Notion Image DL | `/notion-image-downloader/` | notion | 노션 이미지 일괄 다운로드 |
| Notion Styler | `/notion-styler/` | notion | LaTeX 수식 스타일러 |
| Numberblocks | `/numberblocks/` | edu | 넘버블록스 에피소드 파인더 |
| Step Squad | `/numberblocks/step-squad.html` | edu | 계단수 블록 시각화 + 퀴즈 |
| Flash Deck | `/flash-deck/` | edu | 플래시카드 덱 제작 및 학습 |
| Chalkboard | `/chalkboard/` | edu | 칠판·화이트보드 메모 앱 |
| Login Helper | (모달) | utility | 에듀나비 교원업무지원 안내 |
| Content ID Viewer | (모달) | utility | 에듀나비 아카이브 안내 |

---

## 공통 리소스 (`/common/`)

### `/common/hero-theme.css`
- HeroUI v3 CSS 변수 기반 라이트/다크 팔레트
- 공통 컴포넌트 클래스:
  - `.app-header` / `.app-badge` / `.app-title` / `.app-desc`
  - `.top-overlay` — 우상단 고정 (테마 전환 + 공유 버튼)
  - `.top-overlay-left` — 좌상단 고정 (홈 버튼)
  - `.overlay-btn` — 반투명 블러 버튼
- `body::before` 격자 배경 패턴 (공통 분위기)

### `/common/theme.js`
- `cycleTheme()` — `auto → light → dark → auto` 순환
- `shareCurrentPage()` — Web Share API 또는 클립보드 복사 폴백
- `localStorage['vives-theme']` 읽기/쓰기

### HeroUI 팔레트

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--bg` | #ffffff | #0d0d0d |
| `--card-bg` | #f4f4f5 | #1a1a1a |
| `--border` | #e4e4e7 | #2a2a2a |
| `--fg` | #11181c | #ecedee |
| `--fg-muted` | #71717a | #888888 |
| `--primary` | #006fee | #006fee |
| `--input-bg` | #f4f4f5 | #1a1a1a |

---

## 오버레이 레이아웃 규칙

모든 앱은 아래 구조를 따른다:

```html
<!-- 좌상단: 홈 -->
<div class="top-overlay-left">
  <a href="/" class="overlay-btn" title="홈">
    <svg>...</svg>
    <span>Home</span>
  </a>
</div>

<!-- 우상단: 테마 전환 + 공유 -->
<div class="top-overlay">
  <button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()">💻</button>
  <button id="shareBtn" class="overlay-btn" onclick="shareCurrentPage()">
    <svg>...</svg><span>공유</span>
  </button>
</div>
```

예외: Moon Phase는 자체 다크 테마 유지, 인라인 `shareMoonPhase()` 함수 사용.

---

## 앱별 구현 현황

### 인트로 (`/index.html`)
- JS 데이터 렌더링 (`APPS` 배열 → 카드 자동 생성)
- 카테고리 순서: edu(교육) → utility → creative → notion (교육 최상단)
- 모달 시스템 (Login Helper, Content ID Viewer 등)
- 파비콘: `logo.jpg`
- 우상단 테마 전환 + 공유 버튼

---

### QR Master (`/qr/`)
- 생성하기 / 스캔하기 2탭, `.qr-card` 래퍼
- 스캔 히스토리 로컬스토리지 저장
- 두 탭 패널 고정 높이 통일 완료

---

### Smart Timer (`/timer/`)
- 반복 알람 + 세션 종료 알림

---

### 도서 정보 나눔 (`/book-share/`)

#### 개요
| 항목 | 내용 |
|---|---|
| 앱 이름 | **도서 정보 나눔** |
| 배지 | `◆ Utility` |
| 경로 | `/book-share/` |
| API 키 | `config.js` (gitignore, `ALADIN_TTB_KEY` 상수) |

#### 주요 기능
- ISBN-13 일괄 입력 → 알라딘 ItemLookUp API (JSONP) 순차 조회
- 결과 테이블: 순번·도서명·저자·출판사·정가·주문수량·삭제
- 주문수량 인라인 편집, 행 삭제, 전체 초기화
- 엑셀 내보내기 (SheetJS) — 파일명 `도서 정보_날짜.xlsx`
- 통계 (종수·주문수량·합계) — 표 하단 표시
- **링크 공유**: base64url 인코딩 해시 URL → Short.io 단축 URL

#### 공유 기능 구조
```
[공유 버튼 클릭]
  → list[] → JSON → base64url 인코딩 → URL 해시 생성
  → POST /.netlify/functions/shorten → Short.io API → 단축 URL
  → 클립보드 복사
  → 실패 시: navigator.share 또는 긴 URL 클립보드 복사

[수신자 접속 #share=...]
  → decodeShareData() (3가지 폴백 디코딩)
  → list 복원 → saveList() → renderTable()
```

#### Netlify Function (`netlify/functions/shorten.js`)
- POST 전용, `process.env.SHORT_IO_API_KEY` / `SHORT_IO_DOMAIN` 읽기
- `https://api.short.io/links` 호출, `{ shortURL }` 반환

#### 환경변수
| 키 | 위치 | 용도 |
|---|---|---|
| `ALADIN_TTB_KEY` | Netlify 환경변수 + `config.js` (빌드 생성) | 알라딘 OpenAPI |
| `SHORT_IO_API_KEY` | Netlify 환경변수 + `.env` (로컬) | Short.io 단축 URL |
| `SHORT_IO_DOMAIN` | 동일 | Short.io 도메인 |

#### localStorage 키
- `bookwishlist_items` — JSON 배열 (isbn13, title, author, publisher, priceStandard, qty)

---

### Grid Maker (`/grid-maker/`)
- 이미지 드래그 업로드, HeroUI CSS 변수 전면 적용
- 상단 여백 `pt-16` (홈 버튼 중첩 해소)

---

### YT Thumbnail (`/yt-thumb/`)
- 유튜브 URL → 썸네일 추출

---

### Notion Image DL (`/notion-image-downloader/`)
- Notion API 프록시 연동, 오류 메시지 실제 응답 노출

---

### Notion Styler (`/notion-styler/`)
- React + Babel + KaTeX, 2단 레이아웃, 4열 폰트 그리드
- 텍스트 입력·미리보기 높이 동기화 완료
- 정렬 버튼 → 스타일 설정 카드로 이동
- 생성된 코드 영역 배경 `#242b3d` / 테두리 `#3a4460`

---

### Moon Phase (`/moon-phase/`)
- 자체 다크 테마 유지
- 인라인 `shareMoonPhase()` + `#mpToast` 요소로 공유 기능 독립 구현
- 우상단 공유 버튼 (다크 오버레이 스타일)

---

### Numberblocks (`/numberblocks/`)

#### 기능
- 에피소드 파인더 + 유튜브 연동
- 필터: 3단계 분류 (단계별/학년별/영역별) + 동적 하위 필터
- 검색: 데스크톱 확장형 / 모바일 전체화면 오버레이
- 그리드 → 무한 스크롤 (Intersection Observer)
- 항목 클릭 시 토글 버튼 방식 (버튼 클릭 → 링크 버튼 노출)

#### 파일 구조
```
public/numberblocks/
├── index.html
├── style.css
├── app.js
├── data-content.json
└── step-squad.html   ← Step Squad 앱
```

---

### Step Squad (`/numberblocks/step-squad.html`)

#### 개요
| 항목 | 내용 |
|---|---|
| 앱 이름 | **Step Squad** |
| 배지 | `◆ EDU` |
| 경로 | `/numberblocks/step-squad.html` |
| 폰트 | Dongle (어린이 가독성, `font-size: 200%`) |

#### 주요 기능
- **설명 탭**: 계단수(Step Squad) 개념 소개, 만들기/퀴즈 CTA 버튼
- **만들기 탭**: 슬라이더로 1~20 계단수 블록 시각화, 다중 Squad 비교
- **퀴즈 탭**: 인트로 화면 → 시작하기 → 퀴즈 게임 → 점수 표시 → 처음부터
- 홈·공유 오버레이 버튼, `execCommand('copy')` 폴백 포함

---

### Flash Deck (`/flash-deck/`)

#### 개요
| 항목 | 내용 |
|---|---|
| 앱 이름 | **Flash Deck** |
| 배지 | `◆ EDU` |
| 경로 | `/flash-deck/` |
| localStorage | `vives-flashdeck` |

#### 주요 기능

**덱 관리**
- 여러 덱 생성·삭제
- 덱 카드: 카드 수 / 마스터 수 / 학습 횟수 / 마지막 학습일 / 진행률 바
- AI 프롬프트 카드: 덱 그리드 맨 끝 점선 카드 (기본·영단어·역사·수식 4종 모달)
- 덱 삭제: hover 시 우상단 아이콘, confirm 후 삭제

**카드 입력**
- 단건 입력 (앞면/뒷면 필드, Enter 지원)
- 일괄 입력 (`앞면 :: 뒷면` 형식, 토글 패널)
- 카드 삭제

**학습 모드**
- CSS 3D 플립 (perspective 1200px, 높이 340px)
- 플립 전 결과 버튼 숨김 → 플립 후 fade-in
- ✓ 알아요 / ✗ 모르겠어요 (passCount ≥ 2 → mastered)
- 학습 범위: 전체 / 모르는 것만, 섞기 ON/OFF
- **전체화면 모드** (버튼 + F키, Esc 해제)

**결과 화면**
- 정확도별 이모지 메시지 (100% 🎉 / 70%+ 😊 / 40%+ 💪 / 미만 📚)
- 세션 완료 시 `studyCount` 증가

**키보드 단축키**
- `Space` / `↑` — 뒤집기, `→` — 알아요, `←` — 모르겠어요, `F` — 전체화면

**버그 수정 이력**
- 전체화면 마지막 카드 → 결과 화면 미전환: `showResult()` 진입 시 `exitFullscreen()` 먼저 호출
- 재학습 시 카드 뒤집기 불가: 학습 시작 시 flip 상태 초기화

#### 데이터 구조
```json
{
  "decks": [{
    "id": "uid", "name": "생물 용어",
    "createdAt": 0, "lastStudied": 0, "studyCount": 3,
    "cards": [{ "id": "uid", "front": "photosynthesis", "back": "광합성",
      "mastered": false, "failCount": 2, "passCount": 1 }]
  }]
}
```

---

### Chalkboard (`/chalkboard/`)

#### 개요
| 항목 | 내용 |
|---|---|
| 앱 이름 | **Chalkboard** |
| 배지 | `◆ EDU` |
| 경로 | `/chalkboard/` |
| localStorage | `vives-chalkboard` |

#### 주요 기능

**보드 관리**
- 여러 보드 생성·삭제
- 목록 화면: 그리드 카드 — 썸네일은 좌상단 텍스트 (y→x 정렬), 텍스트 없으면 보드 이름
- 구형 localStorage 데이터 `type` 필드 없을 때 자동 보정

**보드 타입 전환**
- **칠판 모드**: 배경 `#1b4332`, 기본 글자색 흰색
- **화이트보드 모드**: 배경 `#ffffff`, 기본 글자색 검정
- 전환 시 기존 요소 색상 자동 반전

**텍스트 추가**
- 더블클릭으로 추가, 기본 80px (SIZES: 32·48·64·80·96·120·160·200px)
- 드래그 이동, contenteditable 인라인 편집
- 컨텍스트 메뉴: 크기 조정·색상 변경·편집·삭제

**선 그리기**
- 드래그로 직선, 드래그 이동, 두께 기본 3px
- 컨텍스트 메뉴: 색상 변경·삭제

**색상 팔레트 (4색)**
- 기본색 / 노랑 `#fde68a` / 분홍 `#fca5a5` / 파랑 `#93c5fd`

**저장**
- 드롭다운: TXT (텍스트만) / JPG (Canvas API)
- 자동저장 펄스 점 — "저장" 텍스트 우측 인라인 배치

**실행취소 (Ctrl+Z)**
- 최대 50단계 히스토리 스택 (`JSON.parse/stringify` 깊은 복사)
- 변경 지점: 타입 전환·크기·색상·삭제·텍스트 추가·편집 완료·드래그 완료·선 그리기
- 취소 시 토스트 "취소했습니다"

**복사·붙여넣기 (Ctrl+C / Ctrl+V)**
- 선택 요소를 인메모리 클립보드에 복사
- 붙여넣기 시 +20px(가로) / +20px(세로) 오프셋으로 새 요소 생성
- 토스트: "복사했습니다" / "붙여넣었습니다"

**공유**
- 툴바 "공유 ▼" 드롭다운 — 권한 선택: 보기 전용 / 복제 허용
- 공유 payload: `{ elements, type, name, permission }` → base64url 인코딩 → `#share=` 해시
- Short.io(`/.netlify/functions/shorten`) 단축 URL → 클립보드 복사, 실패 시 원본 URL 폴백

**보기 전용 모드 (수신 측)**
- `#share=` 해시 감지 → `history.replaceState`로 즉시 제거
- `permission === 'view'` → 바로 보기 전용 진입 + 토스트
- `permission === 'clone'` → "보기 전용 / 복제하기" 선택 모달
- `viewOnlyBoard` 변수: `getBoard()` 오버라이드, `saveBoard()` no-op
- 모든 mutation 함수에 `if (viewOnlyBoard) return;` 가드
- `.is-view-only` CSS: 편집 컨트롤 비활성(opacity 0.3), 보기전용 배지·복제 버튼 표시

**모바일 더보기 메뉴 (≤600px)**
- 저장·공유 버튼 숨기고 ··· 버튼으로 통합
- btn-type·btn-add-text·btn-draw: `font-size: 0`으로 텍스트 숨기고 아이콘만 표시
- 더보기 드롭다운: TXT / JPG / 공유-보기전용 / 공유-복제허용 4개 항목

#### 데이터 구조
```json
{
  "boards": [{
    "id": "uid", "name": "수업 보드", "type": "chalkboard",
    "createdAt": 0, "lastEdited": 0,
    "elements": [
      { "id": "uid", "type": "text", "x": 100, "y": 200,
        "text": "안녕하세요", "color": "#ffffff", "size": 80 },
      { "id": "uid", "type": "line", "x1": 50, "y1": 100,
        "x2": 300, "y2": 150, "color": "#fde68a", "width": 3 }
    ]
  }]
}
```

---

## 아이템 추가 방법

`index.html` 상단의 `APPS` 배열에 객체 하나 추가:

### 내부 앱 (타입 A)
```javascript
{
  emoji: "🆕",
  title: "앱 이름",
  desc: "기능 설명 (한 줄)",
  href: "/앱-경로/",
  category: "utility",   // utility | creative | notion | edu
}
```

### 외부 링크 + 모달 (타입 B)
```javascript
{
  type: "link",
  emoji: "🔗",
  title: "링크 제목",
  badge: "유틸리티",
  desc: "카드에 표시되는 짧은 설명",
  modalDesc: "모달에 표시되는 긴 설명",
  features: [
    "기능 설명 1",
    '<a href="https://...">링크가 포함된 기능</a>',
  ],
  links: [
    { label: "바로가기", href: "https://...", primary: true },
  ],
  category: "utility",
}
```

---

## 파일 구조 (현재)

```
byeduin-labs/
├── README.md
├── netlify.toml                    ← Netlify 빌드·Functions 설정
├── .env                            ← 로컬 환경변수 (gitignore)
├── docs/
│   ├── DEVPLAN.md                  ← 이 파일 (전체 개발 현황)
│   └── PLAN.md                     ← 작업 플랜 (진행/완료/대기)
├── netlify/
│   └── functions/
│       └── shorten.js              ← Short.io API 프록시
└── public/
    ├── index.html
    ├── logo.jpg
    ├── common/
    │   ├── hero-theme.css
    │   └── theme.js
    ├── qr/index.html
    ├── timer/index.html
    ├── book-share/
    │   ├── index.html
    │   └── config.js               ← gitignore (ALADIN_TTB_KEY)
    ├── grid-maker/index.html
    ├── moon-phase/index.html
    ├── yt-thumb/index.html
    ├── notion-image-downloader/index.html
    ├── notion-styler/index.html
    ├── flash-deck/index.html
    ├── chalkboard/index.html
    └── numberblocks/
        ├── index.html
        ├── app.js
        ├── style.css
        ├── data-content.json
        └── step-squad.html
```
