# 마당(madang) v2 개선 계획서

> 작성: 2026-07-03 (Claude Fable — 계획 수립, 미결정 사항 확정 반영 완료)
> **구현 분담(난이도 기준)**: Phase 1 + 위험 마이그레이션(likes 테이블 재생성) = **Opus** · Phase 2·3·4 = **Sonnet**. Fable은 계획만 담당, 구현하지 않음.
> 대상 코드: [`public/apps/madang/index.html`](../public/apps/madang/index.html) ·
> [`functions/api/madang.js`](../functions/api/madang.js) ·
> [`migrations/0006~0009`](../migrations/) · 패턴 문서 [`d1-sync-pattern.md`](./d1-sync-pattern.md) §5

---

## 0. 목표와 대상 사용자

| 시나리오 | 규모 | 핵심 요구 |
|---|---|---|
| **초등 저학년 × 1인 1태블릿** | 학급 20~30명 동시 접속 | 타이핑 최소화(사진·그림 카드), 큰 터치 타깃, QR 즉시 입장, 교사 사전승인·잠금 |
| **교원연수 (교사 대상)** | 30~150명 동시 접속 | 빠른 입장(링크/QR), 반영 지연 체감 최소화, 발표(프로젝터) 모드, 결과 내보내기 |

**v2의 두 축**: ① 폴링·렌더링 성능을 저사양 태블릿·학교 와이파이 기준으로 재설계 ② 저학년·연수 모두에서 "설명 없이 30초 안에 참여"가 되는 UX.

기존 설계 원칙(로그인 없음 · 개인정보 0 · 코드 HMAC 신원 · D1 단일 DB)은 **그대로 유지**한다.

---

## 1. 현재 구조 요약 (있는 그대로)

- **서버**: Pages Function 단일 파일 [`madang.js`](../functions/api/madang.js). GET(보드+카드 전체) / POST(action 라우팅: create·post·editCard·deleteCard·settings·deleteBoard·addComment·deleteComment·like·join·setNick·members).
- **DB**: D1 `BYEDUIN_DB`, 테이블 5개 — `madang_boards`(settings JSON) · `madang_cards`(board_id 파티션, 카드당 최대 12KB, 보드당 300장) · `madang_comments` · `madang_likes` · `madang_members`.
- **클라이언트**: 단일 `index.html`(약 80KB, 바닐라 JS). `setInterval` **2.8초 폴링**(index.html:457, 768)으로 GET 전체 응답을 받아 `reconcile()`(index.html:623)로 DOM 증분 반영. HTML 카드는 카드마다 `sandbox iframe`(index.html:546-548) + postMessage 높이 조절.
- **검열**: 게시/수정/댓글 시 OpenAI Moderation **동기 호출**(madang.js:74-93). 키 없음·오류 시 통과.
- **신원**: `vives:code`(또는 `madang:code` 폴백) → HMAC 토큰. 개설자/작성자 판정.

---

## 2. 문제 진단

### 2-1. 성능 (P = Performance)

| # | 문제 | 근거 | 영향 |
|---|---|---|---|
| **P1** | **폴링마다 전체 페이로드 재전송.** 변경 여부와 무관하게 보드 메타 + 카드 전문(全文) + (켜져 있으면) 전체 좋아요 행 + **전체 댓글 전문**을 매 2.8초 반환. 델타/ETag/304 없음 | madang.js:161-193, index.html:750-767 | 카드 12KB×수십 장이면 폴링 1회 수백 KB. 30대 동시면 학교 와이파이·D1 rows_read 모두 낭비. "느리다" 체감의 최대 원인 |
| **P2** | **GET 1회 = 직렬 D1 쿼리 최대 4개** (board → cards → likes 전행 → comments 전행). `db.batch()` 미사용. likes는 행 전체를 가져와 JS에서 집계 | madang.js:147-177 | 응답 지연 + rows_read 과금 누적 |
| **P3** | **HTML 카드 = 카드당 iframe(allow-scripts)** + 로드 타이밍 setTimeout 3회 | index.html:525-548 | 저사양 태블릿에서 iframe 수십 개는 메모리·CPU 킬러. 스크롤 버벅임의 주범 |
| **P4** | 검열 API가 게시 경로에 **동기 삽입** (타임아웃 없음) | madang.js:259, 288, 370 | 게시 버튼 → 반영까지 +300ms~수 초. 저학년은 "안 되는 줄 알고" 연타 |
| **P5** | `insertSorted` O(n²), `renderLayout`은 레이아웃 변경 시 전체 DOM 폐기 재생성 | index.html:655-678 | 300장 기준 체감 끊김 |
| **P6** | 폴링 간격 고정 2.8초. 변경 없어도, 수업 끝나 방치돼도 동일 | index.html:457 | 대역·배터리 낭비. 반대로 활발할 땐 2.8초도 느리게 느껴짐 |

### 2-2. 사용성 (U = Usability)

| # | 문제 | 대상 |
|---|---|---|
| **U1** | 입장에 "코드 6자리 타이핑 + 별명 타이핑" 필수. QR은 있으나 스캔 후에도 별명 입력 모달을 거침 | 저학년: 사실상 진입 장벽. 연수: 번거로움 |
| **U2** | 카드 유형이 **텍스트/HTML뿐**. 사진·그림·음성 없음 → 글씨를 못/느리게 쓰는 저학년이 표현할 수단이 없음 | 저학년 치명적 |
| **U3** | 교사 통제 수단 부족: **사전 승인(승인 후 게시) 없음**, 보드 잠금(읽기 전용 얼리기) 없음, 이름 숨김 없음 | 저학년·공개 수업 |
| **U4** | 발표 모드 없음(프로젝터에 그대로 띄우면 툴바·FAB 노출, 새 카드 강조 없음) | 연수·수업 공유 |
| **U5** | 댓글·좋아요가 텍스트 중심. 저학년은 이모지 반응이 적합 | 저학년 |
| **U6** | 게시 실패(오프라인·검열·PIN)가 어른용 문구. 재시도 큐 없음 | 저학년 |
| **U7** | 보드 재사용(지난 학기 마당을 틀만 복제) 불가 | 교사 |

---

## 3. 개선 계획 — 4단계

> 각 Phase는 독립 배포 가능. **Phase 1·2가 필수 코어**, 3·4는 순차 확장.
> DO(WebSocket) 전환은 **하지 않는다** — §6 참고.

### Phase 1 — 성능 재설계 (P1~P6)

**1-A. rev 기반 조건부 폴링 (핵심)**

- `madang_boards`에 `rev INTEGER NOT NULL DEFAULT 0` 추가. **모든 변이 액션**(post/editCard/deleteCard/settings/addComment/deleteComment/like/setNick)에서 `UPDATE madang_boards SET rev = rev + 1 …`을 같은 `db.batch()`에 포함.
- GET에 `?rev=N` 파라미터: `board.rev === N`이면 `{ unchanged: true, rev: N }`만 반환(수십 바이트, D1 쿼리 1개). 다르면 전체 응답 + `rev`.
- 클라이언트 `tick()`은 마지막 rev를 들고 폴링. `unchanged`면 아무것도 안 함.
- **효과**: 폴링의 90%+가 무변경 → 페이로드 수백 KB → ~100B, rows_read 4쿼리 → 1쿼리.

**1-B. 댓글 분리 + 좋아요 집계 쿼리화**

- GET 응답에서 댓글 **전문 제거** → 카드에 `commentCount`만 포함(`SELECT card_id, COUNT(*) … GROUP BY card_id`).
- 댓글 전문은 모달 열 때만: 새 GET `?board=ID&comments=CARD_ID` 또는 POST `action:'getComments'`.
- 좋아요도 `GROUP BY card_id` 집계 + `liked` 여부는 `WHERE liker_token = ?` 한 쿼리로.
- board+cards+likes집계+댓글카운트를 **`db.batch()` 1회**로.

**1-C. 게시 경로 지연 제거**

- 검열 호출에 **AbortController 2.5초 타임아웃** — 초과 시 통과(현행 "가용성 우선" 정책과 일관) + `ctx.waitUntil`로 사후 검열 → flagged면 카드 `hidden` 처리(1-D status 칼럼 활용).
- 한국어 금칙어 로컬 프리필터(정규식 수십 개)를 검열 API **앞에** 둬서 명백한 비속어는 API 왕복 없이 즉시 차단.
- `post` 액션의 `COUNT(*)` 상한 검사(madang.js:256)를 INSERT와 함께 batch로.

**1-D. 마이그레이션 `0010_madang_v2.sql`**

```sql
ALTER TABLE madang_boards ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE madang_cards  ADD COLUMN status TEXT NOT NULL DEFAULT 'live';  -- live|pending|hidden (Phase 4 승인모드 겸용)
CREATE INDEX IF NOT EXISTS idx_madang_comments_card ON madang_comments (board_id, card_id);
```

**1-E. 클라이언트 렌더링**

- HTML 카드 iframe을 **IntersectionObserver 지연 생성**: 뷰포트 진입 시 `srcdoc` 주입, 이탈 시(선택) 해제. 동시 활성 iframe 상한(예: 12개).
- `insertSorted`를 정렬 키 배열 이진탐색으로, 신규 카드 다건은 `DocumentFragment`로 일괄 삽입.
- 적응형 폴링: 기본 2초 → 최근 60초간 rev 무변경이면 5초 → 8초로 백오프, 내 게시/변이 직후엔 즉시 1회 tick(이미 유사 구조 있음).

**Phase 1 수용 기준**

- [ ] 무변경 폴링 응답 ≤ 200B, D1 쿼리 1개
- [ ] 카드 50장·댓글 200개 보드의 변경 폴링 페이로드가 v1 대비 80%↓ (댓글 전문 제외 효과)
- [ ] 게시 → 본인 화면 반영 ≤ 300ms(낙관 반영), 타 기기 반영 ≤ 2.5초
- [ ] HTML 카드 30장 보드에서 스크롤 시 활성 iframe ≤ 12개

### Phase 2 — 입장·참여 UX (U1, U5, U6)

**2-A. QR/링크 원탭 입장**

- 초대 URL을 `…/apps/madang/#CODE` (+PIN이면 `#CODE:PIN` — PIN을 QR에 포함할지는 개설자 체크박스, **기본 미포함**(보안 우선, 확정)). 링크 진입 시 코드 입력 화면 생략, 바로 별명 단계로.
- **저학년 모드 분기(확정)**: 보드 개설 시 대상을 "저학년용/일반" 중 선택 → `settings.kidMode: true|false`. **저학년용**이면 별명 단계가 "이모지 아바타 + 자동 별명"(예: 🦊 여우 7) 버튼 1개 기본, 직접 입력은 접힌 옵션. **일반**(연수 등)이면 직접 입력이 기본이고 자동 별명은 보조 버튼. 자동 별명은 형용사+동물 조합 로컬 생성. 어린이 친화 문구(2-C)도 kidMode일 때 적용.
- 개설자 화면에 **전체화면 QR 버튼**(프로젝터에 띄우는 용도, 코드 6자리 대형 표기 병행 — 이미 있는 `openInvite` 확장).

**2-B. 이모지 반응 (좋아요 확장)**

- `madang_likes`에 `emoji TEXT NOT NULL DEFAULT '❤️'` 추가, PK를 `(board_id, card_id, liker_token, emoji)`로 재구성(테이블 재생성 마이그레이션).
- 보드 설정 `reactions: ['❤️','👍','😄','👏']` — **기본 4종 확정**(긍정 반응만, 개설자가 다른 이모지로 교체 가능·최대 4종). 기존 `allowLikes`는 `reactions` 유무로 흡수하되 하위호환 유지.
- 카드 푸터에 이모지별 카운트 칩. 터치 타깃 최소 40×40px.

**2-C. 어린이 친화 실패 처리**

- 게시 실패 시 문구를 상황별 아이콘+짧은 문장으로("🌐 인터넷이 잠깐 끊겼어요. 다시 눌러 보세요"). 검열 차단은 "이 말은 올릴 수 없어요. 선생님께 물어보세요". 어린이 문구는 `kidMode`일 때 적용, 일반 보드는 성인용 간결 문구.
- 오프라인 게시 시 로컬 대기열(localStorage) 1건 보관 → 재연결 시 자동 재시도.

**Phase 2 수용 기준**

- [ ] QR 스캔 → 카드 작성 가능까지 터치 3회 이하, 타이핑 0회(자동 별명 경로)
- [ ] 이모지 반응 v1 좋아요 데이터 하위호환(기존 행 → ❤️)

### Phase 3 — 카드 유형 확장: 사진·그림 (U2)

> **R2 버킷 신설(확정)**: **byeduin 공용 버킷 `byeduin-media`** — 마당 전용이 아니라 프로젝트 전체 앱이 공유. wrangler.toml `[[r2_buckets]]` binding `MEDIA_R2`. 앱별 키 프리픽스로 구분(마당은 `madang/BOARD_ID/uuid.webp`). 공개 도메인 대신 Function 프록시로 서빙해 접근제어(비공유 보드) 유지.

**3-A. 사진 카드** — 저학년 1순위 기능

- 클라이언트에서 촬영/선택 → canvas 리사이즈(최대 1280px, WebP/JPEG 품질 0.8, **≤ 400KB**) → `POST /api/madang-upload` (multipart 또는 raw body, 코드·보드·PIN 검증 동일) → `{ key }` → 카드 `type:'image'`, `content:key`.
- 서빙: `GET /api/madang-img/[key]` — key는 `madang/BOARD_ID/uuid.webp` 구조로 보드 접근제어(shared/PIN/만료)를 통과해야 스트림. `Cache-Control: private, max-age=3600`.
- 삭제 연쇄: 카드 삭제·보드 삭제 시 R2 객체 삭제(`ctx.waitUntil`).
- 상한: 보드당 이미지 총량(예: 60MB), 초과 시 게시 차단 안내.

**3-B. 그림 카드** — 타이핑 대체 표현 수단

- 인앱 미니 캔버스: 굵은 펜 1종, 색 6개, 지우개, 되돌리기 1단계, 전체 지우기. **그 이상 넣지 않는다**(저학년 기준). 완성 시 PNG → 3-A 업로드 파이프라인 재사용.
- chalkboard 앱의 캔버스 코드 재사용 가능 여부 검토(있으면 추출, 없으면 200줄 내 자체 구현).

~~**3-C. 음성 카드**~~ — **v2 범위에서 제외 확정** (§6 참고)

**Phase 3 수용 기준**

- [ ] 태블릿 카메라 → 사진 카드 게시까지 터치 4회 이하, 업로드 3G급 회선에서 ≤ 5초
- [ ] 비공유/PIN 보드의 이미지가 URL 직접 접근으로 열리지 않음
- [ ] 보드 삭제 시 R2 잔존 객체 0

### Phase 4 — 교사 통제·진행 도구 (U3, U4, U7)

**4-A. 사전 승인 모드** — `settings.approval: true`

- 켜면 참여자 카드가 `status:'pending'`으로 저장. 본인+개설자에게만 보임(본인에겐 "선생님 확인 중 ⏳" 배지). 개설자 화면에 승인 대기 큐(일괄 승인/거절). 승인 시 `live` + rev 증가.
- GET은 비개설자에게 `status='live' OR (pending AND 본인)`만 반환 — **서버에서 필터**(클라이언트 숨김 아님).

**4-B. 보드 잠금(얼리기)** — `settings.frozen: true`

- 읽기·반응은 허용하되 post/editCard/addComment 차단(옵션: 반응도 차단). 툴바에 자물쇠 표시. "지금은 발표 시간" 용도.

**4-C. 이름 숨김** — `settings.hideNames: true`

- 서버가 비개설자 응답에서 nickname을 "익명"으로 치환. 공개 수업·연수에서 부담 완화.

**4-D. 발표 모드 (클라이언트 전용)**

- 개설자 메뉴 "🖥 발표 모드": 툴바·FAB 숨김 + 카드 확대 슬라이드쇼(←/→, 자동 넘김 옵션) + 새 카드 도착 시 하이라이트 토스트. URL `#CODE?present=1`로 직접 진입 가능(프로젝터 PC용).

**4-E. 마당 복제(템플릿)**

- 개설자 목록에서 "복제": 제목·설정·섹션만 복사한 새 보드 생성(카드 제외). `action:'duplicate'`.

**Phase 4 수용 기준**

- [ ] 승인 모드에서 타 참여자에게 pending 카드가 API 응답 자체에 포함되지 않음
- [ ] 잠금 상태에서 게시 시도 시 어린이 친화 안내
- [ ] 발표 모드에서 30초 무조작 시에도 폴링 유지·새 카드 하이라이트

---

## 4. API 변경 요약 (v1 하위호환 유지)

| 구분 | 변경 |
|---|---|
| GET | `?rev=N` 조건부 응답 · 카드에 `commentCount`·`reactions` 집계 포함, 댓글 전문 제거 · `status` 필터 |
| GET | `?comments=CARD_ID` 댓글 전문 조회(신규) |
| POST | `approve` / `reject`(개설자, 승인모드) · `duplicate`(개설자) · `react`(이모지, 기존 `like` 흡수·별칭 유지) 신규 |
| 신규 엔드포인트 | `POST /api/madang-upload` · `GET /api/madang-img/[key]` |
| settings patch 확장 | `approval` · `frozen` · `hideNames` · `reactions[]` · `kidMode`(개설 시 "저학년용/일반" 선택 — 별명·문구 UX 분기) |

기존 클라이언트(v1)가 살아 있어도 동작하도록: `rev` 미지정 GET은 종전대로 전체 응답(단, 댓글 전문은 **v2 배포와 동시에 클라이언트도 갱신**되므로 제거해도 무방 — 단일 배포 단위).

---

## 5. 성능 목표 (연수 150명 시나리오 검증 기준)

| 지표 | v1 현재 | v2 목표 |
|---|---|---|
| 무변경 폴링 응답 | 전체 페이로드(수십 KB~수백 KB) | **≤ 200B** |
| 폴링당 D1 쿼리 | 3~4 직렬 | 무변경 1 / 변경 1 batch |
| 게시 지연(체감) | 검열 대기 포함 0.5~수 초 | 낙관 반영 즉시, 서버 확정 ≤ 1초(검열 타임아웃 2.5초) |
| 150명 동시 폴링 | ~54 req/s 전체 페이로드 | 같은 req/s이나 대부분 초소형 응답 + 백오프로 ~20 req/s |
| 저사양 태블릿 스크롤 | iframe 수십 개 활성 | 활성 iframe ≤ 12 |

---

## 6. 하지 않기로 한 것 (스코프 밖 — 근거 포함)

1. **Durable Objects/WebSocket 실시간 전환** — rev 폴링이면 2초 내 반영으로 교실 요구 충족. Pages 프로젝트에 DO를 붙이려면 별도 Worker 분리 또는 Workers 마이그레이션이 필요해 구조 변화가 큼. **rev 폴링 배포 후 실측이 부족할 때만 재논의.**
2. **로그인·계정** — 개인정보 0 원칙 유지. 승인모드+HMAC 신원으로 충분.
3. **그림 도구 고도화**(레이어·도형 등) — chalkboard 앱 영역. 마당은 "빨리 그려서 붙이는" 수준만.
4. **이미지 AI 검열** — 비용 대비 승인모드가 더 확실. 보류.
5. **음성 카드** — 검열 불가·소음 문제로 v2에서 제외 확정(2026-07-03). 추후 별도 검토.

---

## 7. 구현 가이드 (Opus · Sonnet 분담)

**분담 원칙(확정)**: 서버 성능 재설계와 데이터 파괴 위험이 있는 마이그레이션은 **Opus**, UI 중심 작업은 **Sonnet**. Fable은 구현하지 않는다.

**작업 순서** (커밋 단위 권장):

| # | 작업 | 담당 |
|---|---|---|
| 1 | `0010_madang_v2.sql` + rev 증가를 모든 변이 액션에 삽입 + GET `?rev` 분기 — *여기까지만 배포해도 성능 절반 해결* | **Opus** |
| 2 | GET batch화 + 댓글 카운트화 + `getComments` 분리 + 클라이언트 tick/댓글모달 대응 | **Opus** |
| 3 | 검열 타임아웃 + 금칙어 프리필터 + waitUntil 사후검열(hidden 처리) | **Opus** |
| 4 | iframe 지연 생성 + 적응형 폴링 + insertSorted 개선 | **Opus** |
| 5 | QR 원탭 입장 + kidMode 개설 선택 + 자동 별명 + 어린이 문구 | Sonnet |
| 6 | 이모지 반응 — likes 테이블 재생성 마이그레이션은 **Opus**(데이터 이관 SQL 필수: 기존 행 emoji='❤️'), UI 칩은 Sonnet | **Opus**+Sonnet |
| 7 | R2(`byeduin-media`) 업로드/서빙/삭제연쇄 + 사진 카드 + 그림 카드 | Sonnet |
| 8 | 승인모드 → 잠금 → 이름숨김 → 발표모드 → 복제 | Sonnet |

**주의사항**

- 변이 액션마다 rev UPDATE를 **빠뜨리면 그 변경이 영원히 폴링에 안 잡힌다.** 액션 핸들러 공통 헬퍼(`bumpRev(db, boardId)`)로 강제할 것.
- `madang_likes` PK 변경은 SQLite 특성상 `CREATE TABLE new → INSERT SELECT → DROP → RENAME` 절차. `--local` 검증 후 `--remote`.
- 이미지 프록시에서 board 접근제어를 재검사할 때 GET 폴링과 동일한 `checkAccess` 로직 재사용(madang.js:116-123) — 복붙 말고 함수 공유.
- `status='pending'` 필터를 **모든** 카드 조회 경로(GET, 댓글 대상 카드 존재 검사 등)에 일관 적용.
- 배포 전 체크: `0010` `--remote` 적용, R2 버킷 `byeduin-media` 생성 + `MEDIA_R2` 바인딩, `MADANG_PEPPER`·`OPENAI_API_KEY` 시크릿 확인.
- 테스트: `npx wrangler pages dev` + 로컬 D1로 ① rev 무변경/변경 분기 ② 승인모드 응답 필터 ③ 이미지 접근제어 ④ v1 좋아요 이관을 우선 검증.

**확정 사항 (2026-07-03 사용자 결정 — 구현 중 재질문 불필요)**

1. **R2**: byeduin **공용** 버킷 `byeduin-media` 신설(binding `MEDIA_R2`, 무료 티어 10GB). 마당은 키 프리픽스 `madang/BOARD_ID/…` 사용. 다른 앱도 이 버킷을 공유할 수 있게 프리픽스 규약 유지.
2. **음성 카드**: v2 범위에서 제외 (§6-5).
3. **QR+PIN**: 기본 **미포함**(보안 우선). 개설자 체크박스로 opt-in.
4. **이모지 기본 4종**: ❤️ 👍 😄 👏 (개설자 교체 가능).
5. **작업 범위**: Phase 1~4 전부 순차 진행(각 Phase 독립 배포 가능).
6. **저학년 모드**: 보드 개설 시 "저학년용/일반" 선택 → `settings.kidMode`. 저학년용=자동 별명·어린이 문구 기본, 일반=직접 입력 기본.
7. **모델 분담**: Phase 1~4단계·위험 마이그레이션 = Opus, UI 중심(5·7·8단계 등) = Sonnet. Fable은 계획 전담.
