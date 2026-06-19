# D1 코드 동기화 패턴 (byeduin 공용)

read-tree(`/api/readtree`)에서 검증된 **"로그인 없는 코드 기반 + 로컬 우선 + 서버 백업"**
동기화 패턴을, byeduin 내부 다른 앱에서 재사용할 수 있도록 공용 헬퍼로 추출했다.

- 서버: [`functions/api/_sync.js`](../functions/api/_sync.js)
- 클라이언트: [`public/common/sync.js`](../public/common/sync.js) → 전역 `VivesSync`
- DB: byeduin 전용 D1 1개(`BYEDUIN_DB`, [wrangler.toml](../wrangler.toml)) + **앱별 테이블 접두사**

> ⚠️ 이 D1은 **byeduin(eduin.info) 내부 전용**이다. ecoin·ssac·edu-portal 등 별도
> Pages 프로젝트는 각자의 D1을 둔다(같은 패턴을 복제할 수는 있음). 아래 적합도 분석도
> byeduin 내부 앱만 대상으로 한다.

---

## 1. 핵심 설계 원칙 (read-tree에서 추출)

| 원칙 | 내용 |
|---|---|
| **통합 익명 코드** | byeduin 전 앱 **공용 코드 1개**(6자리, `crypto.getRandomValues`). 로그인·개인정보 0. → §1-1 |
| **로컬 우선** | localStorage가 진실의 원천. 서버는 백업·다기기 이어쓰기용. |
| **장애 무력화** | 오프라인·엔드포인트 없음·에러는 클라이언트가 조용히 무시 → 앱은 항상 동작. |
| **LWW 머지** | 타임스탬프(ISO8601) 비교로 최신 우선 병합. 충돌 해결이 단순·견고. |
| **멱등 upsert** | `ON CONFLICT … DO UPDATE`로 재시도·중복에 안전. |
| **입력 화이트리스트** | 코드/항목ID 정규식 검증 + prepared+bind로 주입 차단 + 용량 상한. |
| **앱별 테이블 접두사** | `read_tree_*`, `flash_deck_*` … DB 하나를 네임스페이스로 공유. |

### 1-1. 통합 코드 정책 (결정됨)

코드는 **앱별이 아니라 byeduin 전체 1개**를 공유한다. `localStorage`는 origin(eduin.info)
단위로 공유되므로, 공용 키(`vives:code`) 하나면 모든 `/apps/*`가 같은 코드를 자동 인식한다.
→ "앱마다 코드 따로" 문제 해소, 한 번 발급하면 전 앱·전 기기에서 따라옴.

- **개인정보 0 유지**: 코드는 무작위 난수. 이름·이메일·학번 등 식별정보와 연결하지 않는다
  (연결하는 순간 PIPA상 개인정보가 되어 동의·보관·파기 의무 발생).
- **학생용 아님 → 6자리 유지**, QR/링크 이전 미도입(수동 입력). 향후 필요 시 자리수 상향·QR 추가 가능.
- 코드 발급/조회는 `VivesSync.ensureCode()` / `getCode()` / `setCode()` / `clearCode()` 사용
  (모두 공용 키 `vives:code` 기준).

---

## 2. 두 가지 저장 모드

### doc 모드 — 코드당 JSON 문서 1개
상태를 통째 blob으로 들고 있는 앱에 적합(현재 대다수 byeduin 앱이 이 형태).
문서 단위 LWW. 테이블: `(code PK, data, updated_at)`.

```
GET    /api/<app>?code=ABC123              -> { data, updated_at } | { data:null }
PUT    /api/<app> { code, data, updatedAt }-> upsert (들어온 게 과거면 stale 반환)
DELETE /api/<app> { code }                 -> 삭제
```

### set 모드 — 코드당 다수 항목
항목별 토글·값(read-tree의 "읽음" 처럼). 항목 단위 LWW.
테이블: `(code, item_id, value, updated_at, PK(code,item_id))`.

```
GET    /api/<app>?code=ABC123                       -> { items: { id: { v, at } } }
PUT    /api/<app> { code, itemId, value, updatedAt }-> 항목 upsert
DELETE /api/<app> { code, itemId }                  -> 항목 삭제
```

---

## 3. 새 앱에 붙이는 법 (3단계)

### ① 마이그레이션 작성·적용
`migrations/NNNN_<app>.sql` 생성. SQL은 헬퍼의 스키마 생성기와 동일하다:

```sql
-- doc 모드 예: flash-deck
CREATE TABLE IF NOT EXISTS flash_deck_docs (
  code       TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
```bash
npx wrangler d1 execute byeduin --local  --file=migrations/NNNN_<app>.sql
npx wrangler d1 execute byeduin --remote --file=migrations/NNNN_<app>.sql
```

### ② 서버 함수 한 줄
```js
// functions/api/flash-deck.js
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'flash_deck_docs' });
```
set 모드면 `createSetSync({ table: 'xxx_items' })`.

### ②-1 선택 동기화 앱은 `mountDocSync` 한 번이면 끝

doc 모드 + "헤더 동기화 버튼"을 통째로 주입하는 UI 헬퍼. 앱은 소유 키만 알려주면 된다.
`localStorage.setItem`을 가로채 해당 키가 바뀌면 자동(디바운스) push, 로드 시 자동 pull.

```js
// 예: timer
VivesSync.mountDocSync({
  apiUrl: '/api/timer',
  keys: ['alarms', 'alarm_logs'],   // 이 앱이 소유한 localStorage 키
  appName: '알람',
  onApplied: () => { /* 서버→로컬 머지 후 인메모리 상태 재로딩 + 재렌더 */ },
});
```
- 인메모리 변수를 들고 있는 앱(blocks-universe·timer)은 `onApplied`에서 그 변수들을
  localStorage로부터 재로딩한 뒤 재렌더해야 한다. 렌더 때마다 저장소를 새로 읽는
  앱(flash-deck·search)은 `onApplied`에 재렌더만 넣으면 된다.

### ③ 클라이언트 연결 (직접 createDoc 쓰는 경우)
```html
<script src="/common/sync.js"></script>
```
```js
const sync = VivesSync.createDoc({
  apiUrl: '/api/flash-deck',
  getLocal: () => JSON.parse(localStorage.getItem('vives-flashdeck') || '{"decks":[]}'),
  setLocal: (data) => localStorage.setItem('vives-flashdeck', JSON.stringify(data)),
});
// 통합 코드 확보(없으면 자동 발급) — 전 앱 공용
const code = VivesSync.ensureCode();
// 앱 시작 시: 서버↔로컬 머지
await sync.pull(code);
// 상태 변경 후 (디바운스 저장)
sync.push(code);
```

> 코드는 `VivesSync.ensureCode()`로 전 앱이 공유한다(공용 키 `vives:code`).
> 사용자가 다른 기기의 코드를 가져올 때만 `VivesSync.setCode(입력값)`으로 교체.

---

## 4. byeduin 앱 서버-DB 적합도 분석

기준: ① 시간이 지나며 **누적되는 사용자 상태**가 있는가(localStorage 사용) ② 다기기 이어쓰기·
공유·집계 등 **서버화 시 확장 가치**가 큰가. (read-tree는 이미 적용 완료 — 기준 모델)

### 🟢 1순위 — 확장 가치 높음 (doc 모드 즉시 적용 가능)

| 앱 | 저장 데이터 | 서버화 시 열리는 것 |
|---|---|---|
| **scoring-table** (채점표) | 채점 설정(MK_KEY)+점수(SC_KEY) | 교사가 PC↔태블릿 이어서 채점, 학급 점수 백업·복구, 향후 집계 뷰 |
| **flash-deck** (플래시카드) | `{decks:[]}` 사용자 제작 덱 | 덱을 코드로 다기기 동기화·공유, "학급 공용 덱" 배포(이미 보기전용 공유 존재 → 자연 확장) |
| **allowance-calculator** (용돈) | `vives-allowance-history` 거래 이력 | 학생별 장부를 기기 바꿔도 이어쓰기, 경제교육 장기 기록(ecoin 컨셉과 연결) |

### 🟡 2순위 — 가치 있으나 조건부

| 앱 | 비고 |
|---|---|
| **book-share** | 이미 URL/단축링크 기반 공유. D1로 "지속되는 공유 목록·조회수"까지 확장 가능하나 현 구조로도 충분. |
| **chalkboard** | 공유 기능 보유. 단일 사용자 백업엔 doc 모드 적합. 단 *실시간 협업*까지 가려면 D1보다 Durable Objects가 적합. |
| **search** | 최근 문서 등 서버 데이터 사용 중이나 사용자별 상태 동기화 수요는 낮음. |

### 🔴 비대상 — 상태가 휘발성/설정성

`grid-maker`·`math-sheet`·`timer`·`shortcut`·`qr`·`bubble-chat`(실시간은 DO 영역)·`moon-phase`·
`volcano`·`file-tools`·`md-editor`·`notion-*`·`signage-maker`·`yt-thumb` 등 —
저장 상태가 로컬 설정 수준이거나 서버 동기화 수요가 낮아 현시점 D1 대상 아님.

### 적용 현황 (2026-06-20)

- ✅ **read-tree** — set 모드로 전환 완료(통합 코드 + `createSetSync`). 로컬·원격 마이그레이션 적용.
- ✅ **flash-deck · blocks-universe · timer · search** — 선택 동기화(헤더 '동기화' 버튼, `mountDocSync`, doc 모드) 적용. 원격 테이블 생성(0003) 완료.
  - search 기록 동기화는 `/api/search`(RAG 검색)와 충돌 피해 `/api/search-sync` 사용.
  - blocks-universe는 즐겨찾기·재생목록·최근만 동기화(영상 길이 캐시 제외).
- ⏳ **math-sheet · md-editor** — 코드 다중문서 + 서버 열기(set 모드) 예정.

> **참고 적용 순서: scoring-table → flash-deck → allowance-calculator.**
> 셋 다 doc 모드라 `_sync.js` + `/common/sync.js`로 거의 그대로 붙는다.
> (실시간 협업이 필요한 chalkboard/bubble-chat은 D1이 아니라 Durable Objects 검토.)
