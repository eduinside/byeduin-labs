---
name: vives-share
description: >
  Implements URL-based sharing for static web apps in the byeduin VIVES project.
  Use this skill whenever adding a share feature to any app in the project,
  or when the user mentions "공유 기능", "share link", "URL 공유", or wants
  users to share app state via a link. Covers the full pattern:
  base64url encoding of state into the URL hash (#share=...), short.io URL
  shortening via the existing /.netlify/functions/shorten proxy, permission
  levels (보기 전용 / 복제 허용) embedded in the payload, and recipient-side
  decoding with view-only mode or a modal — all consistent with the patterns
  already used in book-share and chalkboard.
---

# VIVES URL Share Pattern

This skill codifies the sharing pattern used in book-share and chalkboard.
Follow these steps when adding share to a new app or extending an existing one.

## Step 1: Gather requirements

Before writing code, clarify:

- **무엇을 공유하나?** 공유할 앱 상태의 필드 목록 (예: elements, type, name)
- **어떤 권한을 지원하나?** 보통 두 가지:
  - `view` — 수신자는 보기만 가능, localStorage에 저장 안 됨
  - `clone` — 수신자가 복제해서 자기 데이터로 저장 가능
- **수신자 UX:**
  - `view` → 모달 없이 바로 보기 전용 모드 진입
  - `clone` → "보기 전용 | 복제하기" 선택 모달 표시

---

## Step 2: 인코딩 (발신 측)

`permission` 포함해서 base64url로 인코딩 후 URL 해시에 삽입한다.

```js
function buildShareURL(permission) {
  const payload = JSON.stringify({
    // 공유할 상태 필드들을 여기에
    data: getAppState(),
    permission,          // 'view' | 'clone'
  });
  const encoded = btoa(encodeURIComponent(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${location.origin}/<app-path>/#share=${encoded}`;
}
```

`getAppState()`를 실제 상태를 반환하는 함수로 교체한다.
수신자 재구성에 필요한 것만 포함해 페이로드를 최소화한다.

---

## Step 3: 단축 URL + 클립보드 복사 (발신 측)

`/.netlify/functions/shorten`은 이미 배포된 프록시다. **재구현하지 않는다.**

```js
async function doShare(permission) {
  closeShareMenu();
  const longURL = buildShareURL(permission);
  if (!longURL) return;
  const btn = document.getElementById('btn-share');
  btn.disabled = true;
  try {
    const res = await fetch('/.netlify/functions/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longURL }),
    });
    const data = await res.json();
    if (!res.ok || !data.shortURL) throw new Error();
    await navigator.clipboard.writeText(data.shortURL);
    showToast('링크가 복사되었습니다 ✓');
  } catch {
    try {
      await navigator.clipboard.writeText(longURL);
      showToast('링크가 복사되었습니다 (단축 미적용)');
    } catch { showToast('공유에 실패했습니다.'); }
  } finally { btn.disabled = false; }
}
```

---

## Step 4: 공유 버튼 UI (발신 측)

모달이 아닌 **저장 드롭다운과 동일한 스타일의 드롭다운**으로 구현한다.

### HTML

```html
<!-- 툴바에 추가 -->
<button id="btn-share" class="tb-btn" onclick="toggleShareMenu(event)" title="공유">
  <svg width="14" height="14" ...><!-- 공유 아이콘 --></svg>
  공유
  <svg width="10" height="10" ...><polyline points="6 9 12 15 18 9"/></svg>
</button>

<!-- save-dropdown의 형제 요소로 추가 -->
<div id="share-dropdown">
  <button class="save-opt" onclick="doShare('view')">
    <svg ...><!-- 눈 아이콘 --></svg> 보기 전용
  </button>
  <button class="save-opt" onclick="doShare('clone')">
    <svg ...><!-- 복제 아이콘 --></svg> 복제 허용
  </button>
</div>
```

### CSS

```css
#share-dropdown {
  position: fixed; display: none; flex-direction: column;
  gap: 3px; padding: 6px; border-radius: 10px;
  border: 1px solid transparent; z-index: 9500;
  min-width: 150px; box-shadow: 0 4px 20px rgba(0,0,0,0.45);
}
#share-dropdown.open { display: flex; }
```

### JS (toggleShareMenu)

`toggleSaveMenu`와 동일한 구조로 작성한다.
- 보드 타입에 맞는 색상 적용 (BS[board.type])
- btn-share 아래에 위치 (`getBoundingClientRect()`)
- 외부 클릭 시 닫기 (`document.addEventListener('click', ...)`)

---

## Step 5: 디코딩 (수신 측)

페이지 로드 시 `#share=` 해시를 감지한다.

```js
(function init() {
  const hash = location.hash;
  if (hash.startsWith('#share=')) {
    const encoded = hash.slice(7);
    try {
      const raw = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const pad = (4 - raw.length % 4) % 4;
      const payload = decodeURIComponent(atob(raw + '='.repeat(pad)));
      const shared = JSON.parse(payload);
      if (shared && shared.data) {
        history.replaceState(null, '', location.pathname); // 해시 즉시 제거
        if (shared.permission === 'view') {
          enterViewOnly(shared.data);
          showToast('보기 전용으로 열립니다');
        } else {
          openShareModal(shared.data); // "보기 전용 | 복제하기" 모달
        }
        return;
      }
    } catch {}
    showToast('공유 링크를 읽을 수 없습니다.');
  }
  // 일반 초기화...
})();
```

`history.replaceState`는 항상 즉시 실행해 리로드 시 재트리거를 방지한다.

---

## Step 6: 보기 전용 모드

핵심 원칙: **공유받은 데이터는 어떤 경우에도 수신자의 localStorage에 저장되지 않는다.**

```js
let viewOnlyData = null;

// 데이터 읽기 함수를 viewOnlyData 우선으로 오버라이드
function getAppState() {
  if (viewOnlyData) return viewOnlyData;
  return loadFromLocalStorage();
}

// 저장 함수에 가드 추가
function saveAppState(data) {
  if (viewOnlyData) return; // 보기 전용에서는 no-op
  writeToLocalStorage(data);
}

function enterViewOnly(data) {
  viewOnlyData = data;
  document.body.classList.add('is-view-only');
  openView(data);
}

function exitViewOnly() {
  viewOnlyData = null;
  document.body.classList.remove('is-view-only');
}
```

**모든 mutation 함수** 상단에 가드를 추가한다:
```js
function addElement(...) {
  if (viewOnlyData) return;
  // ...
}
```

### CSS

```css
/* 편집 컨트롤 비활성화 */
.is-view-only #btn-edit,
.is-view-only #btn-save,
.is-view-only #btn-share,
.is-view-only #tb-name { opacity: 0.3; pointer-events: none; }

/* 보기 전용 배지와 복제 버튼 표시 */
#btn-view-badge { display: none; }
.is-view-only #btn-view-badge { display: flex; }
#btn-clone { display: none; }
.is-view-only #btn-clone { display: flex; }
```

### 복제 버튼

```js
function cloneSharedData() {
  const shared = viewOnlyData;
  exitViewOnly();
  const newData = { id: uid(), ...cloneDeep(shared), createdAt: Date.now() };
  saveAppState(newData);
  openView(newData);
  showToast('복제했습니다');
}
```

---

## Step 7: 복제 허용 모달 (수신 측)

```html
<div id="modal-share" class="modal-bg">
  <div class="modal-box">
    <p class="modal-title">공유된 콘텐츠</p>
    <p id="modal-share-name" class="modal-share-name"></p>
    <p style="font-size:13px;color:var(--fg-muted);margin-bottom:1.2rem;text-align:center">
      어떻게 열겠습니까?
    </p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="enterViewOnly(_pendingShared)">
        👁 보기 전용
      </button>
      <button class="btn-confirm" onclick="cloneAndOpen()">복제하기</button>
    </div>
  </div>
</div>
```

```js
let _pendingShared = null;

function openShareModal(data) {
  _pendingShared = data;
  document.getElementById('modal-share-name').textContent = data.name || '';
  document.getElementById('modal-share').classList.add('active');
}

function cloneAndOpen() {
  document.getElementById('modal-share').classList.remove('active');
  const shared = _pendingShared;
  _pendingShared = null;
  const newData = { id: uid(), ...cloneDeep(shared), createdAt: Date.now() };
  saveAppState(newData);
  openView(newData);
  showToast('복제했습니다');
}
```

---

## 구현 체크리스트

구현 완료 전 확인:

- [ ] `history.replaceState`로 `#share=` 해시 즉시 제거
- [ ] 모든 mutation 함수에 `if (viewOnlyData) return;` 가드 추가
- [ ] 보기 전용 상태에서 공유 버튼 및 편집 컨트롤 비활성화
- [ ] `navigator.clipboard` 실패 시 fallback (로컬 http에서 미지원)
- [ ] `/.netlify/functions/shorten` 실패 시 원본 URL 복사로 fallback
- [ ] 화면 이동(홈으로 돌아가기 등) 시 `viewOnlyData` 초기화 + CSS 클래스 제거
- [ ] undo 스택이 있다면 보기 전용 진입/이탈 시 초기화

---

## 참고 구현

- `public/book-share/index.html` — 단순 버전 (권한 없음, 보기 전용 없음)
- `public/chalkboard/index.html` — 전체 패턴 (권한 + 보기 전용 + 드롭다운 UI)
