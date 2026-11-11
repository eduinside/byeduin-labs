# AI 호출 Gemini 단일화 계획

> 작성: 2026-11-12 · 상태: **구현 완료(2026-11-12)** — 유료 키 사용 중, B안(전부 flash-lite) 적용. 남은 일: §4.4 키 정리 · 대상: `functions/api/_ai.js`와 이를 쓰는 모든 AI 엔드포인트, `scripts/translate-bu-episodes.cjs`
> 목적: 요금 단순화. 텍스트·사진 인식·그림 생성을 Timely(1차) + Gemini(폴백) 두 곳 대신 **Gemini API 직접 호출 하나**로 정리한다.
> 범위 밖(그대로 둠): OpenAI Moderation(`_moderation.js`, `madang.js`), Corepin 문서 파싱(`doc-parse.js`), 다른 저장소(dgedu-agent 등)의 Timely 사용.

---

## 1. 현재 상태

모든 생성 AI가 `_ai.js` 한 곳을 지난다. 호출부는 `generateContent`/`generateImage`만 쓰므로 바꿀 곳은 거의 `_ai.js` 하나다.

| 함수 | 1차(Timely) | 폴백(Gemini 직접) |
|---|---|---|
| `generateContent` | `openai/gpt-5.6-luna` | `gemini-flash-lite-latest`(호출부가 바꿀 수 있음) |
| `generateImage` | `google/gemini-2.5-flash-image` + `image_config {1K, 1:1}` | `gemini-2.5-flash-image` |

호출부(엔드포인트 → 앱)와 현재 옵션:

| 엔드포인트 | 앱 | 옵션 | 지금 Gemini 폴백 모델 |
|---|---|---|---|
| `flash-recommend` | flash-deck | temp 0.8 | lite |
| `mindmap-draft`, `mindmap-ask` | mindmap | temp 0.4~0.7 | lite |
| `spell-check` | spell-checker | temp 0.2 | lite |
| `bu-recommend`, `bu-translate` | blocks-universe | temp 0.3 | lite |
| `idea-lab` | idea-lab | 텍스트 temp 0.8~0.9 + 그림 | lite |
| `career-talk` | career-talk | `json: true` + 그림 | lite |
| `signage-prompt`, `signage-image` | _signage-maker | 텍스트 + 그림, `provider` 인자(무시됨) | lite |
| `dictation-ai` | dictation | temp 0.7 | flash |
| `timer-vision` | timer | `images` + `json` + 45초 | flash |
| `search` | _search | 긴 답변, 75초, `DEFAULT_TIMELY_MODEL` import | flash |

개발용 스크립트 `scripts/translate-bu-episodes.cjs`는 `_ai.js`를 쓰지 않고 Timely·Gemini를 직접 fetch한다.

사이트 하루 상한(`_guard.js`): `ai-text` 10,000회, `ai-image` 600회.

---

## 2. 운영자가 먼저 정할 것

1. **Gemini 결제(종량제) 사용 여부** — 이 계획의 전제.
   - 무료 티어는 모델별 하루 요청 한도가 사이트 상한(텍스트 10,000/일)보다 훨씬 낮고, 그림 모델은 무료 한도가 없거나 매우 작다(현재 수치는 AI Studio 한도 화면에서 확인).
   - 무료 티어 입력은 Google 서비스 개선에 쓰일 수 있다. 학생이 쓰는 앱(career-talk, idea-lab, dictation)이 있으므로 **결제 프로젝트(유료 티어)로 쓰는 것을 권장**한다.
   - 워크스페이스 규칙상 유료 전제는 운영자 확인 사항이라 여기 적어 둔다. Cloudflare 쪽은 그대로 무료 티어다.
   - Google Cloud 예산 알림(예: 월 상한 금액의 50%·90%)을 같이 건다.
2. **기본 텍스트 모델** — 지금 사용자가 실제로 받는 답은 `gpt-5.6-luna` 품질이다. 대체 후보:
   - A안(권장): 기본 `gemini-flash-latest`, 짧고 단순한 작업(spell-check, bu-translate, bu-recommend, flash-recommend)은 `gemini-flash-lite-latest`.
   - B안: 전부 `gemini-flash-lite-latest`(가장 싸지만 진로 대화·마인드맵·검색 답변 품질이 떨어질 수 있음).
3. **모델 이름 고정 방식** — `-latest` 별칭은 Google이 예고 후 바꾼다. 별칭을 쓰되 §5 점검 목록에 "분기마다 모델 목록 확인"을 넣는 안을 권장한다(고정 버전명은 종료 때마다 코드를 고쳐야 함).

---

## 3. 모델 대응표(A안 기준)

| 용도 | 지금(Timely) | 이후(Gemini) |
|---|---|---|
| 기본 텍스트(mindmap, idea-lab, career-talk, signage-prompt, dictation-ai) | gpt-5.6-luna | `gemini-flash-latest` |
| 단순 텍스트(spell-check, bu-translate, bu-recommend, flash-recommend) | gpt-5.6-luna | `gemini-flash-lite-latest` |
| 검색 답변(search) | gpt-5.6-luna, 75초 | `gemini-flash-latest`, 75초 유지 |
| 사진 인식(timer-vision) | gpt-5.6-luna | `gemini-flash-latest`(지금 폴백과 같음) |
| 그림(idea-lab, career-talk, signage-image) | google/gemini-2.5-flash-image | `gemini-2.5-flash-image`(모델 같음, 경로만 바뀜) |
| 번역 스크립트 | google/gemini-2.5-flash-lite | `gemini-flash-lite-latest` |

그림은 이미 같은 모델이라 결과 품질 변화가 없다. 텍스트는 모델이 바뀌므로 §5 확인이 필요하다.

---

## 4. 코드 변경

### 4.1 `_ai.js` (핵심)

> **실제 적용(B안)**: `DEFAULT_TEXT_MODEL = 'gemini-flash-lite-latest'` 하나만 두고 `LITE_TEXT_MODEL`·lite 전환 재시도는 만들지 않았다(이미 lite). 인자는 `model` 하나(`timelyModel`/`geminiModel` 제거, 호출부도 함께 정리). 아래는 계획 당시 A안 기준 서술.

- 삭제: `TIMELY_ENDPOINT`, `callTimely()`, 두 함수의 Timely 블록, `TIMELY_API_KEY` 참조.
- `DEFAULT_TIMELY_MODEL` → `DEFAULT_TEXT_MODEL = 'gemini-flash-latest'`, `LITE_TEXT_MODEL = 'gemini-flash-lite-latest'` export.
- `generateContent` 인자: `timelyModel` 제거, `geminiModel` → `model`(기본 `DEFAULT_TEXT_MODEL`). 호출부 정리 기간 동안 `geminiModel`도 받아 주고, 정리 후 제거.
- **키를 URL 대신 헤더로**: `?key=` 대신 `x-goog-api-key` 헤더. 로그·오류 메시지에 키가 섞일 위험을 없앤다.
- **재시도**: 지금은 Timely가 실패하면 Gemini로 넘어가는 이중 안전망이 있었다. 단일화 후에는 다음으로 대신한다.
  - 429·500·503: 0.5초 뒤 1회 재시도.
  - 그래도 429·503이면 텍스트는 `LITE_TEXT_MODEL`로 1회 더 시도(모델별 한도가 따로라 효과가 있음). 이미 lite면 생략.
  - 타임아웃은 재시도하지 않는다(사용자 대기 시간이 두 배가 됨).
- **차단 응답 처리**: `promptFeedback.blockReason`이 있거나 `finishReason`이 `SAFETY`/`PROHIBITED_CONTENT`면 "이 내용으로는 답을 만들 수 없어요" 문구(400)로 구분한다. 지금은 "AI가 답을 만들지 못했어요"(502)로 뭉뚱그려진다.
- **그림 크기**: `generationConfig.imageConfig: { aspectRatio: '1:1' }`를 넣어 지금의 1:1 고정을 유지한다(직접 API에서 동작하는지 §5에서 실측. 안 되면 빼고 프롬프트에 정사각형 지시).
- 로그 문구의 Timely·폴백 표현을 정리한다.

### 4.2 호출부

- `search.js`: `DEFAULT_TIMELY_MODEL` import와 `ANSWER_TIMELY_MODEL` 제거, `model: DEFAULT_TEXT_MODEL`.
- `timer-vision.js`, `dictation-ai.js`: `geminiModel: 'gemini-flash-latest'` → 기본값과 같으므로 인자 삭제.
- spell-check, bu-translate, bu-recommend, flash-recommend: `model: LITE_TEXT_MODEL` 추가(A안일 때).
- `signage-prompt.js`: 쓰이지 않는 `provider` 인자 제거(프런트 `_signage-maker`가 보내는 값은 무시해도 됨).
- `signage-image.js` 상단 주석은 이미 "Google Gemini"라 그대로.

### 4.3 스크립트

- `scripts/translate-bu-episodes.cjs`: Timely 블록 삭제, Gemini만 호출, 키는 헤더로.

### 4.4 설정·키

- 코드 배포 후 2주 동안은 `TIMELY_API_KEY`를 Cloudflare Pages 환경변수에 그대로 둔다(되돌릴 때 필요).
- 2주 뒤 문제가 없으면 Pages 환경변수, `.dev.vars`/`.env`, `LOCAL/local-keyvault` 항목에서 이 프로젝트의 `TIMELY_API_KEY`를 지운다. 다른 저장소가 같은 키를 쓰면 키 자체는 폐기하지 않는다.

---

## 5. 확인 방법

배포 전(로컬 `wrangler pages dev`, Timely 키를 뺀 상태):

| 확인 | 기준 |
|---|---|
| 각 엔드포인트 1회씩 호출 | 정상 응답, 로그에 Timely 흔적 없음 |
| career-talk `json: true` | JSON 파싱 실패 없음(10회) |
| timer-vision 인쇄형 시정표 사진 | 지금과 같은 행 수 인식, 45초 안 |
| search 긴 답변 | 75초 안, 인용 [n] 형식 유지 |
| 그림 3종(idea-lab, career-talk, signage) | 1:1, 응답 크기 지금 수준(1~2MB), 엣지 502 빈도 지금 이하 |
| 잘못된 키 / 존재하지 않는 모델 | 사용자 문구 정상, 키가 로그에 안 찍힘 |
| 429 재현(짧은 시간 연속 호출) | 재시도 → lite 전환 로그 확인 |
| 학생용 프롬프트(career-talk, idea-lab) 답변 말투 | 초등 눈높이 유지 — gpt 대비 차이가 크면 프롬프트 보정 |

배포 후: 첫 1주는 Cloudflare 로그에서 AI 오류율, Google Cloud 콘솔에서 일 사용량·요금을 매일 본다.

정기 점검(분기): `GET /v1beta/models`로 별칭이 가리키는 모델과 종료 예고를 확인한다.

---

## 6. 진행 순서

1. 운영자 결정(§2) — 결제 활성화·예산 알림·모델안.
2. `_ai.js` 변경 + 호출부 정리 + 스크립트(한 커밋 단위로 `feat(ai): Gemini 직접 호출로 단일화`).
3. 로컬 확인(§5 표).
4. 배포, 1주 관찰.
5. 2주 뒤 `TIMELY_API_KEY` 정리(§4.4).
6. 문서 갱신(§7), STATUS·CHANGELOG.

되돌리기: 2단계 커밋을 `git revert`하면 Timely 1차 구조로 바로 돌아간다(키를 지우기 전까지).

---

## 7. 문서 갱신

- `docs/timely-ai-pattern.md` → `docs/ai-pattern.md`로 이름을 바꾸고(완료) Gemini 기준으로 다시 쓴다. 유지할 내용: CPU 10ms 제약(§5), 그림 크기·용량 실측(§7), 신규 프록시 체크리스트(§8). Timely 고유 내용(크레딧 등급, 브릿지 모델 목록, 호스트)은 "과거 기록" 한 단락으로 줄인다.
- `docs/OVERVIEW.md`: 181행(search 설명의 "Timely LLM"), 259행(기본 모델) 갱신, 변경 이력에 2026-11 항목 추가. 지난 이력 항목은 그대로 둔다.
- 다른 plan 문서(career-talk, idea-lab, mindmap, timer, audit)의 Timely 언급은 작성 당시 기록이라 고치지 않는다.
- 화면 문구에는 Timely가 나오지 않으므로(src 검색 결과 없음) 사용자 대상 글은 바꿀 것이 없다.

---

## 8. 위험

| 위험 | 대응 |
|---|---|
| 텍스트 품질 변화(gpt → gemini) | §5 학생용 답변 확인, 필요하면 프롬프트 보정·해당 엔드포인트만 flash 유지 |
| 공급자 하나에 의존(이중 안전망 없어짐) | 재시도 + lite 모델 전환, Google 장애 시에는 이전처럼 오류 문구 |
| 예상 밖 요금 | 사이트 하루 상한(_guard.js) 유지 + Google Cloud 예산 알림 |
| 무료 티어로 운영 시 데이터 학습 사용·한도 부족 | §2-1, 결제 프로젝트 사용 |
| 그림 `imageConfig`가 직접 API에서 다르게 동작 | §5 실측, 안 되면 빼고 프롬프트로 지시 |
