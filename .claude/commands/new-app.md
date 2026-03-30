---
description: byeduin VIVES에 새 미니앱 스캐폴딩 — 폴더+HTML 생성, 앱 목록 자동 등록
argument-hint: [app-slug] [category]
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# /new-app — 새 앱 스캐폴딩

사용자가 `/new-app` 명령을 실행했습니다. 인수: `$ARGUMENTS`

## 목표

byeduin VIVES 프로젝트에 새 미니앱을 추가합니다. 아래 단계를 순서대로 수행하세요.

---

## 단계 1: 정보 수집

인수가 없거나 불완전하면 다음 정보를 질문하세요:

1. **앱 슬러그** (영어 소문자, 하이픈): 예) `color-picker`, `mood-tracker`
2. **앱 제목** (한국어 또는 영어): 예) `컬러 피커`
3. **카테고리**: `edu` / `utility` / `creative` / `notion` 중 선택
4. **이모지**: 앱을 대표하는 이모지 1개
5. **한 줄 설명** (한국어): 예) `색상 코드를 선택하고 저장하는 도구`
6. **레이아웃 타입**:
   - `single` — 단일 중앙 컬럼 (book-share, timer 스타일)
   - `split` — 좌측 사이드바 + 우측 콘텐츠 (grid-maker 스타일)
   - `card` — 카드 그리드 목록 (flash-deck 스타일)

인수로 슬러그와 카테고리가 제공된 경우 나머지 정보만 질문하세요.

---

## 단계 2: 파일 생성

### 2-1. 앱 폴더와 index.html 생성

`public/{slug}/index.html`을 아래 템플릿으로 생성하세요.

**레이아웃 타입 `single` 템플릿:**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>{앱 제목} — byeduin</title>
  <link rel="stylesheet" href="/common/hero-theme.css">
  <script src="/common/theme.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 16px 80px;
    }

    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(0,111,238,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,111,238,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none; z-index: 0;
    }

    .page-wrap {
      max-width: 580px;
      width: 100%;
      position: relative;
      z-index: 1;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 0.25rem;
    }

    .subtitle {
      font-size: 0.875rem;
      color: var(--fg-muted);
      margin-bottom: 1.5rem;
    }

    /* 앱별 스타일 추가 */

    /* 토스트 */
    #toast {
      position: fixed;
      bottom: 2rem; left: 50%;
      transform: translateX(-50%) translateY(1rem);
      background: var(--fg); color: var(--bg);
      padding: 0.65rem 1.25rem;
      border-radius: 99px;
      font-size: 0.85rem; font-weight: 600;
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 9000; white-space: nowrap;
    }
    #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    @media (max-width: 540px) {
      .page-wrap { padding-top: 56px; }
      .overlay-btn span { display: none; }
    }
  </style>
</head>
<body>

  <!-- 상단 좌측: 홈 -->
  <div class="top-overlay-left">
    <a href="/" class="overlay-btn" title="byeduin VIVES 홈">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span>Home</span>
    </a>
  </div>

  <!-- 상단 우측: 테마·공유 -->
  <div class="top-overlay">
    <button id="themeToggleBtn" class="overlay-btn" onclick="cycleTheme()" title="보기 모드">💻</button>
    <button id="shareBtn" class="overlay-btn" onclick="shareCurrentPage()" title="공유">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>
      </svg>
      <span>공유</span>
    </button>
  </div>

  <div class="page-wrap">
    <h1>{이모지} {앱 제목}</h1>
    <p class="subtitle">{한 줄 설명}</p>

    <!-- 앱 콘텐츠 -->

  </div>

  <div id="toast"></div>

  <script>
    // 앱 로직

    function showToast(msg, duration = 2200) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), duration);
    }
  </script>
</body>
</html>
```

**레이아웃 타입 `split` 템플릿:** 좌측 `.sidebar` (280px) + 우측 `.canvas-area` flex 레이아웃으로 변경하세요.

**레이아웃 타입 `card` 템플릿:** `.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }` 구조로 생성하세요.

---

### 2-2. public/index.html APPS 배열 등록

`public/index.html`의 `const APPS = [` 배열에서 해당 카테고리 섹션 첫 번째 항목 앞에 새 항목을 추가하세요:

```js
{
  emoji: "{이모지}",
  title: "{앱 제목}",
  desc: "{한 줄 설명}",
  href: "/{slug}/",
  category: "{category}",
},
```

카테고리 주석 (`// --- 유틸리티 ---` 등) 바로 다음에 삽입하세요.

---

### 2-3. docs/DEVPLAN.md 업데이트

`docs/DEVPLAN.md` 파일 끝에 새 앱 섹션을 추가하세요:

```markdown
## {이모지} {앱 제목} (`/{slug}/`)
- [ ] 기본 UI 구현
- [ ] 핵심 기능 구현
- [ ] 테마/반응형 확인
```

---

## 단계 3: 완료 보고

다음 내용을 출력하세요:

```
✅ 앱 생성 완료
- 파일: public/{slug}/index.html
- APPS 등록: category={category}
- 개발 서버: http://localhost:3000/{slug}/
```
