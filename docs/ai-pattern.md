# AI 호출 패턴 (Gemini 직접)

> 처음 작성: 2026-08-18(Timely 게이트웨이 연동 패턴) · 개편: 2026-11-12(Gemini 단일화, `docs/gemini-migration-plan.md`)
> 대상: `functions/api/_ai.js`를 통해 AI를 호출하는 모든 엔드포인트. 새 AI 프록시를 만들 때 이 문서만 보면 되도록 한다.

---

## 1. 구조

`functions/api/_ai.js`의 `generateContent()`/`generateImage()`가 **Gemini API를 직접** 부른다. 다른 공급자로 넘어가는 폴백은 없다.

| 함수 | 모델 | 용도 |
|---|---|---|
| `generateContent` | `DEFAULT_TEXT_MODEL = 'gemini-flash-lite-latest'` (호출부에서 `model`로 바꿀 수 있음) | 텍스트, 사진 입력(`images`), JSON(`json: true`) |
| `generateImage` | `gemini-3.1-flash-lite-image` | 그림(1:1, 1K, JPEG) |

- 키: `GEMINI_API_KEY` 하나(결제 연결된 유료 키). URL `?key=` 대신 **`x-goog-api-key` 헤더**로 보낸다.
- 모델 결정(2026-11-12 운영자): 텍스트는 전 엔드포인트 flash-lite(B안). 특정 엔드포인트 품질이 부족하면 그 호출부만 `model: 'gemini-flash-latest'`로 올린다.
- 생성 AI와 별개로 검열은 OpenAI Moderation(`_moderation.js`, `madang.js`), 문서 파싱은 Corepin(`doc-parse.js`)을 쓴다. 이 둘은 `_ai.js`와 무관하다.

---

## 2. 오류 처리 (`callGemini`)

| 상황 | 처리 | 사용자 문구(상태) |
|---|---|---|
| 429·500·503 | 0.5초 뒤 1회 재시도 | 그래도 429면 '요청이 몰리고 있어요'(429), 그 밖은 '응답을 받지 못했어요'(502) |
| 연결 실패·타임아웃 | 재시도 없음(대기 시간이 두 배가 됨) | '늦어지고 있어요'(504) |
| `promptFeedback.blockReason` 또는 `finishReason`이 SAFETY 등 | 재시도 없음 | '이 내용으로는 결과를 만들 수 없어요'(400) |
| 응답이 비어 있음 | — | '답을 만들지 못했어요'(502) |
| 키 없음 | — | '아직 준비되지 않았어요'(503) |

외부 API 원문은 로그에만 남기고, 사용자에게는 `err.expose` 문구만 보낸다(`_guard.js`의 오류 변환).

요청 제한은 `_ai.js`가 엔드포인트 한도와 별도로 센다: `_guard.js` `LIMITS['ai-text']`(사이트 하루 10,000), `['ai-image']`(사이트 하루 600). 이 상한이 곧 하루 요금 상한 역할을 하므로, 늘릴 때는 Google Cloud 요금도 같이 본다.

---

## 3. 타임아웃

- 텍스트 기본 30초, 그림 60초.
- 긴 답변은 호출부가 `timeoutMs`로 늘린다: `search` 75초(화면은 90초까지 기다림), `timer-vision` 45초.

---

## 4. CF Pages 무료 티어 제약

- **CPU 시간**: 요청당 **10ms**(Free 플랜). fetch 대기 시간은 안 잡히고 JSON 파싱·직렬화는 잡힌다.
- **서브리퀘스트**: invocation당 50개.
- 모델 목록 같은 메타 정보를 **요청 경로에서 조회하지 말 것**. 필요하면 KV 캐시 + Cron Trigger로 요청 밖에서 갱신한다.
- 사진 입력은 본문이 커서 클라이언트에서 줄여 보낸다(`timer-vision`: 긴 변 1280px·JPEG 0.75, 본문 상한 900KB).

---

## 5. 그림 생성 실전 노트

- 호출: 표준 `:generateContent` + `generationConfig.responseModalities: ['IMAGE']`, `imageConfig: { aspectRatio: '1:1', imageSize: '1K' }`. 응답은 `candidates[0].content.parts[].inlineData.data`(base64).
- **모델 선택(2026-11-12, 해상도가 낮아도 되는 그림이라 낮은 모델 허용)**: 같은 크레파스풍 프롬프트 실측.

  | 모델 | 크기 옵션 | 결과 | 시간 | 장당 요금(유료, 2026-11 가격표) |
  |---|---|---|---|---|
  | `gemini-2.5-flash-image`(이전) | 1K만 | PNG 1024px 약 2.3MB | 약 7.5초 | $0.039 |
  | **`gemini-3.1-flash-lite-image`(현재)** | 1K만(512 → 400) | JPEG 1024px 약 0.5~1.1MB | 약 3~4초 | $0.0336 |
  | `gemini-3.1-flash-image` | 512 가능 | JPEG 512px 약 0.3MB | 약 9.6초 | $0.045 |

  가장 작은 것은 3.1-flash 512지만 더 비싸고 느려서, 용량 절반·요금 최저인 3.1-flash-lite를 골랐다. 2.5 모델은 `imageSize: '512'`/`'0.5K'`, `imageOutputOptions`(JPEG 지정)를 모두 400으로 거절한다.
- **JPEG 주의**: 지금 결과는 JPEG다. 화면은 base64 앞부분으로 형식을 고른다(`/9j/` = JPEG, 그 밖은 PNG). `idea-lab`·`career-talk`·`_signage-maker`에 반영돼 있다. 새 그림 화면도 `data:image/png` 고정으로 쓰지 말 것.
- 더 줄이려면 Worker에서 재인코딩해야 하는데 CPU 10ms 예산과 충돌한다. 저장용으로 줄일 때는 브라우저 canvas에서 줄인다.
- **엣지 502**: 2026-08 실측에서 연속 8회 중 1회 Cloudflare 엣지 502(우리 코드가 응답을 만들기 전 끊김)가 나왔다. 큰 응답 처리로 CPU·메모리 예산을 넘긴 것으로 추정. 프런트(`idea-lab` `startDraw()` 등)는 실패를 이모지 카드로 대체하므로, 새 그림 프록시는 실패 원인이 콘솔에 남는지 확인한다.
- 옛 `imagen-3.0-generate-002`(`:predict`)는 이 키에서 404(2026-08). 모델 목록은 조용히 바뀌므로 그림 경로가 오래 안 쓰였다면 배포 전에 `GET /v1beta/models`로 확인한다.

---

## 6. 모델 별칭 점검

`-latest` 별칭은 Google이 예고 후 다른 모델로 바꾼다. 분기마다 `GET https://generativelanguage.googleapis.com/v1beta/models`(헤더 `x-goog-api-key`)로 별칭이 가리키는 모델과 종료 예고를 확인한다. 바뀐 뒤 답변 형식(JSON, 말투)이 달라졌는지 career-talk·spell-check·timer-vision으로 확인한다.

---

## 7. 신규 AI 프록시 체크리스트

1. `functions/api/<app>.js`에서 `_ai.js`의 `generateContent`/`generateImage`만 쓴다. Gemini fetch를 새로 쓰지 않는다.
2. `request`를 꼭 넘겨 `ai-text`/`ai-image` 한도가 적용되게 한다. 엔드포인트별 한도는 `_guard.js` `LIMITS`에 추가한다.
3. 모델은 기본값을 쓴다. 바꿀 때는 이유를 주석으로 적는다.
4. 새 실패 유형은 `callGemini()` 한 곳에서 처리한다. 앱 파일에 예외 처리를 중복으로 쓰지 않는다.
5. 그림이 필요하면 §5를 먼저 읽는다.

---

## 8. 과거 기록: Timely 게이트웨이 (2026-08 ~ 2026-11)

2026-11-12까지는 Timely GPT 브릿지(`hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions`, OpenRouter를 감싼 OpenAI 호환 게이트웨이)를 1차로, Gemini 직접 호출을 폴백으로 썼다. 텍스트 기본 모델은 `openai/gpt-5.6-luna`, 그림은 `google/gemini-2.5-flash-image`였다. 요금을 Gemini 하나로 단순화하려고 걷어 냈다. 다른 저장소(dgedu-agent 등)는 아직 Timely를 쓸 수 있으니 그쪽 문서를 본다.
