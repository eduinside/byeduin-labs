# byeduin VIVES — 개발 계획

> 작성일: 2026-03-25

---

## 프로젝트 개요

**byeduin VIVES**는 바이브 코딩으로 만든 소형 웹 앱 모음이다.
순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).
8개의 독립 앱과 1개의 인트로 페이지로 구성된다.

---

## 현재 앱 목록

| 앱 | 경로 | 카테고리 | 비고 |
|---|---|---|---|
| QR Code | `/qr/` | utility | QR 생성 + 스캔 |
| Timer | `/timer/` | utility | 스마트 반복 알람 |
| Grid | `/grid/` | creative | 이미지 그리드 분할 |
| Moon Phase | `/moon-phase/` | info | 달 위상 시뮬레이터 |
| YT Thumbnail | `/yt-thumb/` | creative | 유튜브 썸네일 추출 |
| Notion Image DL | `/notion-image-downloader/` | notion | 노션 이미지 일괄 다운로드 |
| Notion Styler | `/notion-styler/` | notion | LaTeX 수식 스타일러 |
| Numberblocks | `/numberblocks/` | edu | 넘버블록스 에피소드 파인더 |

---

## 이번 개편 목표

### 1. 인트로 페이지 (`/index.html`) 개편

- **카테고리별 섹션 구분** (현재: 혼합 그리드)
  - 🛠 유틸리티 — QR, Timer
  - 🎨 크리에이티브 — Grid, YT Thumbnail
  - 📐 노션 도구 — Notion Image DL, Notion Styler
  - 📚 교육 — Numberblocks
  - 🌐 정보 탐색 — Moon Phase
- **JS 데이터 렌더링** — HTML 수정 없이 배열에만 추가
- **외부 링크 카드** 지원 (↗ 아이콘 표시, `target="_blank"`)
- **테마 선택기** (자동/라이트/다크)
- **라이트 모드 기본값** (기존: 다크 고정)

### 2. 공통 리소스 통합 (`/common/`)

중복 코드를 통합해 유지보수성을 높인다.

#### `/common/hero-theme.css`
- HeroUI v3 CSS 변수 (라이트/다크 팔레트)
- 공통 컴포넌트 클래스: `.hero-card`, `.hero-input`, `.hero-btn`
- 플로팅 오버레이: `.top-overlay`, `.overlay-btn`

#### `/common/theme.js`
- 테마 초기화: `localStorage['vives-theme']` 읽어 적용
- 테마 순환: auto → light → dark → auto
- 시스템 테마 변경 감지

### 3. HeroUI 스타일 통일 (Moon Phase 제외)

**적용 팔레트:**

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--bg` | #ffffff | #0d0d0d |
| `--card-bg` | #f4f4f5 | #1a1a1a |
| `--border` | #e4e4e7 | #2a2a2a |
| `--fg` | #11181c | #ecedee |
| `--fg-muted` | #71717a | #888888 |
| `--primary` | #006fee | #006fee |
| `--input-bg` | #f4f4f5 | #1a1a1a |

**공통 오버레이 버튼** (모든 앱 우상단, Moon Phase 포함):
```html
<div class="top-overlay">
  <button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()">💻</button>
  <a href="/" class="overlay-btn">
    <svg ...>홈</svg>
    <span>Home</span>
  </a>
</div>
```
Moon Phase는 홈 버튼만 추가 (테마 선택기 없음, 기존 다크 테마 유지).

### 4. 모바일 접근성 개선 (Moon Phase 제외)

- 터치 타겟 최소 44×44px
- `input`, `select`, `textarea` — font-size 16px 이상 (iOS 자동 줌 방지)
- 버튼 패딩 `py-3` 이상 확보
- 가로 스크롤 최소화 → 세로 스택 레이아웃 우선

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
  category: "utility",   // utility | creative | notion | edu | info
}
```

### 외부 링크 (타입 B)
```javascript
{
  type: "link",
  emoji: "🔗",
  title: "링크 제목",
  desc: "이 리소스에 대한 설명",
  href: "https://example.com",
  external: true,
  category: "info",
}
```
외부 링크 카드는 우상단에 ↗ 아이콘이 표시된다.

### 카테고리 추가
새 카테고리가 필요하면 `CATEGORIES` 배열에도 추가:
```javascript
{ id: "newcat", label: "🔥 새 카테고리", desc: "설명" }
```

---

## 앱별 개선 제안 (별도 요청 시 구현)

### QR Code
- QR 크기 슬라이더, 색상 커스터마이징, 오류 정정 레벨 선택

### Timer
- 스누즈 기능 (+5분/+10분), 카운트다운 타이머 탭, 볼륨 조절

### Grid
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

## 파일 구조 (개편 후)

```
public/
├── index.html              ← JS 렌더링 방식으로 개편
├── DEVPLAN.md              ← 이 파일
├── favicon.svg
├── common/
│   ├── hero-theme.css      ← 공통 CSS 변수 + 컴포넌트 (신규)
│   └── theme.js            ← 공통 테마 전환 로직 (신규)
├── qr/index.html           ← HeroUI 리스타일
├── timer/index.html        ← HeroUI 리스타일
├── grid/index.html         ← HeroUI 리스타일
├── moon-phase/index.html   ← 홈 버튼만 추가 (스타일 유지)
├── yt-thumb/index.html     ← HeroUI 리스타일
├── notion-image-downloader/index.html  ← HeroUI 리스타일
├── notion-styler/index.html            ← HeroUI 리스타일
└── numberblocks/
    ├── index.html          ← 홈버튼+테마 추가
    ├── app.js
    ├── style.css           ← CSS 변수 HeroUI로 교체
    └── data-content.json
```
