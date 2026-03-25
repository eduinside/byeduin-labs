# byeduin VIVES — 개발 계획

> 최초 작성: 2026-03-25 / 최종 업데이트: 2026-03-26

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
| QR Master | `/qr/` | utility | QR 생성 + 스캔 |
| Smart Timer | `/timer/` | utility | 스마트 반복 알람 |
| Grid Maker | `/grid-maker/` | creative | 이미지 그리드 분할 |
| Moon Phase | `/moon-phase/` | edu | 달 위상 시뮬레이터 |
| YT Thumbnail | `/yt-thumb/` | creative | 유튜브 썸네일 추출 |
| Notion Image DL | `/notion-image-downloader/` | notion | 노션 이미지 일괄 다운로드 |
| Notion Styler | `/notion-styler/` | notion | LaTeX 수식 스타일러 |
| Numberblocks | `/numberblocks/` | edu | 넘버블록스 에피소드 파인더 |
| Login Helper | (모달, 외부 링크) | utility | 에듀나비 교원업무지원 안내 |
| Content ID Viewer | (모달, 외부 링크) | utility | 에듀나비 아카이브 안내 |

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

예외: Moon Phase는 자체 다크 테마 유지, 홈 버튼 인라인 스타일 사용.

---

## 앱별 구현 현황

### 인트로 (`/index.html`)
- JS 데이터 렌더링 (`APPS` 배열 → 카드 자동 생성)
- 카테고리별 섹션 분리 (utility / creative / notion / edu)
- **모달 시스템**: 상세설명, 기능 목록, 링크를 모달로 표시 (Login Helper, Content ID Viewer 등)
- 파비콘: `logo.jpg`
- 우상단 테마 전환 + 공유 버튼

### QR Master (`/qr/`)
- 생성하기 / 스캔하기 2탭 구성
- `.qr-card` 래퍼 (border-radius: 1.5rem, overflow: hidden)
- 스캔 히스토리 로컬스토리지 저장
- **TODO**: 두 탭 패널 고정 높이 통일 (탭 전환 시 레이아웃 변동 없도록)

### Smart Timer (`/timer/`)
- 반복 알람 + 세션 종료 알림
- `.timer-wrap` 래퍼, `body::before` 격자 배경
- 앱 헤더: `◆ UTILITY` / `Smart Timer`

### Grid Maker (`/grid-maker/`)
- 이미지 드래그 업로드 지원
- HeroUI CSS 변수 적용 (`indigo-*` → `var(--primary)` 전면 교체)
- **TODO**: 2단 레이아웃 (좁은 사이드바 좌측 + 캔버스 우측), 버튼 가시성 개선

### YT Thumbnail (`/yt-thumb/`)
- 유튜브 URL → 썸네일 추출
- `.app-header` 카드 외부로 이동
- 오버레이 업데이트 완료

### Notion Image DL (`/notion-image-downloader/`)
- Notion API 프록시 연동
- 오류 메시지 실제 API 응답 노출 (기존: 무조건 "404"로 표시하던 버그 수정)
- 오버레이 업데이트 완료

### Notion Styler (`/notion-styler/`)
- React + Babel + KaTeX 구성
- **2단 레이아웃**: 좌측 (텍스트 입력 + 스타일 설정) / 우측 (미리보기 + 코드 + 액션)
- 폰트 스타일 4열 그리드 (`repeat(4, 1fr)`)
- 섹션 구분: `ns-card-title::after` 라인 구분자
- 다크모드 보정: `[data-theme="dark"]` 오버라이드
- **TODO**: 텍스트 입력 높이 ↔ 미리보기 높이 맞춤, 색상 스와치 컴팩트 정렬

### Moon Phase (`/moon-phase/`)
- 자체 다크 테마 유지 (HeroUI 미적용)
- 홈 버튼: 좌상단 인라인 스타일 (`left:12px`)

### Numberblocks (`/numberblocks/`)
- 에피소드 파인더 + 유튜브 연동
- 오버레이 업데이트 완료
- **TODO**: 애니메이션 축소, HeroUI 전면 적용, 아이템 클릭 시 펼침 효과 → 심플 버튼 교체, 홈 버튼 상단 메뉴 간섭 해결, 클릭 아이템 하위 버튼 중앙 정렬, 모바일 접근성

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

### 카테고리 추가
```javascript
{ id: "newcat", label: "🔥 새 카테고리", desc: "설명" }
```

---

## 앱별 개선 아이디어 (별도 요청 시 구현)

### QR Master
- QR 크기 슬라이더, 색상 커스터마이징, 오류 정정 레벨 선택

### Smart Timer
- 스누즈 기능 (+5분/+10분), 카운트다운 탭, 볼륨 조절

### Grid Maker
- 프리셋 그리드 (3×3, 2×3, 4×4), 셀 간 여백 설정, 개별 다운로드

### YT Thumbnail
- 인앱 미리보기, 4종 품질 동시 표시, 마크다운 복사, 1클릭 다운로드

### Notion Image DL
- 다운로드 전 이미지 목록 미리보기, 선택적 다운로드 (체크박스)

### Notion Styler
- 자주 쓰는 수식 프리셋, 수식 히스토리

### Numberblocks
- 즐겨찾기, 학습 진도 표시, 랜덤 에피소드 추천

---

## 파일 구조 (현재)

```
byeduin-labs/
├── docs/
│   ├── DEVPLAN.md              ← 이 파일
│   └── numberblocks-readme.md
├── public/
│   ├── index.html
│   ├── logo.jpg
│   ├── common/
│   │   ├── hero-theme.css
│   │   └── theme.js
│   ├── qr/index.html
│   ├── timer/index.html
│   ├── grid-maker/index.html
│   ├── moon-phase/index.html
│   ├── yt-thumb/index.html
│   ├── notion-image-downloader/index.html
│   ├── notion-styler/index.html
│   └── numberblocks/
│       ├── index.html
│       ├── app.js
│       ├── style.css
│       └── data-content.json
├── netlify/
└── netlify.toml
```
