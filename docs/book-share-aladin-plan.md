# book-share — 알라딘 API 캐시·차단 대응 계획

> 작성: 2026-08-20 · 대상: `functions/api/book-lookup.js`, `src/pages/apps/book-share/index.astro`
> 계기: 알라딘 Open API 도메인 통합 공지(2026-08-20~08-31) 및 호출량 제한 안내

---

## 1. 배경

알라딘이 2026-08-20 공지로 두 가지를 알려 왔다.

1. **도메인 통합**: `openapi.aladin.co.kr` → `aladin.co.kr` (8월 31일까지 전환)
2. **호출량 제한**: 과도한 호출 시 일시 차단, **10분 후 해제**. 구체적 기준은 비공개.

### 도메인 — 우리는 이미 대상이 아님

`book-lookup.js`는 처음부터 매뉴얼에 적힌 정본 호스트(`www.aladin.co.kr/ttb/api/...`)를 쓰고 있었고, 저장소 전체에서 `openapi.aladin.co.kr` 참조는 0건이다. 2026-08-20 실측:

| 호스트 | 응답 |
|---|---|
| `aladin.co.kr` | 200 — `{"errorCode":4, ...}` (테스트용 가짜 키에 대한 정상 응답) |
| `www.aladin.co.kr` | 200 — 동일 |
| `openapi.aladin.co.kr` | **403 Forbidden** — 이미 차단됨 |

즉 8월 31일 마감에 대해 코드 변경 없이도 정상 동작한다. 다만 공지의 "(변경) aladin.co.kr"이 apex인지 `www` 포함인지 애매하고, 향후 추가 통합 공지가 올 수 있으므로 **호스트를 상수로 분리**해 한 줄 수정으로 대응 가능하게 만든다.

### 호출량 제한 — 이쪽이 실질 리스크

book-share는 **서버사이드 공용 TTB 키 1개**로 모든 이용자의 조회를 대행한다. 따라서 차단의 폭발 반경이 크다.

- 한 교사가 ISBN 50개를 붙여넣으면 그 순간 **사이트 전체**가 10분간 조회 불가.
- **캐시가 전혀 없다.** ISBN→서지정보는 사실상 불변인데 매번 알라딘을 호출한다. 같은 학년 교사 여럿이 같은 도서목록을 조회하면 전부 중복 호출.
- 차단 시 알라딘이 JSON 대신 HTML/에러를 주면 현재 코드는 `'알라딘 응답 파싱 실패'`로 뭉개서 502를 반환하고, 클라이언트는 그 문자열을 **책 제목 칸에 그대로 박아 넣는다**. 게다가 루프를 멈추지 않아 차단 상태에서 남은 ISBN을 계속 두드린다.
- 현재 유일한 완화책인 클라이언트 `sleep(300)`은 브라우저 자율 규제라 탭을 여러 개 열면 무력화된다.

---

## 2. 목표

1. 알라딘 실호출 횟수를 **캐시 히트만큼 0으로** 줄인다.
2. 차단이 발생해도 **사용자에게 정확히 안내**하고, 차단 중 추가 호출을 **즉시 중단**한다.
3. 도메인 변경 요구가 다시 와도 **한 줄 수정**으로 끝낸다.

무료 티어 유지가 제약조건이므로 D1(이미 `BYEDUIN_DB` 바인딩 존재)만 사용하고 새 유료 리소스는 도입하지 않는다.

---

## 3. 변경 내역

### 3-1. D1 영구 캐시 (`book_cache`)

새 마이그레이션 `migrations/0012_book_cache.sql`:

```sql
CREATE TABLE IF NOT EXISTS book_cache (
  isbn13 TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
```

- **읽기**: 요청 시 먼저 `book_cache`를 조회. 히트면 알라딘을 호출하지 않고 즉시 반환(`X-Cache: HIT`).
- **TTL**: 90일. 서지정보 자체는 불변이지만 `priceStandard`(정가)가 개정판에서 바뀔 수 있어 무기한은 피한다. 만료 행은 미스로 처리하고 재조회 후 upsert.
- **쓰기**: 알라딘 조회 성공 시에만 upsert. 실패·404는 캐시하지 않는다(일시 장애를 90일 고착시키지 않기 위해).
- **DB 없을 때**: `env.BYEDUIN_DB`가 없거나 D1이 오류를 내면 캐시를 조용히 건너뛰고 기존 동작(직접 호출)으로 진행한다. 캐시는 최적화이지 필수 경로가 아니다.

로컬/원격 적용:

```
npx wrangler d1 execute byeduin --local  --file=migrations/0012_book_cache.sql
npx wrangler d1 execute byeduin --remote --file=migrations/0012_book_cache.sql
```

### 3-2. 서버 측 차단 감지·에러 분기

`book-lookup.js`에서 다음을 429로 매핑하고 `{ error, retryAfter: 600, blocked: true }`와 `Retry-After: 600` 헤더를 함께 내보낸다.

| 상황 | 판정 |
|---|---|
| HTTP 429 또는 403 | 차단 |
| 응답이 JSON이 아님(HTML 등) | 차단으로 간주 — 알라딘은 차단 시 안내 페이지를 반환 |
| `errorCode` 8(과도한 호출) 계열 / 메시지에 `차단`·`초과` 포함 | 차단 |

그 외 `errorCode`는 기존대로 502. 도서 없음은 404 유지.

에러 메시지는 초등 교사 눈높이로 `"알라딘 조회가 일시 제한되었습니다. 10분 후 다시 시도해 주세요."`.

### 3-3. 클라이언트 루프 중단

`index.astro`의 `lookupISBN`이 429를 만나면 `blocked` 플래그가 붙은 오류로 reject하고, `startFetch` 루프는 이를 잡아 **남은 ISBN을 처리하지 않고 즉시 빠져나온다**. 처리하지 못한 ISBN은 목록에 추가하지 않고(빈 행 오염 방지) 토스트로 몇 건이 남았는지 알린다.

### 3-4. 호스트 상수화

```js
const ALADIN_HOST = 'https://www.aladin.co.kr';
```

값은 현행 유지(실측상 apex/`www` 동일 동작). 추후 공지 시 이 한 줄만 바꾼다.

---

## 4. 범위 밖 (이번에 안 하는 것)

- **배치 상한(ISBN 50개 제한)**: 캐시가 붙으면 반복 조회는 대부분 사라지므로 효과를 먼저 관측한 뒤 판단한다. 필요해지면 후속 작업.
- 개인별 TTB 키 입력 UI — 로그인 없는 설계 원칙과 충돌하고 교사 부담이 큼.

---

## 5. 검증

1. `npx wrangler pages dev` 로컬 구동 후 ISBN 조회 → 첫 호출 `X-Cache: MISS`, 재호출 `HIT` 확인.
2. `book_cache` 행이 생겼는지 `wrangler d1 execute byeduin --local --command "SELECT * FROM book_cache"`로 확인.
3. 잘못된 ISBN → 404, 정상 동작 확인.
4. 차단 경로는 실제 재현이 어려우므로, 알라딘 응답을 HTML로 가정한 분기가 429를 내는지 코드 리뷰로 확인.

---

## 6. 후속

- `docs/OVERVIEW.md` book-share 행에 캐시 사용 사실 반영.
- 알라딘이 추가 공지를 보내면 §3-4 상수만 수정.
