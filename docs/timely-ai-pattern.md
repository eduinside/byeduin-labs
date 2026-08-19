# Timely AI 게이트웨이 연동 패턴

> 작성: 2026-08-18 · 대상: `functions/api/_ai.js`를 통해 AI를 호출하는 모든 앱(idea-lab, search, signage-maker, spell-checker, flash-deck, blocks-universe 등)
> 목적: Timely 연동 관련 노하우를 한 곳에 모아 신규 AI 프록시 앱을 만들 때 이 문서만 보면 되도록 함

---

## 1. Timely가 하는 일

`functions/api/_ai.js`의 `generateContent()`/`generateImage()`는 다음 순서로 동작한다.

1. **1차: Timely GPT** (`TIMELY_API_KEY` 있을 때) — `https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions`를 OpenAI 호환 스키마로 호출.
2. **2차: 직접 Gemini API** (`GEMINI_API_KEY`) — Timely가 실패하거나 키가 없을 때 폴백.

**핵심 사실**: Timely GPT 브릿지는 자체 모델이 아니라 **OpenRouter를 백엔드로 감싼 재판매·과금 레이어**다(Timely 공식 SDK 문서 `OPENAI_SDK_GUIDE.md` 확인, 2026-08-18). 즉 `openai/*`, `anthropic/*`, `google/*`, `x-ai/*` 등 OpenRouter 카탈로그 대부분을 Timely 크레딧(조직이 이미 충전·부담)으로 그대로 쓸 수 있다.

- **비용**: Timely 크레딧은 조직 예산으로 이미 충당되는 사실상 무료 채널. Gemini 직접 폴백은 별도 `GEMINI_API_KEY` 쿼터를 쓴다.
- **왜 OpenRouter로 직접 안 가는가**: Timely가 이미 OpenRouter 카탈로그를 무료로 중개하므로, 직접 전환은 같은 모델을 유료로 다시 쓰는 것과 같다. 새 모델이 꼭 필요한 게 아니면 전환 실익이 없음(2026-08-18 검토 결론).

---

## 2. 엔드포인트·인증

```
POST https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions
Authorization: Bearer <TIMELY_API_KEY>
Content-Type: application/json
```

- **API 키를 그대로 Bearer로 사용**한다. JWT 교환 등 별도 인증 절차 불필요(Timely 공식 문서에서 명시적으로 확인됨 — 네이티브 SDK 모드의 JWT 1일 만료 토큰 발급 흐름은 이 브릿지 모드와 무관).
- 모델명은 `제공자/모델명` 형식(예: `google/gemini-2.5-flash-lite`, `google/gemini-2.5-flash-image`, `openai/gpt-4.1-mini`, `anthropic/claude-sonnet-4.6`). 실시간 지원 모델 목록은 `GET /api/v2/chat/bridge/info/models`에서 조회 가능하나, **이 프로젝트에서는 아직 자동 조회를 붙이지 않고 하드코딩된 모델명을 씀**(§5 참고 — 요청 경로에 넣기엔 CF Pages 무료 CPU 예산이 빠듯함).

---

## 3. Rate Limit / 에러 코드

Timely 쪽 요청 제한은 **크레딧 잔액에 따라 동적으로 낮아진다**(2026-08-18 기준 공식 문서):

| 크레딧 잔액 | 분당 요청 한도 |
|---|---|
| 충분 | 60/분 |
| 5만 미만 | 30/분 |
| 1만 미만 | 20/분 |
| 5천 미만 | 10/분 |

동시 실행 요청도 크레딧이 낮으면 1~3개로 제한된다. 이 프로젝트 자체 리미터(`_ai.js`의 `checkRateLimit`, 텍스트 30/분·이미지 5/분, IP 기준)는 고정값이라 **Timely 쪽이 크레딧 소진으로 10/분까지 떨어지면 우리 쪽 한도보다 더 빡빡해질 수 있다** — 이 경우 병목은 Timely 쪽 429로 나타난다.

| 상태코드 | 의미 | 처리(현재 구현) |
|---|---|---|
| 401 | 인증 실패(키 오류) | 즉시 Gemini 폴백 + 경고 로그 |
| **402** | **크레딧 소진** — 재시도로 해결 안 됨 | 즉시 Gemini 폴백 + `console.error`로 강조 로그(운영자가 충전해야 함을 표시) |
| **429** | Rate limit(크레딧 등급 하락 또는 순간 폭주) | **400ms 후 1회 재시도** → 그래도 실패하면 Gemini 폴백 |
| 404 | 모델명 오류 | 즉시 Gemini 폴백 + 경고 로그(모델명 오탈자 의심) |
| 5xx | Timely 쪽 일시 장애 | 즉시 Gemini 폴백 |

이 분기는 `_ai.js`의 `callTimely()` 헬퍼에 구현돼 있다. **새 AI 프록시를 만들 때는 이 fetch 로직을 복붙하지 말고 반드시 `generateContent`/`generateImage`를 통해서만 호출**할 것 — 헬퍼가 바뀌면 전체 앱에 자동 반영된다.

---

## 4. 폴백 체인과 미사용 자산

현재 폴백은 `Timely → Gemini 직접` 2단이다.

- **`OPENAI_API_KEY`가 CF Pages 환경변수에 이미 등록돼 있음**(2026-08-18 기준, 크레딧 충전 완료·언젠가 소모 예정). 아직 `_ai.js` 코드에는 연결돼 있지 않다.
- 향후 3단 폴백(`Timely → Gemini → OpenAI 직접`)이나, 특정 앱에서 OpenAI 모델이 더 적합할 때의 전용 경로로 고려 가능. **아직 미구현** — 필요해지면 이 문서를 갱신하고 `_ai.js`에 3차 폴백 블록을 추가할 것.

---

## 5. CF Pages 무료 티어와 관련된 제약

- **CPU 시간**: 요청당 **10ms**(Free 플랜, Workers/Pages Functions 공용). 네트워크 대기(fetch가 응답 기다리는 시간)는 CPU 시간에 안 잡히지만, JSON 파싱·직렬화 등 실제 연산은 잡힌다.
- **서브리퀘스트**: invocation당 50개.
- **함의**: 모델 목록(`/bridge/info/models`)이나 기타 메타 정보를 **요청 경로에서 동기적으로 조회하지 말 것**. 캐시가 없다고 그 자리에서 재조회하면 CPU 예산을 갉아먹고, 조회 자체가 느려지면 실제 생성 요청까지 지연/실패로 끌고 간다.
  - 이런 자동화가 필요해지면: KV에 캐시해두고 핫패스는 캐시만 읽기, 갱신은 **Cloudflare Cron Trigger**로 요청 경로 밖에서 수행. 실패해도 하드코딩된 기본 모델명으로 조용히 폴백.

---

## 7. 이미지 생성 — 크기(`image_config`)와 폴백 실전 노트 (2026-08-19 실측)

`generateImage()`가 쓰는 `google/gemini-2.5-flash-image`는 `image_config: { image_size, aspect_ratio }`로 크기를 지정할 수 있다. **Timely 게이트웨이 자체의 검증 스키마는 `image_size`로 `"0.5K"`/`"1K"`/`"2K"`/`"4K"`만 허용**하고(그 외 값은 Timely 단에서 바로 400), 이 값을 뒤에서 실제 모델에 맞게 변환해 전달하는 구조다.

- **`gemini-2.5-flash-image`의 실측 최솟값은 `"1K"`**다. `"0.5K"`를 보내면 Timely 검증은 통과하지만 Google 쪽에서 "이 모델은 0.5K 미지원"으로 재차 400을 반환한다(모델별로 실제 지원 크기가 다름 — Timely 에러 메시지가 "이 모델은 0.5K 지원"이라고 알려준 대체 모델(`google/gemini-3.1-flash-image-preview-*`)로 시도해봐도 `"0.5K"`·`"512"` 둘 다 400 — 프리뷰 모델 쪽 검증이 불안정하므로 신뢰하지 말 것.
- **크기를 줄여도 용량은 별로 안 줄어든다**: `"1K"`로 고정해도 실측 PNG(base64)가 **~1.1~1.8MB**. 이 모델은 "크레파스 그림" 같은 텍스처 많은 스타일을 저해상도에서도 노이즈가 많게 그려서 PNG 압축률이 나쁜 것으로 보인다. **"이미지가 작아도 됨(화면에 보이기만 하면 됨)"이라는 요구사항이 있어도, 현재 API로는 이보다 더 못 줄인다** — 진짜로 더 줄이려면 Worker 쪽에서 리사이즈/재인코딩(추가 CPU 비용 발생, §5 예산과 상충)이나 다른 이미지 모델 채택이 필요.
- 그래도 `image_size: '1K'`를 명시하는 이유: 파라미터를 생략하면 provider가 기본값으로 2K/4K를 골라 더 큰 페이로드가 나올 수 있어, **"1K로 상한을 고정"하는 효과**는 있다. `aspect_ratio: '1:1'`은 카드 레이아웃 일관성 목적.
- **Gemini 직접 폴백 모델명 주의**: 예전 `imagen-3.0-generate-002`(`:predict` 엔드포인트, `instances`/`predictions` 스키마)는 이 프로젝트 키에서 **더 이상 존재하지 않음**(404 확인, 2026-08-19). 현재는 `gemini-2.5-flash-image`를 표준 `:generateContent` + `generationConfig.responseModalities: ["IMAGE"]`로 호출하고, 응답은 `candidates[0].content.parts[].inlineData.data`에서 추출해야 한다(`_ai.js` 반영 완료). **모델 목록은 조용히 바뀌므로, 폴백 경로가 오래 안 쓰였다면 배포 전에 `GET /v1beta/models?key=...`로 실제 지원 모델을 재확인할 것.**
- **CF Pages 무료 CPU 예산과의 충돌 실측**: 프로덕션에 이미지 생성 요청을 8회 연속 보냈을 때 1회는 우리 앱의 JSON 에러가 아니라 **순수 Cloudflare 엣지 502**(`error code: 502`, 우리 코드가 응답을 만들기도 전에 인프라 단에서 끊김)가 나왔다 — 1.3~2MB급 응답을 파싱·재직렬화하다 §5의 CPU/메모리 예산을 넘겨 워커가 죽는 것으로 추정. 프런트엔드(`idea-lab`의 `startDraw()`)는 이런 실패를 전부 "이모지 카드로 대체"로 조용히 삼키므로, **폴백이 죽어 있으면(위 항목) 사용자에게는 "그림이 잘 안 그려짐"으로만 보이고 원인이 안 드러난다** — 새 이미지 프록시를 만들 때는 실패 시 최소한 콘솔 로그로 원인이 남는지 확인할 것.

---

## 8. 신규 AI 프록시 앱 체크리스트

1. `functions/api/<app>.js`에서 `_ai.js`의 `generateContent`/`generateImage`를 import해서 쓴다. Timely fetch 로직을 새로 작성하지 않는다.
2. `request` 파라미터를 반드시 넘겨서 IP 레이트리밋이 적용되게 한다(텍스트/이미지 기본값은 §3 표 참고, 필요시 `checkRateLimit` 한도 조정은 `_ai.js` 공통 로직에 영향을 주므로 신중히).
3. 모델은 기본값(`flash-lite`)을 우선 쓰고, 답변 품질이 중요한 경로만 `timelyModel`/`geminiModel` 오버라이드로 승격한다(예: `search.js`의 2단계 라우터 패턴).
4. 새 실패 케이스를 발견하면(예: 새로운 상태코드, Timely 응답 스키마 변경) `callTimely()` 한 곳만 고치면 전체 앱에 반영된다는 걸 기억하고, 개별 앱 파일에 예외 처리를 중복 작성하지 않는다.
5. 이미지 생성이 필요하면 §7을 먼저 읽을 것 — 크기 파라미터의 실제 한계와 폴백 모델명이 언제든 바뀔 수 있다는 점을 전제로 설계.
