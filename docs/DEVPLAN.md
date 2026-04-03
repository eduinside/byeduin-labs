# byeduin VIVES — 개발 계획

> 최초 작성: 2026-03-25 / 최종 업데이트: 2026-04-04 (전체 앱 UX 개선 완료)

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

### MD Editor (`/md-editor/`)

#### 개요
| 항목 | 내용 |
|---|---|
| 앱 이름 | **MD Editor** |
| 배지 | `◆ Utility` |
| 경로 | `/md-editor/` |
| CDN | marked.js (cdn.jsdelivr.net) |
| localStorage | 없음 (세션 전용) |

#### 주요 기능
- **간편한 마크다운 편집** (JetBrains Mono 에디터 + 편집/미리보기 모드 전환)
- 실시간 HTML 미리보기 (marked.js, GFM + breaks)
- 로컬 `.md` 파일 불러오기 (FileReader API)
- `.md` 파일 다운로드 (Blob)
- **도움말 모달**: 앱 설명 우측 버튼 → 마크다운 빠른 참조 (헤더/굵기/코드/목록/표 등)
- **공유** (vives-share 패턴): payload `{ data: { content, filename }, permission }` → base64url → Short.io 단축
  - payload > 8KB면 단축 URL 생략 + 경고 토스트
  - `view`: 보기 전용 진입 (textarea readonly, `.is-view-only`)
  - `clone`: "보기 전용 / 내 편집기로 가져오기" 선택 모달

#### 레이아웃
- **데스크톱** (≥768px): CSS Grid `1fr 1fr` — 좌 편집 / 우 미리보기
- **모바일** (<768px): 탭 전환 (편집 / 미리보기)

---

### QR Master (`/qr/`)
- 생성하기 / 스캔하기 2탭 → **생성하기 / 스캔하기 / 멀티 스캔** 3탭으로 확장
- 스캔 히스토리 로컬스토리지 저장
- 두 탭 패널 고정 높이 통일 완료

#### 추가 기능
**PWA (오프라인 캐시)**
- `manifest.json` + `sw.js` (서비스워커, cache-first 전략)
- 첫 로드 후 오프라인/재방문 시 캐시에서 즉시 로드

**생성하기 탭 — Short.io 단축 URL**
- QR 생성 결과 아래 "🔗 단축 URL 생성" 버튼
- 입력 URL을 `/.netlify/functions/shorten`으로 단축 후 클립보드 복사
- URL이 아닌 텍스트면 버튼 비표시

**멀티 스캔 탭**
- 카메라로 QR 코드를 연속 스캔 (jsQR + 그리드 기반 다중 감지, requestAnimationFrame 루프)
- 스캔 성공 상자: 5초 또는 X 버튼으로 닫음 → 새 QR 감지 시 다시 표시
- 각 스캔 후: URL 확인 + 설명 입력 → "다음 스캔" or "완료"
- 누적 목록 표시
  - 최근 발견한 항목이 맨 위에 (역순 렌더링)
  - URL + 설명, 개별 삭제 가능
  - 목록 옆 "지우기" 버튼으로 전체 초기화
- "📄 링크 정리 (MD Editor로)" — 스캔 결과를 마크다운으로 변환해 MD Editor로 전송:
  ```markdown
  # QR 스캔 결과
  > YYYY-MM-DD · N개 항목

  1. [URL]
  - 링크: https://...
  - 설명: 사용자 입력
  ```
- 탭 전환 시 각 카메라 자동 정지 (충돌 방지)

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

#### 개요
| 항목 | 내용 |
|---|---|
| 앱 이름 | **YT Thumbnail** |
| 배지 | `◆ Creative` |
| 경로 | `/yt-thumb/` |
| 설명 | 유튜브 썸네일 추출 및 플레이리스트 아카이빙 도구 |
| API | YouTube Data API v3 |

#### 기능

**UI 구조: 항상 3탭 표시**
- **탭 1: 썸네일** — 단일 영상 썸네일 추출
- **탭 2: 재생목록** — 플레이리스트 영상 목록
- **탭 3: 히스토리** — 최근 검색 기록

**URL 분석 및 탭 활성화**
- URL 입력 후 **화살표 버튼** 클릭 → URL 분석
- **듀얼 URL** (영상ID + 재생목록ID): 모든 탭 활성화
- **영상 URL만**: 썸네일 탭만 활성화, 재생목록 탭 비활성화(disabled)
- **재생목록 URL만**: 재생목록 탭만 활성화, 썸네일 탭 비활성화(disabled)

**탭 1: 단일 영상**
- 유튜브 URL 입력 → 정규식 추출 (`videoId`)
- 썸네일 2종 표시: maxresdefault (1080p) + hqdefault (720p, 필수)
- URL 복사 버튼 (피드백: 체크마크 표시)
- 탭 클릭 시 `extractThumbnail()` 자동 호출

**탭 2: 플레이리스트**
- 플레이리스트 URL 입력 → `list=PLxxxxx` 추출
- 탭 클릭 시 `fetchPlaylist()` 자동 호출
  - Netlify Function 호출, 페이지네이션 자동 처리 (50개/페이지)
  - 플레이리스트 제목 + 총 영상 수 표시
- 영상 목록: 순번·썸네일·제목·설명 일부·링크
- 두 액션 버튼:
  1. **[MD 편집기로 열기]** → md-editor에 URL 해시로 전송
  2. **[ZIP 다운로드]** → JSZip 생성

**탭 3: 히스토리**
- 최근 검색 목록 표시 (통합 히스토리)
- 항목 클릭 시 URL 복원, 해당 탭 활성화
- 삭제 및 전체 삭제 기능

#### Netlify Function 1: `yt-playlist.js`
```
POST /.netlify/functions/yt-playlist
Body: { playlistId, pageToken? }

1. process.env.YOUTUBE_API_KEY 읽기
2. playlists.list → 플레이리스트 제목
3. playlistItems.list (50개/페이지) → 영상 정보
4. Response: { playlistTitle, items[], nextPageToken }
```

#### Netlify Function 2: `yt-thumb-img.js`
```
GET /.netlify/functions/yt-thumb-img?id={videoId}&q={quality}

1. videoId 검증 (11자리 정규식)
2. quality 검증 (maxres|hq|mq|sd)
3. img.youtube.com 이미지 fetch → 반환 (image/jpeg, Cache-Control)
4. CORS 우회용 서버 프록시
```

#### md-editor 연동
```javascript
const encoded = btoa(encodeURIComponent(JSON.stringify({
  data: { content: mdContent, filename: '플레이리스트명.md' },
  permission: 'clone'
}))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
window.open(`/md-editor/#share=${encoded}`, '_blank');
```

#### 환경변수
| 키 | 위치 | 용도 |
|---|---|---|
| `YOUTUBE_API_KEY` | Netlify 환경변수 + `.env` (로컬) | YouTube Data API v3 |

#### localStorage 키
- `youtube_thumbnail_history_v2` — 레거시 동영상 ID 배열 (호환성 유지)
- `youtube_unified_history` — 통합 히스토리 (영상 + 재생목록)
  - 구조: `[{ type: 'video'|'playlist', data: 'id'|'url', timestamp }]`
  - 최대 30개 항목 저장

---

## YT Thumbnail 탭 기반 UI 최종 개선 (2026-04-04)

### 개요
기존의 듀얼 URL 처리에서 두 개의 UI가 나란히 표시되는 구조를 개선하여, **항상 3탭 인터페이스**로 통합.
- 탭 아래의 모든 버튼 제거 (자동 로드)
- 화살표 버튼만으로 모든 작동 제어
- URL 타입에 따른 탭 활성화/비활성화

### 구현 내용

**변경 구조:**

| URL 타입 | 탭 상태 | 동작 |
|---|---|---|
| **듀얼** (영상+재생목록) | 모두 활성화 | 썸네일 탭이 기본값, 탭 클릭 시 자동 로드 |
| **영상만** | 썸네일만 활성, 재생목록 비활성 | 썸네일 자동 추출 |
| **재생목록만** | 재생목록만 활성, 썸네일 비활성 | 탭 클릭 시 재생목록 로드 |

**HTML 변경:**
```html
<!-- 3탭만 표시, 버튼 제거 -->
<div id="dual-mode-tabs" style="display:none;">
  <button onclick="switchDualModeTab('thumbnail')">썸네일</button>
  <button onclick="switchDualModeTab('playlist')">재생목록</button>
  <button onclick="switchDualModeTab('history')">히스토리</button>
</div>

<!-- #single-ui와 #playlist-ui는 버튼 없이 콘텐츠만 표시 -->
<div id="single-ui" style="display:none; margin-top:1rem;">
  <div id="result"></div>
</div>

<div id="playlist-ui" style="display:none; margin-top:1rem;">
  <div id="plResult"></div>
</div>
```

**JavaScript 변경:**
```js
let currentMode = null; // 'video', 'playlist', 'dual'

function analyzeUrl() {
  const url = document.getElementById('youtubeUrl').value.trim();
  const isVideo = YT_REGEX.test(url);
  const isList = PL_REGEX.test(url);

  if (isVideo && isList) {
    currentMode = 'dual';
    document.getElementById('dual-mode-tabs').style.display = 'block';
    // 모든 탭 활성화
    playlistBtn.disabled = false;
    playlistBtn.style.opacity = '1';
    thumbnailBtn.disabled = false;
    thumbnailBtn.style.opacity = '1';
    switchDualModeTab('thumbnail');
  } else if (isVideo) {
    currentMode = 'video';
    document.getElementById('dual-mode-tabs').style.display = 'block';
    // 썸네일만 활성화
    thumbnailBtn.disabled = false;
    thumbnailBtn.style.opacity = '1';
    playlistBtn.disabled = true;
    playlistBtn.style.opacity = '0.5';
    playlistBtn.style.cursor = 'not-allowed';
    switchDualModeTab('thumbnail');
  } else if (isList) {
    currentMode = 'playlist';
    document.getElementById('dual-mode-tabs').style.display = 'block';
    // 재생목록만 활성화
    playlistBtn.disabled = false;
    playlistBtn.style.opacity = '1';
    thumbnailBtn.disabled = true;
    thumbnailBtn.style.opacity = '0.5';
    thumbnailBtn.style.cursor = 'not-allowed';
    switchDualModeTab('playlist');
  }
}

function switchDualModeTab(tab) {
  // 탭 활성화 상태 유지하면서 클릭된 탭 활성화
  if (tab === 'thumbnail' && !thumbnailBtn.disabled) {
    singleUi.style.display = 'block';
    playlistUi.style.display = 'none';
    extractThumbnail();  // 자동 로드
  } else if (tab === 'playlist' && !playlistBtn.disabled) {
    playlistUi.style.display = 'block';
    singleUi.style.display = 'none';
    fetchPlaylist();  // 자동 로드
  } else if (tab === 'history') {
    historySection.style.display = 'block';
    singleUi.style.display = 'none';
    playlistUi.style.display = 'none';
  }
}
```

### 주요 특징

1. **통합 인터페이스**
   - 항상 3탭만 표시
   - 탭 아래에 버튼 없음 (UI 단순화)
   - 화살표 버튼이 URL 분석의 유일한 제어 요소

2. **스마트 탭 활성화**
   - URL 타입 자동 감지
   - 불필요한 탭은 비활성화 (disabled, 회색 표시)
   - 클릭 방지로 UX 혼란 최소화

3. **자동 콘텐츠 로드**
   - 탭 클릭 시 자동으로 `extractThumbnail()` 또는 `fetchPlaylist()` 호출
   - 추가 버튼 클릭 불필요

4. **히스토리 통합**
   - 세 번째 탭에서 영상+재생목록 통합 히스토리 표시
   - 항목 클릭 시 URL 복원 및 해당 탭 자동 활성화

### 검증 결과

✅ **듀얼 URL** — 3탭 모두 활성화, 썸네일 자동 추출
✅ **영상 URL** — 썸네일 탭만 활성화, 재생목록 탭 비활성화 (회색)
✅ **재생목록 URL** — 재생목록 탭만 활성화, 썸네일 탭 비활성화 (회색)
✅ **버튼 제거** — 탭 아래에 버튼 없음
✅ **자동 로드** — 탭 클릭 시 콘텐츠 자동 로드

---

## MD Editor 개선사항 (2026-04-04)

### 보기(View) 드롭다운 및 UI/UX 개선

#### 개요
- **보기 드롭다운**: 편집만 / 미리보기만 / 둘 다 (3가지 모드)
- **모바일 레이아웃 개선**: 제목 영역과 버튼을 별도 줄로 분리
- **드롭다운 상태 관리**: 여러 드롭다운 동시 열림 방지
- **단일 창 모드 전체 폭 표시**: 편집만/미리보기만 선택 시 하단 영역 전체 폭 차지
- **버튼 텍스트 가운데 정렬**: toolbar-btn 글자 정렬 개선
- **저장 버튼 항상 활성화**: 초기 페이지 로드 시에도 저장 버튼 클릭 가능

#### 구현 내용

**HTML 변경:**
```html
<!-- 보기 드롭다운 메뉴 -->
<button class="toolbar-btn" onclick="toggleViewMenu()" title="보기">
  보기 ▾
</button>

<div id="view-dropdown" class="toolbar-dropdown">
  <button onclick="setViewMode('edit-only')">편집만</button>
  <button onclick="setViewMode('preview-only')">미리보기만</button>
  <button onclick="setViewMode('both')">둘 다</button>
</div>
```

**CSS 변경:**
```css
/* 보기 드롭다운 스타일링 */
#view-dropdown {
  position: fixed;
  display: none;
  flex-direction: column;
  z-index: 9500;
  min-width: 120px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

#view-dropdown.open {
  display: flex;
}

/* 모바일 레이아웃: 제목과 버튼을 별도 줄로 */
@media (max-width: 767px) {
  .md-toolbar {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .md-title {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .toolbar-btn {
    flex: 1;
    min-width: 60px;
  }
}

/* 버튼 텍스트 가운데 정렬 */
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;  /* 추가됨 */
}

/* 단일 창 모드: 그리드 동적 조정 */
.md-split {
  display: grid;
  grid-template-columns: 1fr 1fr;  /* 기본값: 둘 다 모드 */
  gap: 1rem;
}

/* 편집만/미리보기만 모드: 1fr로 조정 */
.md-split.single-pane {
  grid-template-columns: 1fr;
}
```

**JavaScript 변경:**
```javascript
let viewMode = 'both';  // 기본값: 둘 다

function setViewMode(mode) {
  viewMode = mode;
  const paneEdit = document.getElementById('paneEdit');
  const panePreview = document.getElementById('panePreview');
  const mdSplit = document.querySelector('.md-split');

  _closeViewMenu();

  if (mode === 'edit-only') {
    paneEdit.style.display = 'block';
    panePreview.style.display = 'none';
    mdSplit.classList.add('single-pane');
    mdSplit.style.gridTemplateColumns = '1fr';
  } else if (mode === 'preview-only') {
    paneEdit.style.display = 'none';
    panePreview.style.display = 'block';
    mdSplit.classList.add('single-pane');
    mdSplit.style.gridTemplateColumns = '1fr';
  } else {
    paneEdit.style.display = 'block';
    panePreview.style.display = 'block';
    mdSplit.classList.remove('single-pane');
    mdSplit.style.gridTemplateColumns = '1fr 1fr';
  }

  // localStorage에 선택된 모드 저장
  localStorage.setItem('md-editor-view-mode', mode);
}

function toggleViewMenu() {
  closeAllMenus();  // 다른 드롭다운 먼저 닫기
  const dropdown = document.getElementById('view-dropdown');
  dropdown.classList.toggle('open');
  _viewMenuOpen = dropdown.classList.contains('open');
}

function _closeViewMenu() {
  const dropdown = document.getElementById('view-dropdown');
  dropdown.classList.remove('open');
  _viewMenuOpen = false;
}

// 드롭다운 상태 통합 관리
function closeAllMenus() {
  document.getElementById('open-dropdown')?.classList.remove('open');
  document.getElementById('save-dropdown')?.classList.remove('open');
  document.getElementById('view-dropdown')?.classList.remove('open');
  document.getElementById('share-dropdown')?.classList.remove('open');
  _openMenuOpen = false;
  _saveMenuOpen = false;
  _viewMenuOpen = false;
  _shareMenuOpen = false;
}

// 저장 버튼 항상 활성화
function updateSaveButtonState() {
  const saveMdOpt = document.getElementById('saveMdOpt');
  const saveHtmlOpt = document.getElementById('saveHtmlOpt');
  const saveLsOpt = document.getElementById('saveLsOpt');

  // 저장 버튼은 항상 활성화 (클릭 시 내용 확인)
  saveMdOpt.disabled = false;
  saveHtmlOpt.disabled = false;
  saveLsOpt.disabled = false;
}
```

#### 특징
1. **보기 모드 선택**: 사용자가 편집 또는 미리보기에만 집중 가능
2. **모바일 최적화**: 제목과 버튼이 명확하게 분리되어 터치하기 쉬움
3. **드롭다운 충돌 방지**: `closeAllMenus()` 함수로 중복 열림 방지
4. **전체 폭 활용**: 단일 창 모드에서 grid 동적 조정으로 화면 최대 활용
5. **버튼 텍스트 정렬**: `justify-content: center`로 모든 버튼 텍스트 균등 정렬
6. **저장 버튼 항상 활성화**: 초기 로드 상태에서도 사용자가 저장할 수 있음 (내용 유효성은 저장 함수에서 검증)

---

### 브라우저 로컬 저장 모드

#### 개요
- **열기 드롭다운**: 기존 단순 파일 열기 → 드롭다운 (파일 열기 / 브라우저에서 열기)
- **저장 옵션**: 저장 드롭다운에 "브라우저에 저장" 옵션 추가
- **다중 문서 관리**: localStorage에서 여러 문서 저장/관리
- **중복 파일명 처리**: 동일한 파일명 입력 시 자동 번호 붙이기 (예: `파일.md` → `파일(1).md`)

#### localStorage 구조
```js
// 새 키: md-editor-all-docs
// 형식: 배열 구조
[
  {
    id: "1712211000000",  // timestamp ID
    filename: "파일.md",
    content: "마크다운 내용...",
    savedAt: "2026-04-04T12:30:00.000Z"
  },
  ...
]
```

#### 기능 명세
- **`saveToLocalStorage()`**: 파일명 입력 후 저장
  - 같은 이름 파일 확인 → 있으면 `(1)`, `(2)` 등 자동 번호
  - 저장 성공 토스트: `"파일명"으로 저장되었습니다 ✓`

- **`openLoadModal()`**: 저장된 파일 목록 모달 표시
  - 모달 배경 어두운 오버레이 (`rgba(0,0,0,0.5)`)
  - 파일 목록: 이름 / 저장 시간 / 삭제 버튼
  - 시간순 역정렬 (최신 먼저)

- **`loadDocById(id)`**: 파일 클릭 시 문서 로드
  - 현재 내용 있으면 `confirm()` 후 로드

- **`deleteDocById(id)`**: 확인 후 삭제, 모달 새로고침

### 공유 링크 모바일 뷰 수정

#### 문제
- 모바일에서 공유 링크 열기 시 편집 탭과 미리보기 탭이 동시 표시됨

#### 해결
- HTML 수정: `#panePreview`에서 기본값 `mobile-active` 클래스 제거
- JS 수정: 공유 링크 로드 후 `switchMobileTab('preview')` 호출
  ```js
  if (payload.permission === 'view') {
    enterViewOnly();
    switchMobileTab('preview');  // 미리보기 탭 기본값
  } else {
    openCloneModal(currentFilename);
    switchMobileTab('preview');  // 미리보기 탭 기본값
  }
  ```

---

## QR Master 개선사항 (2026-04-04)

### 마지막 탭 상태 저장/복환

#### 기능
- 사용자가 마지막으로 선택한 탭 (생성/스캔) 저장
- 페이지 새로고침 시 이전 탭 상태 복원

#### 구현
```js
const QR_TAB_KEY = 'qr-last-tab';

function switchTab(tab) {
  // ... 기존 탭 전환 로직
  localStorage.setItem(QR_TAB_KEY, tab);
}

// DOMContentLoaded 이후
const savedTab = localStorage.getItem(QR_TAB_KEY);
if (savedTab === 'scan' || savedTab === 'generate') {
  switchTab(savedTab);
}
```

### 스캔 URL 페이지 제목 추출 + MD Editor 전송

#### 개요
- 스캔된 URL이 유효할 때 백그라운드에서 페이지 제목 추출
- 제목을 다중 마크다운 내보내기 시 링크 텍스트로 사용

#### 새로운 Netlify 함수: `get-page-title.js`
```js
// POST /.netlify/functions/get-page-title
// Body: { url: "https://..." }
// Response: { title: "페이지 제목" | null }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let url;
  try {
    ({ url } = JSON.parse(event.body));
    new URL(url);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'url 필드 필요' }) };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);  // 5초 타임아웃
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; byeduin-bot/1.0)' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const html = await res.text();
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = m ? m[1].trim().replace(/\s+/g, ' ') : null;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: null }),
    };
  }
};
```

#### QR Master 클라이언트 구현
```js
const pageTitleCache = {};  // 인메모리 캐시

async function fetchPageTitle(url) {
  if (url in pageTitleCache) return pageTitleCache[url];
  try {
    const res = await fetch('/.netlify/functions/get-page-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    pageTitleCache[url] = (await res.json()).title || null;
  } catch {
    pageTitleCache[url] = null;
  }
  return pageTitleCache[url];
}

// 스캔 성공 후 백그라운드 fetch (fire-and-forget)
try {
  new URL(code);
  fetchPageTitle(code);  // 비동기, 기다리지 않음
} catch {}

// 다중 마크다운 내보내기 시
function exportMultiMd() {
  // ...
  const title = pageTitleCache[item.url];
  const linkText = item.desc || title || item.url;
  md += `${idx + 1}. [${linkText}](${item.url})\n`;
}
```

#### 특징
- **백그라운드 제목 추출**: 화면 변화 없음, 페이지 간섭 없음
- **인메모리 캐시**: 세션 내에서 중복 요청 방지
- **제목 폴백**: 제목 없으면 기존 URL 텍스트 사용
- **타임아웃**: 5초 이상 응답 없으면 null 처리

---

## Chalkboard 개선사항 (2026-04-04)

### 더블클릭으로 편집

#### 텍스트 더블클릭
- 기존: 단일 클릭 후 선택 → 컨텍스트 메뉴에서 편집 선택
- 개선: **더블클릭** → 즉시 편집 모드 진입 (contentEditable 활성화)

```js
// buildTextEl() 함수 내 추가
div.addEventListener('dblclick', e => {
  e.stopPropagation();
  if (viewOnlyBoard) return;
  selectEl(el.id, 'text');
  startEdit(el.id);  // 기존 편집 함수 재활용
});
```

#### 선 더블클릭
- 기존: 선 클릭 후 컨텍스트 메뉴에서 색상 변경
- 개선: **더블클릭** → 즉시 컨텍스트 메뉴 표시

```js
// buildLineEl() 함수 내 hit 영역에 추가
hit.addEventListener('dblclick', e => {
  e.stopPropagation();
  if (viewOnlyBoard) return;
  selectEl(el.id, 'line');
  showCtx(el.id, 'line');  // 컨텍스트 메뉴 즉시 표시
});
```

#### 특징
- 모바일에서 더블클릭은 미지원 (데스크톱 중심)
- 보기 전용 모드 (`viewOnlyBoard`) 체크로 권한 보호
- 기존 `startEdit()`, `showCtx()` 함수 재활용

---

## Book Share 개선사항 (2026-04-04)

### 반응형 너비 조정

#### 문제
- ISBN 입력 전: 빈 화면이 매우 넓게 보임
- 데이터 로드 후: 테이블 때문에 더 넓은 공간 필요

#### 해결
```css
.page-wrap {
  max-width: 440px;   /* 기존: 580px → 440px (QR Master 수준) */
  width: 100%;
  transition: max-width 0.3s ease;
  margin: 0 auto;
  padding: 1rem;
}

.page-wrap.wide {
  max-width: 800px;   /* 테이블 표시 시 확장 */
}
```

```js
// renderTable() 함수 내 수정
function renderTable() {
  const pageWrap = document.querySelector('.page-wrap');

  if (list.length === 0) {
    section.style.display = 'none';
    pageWrap.classList.remove('wide');
    return;
  }

  section.style.display = '';
  pageWrap.classList.add('wide');
  // ... 테이블 렌더링
}
```

#### 특징
- **초기 상태**: 440px (단순하고 깔끔)
- **데이터 있을 때**: 800px (테이블 충분한 공간)
- **전환 애니메이션**: `max-width` transition 0.3s
- **모바일**: 테이블의 기존 `overflow-x: auto` 가로 스크롤로 대응

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
- **덱 이름 변경**: 덱 뷰 헤더 연필 버튼 → 인라인 입력, Enter 저장 / Esc 취소 (자동저장 토스트)

**카드 입력**
- 단건 입력 (앞면/뒷면 필드, Enter 지원)
- 일괄 입력 (`앞면 :: 뒷면` 형식, 토글 패널)
- 카드 삭제
- **카드 순서 변경**: 각 카드 행 ↑ / ↓ 버튼, 첫/마지막 카드는 해당 방향 비활성화

**덱 공유** (vives-share 스킬 패턴)
- 덱 뷰 헤더 공유 버튼 → 드롭다운: **보기 전용** / **복제 허용** 선택
- payload: `{ data: { name, cards }, permission: 'view' | 'clone' }` → base64url → Short.io 단축
- `view` 링크 수신: 모달 없이 바로 보기 전용 진입 (`is-view-only` CSS 클래스)
- `clone` 링크 수신: "보기 전용 | 복제하기" 선택 모달
- 보기 전용 중 localStorage 쓰기 완전 차단 (mutation guard × 3 + markCard / showResult 분기)
- 복제 시 `[사본] 덱이름` → localStorage → 일반 덱으로 열림
- 우상단 공유 버튼은 현재 페이지 URL 복사 (덱 공유와 별개)

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

---

## 향후 개발 가능 기능 인사이트

### **1. 컨텐츠 생성 도구 확장**

#### MD Editor
- **PDF/Word 내보내기** — marked.js → pdfkit 또는 docx 라이브러리
- **템플릿 라이브러리** — 보일러플레이트 (이력서, 보고서, 제안서)
- **다크 모드 마크다운** — 특정 주제에 따른 렌더링 스타일
- **AI 요약/교정** — 외부 API (OpenAI) 연동

#### YT Thumbnail
- **썸네일 편집 기능** — 크롭, 텍스트 오버레이, 필터
- **배치 처리** — 여러 영상 한 번에 다운로드
- **썸네일 생성 AI** — 자동 최적 썸네일 추천

---

### **2. 협업 & 공유 강화**

- **실시간 협업** — WebSocket 기반 동시 편집 (MD Editor, Chalkboard)
- **버전 관리** — 저장 이력, 변경점 추적
- **권한 관리** — 읽기/쓰기 세분화, 만료 시간 설정
- **활동 피드** — 공유된 문서의 접근/수정 기록
- **댓글 & 반응** — 협업 중 피드백

---

### **3. 학습 도구 지능화**

#### Flash Deck
- **AI 문제 생성** — 학습 콘텐츠 → 자동 문제 생성
- **적응형 학습** — 정답률 기반 난이도 조절
- **학습 분석** — 진도율, 약점 분석, 추천 학습 시간
- **음성 입력** — 카드 발음 연습, TTS 피드백

#### Chalkboard
- **필기 인식** → 텍스트 변환 (OCR)
- **손글씨 → LaTeX** — 수식 자동 인식

---

### **4. 외부 통합**

- **Google Drive 연동** — 파일 직접 저장/불러오기
- **Notion API 직접 연동** — "Notion Image DL"과 역방향
- **Slack Bot** — 공유 링크 미리보기, 앱 실행
- **Instagram/Pinterest** — 썸네일 직접 업로드

---

### **5. AI/자동화**

- **스마트 요약** — 장문 콘텐츠 → 핵심 정리
- **이미지 배경 제거** — YT Thumbnail 썸네일 편집
- **자동 자막 생성** — YT 영상 설명 → 자막
- **OCR 도구** — 이미지 → 텍스트 추출

---

### **6. 모바일 & 오프라인**

- **PWA 확대** — 모든 앱 오프라인 지원
- **모바일 전용 UI** — 터치 최적화 (드로잉, 제스처)
- **동기화** — 온/오프라인 자동 병합
- **네이티브 앱 래퍼** — Tauri 또는 Capacitor

---

### **7. 성능 & 접근성**

#### 성능
- **코드 스플리팅** — 탭별 동적 로딩
- **이미지 최적화** — WebP, AVIF 포맷
- **서비스 워커 확대** — 모든 에셋 캐싱
- **번들 분석** — 불필요한 의존성 제거

#### 접근성
- **스크린 리더 최적화** — ARIA 레이블 추가
- **키보드 네비게이션** — Tab/Shift+Tab 완전 지원
- **색상 대비 개선** — WCAG AA 준수
- **다국어** — i18n 프레임워크 (한영일중 등)

---

### **8. 엔터프라이즈 기능**

- **사용자 계정 & 인증** — Firebase Auth, NextAuth.js
- **팀 관리** — 조직, 권한, 감사 로그
- **API 제공** — 외부 시스템 통합용
- **분석 대시보드** — 사용 통계, 성능 모니터링

---

### **9. 도메인별 심화**

#### 교육
- **온라인 강의 플랫폼** — 수강생 관리, 과제 제출
- **퀴즈/시험** — 자동 채점, 난제 분석
- **진도 추적** — 개인별 학습 경로

#### 크리에이티브
- **이미지 컬렉션** — 썸네일 라이브러리, 필터
- **디자인 토큰** — 색상, 폰트 팔레트 관리
- **프로토타이핑** — Grid Maker → 프로토타입 변환

#### 업무
- **일정 관리** — 타이머 ↔ 캘린더 통합
- **휴식 추적** — 생산성 리포트
- **자동화 워크플로우** — Zapier/IFTTT 연동

---

### **10. 기술 부채 개선**

- **TypeScript 도입** — 타입 안정성
- **테스트 커버리지** — Jest, Vitest
- **설정 관리** — 환경변수 통합화
- **문서화** — JSDoc, Storybook
- **CI/CD 강화** — 자동 배포, 롤백 기능

---

## 우선순위 제안

**높음** (3개월 내)
1. PDF/Word 내보내기 (MD Editor)
2. 실시간 협업 기본 (WebSocket)
3. 모바일 UI 최적화

**중간** (3-6개월)
1. AI 문제 생성 (Flash Deck)
2. Google Drive 연동
3. 접근성 개선 (WCAG AA)

**낮음** (6개월 이후 / 선택사항)
1. 사용자 계정 & 팀 관리
2. 네이티브 앱 래퍼
3. API 공개
