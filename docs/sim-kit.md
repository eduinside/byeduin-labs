# SimKit — 시뮬레이션 앱 공용 키트

- 파일: `public/common/sim-kit.js`, `public/common/sim-kit.css`
- 전역: `window.SimKit` (v2.0.0, ES2017, 의존성 없음 — 아이콘은 `/common/icons.svg`)
- 배경: 전체 점검 보고서 [audit-2026-10.md](audit-2026-10.md) 8.1 "공통 원인과 조치"
- 상태: 모듈 완성. 앱 이관은 다음 단계(이 문서의 이관 안내를 따라 앱별로 진행)

## 0. 공통 규약 v2 (2026-10-06, sim-kit 2.0.0)

UI 검토([ui-review-2026-10.md](ui-review-2026-10.md)) 뒤 시뮬레이션 앱 전체의 **화면 규약**을 한 번에 맞췄다. 1.x는 내부 동작(미션 이동·타이머·저장·공유)만 통일했고, v2는 모양·말·배치를 통일한다. 자세한 결정 배경은 [ui-polish-plan.md](ui-polish-plan.md) 3장.

| # | 규약 | 키트가 주는 것 |
|---|---|---|
| 1 | 밝은 화면 고정. 우주·밤하늘 같은 무대 그림만 내용상 어둡게 | `<AppLayout theme="light">` (`data-theme-lock`, 화면 모드 버튼 숨김) |
| 2 | 토스트는 화면 위쪽 | `<AppLayout toast="top">` (독립 HTML은 `<body data-toast="top">`) |
| 3 | 조작 버튼은 `.sk-btn`, 조작판마다 primary 하나 | `.sk-btn`, `--primary`, `--danger`, `--sm`, `--block`, 줄 `.sk-actions` |
| 4 | 표준 용어·아이콘 | `SimKit.LABELS` — 확인하기(circle-check) / 결과 보기 / 다음 미션(arrow-right) / 다시 하기(rotate-ccw) / 처음부터(refresh-ccw, 확인 창 필수) / 자유 탐험으로(arrow-left) / 건너뛰기(skip-forward) / 재생·멈춤(play·pause) / 미션 도전(trophy) / 결과 보기(award). 방향어("오른쪽에서") 대신 "조작판에서" |
| 5 | 미션 중에는 "자유 탐험으로"가 항상 보인다 | `mc.stop()` + 앱의 자유 탐험 화면 |
| 6 | 결과 문구가 가려지면 보이게 스크롤 | `SimKit.feedback().show()` 기본 동작(`reveal:false`로 끔), 직접 쓰는 상자는 `SimKit.reveal(el)` |
| 7 | 인트로·결과 화면은 낮은 화면에서도 잘리지 않게 | `.sk-screen` (100dvh, 넘치면 안에서 스크롤) |
| 8 | 무대 위 떠 있는 요소 자리를 비워 둔다 | `--sk-stage-top`(60px) / `--sk-stage-bottom`(64px) |
| 9 | 움직임은 경과 시간 기준, 움직임 줄이기 존중 | `SimKit.loop((dt, t) => …)` → `start/stop/running`, 탭 숨김 시 멈춤. `SimKit.motion.reduced()` |
| 10 | 360px에서 그림 글자 11px 이상 | (앱별 viewBox·글자 보정) |
| 11 | UI 기호는 lucide 아이콘, 학습 대상 이모지는 유지 | `SimKit.icon(name)` (= `VUI.icon`) |

새 시뮬레이션은 위 11개를 체크리스트로 쓴다. 확인 크기: 360×740, 844×390, 1280×720.

## 1. 왜 만들었나

시뮬레이션 앱 8종 이상이 인트로·모드 탭·미션 내비·피드백·토스트·저장·공유 코드를 서로 복사해 쓰면서 같은 버그가 여러 앱에 퍼졌다.

| 퍼진 버그 | 원인 | SimKit에서 막는 방법 |
|---|---|---|
| `showToast is not defined` (eco-web, food-bike) | 토스트를 `init()` 안에 선언 | `SimKit.toast`는 전역. 어디서 불러도 됨 |
| 성공 문구가 표시 직후 사라짐 (food-bike, circuit-lab) | 성공 처리에서 미션 준비 함수(`setupMissionUI`)를 다시 불러 `hideFeedback()`·회로 초기화가 같이 실행 | `mc.complete()`는 `onEnter`를 다시 부르지 않는다. 문구는 다른 미션으로 갈 때만 숨김 |
| 정답 뒤 건너뛰기를 누르면 두 미션 넘어감 (shape-move, fraction-bar) | 자동 이동 `setTimeout(nextMission)`을 이동 때 취소하지 않음 | 모든 이동이 토큰을 올리고 타이머 스코프를 비움. 예약된 이동은 옛 토큰이면 실행 안 됨 |
| 같은 정답 처리가 두 번 실행 (shape-move 키보드, fraction-bar 칸 칠하기) | 성공 뒤에도 입력을 받아 채점이 또 돌고 타이머가 또 걸림 | 자동 이동 대기 중엔 `complete()`·`fail()`이 무시되고, `mc.pending()`으로 입력을 막을 수 있음 |
| 없는 함수 호출 (moon-phase-v2 `showFeedback`, chance-lab `#btnGoMission`) | 복사 중 빠뜨림 | 공용 함수가 항상 존재. 대상 요소가 없으면 조용히 넘어감 |
| 공유 링크를 만들기만 하고 읽지 않음 | 쓰기·읽기를 따로 복사 | `share.link`·`share.read`가 짝으로 있고, 예전 링크 형식도 읽음 |

## 2. 페이지에 넣기

앱 페이지의 `<AppLayout>` 안 `<Fragment slot="head">`에 넣는다(`AppLayout.astro`가 `<slot name="head" />`를 `<head>` 끝에 둔다). 앱 `<style is:global>`보다 **앞에** 두면 앱 스타일이 같은 우선순위에서 이긴다.

```astro
<AppLayout title="…" bodyShell="immersive">
  <Fragment slot="head">
    <link rel="stylesheet" href="/common/sim-kit.css">
    <script is:inline src="/common/sim-kit.js"></script>
    <style is:global>
      :root { --sk-accent: var(--fb-accent); } /* 선택: 앱 강조색 */
      …
    </style>
  </Fragment>
```

- `sim-kit.js`는 `<head>`에서 동기로 실행되므로 본문 끝의 앱 스크립트(IIFE든 전역이든)에서 바로 `SimKit`을 쓸 수 있다.
- `window.VUI`(`public/common/ui.js`)는 **호출할 때마다** 찾는다. 불러오는 순서와 상관없고, 없으면 키트의 기본 동작을 쓴다.
- 독립 HTML(`public/apps/blocks-universe/*.html`)은 `<link rel="stylesheet" href="/common/sim-kit.css">`와 `<script src="/common/sim-kit.js"></script>`.

## 3. 중복 현황 (2026-10-05, audit-fixes 브랜치 기준)

✓ 있음 · △ 있으나 결함 · – 없음

| 앱 | 인트로 | 모드 탭 | 미션 번호·이동 | 정오답 문구 | 토스트 | 별·점수 | 결과 화면 | 저장(검증) | 공유 | 타이머 |
|---|---|---|---|---|---|---|---|---|---|---|
| chance-lab | ✓ `showScreen` | ✓ `.view-tab` 장치 | ✓ 정적 버튼 `[data-m]` + `m1Next` | ✓ 미션별 `#mNFeedback` | △ `init` 안 지역 함수 | ✓ 미션별 0~3 | ✓ | △ 회전판만 검증 | ✓ URI-JSON | ✓ `m1Token`, async 애니메이션 |
| moon-phase-v2 | ✓ | ✓ `.mode-tab` | ✓ 동적 번호 | ✓ `#feedbackBox` text | – (`alert`) | ✓ 완료 수 | ✓ | ✓ | ✓ URI-JSON | rAF 그리기 |
| moon-phase | – | – | – | – | – | – | – | – | 셸 기본 | rAF 재생 |
| eco-web | ✓ | ✓ `.mode-tab` | ✓ 모드별 묶음 번호 | ✓ `#feedbackBox` html | ✓ 전역 | ✓ 완료 수 | ✓ | ✓ | ✓ URI-JSON | `setInterval` 4.5초 |
| food-bike | ✓ | ✓ `.mode-tab` | ✓ 동적 번호 | ✓ `#feedbackBox` html | ✓ 전역 | ✓ 완료 수 | ✓ | ✓ | ✓ URI-JSON | – |
| circuit-lab | ✓ | ✓ `.mode-tab` | ✓ 동적 번호 | ✓ `#feedbackBox` html | – (`alert`) | ✓ 완료 수 | ✓ | ✓ | ✓ URI-JSON | – |
| shape-move | ✓ | – | △ 순차 + 건너뛰기, 자동 이동 미해제 | ✓ `.m-feedback` | ✓ `#toast` | ✓ 이동 횟수 | ✓ 격자 | △ 별 무검증 | ✓ btoa | △ 1.5/1.8초 |
| solar-system | ✓ `renderIntro` | – (허브) | ✓ 순차 + 다시 풀기/다음 | ✓ `.feedback-box` | – | 성공 수 | ✓ | △ 무검증 | 해시 화면 복원 | △ `advanceAfter`, rAF |
| fraction-bar | ✓ | ✓ `.view-tab` 막대/피자 | △ 순차 + 건너뛰기, 자동 이동 미해제 | ✓ `.m-feedback` | ✓ `#toast` | ✓ 시도 횟수 | ✓ 격자 | △ 별 무검증 | ✓ btoa | △ 1.2/1.8/3초 |
| world-landmarks | ✓ | – (해시 라우팅) | ✓ 순차 + 여권 칸 | ✓ `.reveal-banner` | – (`alert`) | 도장 수 | ✓ 수료증 | ✓ | – | rAF 공전 |
| volcano | ✓ | – | ✓ 순차 `next()` | ✓ `aria-live` | – | 맞힌 수 | ✓ | – | – | rAF 공전 |
| idea-lab | ✓ | – | – (단계 마법사) | – | ✓ `#ilToast` | – | ✓ 카드 | ✓ 용량 초과 대비 | ✓ b64url+단축 | `timeoutSignal` |

- **효과음**은 이 12종에 없다. Web Audio 효과음·음소거는 `public/apps/blocks-universe/` 3종(break-make, clubs, step-squad)에 같은 코드로 세 번 있다 → `SimKit.sound`가 같은 소리를 낸다.
- **읽어주기(TTS)**: fraction-bar, world-landmarks, idea-lab → `SimKit.speak`.
- **조사 판별**: food-bike·eco-web `josa()`, idea-lab `josa()`, volcano·solar-system `eunNeun()` → `SimKit.josa` (숫자 끝 "5는" 처리 포함).
- **지도 코드**(volcano·world-landmarks)는 이 키트 범위 밖이다. 다만 공전 rAF는 `SimKit.timers()`로 감쌀 수 있다.

### 그대로 지켜야 할 앱별 동작 차이

| 앱 | 지킬 동작 |
|---|---|
| food-bike, circuit-lab | 성공해도 **자동 이동 없음**. 문구 끝에 "N번 버튼을 눌러…" 안내. 번호를 눌러 들어갈 때만 미션 준비(접시 초기화, 미션 6 합선 회로 배치) |
| eco-web | 미션이 모드별로 묶임(1: 3개, 2: 2개, 3: 1개). 모드 3 미션은 실험 재생(4.5초 × 단계)이 끝나야 채점 |
| moon-phase-v2 | 성공하면 **즉시** 첫 미완료 미션으로 넘어가되 성공 문구는 남김. 미션 중 자동 공전 허용, 채점은 [정답 확인]에서만 |
| chance-lab | 미션별 별 0~3과 완료 여부를 **따로** 저장. 이미 끝낸 미션에 다시 들어가면 문제를 새로 그리지 않음. m4는 오답이어도 별 1로 완료 |
| shape-move | 식별 미션은 한 번만 답함(오답도 별 1로 완료, 1.5초 뒤 이동). 고스트 미션은 이동 횟수로 별, **최고 기록 유지**, 3번 어긋나면 힌트, 1.8초 뒤 이동. 마지막 뒤 결과 화면 |
| fraction-bar | 별 = 오답 횟수(0→3, 1→2, 그 외 1). **덮어씀**(최고 기록 아님). O/X 오답은 1.2초 뒤 다시 고르기, 비교 미션 오답은 별 1로 완료 후 3초 뒤 이동 |
| solar-system | 미션 진행 중 임시 상태(`missionDraft`)는 화면을 다시 그려도 유지. 오답이면 "다시 풀기/다음 미션" 버튼 |
| volcano, world-landmarks | 자동 이동 없음, [다음] 버튼으로만 이동. world-landmarks는 오답이면 다시 풀기 |

## 4. API

모든 함수는 대상 요소가 없으면 예외 없이 넘어간다. "대상"은 요소, 선택자 문자열, 또는 요소를 돌려주는 함수(다시 그려지는 영역용: 쓸 때마다 새로 찾음) 중 하나.

### 4.1 `SimKit.missions(options)` → 미션 컨트롤러 `mc`

| 옵션 | 설명 |
|---|---|
| `ids` / `count` | 미션 id 배열. 없으면 `count`로 `m1`…`mN` |
| `format` | 진행 기록 모양. `'flags'` = `{m1:true}` (food-bike 등), `'stars'` = `{m1:3}` (shape-move·fraction-bar, 별 0 = 미완료), `'full'`(기본) = `{m1:{done,stars}}` |
| `progress` | 저장해 둔 기록(`format` 모양). 모르는 키·잘못된 값은 버림 |
| `maxStars` | 기본 3 |
| `keepBest` | 기본 `true`(다시 풀어도 최고 별 유지). fraction-bar는 `false` |
| `nav` | 번호 버튼을 키트가 그릴 상자. 버튼: `button.sk-mnav-btn`, 상태 클래스 `active`·`done`, `aria-current="step"`, `aria-label="미션 2 (완료)"` |
| `navButtons` | 이미 마크업에 있는 번호 버튼(순서대로 0, 1, …). 키트가 클릭을 한 번만 연결하고 상태 클래스만 바꿈 |
| `navClass` | 키트가 그린 버튼에 더할 앱 클래스(예: `'mission-nav-btn'`). 넣으면 앱의 28px 모양이 키트의 44px 규칙과 겹치니, 가능하면 빼고 `--sk-accent`만 맞출 것 |
| `navText(i, e)` | 버튼 글자 바꾸기(기본 `i+1`) |
| `label` | 화면 읽기용 이름(기본 `'미션'`) |
| `controls` | `{ prev, next, skip }` 버튼 대상. 키트가 클릭을 연결하고 `disabled`를 관리 |
| `feedback` | 문구 상자 대상 또는 `SimKit.feedback(...)` 인스턴스. `feedbackOptions`로 옵션 전달 |
| `autoAdvance` | 성공 뒤 다음 미션으로 갈 ms. 기본 없음(머무름) |
| `onEnter(i, ctx)` | 미션 준비(앱 고유 화면 구성). `ctx = { index, id, done, stars, token }` |
| `onLeave(prev, next)` | 미션을 떠날 때 정리(next가 -1이면 미션 모드 종료) |
| `onComplete(i, {id, stars, earned})`, `onFail(i, attempts)`, `onSkip(i)` | 알림 |
| `onAllDone(summary)` | 모든 미션 완료 순간(결과 버튼 보이기 등) |
| `onFinish(summary)` | 마지막 미션 뒤 `next()` 또는 `finish()` (결과 화면) |
| `onChange(progress)` | 기록이 바뀔 때(`format` 모양). 여기서 앱의 `saveState()` 호출 |

| 메서드 | 동작 |
|---|---|
| `start([i])` | i번 또는 첫 미완료 미션(다 했으면 0번)으로 |
| `go(i, {keepFeedback})` | 이동. **대기 중 자동 이동·미션 타이머 취소**, `onLeave` → 문구 숨김(keepFeedback이면 유지) → 번호 갱신 → `onEnter` |
| `next()` / `prev()` / `skip()` | 다음(마지막이면 `finish`) / 이전 / 건너뛰기(기록 그대로 두고 다음) |
| `retry()` | 같은 미션 다시 준비(`onEnter` 재실행) |
| `finish()` / `stop()` | 미션 모드 끝(`onFinish` 호출) / 조용히 끝(미션 모드 나가기) |
| `complete({stars, message, tone, html, advance, keepBest})` | 완료 기록 → 문구 표시 → 번호만 갱신 → `onChange`. **`onEnter`를 다시 부르지 않음.** `advance`(ms)는 이번 호출만 `autoAdvance` 대신. 자동 이동 대기 중이면 `false`를 돌려주고 무시 |
| `fail(message, {tone, html})` | 실패 문구, 시도 횟수 +1. 자동 이동 대기 중이면 무시 |
| `later(fn, ms)` / `every(fn, ms)` / `frame(fn)` | 이 미션에 묶인 타이머. 미션을 옮기면 자동 취소 |
| `sleep(ms)` | `await` 용. 그사이 미션이 바뀌면 `false` |
| `token()` / `alive(t)` | async 흐름에서 "아직 같은 미션 방문인가" |
| `pending()` | 자동 이동 대기 중인가(이때 입력 막기) |
| `attempts()` | 이번 방문의 `fail()` 횟수 |
| `current()`, `id(i)`, `isDone(i)`, `starsOf(i)`, `doneCount()`, `totalStars()`, `allDone()`, `firstIncomplete()`, `summary()`, `progress()` | 조회 |
| `setProgress(p)`, `reset()`, `render()`, `destroy()` | 기록 교체 / 기록 초기화(`onChange` 호출) / 번호 다시 칠하기 / 해제 |
| `mc.timers`, `mc.feedback` | 미션 타이머 스코프, 문구 인스턴스 |

여러 컨트롤러가 같은 `nav` 상자를 써도 된다(eco-web처럼 모드별 묶음). 마지막으로 그린 컨트롤러가 상자를 가진다.

### 4.2 `SimKit.feedback(target, { html, classes, display })`

`show(type, msg, {html})` (`type`: `ok`·`no`·`info`·`warn`, `success`/`error`도 받음), `hide()`, `clear()`, `visible()`, `type()`, `el()`.
- 처음 표시할 때 `role="status"`, `aria-live="polite"`, `.sk-feedback`, `.sk-feedback--{type}`를 붙인다.
- 기본은 `textContent`. `html: true`는 **앱이 직접 쓴 고정 문구**에만(공유 링크·입력값·AI 답변이 섞이면 안 됨).
- `classes: { ok: 'ok', no: 'no' }` → 앱 기존 클래스(`.feedback-box.ok`)도 같이 붙였다 뗀다. 앱 규칙이 더 구체적이라 앱 모양이 유지된다.

### 4.3 `SimKit.toast(msg, typeOrOptions)`

`SimKit.toast('복사했어요')`, `SimKit.toast('실패했어요', 'no')`, `{ type, duration, local }`. `window.VUI.toast`가 있으면 맡기고(`local: true`면 안 맡김), 없으면 `.sk-toast`(role=status) 하나를 재사용. 표시 시간 기본 `max(2.5초, 글자 수 × 90ms)`, 최대 8초.

### 4.4 `SimKit.store(key, { defaults, validate, version, migrate })`

`load()` → 항상 쓸 수 있는 객체(없음·손상·검사 실패 → `defaults` 복사본). `save(obj)` → `true`/`false`(용량 초과·차단 시 이번 방문 동안 메모리에 보관). `update(patch)`, `clear()`.
- **기존 키와 형식을 그대로 읽는다**(예: `'food-bike:v1'`). 이관할 때 키를 바꾸지 말 것.
- `validate(raw, defaults)`는 정리된 객체 또는 `null`.
- `version`을 주면 저장 객체에 `_v`를 붙이고, 다른 `_v`는 `migrate(raw, oldV)`로. `_v`가 없는 예전 값은 그대로 `validate`로 간다.

`SimKit.clean`: `flags(obj, ids)`, `stars(obj, ids, max)`, `list(arr, allowed, max)`, `int(v, min, max, def)`.

### 4.5 `SimKit.share`

| 함수 | 동작 |
|---|---|
| `link(payload, {format, base, prefix})` | `https://…/apps/x/#share=<base64url>`. `format: 'json'`이면 예전 URI-JSON |
| `read({version, prefix, clear})` | `#share=` 읽고 주소에서 지움. URI-JSON, `btoa(encodeURIComponent(JSON))`, base64url, UTF-8 base64 모두 읽음. 실패·버전 불일치 → `null`. 16,000자 초과 거부 |
| `send(url, {title, shorten, native, copiedMessage})` | 기기 공유 → `VUI.share.copyOrShow`(링크 칸+QR) → 클립보드+토스트 → `prompt`. `shorten: true`면 `VUI.share.shorten` 먼저 |
| `bind(() => payload, {title, ...})` | 셸 공유 버튼(`window.shareCurrentPage`)을 이 앱 공유로 바꿈. `null`을 돌려주면 "공유할 내용이 없어요" |
| `encode` / `decode` | 저수준 |

받은 값은 **반드시 앱의 clean 함수로 다시 검사**(`cleanPlate`, `sanitizeSpinner` 등은 그대로 둔다).

### 4.6 그 밖

| API | 동작 |
|---|---|
| `SimKit.screens({selector='.screen', activeClass='active', focus, onShow})` → `show(id)`, `current()` | 기존 `showScreen`과 같음. `focus: true`면 새 화면의 `[data-sk-focus]`/`h1`/`h2`로 초점 |
| `SimKit.tabs(buttons, {attr='mode', initial, onSelect(value, btn), canSelect(value)})` → `select(v, {silent})`, `value()`, `refresh()` | `.active` + `aria-pressed`. `canSelect`가 `false`면 무시(chance-lab의 "애니메이션 중·미션 중 잠금") |
| `SimKit.timers()` → `timeout`, `interval`, `raf`, `sleep`, `clear(id)`, `reset()`, `size()` | 걸어 둔 것을 한 번에 해제 |
| `SimKit.stars.grade(n, [c1,c2,c3])`, `.text(n, max, empty)`, `.render(el, n, max)` | 완료 수 → 별 / 별 글자 / 별 그리기 + `aria-label="별 3개 중 2개"` |
| `SimKit.sound.play('done'·'wrong'·'star'·'stamp'·'move')`, `.bindButton(el, {keepContent, render})`, `.toggle()`, `.muted()`, `.setMuted(b)`, `.useKey(key)` | blocks-universe와 같은 효과음. 음소거는 `'vives:sim-muted'`에 저장 |
| `SimKit.speak(text, {lang, rate, onend})`, `.supported()`, `.cancel()` | 한국어 읽어주기 |
| `SimKit.josa(word, '은/는')` → `'백두산은'`, `SimKit.josa.pick(word, '이/가')` → `'가'` | 짝은 받침 있을 때/없을 때 순(반대로 써도 맞춤). 숫자 끝 처리. 한글·숫자 외는 `은(는)` |
| `SimKit.ready(fn)` | DOM 준비 뒤 실행 |

## 5. 앱별 이관 안내

공통 원칙:
1. **미션 내용·채점 조건·문구·별 기준은 바꾸지 않는다.** 바꾸는 것은 "배관"(이동·타이머·문구 표시·저장·공유)뿐.
2. 저장 키와 저장 모양을 유지한다(`format`을 앱의 기존 모양에 맞춤). 학생 기록이 사라지면 안 된다.
3. 키트가 맡은 버튼에서 앱의 기존 리스너를 **반드시 지운다**(이중 등록이 shape-move 건너뛰기 버그의 원인).
4. 앱 고유 채점 함수(`m.verify`, `checkGhostMission`, `statesMatch` 등)는 그대로 두고, 결과만 `mc.complete()`/`mc.fail()`로 넘긴다.
5. 미션 안에서 쓰는 `setTimeout`/`setInterval`/rAF는 `mc.later`/`mc.every`/`mc.frame`으로 바꾼다. async 함수는 `await mc.sleep()`이 `false`면 즉시 `return`.
6. 이관 뒤 확인: 콘솔 오류 0, 라이트·다크, 폰 폭, 키보드 Tab으로 번호 버튼 이동, 정답 직후 건너뛰기/번호 누르기, 새로고침 후 기록 유지, 예전 공유 링크 열기.

### food-bike (위험 낮음 — 첫 이관 추천)

| 지금 | 바꿀 것 |
|---|---|
| `showToast` + `toastEl`/`toastTimer` | `function showToast(m, t) { SimKit.toast(m, t); }` (부르는 곳은 그대로) |
| `showFeedback`/`hideFeedback` | `const fb = SimKit.feedback('#feedbackBox', { html: true, classes: { ok: 'ok', no: 'no' } });` → `fb.show(type, text)`, `fb.hide()` (자유 빌더 평가도 이 인스턴스) |
| `renderMissionNav` + `setupMissionUI` 상단의 번호 그리기 | `mc = SimKit.missions({ ids: MISSIONS.map(m => m.id), format: 'flags', progress: state.missionsCompleted, nav: '#missionNav', feedback: fb, onEnter: i => { state.missionIdx = i; setupMissionUI(); }, onChange: p => { state.missionsCompleted = p; saveState(); updateVerifyButtonText(); } })` |
| `setupMissionUI()` | 번호 그리기·`hideFeedback()`만 빼고 미션별 준비(바구니, 접시 초기화, 퀴즈 버튼)는 그대로 |
| `verifyCurrentMission` 모드 2 성공 분기 | `mc.complete({ message: '🎉 미션 성공! …' + tail })` (tail 계산은 `mc.firstIncomplete()`). 실패 분기 → `mc.fail('❌ …')` |
| `switchMode(2)` | `mc.start(state.missionIdx)`; 모드 1·3으로 갈 때 `mc.stop()` |
| `#btnRetry` | `mc.reset()` 후 기존 처리 |
| `window.shareCurrentPage` + `parseShareLink` | `SimKit.share.bind(() => ({ v: 1, plate: state.plate }), { title: '식품구성자전거 — 내가 만든 식단 접시' })`, 읽기는 `const p = SimKit.share.read({ version: 1 }); if (p && p.plate) { state.plate = cleanPlate(p.plate); state.mode = 1; }` |
| `showScreen` | `const screens = SimKit.screens();` → `screens.show(id)` |
| `.mode-tab` 리스너 | `SimKit.tabs('.mode-tab', { attr: 'mode', onSelect: v => switchMode(v) })`, `switchMode` 안의 탭 칠하기는 `tabs.select(v, { silent: true })` |
| `showResultScreen` 별 계산 | `SimKit.stars.render('#resultStars', SimKit.stars.grade(mc.doneCount(), [1, 2, 4]))` |

주의: 성공 처리에서 `setupMissionUI()`를 부르지 말 것(접시가 초기화됨). `josa`는 `SimKit.josa(word, '이/가')`로 바꿀 수 있지만 반환 모양(단어+조사)이 같으니 선택.

### circuit-lab (위험 낮음)

food-bike와 같은 구조. 차이:
- 미션 6의 합선 회로 배치는 `onEnter` 안에서만(완료 뒤 다시 실행되면 성공 순간 회로가 되돌아감 — 오늘 고친 버그).
- 예측 박스(`#predictionBox`) 초기화도 `onEnter`.
- 공유가 `alert`/`prompt`를 쓰므로 `SimKit.share.bind(() => ({ v: 1, circuit: segmentsObj() }), { title: '전기회로 공작소 — 내가 만든 전기 회로' })`로 바꾸면 토스트가 된다. 받는 쪽은 `cleanSegments` 그대로.
- 결과 별: `grade(n, [1, 4, 6])`.

### eco-web (위험 중간)

- 모드별 컨트롤러 3개, 진행 기록은 한 객체를 공유: `const progress = state.missionsCompleted; const mcs = { 1: SimKit.missions({ ids: ['m1_1','m1_2','m1_3'], format: 'flags', progress, … }), 2: …, 3: … }`. 각 `onChange: p => { Object.assign(state.missionsCompleted, p); saveState(); updateVerifyButtonText(); }`.
- 번호 클릭 시 지금은 `switchMode(state.mode, true)`로 화면을 다시 짓는다 → `onEnter: i => { state.missionIdx = i; switchMode(state.mode, true); }`. 단 `switchMode` 안의 `setupMissionUI()`가 번호를 다시 그리지 않게 정리(`mcs[mode].render()`로 대체).
- 모드를 바꿀 때 이전 컨트롤러 `stop()`.
- 시나리오 실험 `setInterval`(4.5초)은 `mcs[3].every(fn, 4500)`으로 → 미션·모드 이동 시 자동 정지. 지금의 `stopSimulation()` 호출 위치는 남겨도 무해.
- `finishScenarioSimulation`의 성공 분기 → `mcs[3].complete({ message, html: true })`, 오답 → `fail`. 지금처럼 `setupMissionUI()`를 다시 부르면 예측 버튼 선택이 지워지니 부르지 말 것.
- 피라미드 퀴즈(m2_2)의 보기 버튼 주입은 `onEnter`에서.
- 토스트는 이미 전역이지만 `SimKit.toast`로 교체하면 `type === 'no'` 색도 유지된다.
- 결과 별: `grade(n, [1, 4, 6])`.

### moon-phase-v2 (위험 낮음)

- `MISSIONS` 3개, `format: 'flags'`, `nav: '#missionNav'`, `feedback: SimKit.feedback('#feedbackBox', { classes: { ok: 'ok', no: 'no' } })`.
- `verifyMission` 성공: `mc.complete({ message })` 뒤 `const n = mc.firstIncomplete(); if (n >= 0) mc.go(n, { keepFeedback: true });` (지금 동작: 즉시 다음 미션, 문구 유지). 실패: `mc.fail('아직 아니에요…')`.
- 일식·월식 모드(`setupEclipseUI`)는 같은 `#missionNav`에 자기 버튼을 넣는다 → 모드 3으로 갈 때 `mc.stop()`, 모드 2로 돌아오면 `mc.start(state.missionIdx)`(키트가 번호를 다시 그림). 인라인 `onclick="window.runEclipse(…)"`은 이참에 `addEventListener`로.
- 공유는 `alert`/`prompt` → `SimKit.share.bind(() => ({ v: 1, phaseAngle: … }))`, 읽기는 `SimKit.share.read({ version: 1 })` + 기존 각도 정규화.

### chance-lab (위험 중간~높음)

- 번호 버튼이 마크업에 있음 → `navButtons: '.mission-nav-btn'`, `ids: ['m1','m2','m3','m4']`, `format: 'full'`.
- 저장은 `missions`(완료)·`missionStars`(별)를 따로 둔다. 불러올 때 `progress: { m1: { done: !!state.missions.m1, stars: state.missionStars.m1 }, … }`로 합치고, `onChange`에서 다시 두 객체로 나눠 `saveState()`. 저장 키·모양 유지.
- 이때 `loadState`의 `missions`·`missionStars`·`counts`·`total`·`snapshots` 무검증(△)을 `SimKit.clean`으로 보강.
- `goToMission(num)` → `onEnter: (i, ctx) => { … 기존 화면 전환 …; if (!ctx.done) renderMissionN(); }` (끝낸 미션은 다시 그리지 않는 동작 유지). `#m1Next` → `mc.next()`, `#btnGoResult` 표시는 `onAllDone`.
- 미션 1의 `m1Token` + `setTimeout(…, 300/1200)` → `mc.later(…)`로 바꾸고 `m1Token` 삭제 가능. 단 m1 안의 문항 진행은 미션 내부 단계이므로 `complete`는 `finishMission1`에서 한 번만.
- 미션 2·3의 `async` 애니메이션: 루프 안 `await sleep(…)`을 `if (!(await mc.sleep(…))) return;`으로. 지금은 다른 미션으로 가도 애니메이션이 숨은 패널에 계속 쓴다.
- 미션별 문구 상자가 4개(`#m1Feedback`…)이므로 컨트롤러 `feedback`은 생략하고, 각 상자에 `SimKit.feedback(...)` 인스턴스를 따로 만든다(`.feedback success/warn` 마크업은 `classes`로 유지 가능).
- `init` 안 지역 `showToast` → `SimKit.toast`.
- `#deviceTabs .view-tab` → `SimKit.tabs(…, { attr: 'device', canSelect: () => !animating && !missionMode, onSelect })`.
- 결과: 미션별 `SimKit.stars.text(mc.starsOf(i))`, 합계 `mc.totalStars()`.

### shape-move (위험 중간 — 이관 효과 가장 큼)

- `format: 'stars'`, `progress: missionStars`, `ids: MISSIONS.map((_, i) => 'm' + (i + 1))`, `keepBest: true`(고스트 미션 최고 기록 유지), `onChange: p => { missionStars = p; saveState(); }`, `onFinish: showResult`.
- `startMissions` → `mc.start()` (첫 미완료, 다 했으면 처음).
- `setupMission(idx)` → `onEnter`. `#btnMission`의 `onclick` 교체 방식은 그대로 두되 건너뛰기는 `() => mc.skip()`. **`addEventListener`와 섞지 말 것.**
- `checkIdentifyAnswer`: 정답 `mc.complete({ stars: 3, advance: 1500 })`, 오답 `mc.complete({ stars: 1, advance: 1500 })` (오답도 완료로 넘어가는 지금 동작 유지. `keepBest`라 이전 3별이 1로 떨어지지 않음 — 지금은 덮어씀. 지금 동작을 그대로 원하면 `keepBest: false`를 이 호출에만). 문구는 지금처럼 `#identifyFeedback`에 직접 쓰거나 `feedback: () => document.getElementById('identifyFeedback')`.
- `checkGhostMission` 성공: `mc.complete({ stars, advance: 1800 })`. `setTimeout(nextMission, …)` 삭제.
- 키보드·버튼 입력 맨 앞에 `if (missionMode && mc.pending()) return;` (성공 뒤 키보드로 도형이 움직여 두 번 채점되던 문제).
- `doAction`의 `await sleep(420)` 뒤 채점은 `const t = mc.token(); await sleep(420); if (!mc.alive(t)) return;` 형태로(애니메이션 중 미션 이동 대비).
- `showObserveToast`/`showToast` → `SimKit.toast`. `#toast` 마크업과 `.toast` CSS는 지워도 됨.
- 공유: `SimKit.share.bind(() => ({ v: 1, state: { … } }), { title: '도형의 이동 — 내 도형 배치' })`, 읽기 `SimKit.share.read({ version: 1 })` + `applySavedShape`. 예전 btoa 링크도 읽힌다.
- 결과: `SimKit.stars.text(s, 3, '—')`, 합계 `mc.totalStars()`.

### fraction-bar (위험 중간)

- `format: 'stars'`, `keepBest: false`(지금은 덮어씀), 나머지는 shape-move와 같은 틀.
- 별 계산 `localAttempts` → `mc.attempts()`. O/X 오답: `mc.fail('다시 한번 생각해 볼까요?', { tone: 'warn' })` 후 `mc.later(() => { …다시 누를 수 있게… }, 1200)`.
- `checkEqualMission`/`checkMakeMission` 성공: `mc.complete({ stars, message, advance: 1800 })`. 만들기 미션은 칸을 누를 때마다 검사하므로 `toggleFill` 맨 앞 `if (missionMode && mc.pending()) return;`(성공 뒤 칸을 더 눌러 타이머가 여러 개 걸리던 문제).
- `checkCompareMission`: 정답 `complete({ stars, advance: 3000 })`, 오답 `complete({ stars: 1, tone: 'warn', message, advance: 3000 })`.
- 겹쳐 보기 버튼의 `setTimeout(checkCompareMission, 600)` → `mc.later(checkCompareMission, 600)`.
- 단위 없는 `translate()` 버그(감사 8.1)는 이관과 별개로 고칠 것.
- 토스트·공유·TTS(`SimKit.speak`)는 shape-move와 같은 방식.

### solar-system (위험 중간 — 전역 함수 + 인라인 onclick 구조)

- 스크립트가 IIFE가 아니고 `onclick="nextMission()"` 같은 인라인 핸들러를 쓴다. 이관할 때 전역 이름(`go`, `nextMission`, `startMissions`, `retryRow` 안 문자열)을 유지하거나, 이참에 `data-*` + 이벤트 위임으로 바꾼다(`public/common/safe.js` 주석 참고).
- `MISSION_IDS`로 `SimKit.missions({ ids: MISSION_IDS, format: 'flags', progress: store.missions, onEnter: i => { missionStep = i; missionDraft = {}; render(); }, onFinish: () => go('result'), onChange: p => { store = saveStore({ missions: p }); } })`. `startMissions()`는 `state.screen = 'missions'; mc.start(0);`, `nextMission()`은 `mc.next()`.
- 오답일 때 나오는 `retryRow`의 "다음 미션 →"은 `mc.next()`. "다시 풀기"는 **지금 코드 그대로**(draft 일부만 지움). `mc.retry()`로 바꾸면 `onEnter`가 draft 전체를 지워 크기 미션이 2단계에서 1단계로 돌아간다.
- `advanceAfter(ms)` → `mc.complete({ advance: ms })`. 지금의 단계·화면 가드는 "허브로 갔다가 같은 0번에서 다시 시작"하면 옛 예약이 통과한다 → 토큰 방식으로 해결.
- `go(screen)`에서 미션 화면을 떠날 때 `mc.stop()`.
- `loadStore` 무검증 → `SimKit.store('solar-system:v1', { defaults: { missions: {}, favorites: [] }, validate })`, `saveStore(patch)` → `st.update(patch)`.
- 크기 비교 화면 밖 문제(감사 8.1)는 별개.

### world-landmarks (위험 중간 — 미션 컨트롤러는 쓰지 않음)

- 진행이 "나라 순서 + 여권 칸으로 아무 데나 이동 + 오답이면 다시 풀기"라 `SimKit.missions`보다 개별 조각이 맞다.
- `saveState`/`loadState` → `SimKit.store('world-landmarks:v1', { defaults: { stamps: [] }, validate: r => ({ stamps: SimKit.clean.list(r.stamps, LANDMARKS.map(l => l.id)) }) })`. 조사 기록(`world-landmarks:research:v1`)도 같은 방식.
- 읽어주기 3곳 → `SimKit.speak(text, { onend: () => btn.classList.remove('speaking') })`. "이름을 첫 공백에서 자름"(감사 8.1)은 문장 조립 쪽 버그라 별개로 고칠 것.
- 지도 공전 rAF·로딩 2.5초 타이머 → `const mapTimers = SimKit.timers();`, `exitExplore`에서 `mapTimers.reset()`.
- `alert` → `SimKit.toast`. 도장 효과음을 넣고 싶으면 `SimKit.sound.play('stamp')`(새 기능이므로 선택).
- 다크 테마 밝은 글씨·보기 셔플·수료증 조건(감사 8.1)은 별개.

### volcano (위험 낮음 — 조각만)

- `eunNeun(name)` → `SimKit.josa.pick(name, '은/는')`.
- 공전 rAF → `SimKit.timers()`.
- 결과 화면 카메라 버튼 인덱스 오류(감사 8.1)는 별개(world-landmarks와 같은 코드).

### idea-lab (위험 낮음 — 조각만)

- `showToast` → `SimKit.toast` (`#ilToast` 마크업은 지워도 됨).
- `ttsSpeak` → `SimKit.speak`.
- `josa(word, a, b)`는 **조사만 돌려줌** → `SimKit.josa.pick(word, a + '/' + b)`.
- `b64urlEncode`/`b64urlDecode` → `SimKit.share.encode`/`decode`(같은 형식). `shareWork`의 단축·복사 → `SimKit.share.send(longURL, { shorten: true, title: '발명 아이디어 공작소' })` (VUI가 없으면 단축 없이 공유).
- `loadStore`/`saveStore`는 용량 초과 시 그림을 빼는 `upsertWork` 논리가 있어 **그대로 두는 것을 권장**. 바꾼다면 `SimKit.store`의 `save()` 반환값(`false`)으로 같은 분기를 유지.
- `timeoutSignal`, 금칙어 처리는 앱 고유. 그대로.

### moon-phase (위험 낮음 — 조각만)

- 재생 rAF → `SimKit.timers().raf`. 미션·저장·공유가 없어 그 외는 해당 없음. 캔버스 고정 폭(감사 8.1)은 별개.

### blocks-universe 3종 (선택)

- `tone`/`sfx`/`toggleMute`/`syncMuteBtn` → `SimKit.sound.useKey('clubs.muted')`(또는 `'stepsquad.muted'`), `SimKit.sound.play(type)`, `SimKit.sound.bindButton('#muteBtn', { render: (el, m) => { el.innerHTML = m ? MUTE_ICON_OFF : MUTE_ICON_ON; } })`. 버튼의 인라인 `onclick="toggleMute()"`은 지울 것(이중 전환).
- break-make는 음소거를 `progress.muted`에 저장 → 불러온 뒤 `SimKit.sound.setMuted(progress.muted)`, 바뀔 때 저장하려면 `bindButton` 대신 직접 `toggle()` 후 `progress.muted = SimKit.sound.muted(); save();`.

## 6. 권장 이관 순서와 위험

| 순서 | 앱 | 이유 | 위험 |
|---|---|---|---|
| 1 | food-bike | 구조가 가장 단순, 자동 이동 없음 | 낮음. 성공 처리에서 `setupMissionUI` 재호출 금지만 지키면 됨 |
| 2 | circuit-lab | food-bike와 같은 틀 | 낮음. 미션 6 회로 배치 위치 |
| 3 | moon-phase-v2 | 같은 틀 + `keepFeedback` | 낮음. 일식·월식 모드가 같은 nav 상자 사용 |
| 4 | shape-move | 자동 이동 버그를 실제로 없앰 | 중간. `btnMission`의 `onclick` 교체, 키보드 입력 잠금 |
| 5 | fraction-bar | shape-move와 같은 틀 | 중간. `keepBest: false`, 오답 잠금 해제 타이머 |
| 6 | eco-web | 컨트롤러 3개 + 실험 인터벌 | 중간. `switchMode`↔`setupMissionUI` 재진입 정리 |
| 7 | solar-system | 전역 함수·인라인 onclick | 중간. 전역 이름 유지 |
| 8 | chance-lab | 정적 버튼 + 별/완료 분리 저장 + async 애니메이션 | 중간~높음. 저장 모양 보존, `await` 지점마다 `alive` 확인 |
| 9 | world-landmarks, volcano, idea-lab, moon-phase, blocks-universe | 조각(토스트·저장·TTS·조사·타이머·효과음)만 | 낮음 |

공통 위험:
- **CSS 충돌**: `navClass`로 앱 클래스를 같이 붙이면 버튼 크기가 앱 규칙(28px)으로 돌아갈 수 있다. 키트 기본(44px)을 쓰고 `--sk-accent`만 맞추는 것을 권장.
- **`html: true` 남용**: 공유 링크·사용자 입력이 문구에 들어가면 XSS. 고정 문구만.
- **저장 형식**: `format`을 잘못 고르면 기존 기록이 "미완료"로 보인다. 이관 전후 같은 localStorage로 확인.
- **이중 리스너**: 키트가 맡은 번호·이전·다음·건너뛰기 버튼에 남은 앱 리스너가 있으면 두 번 이동한다.
- 이관은 앱 하나씩, 앱별 커밋으로(`refactor(<app>): SimKit으로 미션 내비·토스트 이관`).

## 7. 시험

- 미션 컨트롤러의 토큰·타이머 동작은 가짜 시계로 시험했다(2026-10-05, node, 20개 통과): 정답 뒤 자동 이동 1회, 정답 직후 건너뛰기·번호 이동 시 예약 취소, 같은 미션 재시작 시 옛 예약 무시, 대기 중 중복 채점 무시, `complete`가 `onEnter`를 다시 부르지 않음, 문구 유지/숨김, `later`/`every`/`sleep` 취소, 진행 형식 왕복, `keepBest`, 공유 예전 형식 읽기, 조사, 저장 검증·용량 초과.
- 시험 스크립트는 저장소 밖 임시 경로에서 돌렸다. 저장소에 시험 폴더가 생기면(감사 2.3 "검증 장치") 같은 내용을 옮길 것.
- 앱 이관 뒤에는 5장 공통 원칙 6번의 수동 확인을 한다.
