# UI 다듬기 계획 (2026-10-06, 브랜치 `feat/ui-polish-2026-10`)

> 상태: **완료(2026-10-06)** — 빌드·스모크(44페이지 실패 0), 브라우저 실측(375×740·844×390·1280×720) 겹침·가로 넘침 0. 아래 "남은 확인"은 6장.

근거: [ui-review-2026-10.md](ui-review-2026-10.md) (UI·사용성 검토 보고서). 기능 추가가 아니라 고치고 다듬는 작업.

## 1. 결정 사항 (운영자 확인 2026-10-06)

| 항목 | 결정 |
|---|---|
| 아이콘 | **UI 요소는 모두 lucide 선 아이콘**(버튼·탭·배지·제목 앞 기호·상태 표시·토스트/문구 앞 기호). 학습 내용 자체인 이모지(음식·동물·행성·블록 캐릭터·생물 카드·국기 등)는 그대로 |
| 시뮬레이션 화면 모드 | **전부 밝은 화면 고정**(`<AppLayout theme="light">`). 우주·밤하늘 무대 그림(solar-system, moon-phase 2종)은 내용상 어둡게 유지, 패널·버튼·글자는 밝은 테마 |
| 달 앱 2종 | **태양 오른쪽 + 월령 기준**(슬라이더 0 = 삭). moon-phase-v2를 moon-phase 방식에 맞춤 |
| 교과 표현 | shape-move 교과서 표현, sun-shadow 미션 4 춘·추분 고정, solar-system 용어("한 바퀴 자전", "지름", "지구 거리의 1.5배"), chance-lab 용어·색 이름 정정 — 모두 적용 |
| 앱 제목 | **한국어 + 영문 병기**: 화면 제목을 "플래시 카드 (Flash Deck)"처럼. 작품 고유명(Numberblocks 등)은 그대로 |
| 배포 | 브랜치에서 끝내고 빌드·스모크 통과 후 main 병합 |

### 1.1 추가 요청 (운영자, 2026-10-06)

| 앱 | 요청 | 묶음 |
|---|---|---|
| clock | "지금 시각"을 누르면 한 번 맞추는 대신 **실시간으로 계속 따라감**. 바늘을 끌거나 다시 누르면 멈춤 | A |
| graph-maker | 진입할 때 **"그래프 만들기(내 자료로 보고서)"와 "그래프 공부하기(미션)" 두 모드를 명확히** 고르고, 안에서도 현재 모드 표시·바꾸기 | B |
| food-bike | 빨간 안내 배너가 자전거 그림을 가리지 않게 | C |
| blocks-universe 3종 | break-make·clubs·step-squad를 고유 개념·진행 방식은 유지한 채 다른 몰입형 시뮬레이션과 같은 모양(공용 크롬·무대+조작판·`.sk-btn`·표준 용어·밝은 화면)으로 | D |

## 2. 공용 기반 (이 브랜치에서 먼저 만든 것)

### 2.1 아이콘 — lucide 스프라이트
- `scripts/build-icons.mjs`가 소스에서 쓰인 이름만 모아 `public/common/icons.svg`를 만든다(`npm run build`가 먼저 실행, 단독 `npm run icons`).
- Astro 마크업: `import Icon from '../../../components/Icon.astro'` → `<Icon name="camera" />` (크기는 글자 크기 1em, 색은 글자색).
- 스크립트 문자열: `VUI.icon('camera')` (SimKit 앱은 `SimKit.icon('camera')`도 같음). 정적 HTML: `<span data-icon="camera"></span>`.
- 이름을 계산해서 만드는 코드(예: `VUI.icon(ok ? 'check' : 'x')`)는 자동 수집이 안 되므로 파일에 `// @icons check x` 주석을 둔다. `node scripts/build-icons.mjs --check`가 없는 이름을 잡는다.
- lucide 런타임(`/vendor/lucide-*.min.js`, 446KB)과 `<AppLayout icons>`·`data-lucide`는 쓰지 않는다(전부 스프라이트로 이전).
- 이모지를 아이콘으로 바꿀 때 대응표(예): 🔄 refresh-cw · 💾 save · 📋 clipboard-copy/copy · 🔗 link · 🖨️ printer · ⬇️ download · ⬆️ upload · 🗑️ trash-2 · ✏️ pencil · ➕ plus · ✕/× x · ✓/✅ check / circle-check · ❌ circle-x · ⚠️ triangle-alert · ℹ️ info · 💡 lightbulb · 🎲 dices · 🏆 trophy · ⭐ star · 🔊 volume-2 · 🔇 volume-x · ▶ play · ⏸ pause · ⏹ square · ⏭ skip-forward · ↺/🔄(다시) rotate-ccw · ← arrow-left · → arrow-right · 🔍 search · ⚙️ settings · 📁 folder · 📂 folder-open · 📄 file-text · 📷 camera · 🖼️ image · 🎨 palette · 📊 chart-column · 📈 chart-line · 🕐 clock · ⏰ alarm-clock · 📅 calendar · 👁 eye · 🙈 eye-off · 🔒 lock · ✨ sparkles · 🤖 bot · 💬 message-circle · 📝 notebook-pen · ❓ circle-help · 🏠 house · ☰ menu · ⋯ ellipsis.

### 2.2 버튼 체계 (`hero-theme.css`)
| 클래스 | 용도 |
|---|---|
| `.hero-btn` | 주 동작 — **화면(또는 카드)당 하나** |
| `.hero-btn .hero-btn-ghost` | 보조 동작 |
| `.hero-btn .hero-btn-danger` | 지우기·초기화(테두리 빨강). 확인 창의 최종 버튼은 `.hero-btn-danger-solid` |
| `.hero-btn-sm` | 36px(터치 기기 44px) |
| `.hero-btn-icon` | 정사각 아이콘 버튼, `aria-label` 필수 |

규칙: 삭제·초기화는 danger + (확인 창 또는 되돌리기). 이동·다운로드·녹음에 danger 금지. 앱 고유 버튼 클래스를 유지해도 되지만 위 역할 구분(주/보조/위험)과 44px 터치 영역은 지킨다.

### 2.3 공용 UI (`ui.js`, docs/common-ui.md)
- `VUI.toast(msg, { action: { label: '되돌리기', onClick } })` — 되돌리기 토스트(6초 이상).
- 위치: 아래 고정 바가 있는 앱은 `<AppLayout toast="top">` 또는 CSS `--vui-toast-bottom: 96px`.
- `VUI.confirm(msg, { title, ok, danger })`, `VUI.prompt(msg, { value, placeholder })`, `VUI.alert(msg)` — 브라우저 기본 `alert/confirm/prompt` 대신(Promise).
- 셸: 홈 버튼 "홈", 화면 모드 버튼은 monitor/sun/moon 아이콘 + "화면 모드: 자동/밝게/어둡게", 동기화 refresh-cw, 사이드바 `aria-expanded`·Esc, `.app-shell-layout > .app-main`으로 셸 여백 범위 축소.

## 3. 시뮬레이션 공통 규약 v2 (`sim-kit.js` 2.0.0 / `sim-kit.css`)

적용 대상: blocks-universe(+break-make·clubs·step-squad), chance-lab, circuit-lab, eco-web, food-bike, fraction-bar, graph-maker, moon-phase, moon-phase-v2, shape-move, solar-system, sun-shadow, volcano, world-landmarks(지도), idea-lab(마법사형은 해당 항목만).

1. **화면 모드**: `<AppLayout theme="light" …>`. 앱 안 `[data-theme="dark"]`·`prefers-color-scheme: dark` 규칙은 지운다(무대 그림의 의도된 어두운 색은 그대로).
2. **토스트 위치**: `<AppLayout toast="top">` — 무대 하단 도구줄·안내줄과 겹치지 않게.
3. **버튼**: 조작판의 동작 버튼은 `.sk-btn`(+`--primary`/`--danger`/`--sm`/`--block`). 조작판마다 primary는 하나(보통 확인하기). 모드 탭·미션 번호는 기존 키트 모양.
4. **표준 용어**(`SimKit.LABELS`):
   | 동작 | 말 | 아이콘 |
   |---|---|---|
   | 채점 | 확인하기 (자유 탐험에서는 "결과 보기") | circle-check |
   | 다음 미션으로 | 다음 미션 | arrow-right |
   | 같은 미션 다시 | 다시 하기 | rotate-ccw |
   | 모든 진행 지우기 | 처음부터 (**확인 창 필수**, danger) | refresh-ccw |
   | 미션 모드 나가기 | 자유 탐험으로 | arrow-left |
   | 건너뛰기 | 건너뛰기 | skip-forward |
   | 재생 / 멈춤 | 재생 / 멈춤 | play / pause |
   | 미션 시작 | 미션 도전 | trophy |
   | 결과 화면 | 결과 보기 | award |
   - 화면 배치 방향("오른쪽에서", "왼쪽 패널")은 쓰지 않는다 → "조작판에서".
   - 터치 기기를 고려해 "드래그해" 대신 "끌어 놓거나 눌러"처럼.
5. **미션 모드 나가기**: 미션 중에는 항상 "자유 탐험으로" 버튼이 보인다(미션 진행 기록은 유지).
6. **결과 문구 보이기**: `SimKit.feedback().show()`가 문구가 가려져 있으면 자동으로 스크롤한다(v2 기본). 키트를 쓰지 않는 문구 상자는 `SimKit.reveal(el)`을 직접 부른다. 폰에서 미션 문제·문구는 조작 버튼 **위**에 둔다.
7. **인트로·결과 화면**: `.sk-screen`(높이 100dvh, 넘치면 안에서 스크롤). 낮은 화면(844×390)에서 시작 버튼이 잘리지 않게.
8. **무대 위 떠 있는 요소**: 상단 이름표·하단 도구줄 자리(`--sk-stage-top` 60px, `--sk-stage-bottom` 64px)만큼 그림을 비운다(viewBox 여백 또는 padding). 360px·844×390·1280×720에서 그림의 첫 줄·마지막 줄이 가려지지 않을 것.
9. **움직임**: rAF 루프는 `SimKit.loop((dt) => …)`로 — 프레임 수가 아니라 경과 시간(dt초) 기준(120Hz 전자칠판에서 두 배 빨라지지 않게), 탭 숨김 시 멈춤. 자동 재생·장식 애니메이션은 `SimKit.motion.reduced()`이면 끄거나 즉시 결과로. CSS 무한 애니메이션은 hero-theme의 공통 규칙이 처리(내용인 애니메이션은 `data-motion="keep"`).
10. **글자 크기**: SVG viewBox가 화면보다 크게 줄어드는 무대는 360px에서 글자가 11px 미만이 되지 않게(viewBox 축소, 글자 크기 보정, 또는 HTML 범례).
11. **아이콘**: 버튼·안내의 기호 이모지는 lucide(2.1). 학습 대상 이모지는 유지.

## 4. 작업 묶음

| 묶음 | 앱 |
|---|---|
| A 홈·셸·수업 도구 | 홈(index.astro), search, timer, clock, picker, seating |
| B 수학·계산 | allowance-calculator, scoring-table, grid-maker, math-sheet, fraction-bar, graph-maker, chance-lab |
| C 시뮬레이션 1 | circuit-lab, food-bike, eco-web, shape-move |
| D 시뮬레이션 2 | moon-phase, moon-phase-v2, solar-system, sun-shadow, volcano, blocks-universe(+3종) |
| E 쓰기·학습 | book-share(+gather), chalkboard, dictation, flash-deck, idea-lab, md-editor, tts-reader, spell-checker |
| F 유틸리티 | file-tools, notion-image-downloader, notion-styler, octonauts-finder, padlet-bulk-uploader, qr, read-tree, world-landmarks, yt-thumb |

각 묶음은 보고서의 해당 앱 항목(1장 표, 2장 공통, 3장 앱별)을 모두 반영한다. 보고서에서 "교사 확인"으로 남긴 것 중 1장 결정에 없는 항목은 그대로 둔다.

## 5. 확인

- `npm run build` 성공, `node scripts/build-icons.mjs --check` 통과, `npm run smoke`.
- 브라우저 측정(375×740, 844×390, 1280×720): 겹침·가로 넘침 0, 콘솔 오류 0.
- 문서: OVERVIEW·STATUS·CHANGELOG, design-system.md(버튼·아이콘), common-ui.md(새 API), sim-kit.md(규약 v2).

## 6. 남은 확인 (운영자 판단 — 기본값으로 반영해 둠)

| 앱 | 기본으로 정한 것 | 바꾸려면 |
|---|---|---|
| 영문 병기 이름 | EduSearch, Smart Timer, Telling Time, Picker, Seating Chart, Book Gather, Dictation 등 작업자가 정함 | 각 앱 `.app-title-en` |
| picker·seating | "떨어뜨릴 쌍" → "떨어뜨릴 짝"으로 통일 | 두 앱 문구 |
| 홈 바닥글 | "eduin · 선생님이 바이브 코딩으로 만들었어요" | `src/pages/index.astro` |
| food-bike | 식품군 이름 "곡류 / 고기·생선·달걀·콩류 / 채소류 / 과일류 / 우유·유제품류 / 유지·당류" | 교과서 대조 |
| shape-move | 교과서식 뒤집기(도형이 옆자리로 넘어감) → 고스트 미션 6 목표 (4,2), 미션 9·10 최소 횟수 3·4 | 미션 정의 |
| moon-phase-v2 | 볼록한 달 이름 "차오르는/기우는 볼록한 달", 궤도 기울기 그림 약 11° 과장(안내문에 명시), 재생 속도 v1 1초=하루·v2 1초≈2일 | 앱 상수 |
| sun-shadow | 미션 4 날짜 추분(9/23), 기온 이름표 "평소 이맘때 어림" | app.js |
| chance-lab | #D55E00 이름 "빨강" | `COLORS` |
| graph-maker | 미션 중 "자유 탐험으로" 대신 항상 보이는 "그래프 만들기로" 모드 버튼 | |
| world-landmarks | 다음 버튼 "다음 나라로"(표준 "다음 미션" 대신) | |
| read-tree | 코드 없이 쓰는 "이 기기에서 바로 시작" + 새 키 `readtree:localMode` | |
| chalkboard | 작은 화면에서 큰 보드를 열면 자동 "화면에 맞추기", 새 글자 크기 화면 비례(32~80px) | `openBoard` |
| solar-system | 공유 해시 형식(`#`+btoa)은 그대로(다른 앱 `#share=`와 다름) | |
| blocks-universe 탐색기 | 시뮬레이션이 아니라 화면 모드를 따름(밝은 화면 고정 아님) | |
| episodes.json | 유튜브 원문 "넘버블럭" 2곳 그대로 | 데이터 |
