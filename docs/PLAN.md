# byeduin VIVES — 작업 플랜

> 업데이트: 2026-03-26

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

---

## 완료된 작업

### 공통
- [x] HeroUI CSS 변수 팔레트 (`/common/hero-theme.css`)
- [x] 테마 전환 로직 (`/common/theme.js`) — auto/light/dark 순환
- [x] `shareCurrentPage()` 공유 기능 추가
- [x] 홈 버튼 → 좌상단 (`.top-overlay-left`)
- [x] 테마 전환 + 공유 → 우상단 (`.top-overlay`)
- [x] `body::before` 격자 배경 패턴 전체 적용

### 인트로 (`index.html`)
- [x] JS 렌더링 방식으로 전환 (APPS 배열)
- [x] 카테고리별 섹션 분리
- [x] 모달 시스템 (Login Helper, Content ID Viewer)
- [x] Smart Timer 이름 반영
- [x] 파비콘 → `logo.jpg`
- [x] 공유 버튼 추가

### 각 앱
- [x] QR Master: 카드 디자인, 오버레이 통일
- [x] Smart Timer: 오버레이 통일
- [x] Grid Maker: HeroUI 변수 전면 교체, 드래그 업로드
- [x] YT Thumbnail: 오버레이 통일
- [x] Notion Image DL: 오류 메시지 개선, 오버레이 통일
- [x] Notion Styler: 2단 레이아웃, 4열 폰트 그리드, HeroUI 적용
- [x] Moon Phase: 홈 버튼 좌상단으로 이동
- [x] Numberblocks: 오버레이 통일

### 문서
- [x] `DEVPLAN.md` → `docs/DEVPLAN.md` 이동 및 최신화
- [x] `README.md` 루트에 신규 작성
