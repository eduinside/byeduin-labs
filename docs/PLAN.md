# byeduin VIVES — 작업 플랜

> 업데이트: 2026-04-04

---

## 진행 중인 작업

### 15. 전체 앱 UX 개선 및 문서화 — 2026-04-04

#### 11. YT Thumbnail 탭 기반 UI 최종 완성
- [x] 항상 3탭 표시 (썸네일 / 재생목록 / 히스토리)
- [x] URL 타입별 탭 활성화/비활성화
  - 듀얼 URL: 모든 탭 활성화
  - 영상만: 썸네일만 활성화, 재생목록 비활성화 (회색)
  - 재생목록만: 재생목록만 활성화, 썸네일 비활성화 (회색)
- [x] 3탭 아래의 모든 버튼 제거 (자동 로드)
- [x] 화살표 버튼으로만 모든 작동 제어
- [x] 탭 클릭 시 자동으로 콘텐츠 로드
- [x] 히스토리 탭에서 통합 히스토리 표시
- [x] 문서 업데이트 (DEVPLAN.md)

#### 12. MD Editor 개선
- [x] 브라우저 로컬 저장 모드 구현
  - 열기 드롭다운: 파일 열기 / 브라우저에서 열기
  - 저장 옵션: 기본 저장 / 브라우저에 저장
  - localStorage 다중 문서 관리 (`md-editor-all-docs`)
  - 중복 파일명 시 자동 번호 붙이기
- [x] 저장된 파일 목록 모달 UI
  - 모달 배경 어두운 오버레이
  - 파일 시간순 역정렬
  - 파일 선택/삭제 기능
- [x] 공유 링크 모바일 뷰 수정
  - 편집/미리보기 탭 중복 표시 문제 해결
  - 공유 링크 로드 시 미리보기 탭 기본값

#### 13. QR Master 개선
- [x] 마지막 탭 상태 저장/복원
  - localStorage에 선택된 탭 저장 (`qr-last-tab`)
  - 새로고침 후 이전 탭 복원
- [x] 스캔 URL 페이지 제목 추출 + MD Editor 전송
  - Netlify 함수 `get-page-title.js` 구현
  - 백그라운드 제목 추출 (5초 타임아웃)
  - 인메모리 캐시로 중복 요청 방지
  - 다중 마크다운 내보내기 시 제목을 링크 텍스트로 사용

#### 14. Chalkboard 개선
- [x] 텍스트 더블클릭 편집
  - 더블클릭 → 즉시 편집 모드 진입 (contentEditable)
  - 기존 단일 클릭 후 컨텍스트 메뉴 방식 개선
- [x] 선 더블클릭 - 컨텍스트 메뉴
  - 더블클릭 → 즉시 컨텍스트 메뉴 표시
  - 색상 변경·삭제 빠른 접근

#### 16. Book Share 개선
- [x] 반응형 너비 조정
  - 초기 상태: 440px (QR Master 수준)
  - 데이터 로드: 800px (테이블 충분한 공간)
  - CSS transition으로 매끄러운 전환
  - 모바일에서는 기존 overflow-x: auto 유지

#### 문서 업데이트
- [x] README.md 앱 설명 최신화
- [x] DEVPLAN.md 상세 개발 현황 추가
- [x] PLAN.md 완료 작업 정리

### 9. 도서 정보 나눔 앱 개선 — 2026-03-29
- [x] 폴더명 `book-finder` → `book-share`, 앱명 `도서 정보 정리` → `도서 정보 나눔`
- [x] app-desc에 링크 공유 기능 소개 문구 추가
- [x] `엑셀 내보내기` → `내려받기` 버튼 텍스트 간소화
- [x] 세 액션 버튼(내려받기·링크로 공유·전체 초기화) 1/3씩 동일 폭 적용
- [x] `buildShareURL()` 경로 `/book-share/` 업데이트

### 8. Short.io 공유 기능 (book-share) — 2026-03-29
- [x] `netlify/functions/shorten.js` — Short.io API 프록시 (API 키 서버 환경변수)
- [x] `.env` 로컬 환경변수 파일 + `.gitignore` 등록
- [x] book-finder 앱에 `링크로 공유` 버튼 추가
- [x] `buildShareURL()` — base64url 인코딩으로 목록 데이터 URL 해시 삽입
- [x] `decodeShareData()` — 3가지 디코딩 전략 폴백 (base64url / 표준 base64 / URL 디코딩 후 재시도)
- [x] 단축 URL 실패 시 원본 URL로 폴백 공유
- [x] moon-phase 앱에 우상단 공유 버튼 추가

### 6. 도서 정보 정리 앱 (book-finder) 신규 — 2026-03-28
- [x] ISBN-13 일괄 입력 → 알라딘 OpenAPI(JSONP) 조회 → 표 구성
- [x] 표 컬럼: 순번 / 도서명 / 저자 / 출판사 / 정가 / 주문수량 / 삭제
- [x] 주문수량 인라인 편집, 행 삭제, 전체 초기화
- [x] 엑셀 내보내기 (SheetJS) — 파일명 `도서 정보_날짜.xlsx`
- [x] 통계 표시 (종수·주문수량·합계) — 표 하단
- [x] 화살표 구분선 — 버튼 클릭 후 버튼↔표 사이 표시 (초기 숨김)
- [x] API 크레딧 — 앱 설명 문장 끝 `(알라딘 OpenAPI)` 표기
- [x] `config.js` gitignore 처리 (`ALADIN_TTB_KEY` 상수)
- [x] Netlify 빌드 커맨드로 환경변수 → `config.js` 자동 생성 (`netlify.toml`)
- [x] 레이아웃: max-width 580px, body 중앙 정렬 (notion-image-downloader 스타일)
- [x] 폴더명 `book-wishlist` → `book-finder`, 앱명 `희망도서 목록` → `도서 정보 정리`

### 8. Step Squad 신규 앱 — 2026-03-28
- [x] `/numberblocks/step-squad.html` — Numberblocks 폴더 하위 배치
- [x] 계단수(Step Squad) 블록 시각화 (슬라이더로 1~15 범위 설정)
- [x] 다중 계단 Squad 비교 뷰
- [x] 계단수 퀴즈 모드
- [x] 홈 교육 섹션 Numberblocks 카드 바로 다음에 추가 (🪜 Step Squad)

### 7. 기존 앱 세부 개선 — 2026-03-28
- [x] Chalkboard: 홈 카드 앱 이름 `칠판` → `Chalkboard`, 설명 문구 개선
- [x] Notion Styler: 텍스트 입력창/미리보기 높이 축소, 생성된 코드 영역 flex 신장
- [x] Notion Styler: 정렬 버튼 → 스타일 설정 카드로 이동, 입력 레이블 제거
- [x] Notion Styler: 코드 박스 색상 조정 (배경 `#242b3d`, 테두리 `#3a4460`)
- [x] Notion Styler: 모바일 gap 수정 (스타일 설정↔미리보기 붙음 현상 해소)
- [x] Grid Maker: `py-6` → `pb-6 pt-16` (홈버튼 중첩 해소)
- [x] Numberblocks: 토글 버튼 방식 유지 확인 (심플 버튼 방식 시도 후 롤백)

### 1. Numberblocks 개선
- [x] 홈 버튼과 상단 메뉴 간섭 해결
- [x] 아이템 클릭 시 펼쳐지는 하위 버튼 → 중앙 정렬 (기존 justify-content: center 확인)
- [x] 애니메이션 효과 축소 (120ms, 절제된 수준 확인)
- [x] HeroUI CSS 변수 전면 적용 (80%+ 이미 적용 확인)
- [x] 아이템 클릭 시 아코디언 → 심플 버튼 방식 — 토글 버튼 제거, 링크 버튼 항상 노출
- [x] 모바일 접근성 (터치 타겟 44px, 드롭다운 전환 확인)

### 2. QR Master 탭 패널 고정 높이
- [x] 생성하기 / 스캔하기 패널 동일 고정 높이 적용
- [x] 탭 전환 시 전체 카드 크기 변동 없도록

### 3. Notion Styler 세부 개선
- [x] 텍스트 입력 높이 ↔ 미리보기 높이 동기화 — `min-height: calc(100vh - 128px)` 추가로 grid 1fr 행 신장
- [x] 색상 스와치 컴팩트 정렬 — `flex-wrap` → `grid repeat(11, 1fr)` 한 줄 고정

### 4. Grid Maker 레이아웃 개선
- [x] app-badge 상단 여백 — `py-6` → `pb-6 pt-16` (64px 상단 여백)
- [x] 2단 구성: 사이드바(col-4) + 캔버스(col-8) — 기존 구현 확인
- [x] 저장·내보내기 버튼 — 사이드바 하단 위치 확인, 가시성 양호

### 5. Chalkboard 보완 (3-27 이후 발견 사항)
- [x] 배경/글자색 변경 팝오버 작동 검증 완료 필요 — 색상 스와치 `data-color` 비교 버그 수정
- [x] 텍스트 크기 조정 컨텍스트 메뉴 UX 검토 — 코드 정상 확인
- [x] 선 선택·이동 안정성 확인 — 코드 정상 확인

---

## 다음 작업 예정

### Netlify 배포 후 검증 필요
- [ ] `netlify dev`로 로컬 Short.io 함수 테스트
- [ ] Netlify 환경변수 등록 확인 (`SHORT_IO_API_KEY`, `SHORT_IO_DOMAIN`, `ALADIN_TTB_KEY`)

---

## 대기 중 아이디어

### QR Master
- QR 크기 슬라이더, 색상 커스터마이징, 오류 정정 레벨 선택

### Smart Timer
- 스누즈 기능, 카운트다운 탭, 볼륨 조절

### Grid Maker
- 프리셋 그리드 (3×3, 2×3, 4×4), 셀 간 여백, 개별 다운로드

### YT Thumbnail
- 4종 품질 동시 표시, 마크다운 복사, 1클릭 다운로드

### Notion Image DL
- 다운로드 전 이미지 목록 미리보기, 선택적 다운로드

### Notion Styler
- 자주 쓰는 수식 프리셋, 수식 히스토리

### Numberblocks
- 즐겨찾기, 학습 진도 표시, 랜덤 에피소드 추천

### Flash Deck
- 덱 이름 변경, 덱 복제
- 카드 앞/뒤 직접 편집
- 학습 기록 그래프 (날짜별 정확도)
- 마크다운 지원 (앞/뒷면 텍스트 스타일링)

### Chalkboard
- 텍스트 정렬 기능 (좌/중/우)
- 보드 간 복사/붙여넣기

### 신규 앱 후보 (2026-03-27 제안)

#### 교육 (edu)
- 받아쓰기 모드: Flash Deck 확장 — 앞면을 TTS로 읽어주고 타이핑으로 맞추는 모드
- 타임라인 메이커: 역사·사건을 가로 축에 시각적으로 배치, PNG 저장
- 마인드맵: 노드를 화살표로 연결하는 간단한 마인드맵, PNG 저장
- 학습 플래너: 과목별 공부 시간 입력 → 원/막대 그래프 시각화, localStorage 저장
- 연산 드릴: 구구단·사칙연산, 난이도·시간 제한, 점수 기록

#### 유틸리티 (utility)
- Markdown 편집기: 왼쪽 입력 / 오른쪽 미리보기 실시간 렌더링
- 색상 팔레트 생성기: 색상 하나 입력 → 보색·유사색·트라이어드 팔레트, HEX/RGB 복사
- JSON 뷰어: JSON 붙여넣기 → 트리 뷰 + 포매터, 에러 하이라이트
- Base64 변환기: 텍스트↔Base64, 이미지 → Data URL
- 단위 변환기: 길이·무게·온도·넓이, 계산기 스타일 UI

#### 크리에이티브 (creative)
- 글꼴 미리보기: 구글 폰트 목록 + 내 텍스트로 실시간 미리보기, @import 코드 복사
- 이모지 픽커: 키워드 검색으로 이모지 빠르게 찾아 복사
- 그라디언트 생성기: 색상·방향 설정 → CSS 코드 + 미리보기 즉시 생성
- 텍스트 포스터 메이커: 배경·폰트 선택, 인용구/제목 배치, PNG 저장

#### 노션 도구 (notion)
- 노션 표 변환기: CSV/TSV → 노션 붙여넣기용 마크다운 표 변환
- 노션 커버 생성기: 1500×600 사이즈 그라디언트/텍스트 커버 이미지 생성
- 노션 아이콘 픽커: 이모지 + 아이콘 키워드 검색·복사

---

## 완료된 작업

### 공통
- [x] HeroUI CSS 변수 팔레트 (`/common/hero-theme.css`)
- [x] 테마 전환 로직 (`/common/theme.js`) — auto/light/dark 순환
- [x] `shareCurrentPage()` 공유 기능 추가
- [x] 홈 버튼 → 좌상단 (`.top-overlay-left`)
- [x] 테마 전환 + 공유 → 우상단 (`.top-overlay`)
- [x] `body::before` 격자 배경 패턴 전체 적용
- [x] `app-badge::before` 이중 다이아몬드 버그 수정

### 인트로 (`index.html`)
- [x] JS 렌더링 방식으로 전환 (APPS 배열)
- [x] 카테고리별 섹션 분리
- [x] 모달 시스템 (Login Helper, Content ID Viewer)
- [x] Smart Timer 이름 반영
- [x] 파비콘 → `logo.jpg`
- [x] 공유 버튼 추가
- [x] Flash Deck 교육 카테고리 등록

### 각 앱
- [x] QR Master: 카드 디자인, 오버레이 통일
- [x] Smart Timer: 오버레이 통일
- [x] Grid Maker: HeroUI 변수 전면 교체, 드래그 업로드
- [x] YT Thumbnail: 오버레이 통일
- [x] Notion Image DL: 오류 메시지 개선, 오버레이 통일
- [x] Notion Styler: 2단 레이아웃, 4열 폰트 그리드, HeroUI 적용
- [x] Moon Phase: 홈 버튼 좌상단으로 이동
- [x] Numberblocks: 오버레이 통일
- [x] Flash Deck: 신규 앱 완성 (덱 관리, 카드 입력, 학습 모드, 결과 화면)
- [x] Flash Deck: 전체화면 마지막 카드 → 결과 화면 미전환 버그 수정
- [x] Flash Deck: 배지 이중 다이아몬드 제거
- [x] Chalkboard: 신규 앱 완성 (칠판·화이트보드 전환, 텍스트·선 추가, 4색 팔레트, 자동저장)
- [x] Chalkboard: 선 드래그 이동 지원
- [x] Chalkboard: 보드 제목 입력란 테두리 추가
- [x] Chalkboard: 툴바 버튼 우측 배치, 저장 버튼 레이아웃 개선
- [x] Chalkboard: 텍스트 기본 크기 80px, SIZES 32~200px 상향
- [x] Chalkboard: 구형 localStorage 데이터 type 필드 없을 때 자동 보정
- [x] Chalkboard: 목록 화면 Flash Deck 스타일 그리드 카드로 개선 (썸네일 + 미리보기 텍스트)
- [x] Chalkboard: 헤더 공통 app-header/app-badge/app-title 구조 적용
- [x] Chalkboard: 저장 버튼 → 드롭다운 (TXT / JPG), 자동저장 펄스 효과
- [x] Chalkboard: 목록 화면 "내 보드" 섹션 타이틀 + 새 보드 버튼 Flash Deck 스타일로 통일
- [x] Chalkboard: 홈 화면 padding-top 68px (상단 오버레이 버튼 간섭 해소)
- [x] Flash Deck: AI 프롬프트 카드 추가 (덱 그리드 맨 끝, 빈 상태 시 버튼으로 대체)
- [x] Flash Deck: 덱 카드 삭제 아이콘 추가 (hover 시 우상단 노출, confirm 후 삭제)
- [x] 인트로: 교육 카테고리를 섹션 최상단으로 이동

### 각 앱 (2026-03-28 추가)
- [x] 도서 정보 정리 (book-finder): 신규 앱 완성
- [x] Step Squad: 신규 앱 추가 (`/numberblocks/step-squad.html`)
- [x] Chalkboard: 홈 카드 이름·설명 변경
- [x] Notion Styler: UI 세부 개선 다수
- [x] Grid Maker: 상단 여백 수정

### 각 앱 (2026-03-29 추가)
- [x] 도서 정보 나눔 (book-share): 공유 기능 완성, 폴더·앱명 변경, UI 버튼 개선
- [x] Moon Phase: 우상단 공유 버튼 추가

### 각 앱 (2026-03-30 추가)
- [x] Chalkboard: 실행취소 (Ctrl+Z, 최대 50단계)
- [x] Chalkboard: 복사·붙여넣기 (Ctrl+C/V, +20px 오프셋)
- [x] Chalkboard: 공유 기능 (base64url + Short.io, 보기전용/복제허용 권한)
- [x] Chalkboard: 보기 전용 모드 (viewOnlyBoard, .is-view-only CSS, 복제 버튼)
- [x] Chalkboard: 썸네일 — 좌상단 텍스트(y→x 정렬), 없으면 보드 이름
- [x] Chalkboard: 저장 버튼 — 자동저장 텍스트 제거, 펄스 점 인라인
- [x] Chalkboard: 보기전용 배지 높이 36px 통일
- [x] Chalkboard: 모바일 더보기(···) 메뉴 — 저장·공유 통합 (≤600px)

### 문서
- [x] `DEVPLAN.md` → `docs/DEVPLAN.md` 이동 및 최신화
- [x] `docs/PLAN.md` 작성
- [x] `docs/PLAN-flashcard.md` 작성
- [x] `docs/PLAN-chalkboard.md` 작성 (2026-03-27)
- [x] `README.md` 루트에 신규 작성
- [x] `docs/PLAN.md` 2026-03-28 세션 업데이트
