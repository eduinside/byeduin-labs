# byeduin VIVES — 작업 플랜

> 업데이트: 2026-03-27 (2차)

---

## 진행 중인 작업

### 1. Numberblocks 개선
- [ ] 홈 버튼과 상단 메뉴 간섭 해결
- [ ] 아이템 클릭 시 펼쳐지는 하위 버튼 → 중앙 정렬
- [ ] 애니메이션 효과 축소 (HeroUI 기준으로 절제)
- [ ] HeroUI CSS 변수 전면 적용
- [ ] 아이템 클릭 시 아코디언/드롭다운 → 심플 버튼 방식으로 교체
- [ ] 모바일 접근성 (터치 타겟 44px 이상, 폰트 16px 이상)

### 2. QR Master 탭 패널 고정 높이
- [ ] 생성하기 / 스캔하기 패널 동일 고정 높이 적용
- [ ] 탭 전환 시 전체 카드 크기 변동 없도록

### 3. Notion Styler 세부 개선
- [ ] 텍스트 입력 높이 ↔ 미리보기 높이 동기화
- [ ] 색상 스와치 컴팩트 정렬 (줄 수 축소)

### 4. Grid Maker 레이아웃 개선
- [ ] 2단 구성: 좁은 사이드바(좌) + 캔버스(우)
- [ ] 저장·내보내기 버튼 가시성 개선

### 5. Chalkboard 보완 (3-27 이후 발견 사항)
- [ ] 배경/글자색 변경 팝오버 작동 검증 완료 필요
- [ ] 텍스트 크기 조정 컨텍스트 메뉴 UX 검토
- [ ] 선 선택·이동 안정성 확인

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
- 보드 전체 이미지로 내보내기
- 보드 간 복사/붙여넣기
- 실행 취소 (Ctrl+Z) 지원

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

### 문서
- [x] `DEVPLAN.md` → `docs/DEVPLAN.md` 이동 및 최신화
- [x] `docs/PLAN.md` 작성
- [x] `docs/PLAN-flashcard.md` 작성
- [x] `docs/PLAN-chalkboard.md` 작성 (2026-03-27)
- [x] `README.md` 루트에 신규 작성
