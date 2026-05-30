# byeduin VIVES — 디자인 시스템

> 새 앱을 추가할 때 참조하는 색·타이포·컴포넌트 토큰 레퍼런스.  
> 소스 오브 트루스: [`/public/common/hero-theme.css`](/public/common/hero-theme.css)

---

## 1. 공통 파일 3종

모든 앱의 `<head>`에 아래 순서대로 삽입한다.

```html
<link rel="stylesheet" href="/common/hero-theme.css">
<script src="/common/theme.js"></script>   <!-- FOUC 방지: CSS 직후 동기 로드 -->
<script src="/common/init.js"></script>    <!-- 파비콘 + GA4 -->
```

| 파일 | 역할 |
|------|------|
| `hero-theme.css` | CSS 변수(토큰) + 공통 컴포넌트 클래스 |
| `theme.js` | `cycleTheme()` · `shareCurrentPage()` · `data-theme` 자동 적용 |
| `init.js` | 파비콘 `/logo.jpg` 강제 설정 · GA4 초기화 (localhost 제외) |

---

## 2. 색상 토큰

`hero-theme.css`가 `:root`에 정의. 다크 모드는 `[data-theme="dark"]`로 오버라이드.

### 배경

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--bg` | `#ffffff` | `#0d0d0d` | 페이지 배경 |
| `--bg-sec` | `#f4f4f5` | `#1a1a1a` | 보조 배경 (섹션 구분 등) |
| `--card-bg` | `#f4f4f5` | `#1a1a1a` | 카드·모달 배경 |
| `--input-bg` | `#f4f4f5` | `#1a1a1a` | 입력 필드 배경 |

### 텍스트

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--fg` | `#11181c` | `#ecedee` | 기본 텍스트 |
| `--fg-muted` | `#71717a` | `#888888` | 보조·레이블 텍스트 |

### 테두리

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--border` | `#e4e4e7` | `#2a2a2a` | 카드·입력 테두리, 구분선 |

### 브랜드 · 시맨틱

| 토큰 | 값 (공용) | 용도 |
|------|-----------|------|
| `--primary` | `#006fee` | 주요 액션, 포커스 링, 링크 색 |
| `--primary-h` | Light `#005bc4` / Dark `#338ef7` | primary hover 상태 |
| `--primary-fg` | `#ffffff` | primary 위 텍스트 |
| `--danger` | `#f31260` | 삭제·오류 |
| `--success` | `#17c964` | 정답·완료 |
| `--shadow` | Light `0 4px 24px rgba(0,0,0,0.08)` | 카드 그림자 |

### 알파 활용 관례

```css
/* primary 배경 tint */
rgba(0, 111, 238, 0.06)   /* 매우 연한 hover */
rgba(0, 111, 238, 0.08)   /* badge 배경 */
rgba(0, 111, 238, 0.1)    /* active 배경 */

/* danger tint */
rgba(243, 18, 96, 0.08)   /* hover */
rgba(243, 18, 96, 0.10)   /* 버튼 배경 */
rgba(243, 18, 96, 0.18–0.20) /* 버튼 hover */

/* success tint */
rgba(23, 201, 100, 0.10)  /* 버튼 배경 */
rgba(23, 201, 100, 0.20)  /* 버튼 hover */

/* 그리드 배경 패턴 (body::before) */
rgba(0, 111, 238, 0.03)   /* 기본 (대부분 앱) */
rgba(124, 106, 247, 0.03) /* 보라 계열 (chalkboard 등) */
```

---

## 3. 타이포그래피

### 기본 폰트 스택

```css
font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
/* 한국어 앱에서 Pretendard 추가 시 */
font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Inter', sans-serif;
```

### 코드·모노 (JetBrains Mono)

필요한 앱에서 직접 import.

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

```css
font-family: 'JetBrains Mono', monospace;
```

사용처: textarea, 코드 블록, 키보드 힌트(`.kbd`), 프롬프트 미리보기

### 크기 스케일 (앱 내 관례)

| 역할 | 크기 | 비고 |
|------|------|------|
| 앱 타이틀 (`.app-title`) | 26px | `font-weight: 700`, `letter-spacing: -0.03em` |
| 섹션 레이블 (`.fd-section-title`) | 11px | `font-weight: 700`, `letter-spacing: 0.12em`, uppercase |
| 앱 배지 (`.app-badge`) | 11px | `font-weight: 700`, `letter-spacing: 0.1em`, uppercase |
| 앱 설명 (`.app-desc`) | 14px | `color: var(--fg-muted)`, `line-height: 1.6` |
| 카드 제목 | 14px | `font-weight: 700` |
| 본문 텍스트 | 13–14px | |
| 보조·메타 정보 | 11–12px | `color: var(--fg-muted)` |
| 레이블 (`.fd-label`) | 12px | `font-weight: 600` |

---

## 4. 레이아웃

### 페이지 구조

```html
<body>
  <!-- 좌상단: 홈 버튼 -->
  <div class="top-overlay-left">
    <a href="/" class="overlay-btn">홈</a>
  </div>

  <!-- 우상단: 테마 + 공유 -->
  <div class="top-overlay">
    <button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()">💻</button>
    <button class="overlay-btn" onclick="shareCurrentPage()">공유</button>
  </div>

  <!-- 앱 콘텐츠 -->
  <div class="page-wrap">  <!-- 또는 앱별 root 클래스 -->
    <header class="app-header">
      <span class="app-badge">◆ 카테고리</span>
      <h1 class="app-title">앱 이름</h1>
      <p class="app-desc">짧은 설명</p>
    </header>
    <!-- 본문 -->
  </div>
</body>
```

### body 여백

```css
body {
  padding: 56px 1rem 5rem;   /* 상단 오버레이 여유 + 하단 */
  min-height: 100vh;
}
```

### 콘텐츠 폭

| 앱 유형 | max-width |
|---------|-----------|
| 일반 폼·카드 앱 | 440px |
| 리스트·에디터 앱 | 720px |
| 테이블·데이터 앱 | 800px |
| 전체화면 캔버스 | 없음 (fixed inset:0) |

### 그리드 배경 패턴

```css
body::before {
  content: '';
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(0,111,238,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,111,238,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none; z-index: 0;
}
```

콘텐츠는 `position: relative; z-index: 1;`로 그리드 위에 띄운다.

---

## 5. 컴포넌트

### 5-1. 오버레이 버튼 (`.overlay-btn`)

홈·테마·공유 등 우상단·좌상단 플로팅 버튼. `hero-theme.css`에 정의.

```html
<a href="/" class="overlay-btn">
  <svg …>…</svg>
  <span>Home</span>
</a>
```

- 모바일(≤ 540px): 텍스트 숨김, 아이콘만 표시
- 반투명 배경: `backdrop-filter: blur(8px)`

### 5-2. 앱 헤더 (`.app-header`)

```html
<header class="app-header">
  <span class="app-badge">◆ EDU</span>
  <h1 class="app-title">Flash Deck</h1>
  <p class="app-desc">플래시카드 덱을 만들고 반복 학습하세요</p>
</header>
```

배지 텍스트 관례: `◆ EDU`, `◆ TOOL`, `◆ SHARE` 등 카테고리 약어

### 5-3. 카드 (`.fd-card` / `.hero-card`)

```css
/* flash-deck 스타일 (권장) */
.fd-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
}

/* hero-theme.css 공통 클래스 */
.hero-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 1rem; /* 16px */
  transition: border-color 0.2s, box-shadow 0.2s;
}
```

### 5-4. 버튼

| 변형 | 클래스 | 설명 |
|------|--------|------|
| Primary | `.fd-btn .fd-btn-primary` | 파란 배경, 흰 글씨 |
| Ghost | `.fd-btn .fd-btn-ghost` | 테두리만, hover 시 primary 색 |
| Danger | `.fd-btn .fd-btn-danger` | 빨간 tint 배경 |
| Success | `.fd-btn .fd-btn-success` | 초록 tint 배경 |
| Small | `.fd-btn-sm` 추가 | 32px 높이, 8px 둥글기 |
| Icon | `.fd-btn-icon` | 32×32 정사각형, 아이콘 전용 |

```css
/* 기본 버튼 공통 */
.fd-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 18px; border-radius: 10px; border: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.15s; min-height: 40px;
}
```

`hero-theme.css`의 `.hero-btn` / `.hero-btn-ghost`는 16px 기준의 더 큰 버전.  
앱 내부 UI에는 `fd-btn` 계열, 공유·테마 오버레이에는 `overlay-btn` 사용.

### 5-5. 입력 필드

```css
/* 단일 줄 */
.fd-input {
  width: 100%; background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 12px; font-size: 14px;
  color: var(--fg); outline: none; transition: border-color 0.2s;
}
.fd-input:focus { border-color: var(--primary); }

/* 여러 줄 */
.fd-textarea {
  /* fd-input 속성 + */
  resize: vertical; min-height: 120px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; line-height: 1.6;
}
```

`hero-theme.css`의 `.hero-input`은 `font-size: 1rem`(iOS 자동 줌 방지)이 적용된 대형 버전.

### 5-6. 섹션 타이틀 (`.fd-section-title`)

```css
.fd-section-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--fg-muted); margin-bottom: 16px;
  display: flex; align-items: center; gap: 8px;
}
/* 오른쪽 구분선 */
.fd-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
```

### 5-7. 진행률 바

```css
.fd-progress-bar {
  height: 4px; background: var(--border); border-radius: 99px; overflow: hidden;
}
.fd-progress-fill {
  height: 100%; background: var(--primary); border-radius: 99px;
  transition: width 0.4s ease;
}
```

### 5-8. 모달

```css
.fd-modal-overlay {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.5); z-index: 200;
  align-items: center; justify-content: center; padding: 1rem;
}
.fd-modal-overlay.open { display: flex; }

.fd-modal {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 20px; padding: 28px; width: 100%; max-width: 380px;
  animation: scaleIn 0.2s ease;
}
```

### 5-9. 토스트

```html
<div id="fd-toast"></div>
```

```css
#fd-toast {
  position: fixed; bottom: 2rem; left: 50%;
  transform: translateX(-50%) translateY(1rem);
  background: var(--fg); color: var(--bg);
  padding: 10px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 600;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s, transform 0.2s; z-index: 9999;
}
#fd-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
```

```js
let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('fd-toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
```

`theme.js`가 자동으로 `fd-toast` ID를 찾아 재사용함.

### 5-10. 드롭다운

```css
.share-dropdown {   /* 또는 앱별 이름 */
  position: fixed; display: none; flex-direction: column;
  gap: 3px; padding: 6px; border-radius: 10px;
  background: var(--card-bg); border: 1px solid var(--border);
  z-index: 9500; min-width: 150px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.share-dropdown.open { display: flex; }

.dropdown-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 7px; border: none;
  background: none; color: var(--fg); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background 0.12s;
}
.dropdown-item:hover { background: rgba(0,111,238,0.08); color: var(--primary); }
```

### 5-11. 키보드 힌트 (`.kbd`)

```css
.kbd {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 5px; padding: 2px 7px; font-size: 10px;
  font-family: 'JetBrains Mono', monospace; color: var(--fg-muted);
  box-shadow: 0 1px 0 var(--border);
}
```

---

## 6. 애니메이션

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes popIn {
  0%   { transform: scale(0.9); opacity: 0; }
  60%  { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}
```

- 리스트 아이템 등장: `fadeUp 0.2–0.25s ease both`, `animation-delay: i * 0.03–0.05s`
- 모달 등장: `scaleIn 0.2s ease`
- 결과 아이콘: `popIn 0.5s cubic-bezier(0.4,0,0.2,1) both`
- 버튼/테두리 전환: `transition: all 0.15s`
- 배경 색 전환: `transition: background 0.2s ease, color 0.2s ease`

---

## 7. 테마 시스템

`theme.js`가 자동으로 처리. 별도 코드 불필요.

- 저장 키: `localStorage['vives-theme']` → `'auto' | 'light' | 'dark'`
- `cycleTheme()`: auto → light → dark → auto 순환
- `data-theme` 속성을 `<html>`에 설정
- 시스템 테마 변경 자동 감지 (auto 모드)

토글 버튼:
```html
<button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()">💻</button>
```

---

## 8. 공유 기능 (vives-share 패턴)

`/api/shorten` 엔드포인트로 URL 단축. 상세 구현은 `/vives-share` 스킬 참조.

- URL 해시 인코딩: `btoa(encodeURIComponent(JSON.stringify(payload)))` + base64url 변환
- 권한 레벨: `'view'` (보기 전용) / `'clone'` (복제 허용)
- 수신 측 디코딩 → `permission` 분기 → enterViewOnly 또는 openShareCloneModal

---

## 9. 반응형 브레이크포인트

| 구간 | 설명 |
|------|------|
| `≤ 480px` | 플립 카드 높이 축소 등 세부 조정 |
| `≤ 540px` | `.overlay-btn` 텍스트 숨김, 아이콘만 |

---

## 10. z-index 계층

| 값 | 요소 |
|----|------|
| `0` | 그리드 배경 패턴 (`body::before`) |
| `1` | 일반 콘텐츠 |
| `200` | 모달 오버레이 |
| `9500` | 드롭다운 |
| `9999` | 상단 오버레이(홈·테마), 토스트 |
| `10000` | 전체화면 뷰 |
