# byeduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음. 순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).

**로컬 실행**: `npx serve public -l 3000`
**배포**: Netlify 정적 호스팅

---

## 📊 개발 진행 상황

- **Phase 1**: 기본 구현 ✅ 완료
- **Phase 2**: 기능 개선 및 버그 수정 ✅ 완료
  - Bubble Chat: P2P 채팅 앱 (PeerJS + Star topology)
  - localStorage 모니터링 시스템 (80% 경고)
  - 인덱스 페이지 "소셜 도구" 카테고리 추가
- **Phase 2.5**: UI 개선 ✅ 완료 (2026.04.11)
  - QR Master: 긴 URL 레이아웃 오버플로우 버그 수정
  - Index: "최근 방문 앱" 섹션 추가 (최근 1개만 하이라이트)
- **Phase 3**: 마크다운 에디터 확장 ✅ 완료 (2026.04.11)
  - MD Editor: HWP/HWPX → MD 변환 (hwp2md 라이브러리)
  - MD Editor: HTML/HTM → MD 변환 (Turndown 라이브러리)
  - MD Editor: URL → MD 변환 (웹페이지 자동 fetch)
  - 열기 메뉴 통합: .MD / .HTML / .HWP / URL / 브라우저 저장 파일
  - 뱃지 표시: 실험 중 기능 시각화
  - 3초 타임아웃 및 통일된 에러 메시지
- **Phase 4**: 교육 문서 검색 앱 (에듀서치) ✅ 완료 (2026.04.13)
  - 에듀서치 앱: Gemini API 기반 교육 문서 RAG 검색
  - 문서 저장소: GitHub 공개 리포 (`byeduin-edu-docs`) + 웹 UI 드래그&드롭 업로드
  - 문서 뷰어: 마크다운 렌더링 + 요약/질문 버튼
  - 텍스트 선택 기능: 드래그 후 팝업으로 선택 부분 설명 요청
  - 최근 업데이트 문서: GitHub Commits API로 최근 3개 파일 표시
  - 좌측 사이드바: 새 대화 + 대화 목록 + 문서 트리 (폴더 4개, 파일 7개 샘플)

---

## 앱 목록

### 유틸리티
| 앱 | 경로 | 설명 |
|---|---|---|
| **QR Master** | `/qr/` | QR 코드 생성 및 카메라/이미지 스캔. 히스토리 저장. 스캔 URL의 페이지 제목 추출. |
| **Smart Timer** | `/timer/` | 반복 알람 타이머. 세션 종료 알림 지원. |
| **MD Editor** | `/md-editor/` | 간편한 마크다운 문서 편집기. 실시간 미리보기, 파일 저장, 링크 공유, 브라우저 로컬 저장, 다중 문서 관리. **HWP/HWPX 파일 자동 변환** (5MB 제한). |

### 소셜 도구
| 앱 | 경로 | 설명 |
|---|---|---|
| **Bubble Chat** | `/bubble-chat/` | P2P 기반 실시간 채팅. 접속 코드로 쉽게 연결. 호스트/게스트 모드. localStorage 기반 세션 저장. |
| **도서 정보 나눔** | `/book-share/` | ISBN 목록으로 알라딘 도서 정보 자동 조회. 엑셀 내려받기 및 링크 공유. |

### 크리에이티브
| 앱 | 경로 | 설명 |
|---|---|---|
| **Grid Maker** | `/grid-maker/` | 이미지를 N×M 그리드로 분할. 드래그 업로드 지원. |
| **YT Thumbnail** | `/yt-thumb/` | 유튜브 썸네일 추출 및 플레이리스트 아카이빙. 3탭 UI: 썸네일/재생목록/히스토리. |

### 노션 도구
| 앱 | 경로 | 설명 |
|---|---|---|
| **Notion Image DL** | `/notion-image-downloader/` | Notion DB의 이미지를 일괄 다운로드. |
| **Notion Styler** | `/notion-styler/` | LaTeX 수식에 색상·폰트·크기 스타일을 적용하고 HTML 코드를 생성. |

### 교육
| 앱 | 경로 | 설명 |
|---|---|---|
| **에듀서치** | `/edu-search/` | 교육문서 AI 검색. Gemini RAG로 교육법규·교육과정·실무지침 검색. 문서 뷰어 + 텍스트 선택 질문. |
| **Flash Deck** | `/flash-deck/` | 플래시카드 덱 제작 및 학습. 단건/일괄 입력, 3D 플립, 전체화면 모드. |
| **Chalkboard** | `/chalkboard/` | 칠판·화이트보드 메모 앱. 텍스트·선 더블클릭 편집, 4색 팔레트, 자동저장. |
| **Numberblocks** | `/numberblocks/` | 넘버블록스 에피소드 파인더. 숫자·시즌별 검색 + 유튜브 연동. |
| **Step Squad** | `/numberblocks/step-squad.html` | 계단수(Step Squad) 블록 시각화. 슬라이더·비교·퀴즈 모드. |
| **Club Badge** | `/numberblocks/clubs.html` | 넘버블록스 클럽 배지. 16개 수학 클럽 소개·탐색·퀴즈. 3탭 UI. |
| **Moon Phase** | `/moon-phase/` | 달의 위상 시뮬레이터. 날짜별 달 모양 시각화. |

---

## 공통 리소스

```
public/common/
├── hero-theme.css   — HeroUI CSS 변수, 공통 컴포넌트 (.top-overlay, .app-header 등)
└── theme.js         — 테마 전환 (auto/light/dark), 페이지 공유 기능
```

모든 앱은 좌상단 홈 버튼 + 우상단 테마 전환·공유 버튼을 공통으로 사용한다.

---

---

## 🧪 테스트 체크리스트

### 기본 기능
- [ ] 홈 페이지 카테고리별 앱 목록 표시 (5개 카테고리)
- [ ] 각 앱 카드 클릭 시 해당 앱 열기
- [ ] 좌상단 홈 버튼으로 홈 페이지 복귀
- [ ] 우상단 테마 전환 (auto → light → dark)
- [ ] 앱별 배지 표시 (카테고리 표시)

### Bubble Chat
- [ ] 호스트 방 생성 및 코드 표시
- [ ] 게스트 코드 입력으로 참여
- [ ] 메시지 송수신 (호스트 ↔ 게스트)
- [ ] DM 기능 (게스트 → 호스트)
- [ ] 방 종료 (호스트)
- [ ] 게스트 일시 중단 / 완전 종료
- [ ] localStorage 80% 경고 토스트 표시
- [ ] 다크모드 전환 시 UI 색상 변경

### 반응형 디자인
- [ ] 데스크톱 (1024px+): 정상 레이아웃
- [ ] 태블릿 (768px): 카드 2-3열 그리드
- [ ] 모바일 (375px): 카드 1-2열 그리드

### 브라우저 호환성
- [ ] Chrome (최신 버전)
- [ ] Firefox (최신 버전)
- [ ] Safari (최신 버전)
- [ ] Edge (최신 버전)

---

## ⚠️ 알려진 이슈 및 제한사항

### localStorage 관련
- **용량 제한**: 브라우저당 5-10MB (대부분 5MB)
  - 현재 사용률: ~0.3% (13KB)
  - 최대 20개 세션 저장 가능 (메시지 1000개/세션 기준)
- **경고 시스템**: 80% 사용률 도달 시 토스트 경고 → 70% 미만일 때 리셋
- **QuotaExceededError 처리**: 저장 실패 시 "저장소 가득 참!" 토스트 표시

### Bubble Chat
- **PeerJS 신뢰성**: 공개 네트워크에서는 STUN/TURN 서버 설정 필요
- **게스트 재입장**: 이전 메시지 히스토리 동기화 불가 (클라이언트 저장만)
- **동일 탭 제약**: 같은 탭에서 동일한 Peer ID 사용 불가
- **메시지 동기화**: 네트워크 끊김 후 복구 시 메시지 손실 가능

### 일반
- **빌드 없음**: 모든 브라우저에 JavaScript 지원 필수
- **캐시 관리**: 강력 새로고침 필요 시 Ctrl+Shift+R (Windows/Linux) 또는 Cmd+Shift+R (Mac)

---

## 📈 성능 분석

### 코드 크기
- **전체**: 135 KB (Gzip: 25.93 KB, 81% 압축률)
  - JavaScript: 89.2 KB (66%)
  - CSS: 36.5 KB (27%)
  - HTML: 3.3 KB (2%)

### localStorage 효율성
- **현재 구성**: P2P 클라이언트 저장 구조
- **메시지 예상 크기**: ~490 KB (1000개/세션)
- **결론**: IndexedDB 마이그레이션 현재 불필요, 향후 확장 시 고려

---

---

## 🔄 향후 검토 항목

### 1️⃣ MD Editor — HWP 파일 변환 ⚙️ 진행 중
**상태**: 개발 완료, 사용자 테스트 대기

**구현 내용**:
- Netlify 함수 `hwp-to-md.js` (Kordoc 라이브러리)
- MD Editor에 "HWP 열기" 버튼 추가 (드롭다운 내)
- 파일 크기 5MB 제한, 자동 MD 변환 후 편집

**파일**:
- `netlify/functions/hwp-to-md.js` — HWP→MD 변환 함수
- `public/md-editor/index.html` — UI 버튼 + JavaScript 함수

**테스트 방법**:
```bash
# Netlify 함수 포함 로컬 테스트
npx netlify dev --port 8888

# 또는 배포 후
# https://byeduin-vives.netlify.app/md-editor → "HWP 열기" 클릭
```

**다음 단계**:
- 사용자 HWP 파일로 변환 테스트
- 마크다운 형식 검증 (제목, 표, 이미지 등)
- 에러 처리 로직 확인

---

### 2️⃣ MD Editor HWP 지원 심화 검토 (별도 세션)
**검토 내용**:
- `hwp2md`, `kordoc`, `@ohah/hwpjs` 라이브러리 비교
- 대용량 파일(5MB~) 처리 최적화
- 이미지 추출 및 임베딩 가능성
- 복잡한 표/머리글 형식 보존

---

### 3️⃣ 신규 기능 1: 한국 법률 MCP 연동
**아이디어**: 법률·규정 검색 앱

**방향성**:
- 한국 법률 MCP(AI 지식 제공 시스템) 활용 가능성 조사
- 교과서·교육 관련 법규 검색 기능 추가
- 별도 앱 또는 MD Editor 플러그인으로 구현

---

### 4️⃣ 신규 기능 2: 교사용 교육과정 검색 앱
**아이디어**: 교육과정 + AI 검색 도구

**구현 계획**:
- 사용자가 모은 MD 파일 (교육과정, 교안 등) 관리
- Gemini API를 통한 의미 기반 검색
- 검색 결과 하이라이트 및 관련 문서 추천

**파일 구조**:
```
교사용-검색-앱/
├── 문서 업로드 (MD, 교과서 PDF→MD 변환)
├── Gemini API 임베딩 색인화
└── 검색 UI (자연어 쿼리 입력)
```

---

## 문서

- [`docs/DEVPLAN.md`](docs/DEVPLAN.md) — 전체 개발 계획 및 앱별 구현 현황
- [`docs/PLAN.md`](docs/PLAN.md) — 진행 중 / 완료 / 대기 작업 플랜
- [`.claude/BUBBLE_CHAT_TODO.md`](.claude/worktrees/pensive-rhodes/.claude/BUBBLE_CHAT_TODO.md) — Bubble Chat 개발 진행 상황
