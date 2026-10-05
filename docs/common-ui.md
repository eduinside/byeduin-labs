# 공용 UI 도구 `window.VUI` (`public/common/ui.js`)

앱마다 따로 만들던 토스트·모달·공유·fetch 오류 처리를 한곳에 모은 모듈입니다(점검 보고서 `docs/audit-2026-10.md` 7.2, 7.3).

- **불러오기**: `AppLayout.astro`가 `<head>`에서 `safe.js` 다음에 동기로 불러옵니다. Astro 앱은 따로 넣을 필요가 없습니다. 독립 HTML(`public/apps/**.html`)은 `<script src="/common/ui.js"></script>`를 직접 넣습니다.
- **로드 시점**: `document.body`를 건드리지 않습니다. 토스트·공유 창 DOM과 `<style id="vui-style">`은 처음 쓸 때 만듭니다. 그래서 `<head>` 인라인 스크립트에서 바로 `VUI.toast()`를 불러도 됩니다(본문이 준비되면 표시).
- **색**: `hero-theme.css`의 `--toast-bg/--toast-fg`, `--toast-error-bg/--toast-error-fg`, `--dialog-bg/--dialog-fg/--dialog-border` 토큰을 씁니다(라이트·다크 각각 정의). 앱이 `--bg`/`--fg` 하나만 바꿔도 밝은 바탕에 밝은 글씨가 되지 않습니다. 앱이 토스트 색을 바꾸고 싶으면 이 토큰을 한 쌍으로 재정의하세요.

---

## 1. 토스트 `VUI.toast(msg, opts)`

```js
VUI.toast('저장했어요 ✓');
VUI.toast('서버에 연결하지 못했어요.', 'error');          // = { type: 'error' }
VUI.toast('잠깐만 보여요', 1500);                          // = { duration: 1500 }
VUI.toast('완료', { type: 'success', duration: 4000 });
VUI.toast.hide();
```

- 화면 아래 가운데 한 곳(공용 영역 1개). 새 토스트가 이전 것을 바꿉니다.
- 보이는 시간: 글자 수에 맞춰 자동(최소 2.5초, 글자당 약 60ms, 최대 8초). `duration`으로 지정 가능.
- 스크린리더: 보통은 `role="status"`(`aria-live="polite"`), `type:'error'`는 `role="alert"`.
- `prefers-reduced-motion`이면 미끄러지는 움직임 없이 나타납니다.

**이전 패턴 → 새 패턴**

```js
// 이전 (앱마다 다른 id, 2.2~2.8초 고정)
let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('fd-toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// 새 패턴 — 함수 이름은 그대로 두고 몸통만 바꾸면 호출부 수정이 없습니다
function showToast(msg, type) { VUI.toast(msg, type); }
```

앱의 `#xx-toast` 요소와 그 CSS는 지워도 됩니다(인쇄용 `display:none` 목록에서도 빼기). 공용 토스트·공유 창은 인쇄 때 자동으로 숨겨집니다.

---

## 2. 모달 접근성 `VUI.modal`

앱이 이미 가진 모달 요소에 **접근성만** 붙입니다. 모양(CSS)은 바꾸지 않습니다.

- `role="dialog"`·`aria-modal="true"`, 제목(h1~h4)이 있으면 `aria-labelledby` 자동 연결
- 열 때 안쪽으로 포커스 이동, Tab/Shift+Tab 가두기, ESC로 닫기, 닫으면 원래 포커스로 복귀
- 선택: 배경 클릭으로 닫기, `[data-vui-close]` 버튼으로 닫기

```js
VUI.modal.open(el, opts)   // el: 요소 또는 선택자. 반환 { el, open, close, isOpen }
VUI.modal.close(el)        // 앱이 닫을 때. onClose는 부르지 않음
VUI.modal.bind(el, opts)   // 기본 옵션 등록(+ARIA 미리 설정). 반환 { open(opts), close(), isOpen() }
VUI.modal.isOpen(el)
```

| 옵션 | 뜻 |
|---|---|
| `className` | 보일 때 붙일 클래스(`'open'`, `'show'`, `'active'` …). 없으면 `hidden` 속성 → `style.display` 순으로 바꿈 |
| `show` / `hide` | 직접 보이기·숨기기 함수 `(el) => {}`. `false`면 VUI가 보이기·숨기기를 안 함 |
| `manual: true` | `show:false, hide:false` — 앱이 보이기·숨기기를 직접 하고, VUI는 접근성만 |
| `display` | 기본 방식에서 CSS가 `display:none`일 때 쓸 값(기본 `'block'`, 가운데 정렬 오버레이면 `'flex'`) |
| `dialog` | `role="dialog"`를 붙일 안쪽 상자(요소·선택자). 기본은 `el` 자신 |
| `label` | 제목 요소가 없을 때 `aria-label` |
| `initialFocus` | 처음 포커스(요소·선택자·함수). 기본: `[autofocus]` → 첫 포커스 가능 요소 → 상자 |
| `onClose(reason)` | **VUI가 닫았을 때만** 호출: `'esc'`, `'backdrop'`, `'button'`(`[data-vui-close]`) |
| `backdropClose` | 배경(=`el` 자신) 클릭으로 닫기. 기본 `false` |
| `escClose` / `trap` / `restoreFocus` | 기본 `true`. 끄려면 `false` |

**이전 패턴 → 새 패턴 (클래스로 여닫는 앱: flash-deck·md-editor·dictation·bubble-chat·math-sheet 등)**

```js
// 이전
function openHelp()  { $('help-modal').classList.add('open'); }
function closeHelp() { $('help-modal').classList.remove('open'); }

// 새 패턴 — bind 한 번, 여닫기는 VUI로
const help = VUI.modal.bind('#help-modal', { className: 'open', backdropClose: true });
function openHelp()  { help.open(); }
function closeHelp() { help.close(); }
```

**여닫는 코드가 복잡해 그대로 두고 싶을 때 (`manual`)**

```js
const shareM = VUI.modal.bind('#shareModal', { manual: true, onClose: () => closeShare() });
function openShare()  { $('shareModal').classList.add('show'); shareM.open(); /* …기존 코드… */ }
function closeShare() { $('shareModal').classList.remove('show'); shareM.close(); }
// ESC → VUI가 onClose('esc') → closeShare() → shareM.close()는 이미 닫혀 있어 무시됨(재귀 없음)
```

- 기존 `onclick="closeX(event)"` 배경 클릭 처리가 있으면 `backdropClose`는 켜지 마세요(두 번 닫힘은 무해하지만 불필요).
- 앱에 자체 ESC 처리가 있으면 지워도 됩니다(남겨도 `close()`가 중복 호출을 무시).
- 모달 안 닫기 버튼에 `data-vui-close`를 붙이면 따로 핸들러가 필요 없습니다(`onClose('button')` 호출).

---

## 3. 공유 `VUI.share`

### 3.1 인코딩 `encode(obj)` / `decode(str, validate?)`

- `encode`: JSON → UTF-8 바이트 → base64url. 한글은 옛 `btoa(encodeURIComponent())`보다 **약 3배 짧습니다**(링크·QR이 짧아짐).
- `decode`: 새 형식 → 옛 형식 `btoa(encodeURIComponent(json))` → `btoa(json)` 순서로 시도하므로 **이미 퍼진 옛 링크도 그대로 열립니다**. `#share=` 접두사, `+ / =`(표준 base64), `%` 인코딩도 받아 줍니다. 실패하면 `null`.
- `validate(obj)`가 `false`를 주면 다음 형식을 시도합니다.

```js
// 이전
const encoded = btoa(encodeURIComponent(payload)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
function decodeSharePayload(encoded) {
  try { const raw = encoded.replace(/-/g,'+').replace(/_/g,'/'); const pad = (4 - raw.length % 4) % 4;
        return JSON.parse(decodeURIComponent(atob(raw + '='.repeat(pad)))); } catch {}
  try { /* btoa(payload) 구버전 */ } catch {}
  return null;
}

// 새 패턴
const encoded = VUI.share.encode({ data, permission });          // payload 문자열이 아니라 객체를 넘김
const p = VUI.share.decode(encoded, o => o && o.data && Array.isArray(o.data.cards));
```

> 디코드 결과는 여전히 외부 입력입니다. 화면에 넣기 전 `VSafe.esc`·범위 검사를 그대로 하세요.

### 3.2 단축 `shorten(url)`

`POST /api/shorten {url}` → `{shortURL}`. 시간 제한 10초, 같은 주소는 메모리에 캐시. **실패(429 한도·오프라인·503 등)해도 reject하지 않고 원래 주소로 resolve**합니다. 단축됐는지는 `short !== longURL`로 확인.

### 3.3 복사·보여 주기 `copyOrShow(url, opts)` / `link(longURL, opts)` / `show(url, opts)`

- `copyOrShow(url, opts)`: 클립보드 복사 시도 → 성공하면 토스트 `링크를 복사했어요 ✓`, **실패하면 링크 창**(읽기 전용 입력칸 선택됨 + `복사` 버튼 + QR). resolve 값 = 복사 여부.
- `link(longURL, opts)`: `shorten` + `copyOrShow`. resolve 값 = 최종 주소.
- `opts.show: true`: 복사 없이 창을 바로 엽니다. `link`에서는 창을 먼저 열고 "짧은 링크를 만드는 중이에요…"를 보여 준 뒤 채웁니다(연산연습지 공유 모달과 같은 흐름).
- `show(url, opts)`: 창만 열기. `VUI.share.close()`: 창 닫기.
- 옵션: `title`(기본 `🔗 링크 공유`), `desc`(설명 한 줄), `note`(상태 문구), `qr:false`(QR 끄기), `copiedMessage`.
- QR은 `window.QRCode`(qrcodejs)가 페이지에 있을 때만 그립니다. 없으면 QR 칸을 숨깁니다. 링크가 너무 길어 QR 생성이 실패하면 안내 문구를 보여 줍니다.
- 창은 `VUI.modal`로 열려 ESC·배경 클릭·닫기 버튼으로 닫히고 포커스가 돌아옵니다.

```js
// 이전 (chalkboard·scoring-table·flash-deck: 복사 실패 시 prompt 또는 링크를 보여줄 방법 없음)
let url = longURL;
try { const res = await fetch('/api/shorten', {...}); const d = await res.json(); if (res.ok && d.shortURL) url = d.shortURL; } catch {}
try { await navigator.clipboard.writeText(url); showToast('링크가 복사되었습니다 ✓'); }
catch { window.prompt('자동 복사가 안 돼요…', url); }

// 새 패턴 — 한 줄
await VUI.share.link(longURL, { title: '🔗 칠판 공유' });

// 연산연습지처럼 항상 링크·QR 창을 보여 주려면
await VUI.share.link(buildShareURL(), { show: true, title: '🔗 공유', desc: '링크로 접속하면 같은 문제를 볼 수 있어요.' });
```

일반 텍스트 복사는 `VUI.copy(text, okMsg?)` → `Promise<boolean>`(성공 시 토스트, `okMsg:false`면 토스트 없음). 옛 브라우저는 `execCommand('copy')`로 한 번 더 시도합니다.

---

## 4. `VUI.apiFetch(url, opts)`

`fetch` + 시간 제한 + `r.ok` 확인 + 안전한 JSON 해석 + **한국어 오류 문구**.

```js
const data = await VUI.apiFetch('/api/spell-check', { json: { text } });   // json → POST + Content-Type
```

| 옵션 | 뜻 |
|---|---|
| fetch 옵션 그대로 | `method`, `headers`, `body`, `signal`, `cache` … |
| `json` | 본문 객체(자동 `JSON.stringify`, `Content-Type: application/json`, method 기본 `POST`) |
| `timeout` | ms, 기본 20000. `0`이면 제한 없음. `AbortSignal.timeout`이 없으면 `AbortController`로 대체 |
| `as` | `'json'`(기본, 빈 본문은 `null`) / `'text'` / `'response'`(성공 시 Response 그대로 — 파일 받기용) |

실패하면 `Error`를 throw합니다: `e.message`(바로 토스트에 쓸 한국어), `e.code`, `e.status`(HTTP 상태, 네트워크 오류는 0), `e.data`(서버 JSON), `e.serverMessage`.

| `code` | 경우 | 문구 |
|---|---|---|
| `offline` | 기기가 오프라인 | 인터넷 연결이 끊겼어요. 연결을 확인해 주세요. |
| `network` | 연결 실패 | 서버에 연결하지 못했어요. 잠시 후 다시 해 주세요. |
| `timeout` | 시간 초과 | 응답이 너무 늦어요. 잠시 후 다시 해 주세요. |
| `abort` | 호출부가 `signal`로 취소 | 요청을 취소했어요. |
| `rate_limit` | 429 | 요청이 많아요. 잠시 후 다시 해 주세요. |
| `server` | 5xx | 서버의 `{error}`가 한국어면 그것, 아니면 "서버에 잠시 문제가 생겼어요…" |
| `client` | 4xx | 서버의 `{error}`가 한국어면 그것, 아니면 상태별 기본 문구 |
| `bad_response` | 200인데 JSON이 아님 | 받은 내용을 읽지 못했어요… |

```js
// 이전 (r.ok 확인 없음, 빈 catch → 실패가 화면에 안 보임)
fetch('/api/x', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(q) })
  .then(r => r.json()).then(render).catch(() => {});

// 새 패턴
try { render(await VUI.apiFetch('/api/x', { json: q })); }
catch (e) { if (e.code !== 'abort') VUI.toast(e.message, 'error'); }
```

---

## 5. 조사 `VUI.josa(word, pair)` / `VUI.withJosa(word, pair)`

```js
VUI.josa('사과', '을/를')   // '를'
VUI.withJosa(n, '은/는')    // '3은', '2는', '10은'
VUI.josa('물', '으로/로')   // '로' (ㄹ받침)
```

- 지원 쌍: `은/는`, `이/가`, `을/를`, `과/와`, `으로/로`, `아/야`, `이랑/랑`, `이나/나`, `이에요/예요` 등. 순서를 바꿔 써도 됩니다(`는/은`).
- 숫자: 끝자리 읽기(0영 1일 2이 3삼 4사 5오 6육 7칠 8팔 9구). 끝이 0이면 십·백·천·만·억(받침 있음), 조(없음).
- 영문: 대문자 약어·낱글자는 글자 이름(L엘·R알 → ㄹ, M엠·N엔 → 받침), 소문자 단어는 끝소리로 추정(l→ㄹ, m·n·ng·me·ne, k·p·t → 받침).
- 판단할 수 없는 글자(이모지 등)는 `은(는)`처럼 둘 다 돌려줍니다. 끝의 괄호·따옴표·마침표는 건너뜁니다.

---

## 6. 저장소 `VUI.storage`

```js
const decks = VUI.storage.get('vives-flashdeck', { decks: [] }, v => v && Array.isArray(v.decks));
if (!VUI.storage.set('vives-flashdeck', decks)) { /* 저장 실패 — 화면은 계속 동작 */ }
VUI.storage.remove('key');
```

- `get`: 없음·JSON 깨짐·검사 실패·저장소 차단이면 `fallback`.
- `set`: 성공 `true`. 용량 초과면 `false` + 오류 토스트 **한 번만**(저장 공간이 꽉 차서 저장하지 못했어요…). 저장소 차단(시크릿 창 등)도 `false`(토스트 없음).

---

## 7. 공통 CSS (`hero-theme.css`)

- **포커스 표시**: `a[href]`, `button`, `summary`, `[role=button]`, `[tabindex]`(−1 제외)에 키보드 포커스일 때만 `outline: 2px solid var(--primary)`.
- **`.visually-hidden`**: 화면에는 안 보이고 스크린리더만 읽는 글자(아이콘 버튼의 이름 등).
- **움직임 줄이기**: `prefers-reduced-motion: reduce`면 모든 CSS 애니메이션·전환을 0.01ms·1회로 줄입니다(0이 아니라서 `transitionend`/`animationend`는 그대로 발생). 애니메이션이 곧 내용인 요소는 `data-motion="keep"`을 붙이면 그 요소와 자식이 제외됩니다. JS(`requestAnimationFrame`·캔버스·Web Animations API)로 움직이는 것은 영향이 없으니 앱에서 `matchMedia('(prefers-reduced-motion: reduce)')`로 따로 처리하세요.
  - 주의: "몇 초 보였다가 사라지는" 키프레임 애니메이션(volcano·world-landmarks의 `.hint-chip { animation: fadeOutLater 7s forwards }`)은 이 설정에서 **바로 사라집니다**. 해당 요소에 `data-motion="keep"`을 붙이거나, 앱 CSS에 `@media (prefers-reduced-motion: reduce){ .hint-chip{ animation:none } }`(계속 보이게)를 넣으세요.
- **상단 플로팅 버튼(`.overlay-btn`)**: 모바일에서 보이는 크기 36×36px, `::after`로 누르는 영역 최소 44×44px. 앱이 `.overlay-btn::after`를 다른 용도로 쓰면 안 됩니다.

## 8. 동기화(`sync.js`) 관련 변경

- `mountDocSync` 코드 연결: 이 기기와 코드(서버) 양쪽에 서로 다른 내용이 있으면 `confirm()` 두 번으로 묻습니다 — ① 코드 내용으로 바꿀까요? ② (아니면) 이 기기 내용을 코드에 올릴까요? 둘 다 취소면 연결하지 않습니다. 서버에 닿지 못하면 연결하지 않습니다.
- `createSet` 삭제 표식: `del()`이 서버 행을 지우지 않고 `value='__del__'`로 덮어씁니다(서버 변경 없음, 항목 단위 LWW). 다른 기기가 지워진 항목을 되살리지 않습니다. 끄려면 `createSet({ …, tombstones: false })`. 표식 행도 코드당 항목 수 상한(`maxItems`, 기본 500)에 포함됩니다 — Read Tree(책 354권)는 여유가 있습니다.
- 동기화 토스트는 `VUI.toast`를 씁니다(없으면 같은 색 토큰의 임시 토스트).
