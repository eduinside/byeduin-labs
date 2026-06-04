# eduin VIVES — 개발 계획 및 진행 현황

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

## 🌟 완료된 기능

### Phase 1: 기본 구조 및 공통 시스템
- [x] 정적 사이트 기본 구조 (HTML + CSS + JS)
- [x] 14개 앱 개발
- [x] 홈 페이지 (카테고리별 앱 목록)
- [x] 공통 리소스 (hero-theme.css, theme.js)
- [x] 라이트/다크 모드 전환

### Phase 2: 정기능 강화
- [x] Bubble Chat (P2P 실시간 채팅)
- [x] QR Master (생성 및 스캔)
- [x] Smart Timer (반복 알람)

### Phase 3: Markdown Editor 고도화
- [x] 마크다운 편집 및 실시간 프리뷰
- [x] HWP 파일 변환 지원 (Netlify Functions + Kordoc)
- [x] 파일 공유 기능 (base64url 인코딩)

### Phase 4: 에듀서치 (EduSearch) 앱 개발
- [x] Gemini 1.5 Flash API 연동
- [x] 교육 문서 검색 (RAG)
- [x] 문서 탐색 기능 (GitHub 트리)
- [x] 검색 대화 이력 저장
- [x] 문서 요약 및 질문 기능
- [x] 텍스트 선택 팝업 (부분 질문)
- [x] 공유 기능

### Phase 5: 에듀서치 UI/UX 정밀 개선
**상태**: 완료

**개선 사항**:
1. **헤더 높이 통일** (58px): 채팅 헤더와 문서 헤더 일관성
2. **모달 질문 디자인**: `prompt()` 대체 → 세련된 모달 UI
3. **문서 첨부 카드**: 채팅 화면에서 질문 문서를 시각적 카드로 표시
4. **격자 무늬 배경**: 40px 간격, 0.03 투명도로 세련된 시각적 분위기
5. **사이드바 탭 구성**: 대화 ↔ 문서 목록 탭 전환
6. **소스 링크 개선**: 검색 결과 출처를 클릭 가능한 링크로 표시
7. **모바일 반응형**: 삼선 메뉴 시 타이틀 위치 조정
8. **AI 면책 추가**: 메인 설명에 "(AI는 실수를 할 수 있습니다)" 명시
9. **GitHub API 최적화**: Netlify Function으로 클라이언트 레이트 리밋 회피
10. **로컬 캐싱**: localStorage 24시간 TTL로 API 호출 감소

**파일 변경**:
- `/public/search/index.html` — UI 모달, 카드, 탭, 배경 CSS 추가
- `/netlify/functions/tree.js` — GitHub API 서버사이드 호출
- `/public/index.html` — 에듀서치를 홈 페이지에 표시 + 면책 추가

---

### Phase 6: Signage Maker (사이니지 이미지 생성 앱)
**상태**: 완료 및 배포

**개발 개요**:
학교 행사 안내용 세로 사이니지(1080×1920) 이미지를 AI로 생성하는 앱. 사용자가 텍스트와 스타일을 입력하면 프롬프트를 자동 다듬은 후 이미지를 생성해 로컬에 저장.

**주요 기능**:
1. **프롬프트 생성**: 입력 텍스트 + 스타일 → Gemini 2.5 Flash Lite로 정제된 프롬프트 생성
2. **이미지 생성**: 정제 프롬프트 → Gemini 3.1 Flash Image로 1024×1536 이미지 생성
3. **캔버스 변환**: 생성 이미지를 1080×1920으로 자동 확대/여백 처리
4. **이미지 관리**: 다중 생성 지원 (최대 3개), 갤러리 선택 가능
5. **공유 기능**: 프롬프트만 공유 (보기/복제 권한 선택)
6. **로컬 저장**: localStorage에 이미지 + 메타데이터 저장 (이미지는 비공유)

**화면 구성** (4 views):
- **Home**: 생성된 이미지 갤러리 (썸네일 + 생성일)
- **Compose**: 텍스트 입력 + 스타일 선택
- **Prompt Review**: 다듬어진 프롬프트 편집 + 공유 + 관리자 코드 입력
- **Result**: 생성 이미지 갤러리 + 메타데이터(텍스트/스타일) + 삭제 기능

**기술 스택**:
- **프롬프트 생성**: `netlify/functions/signage-prompt.js` (Gemini 2.5 Flash Lite)
- **이미지 생성**: `netlify/functions/signage-image.js` (Gemini 3.1 Flash Image)
- **프론트엔드**: `public/signage-maker/index.html` (SPA, flash-deck 스타일 차용)
- **저장소**: localStorage (VIVES-signage 키)

**핵심 시스템 프롬프트** (signage-prompt.js):
```
너는 학교 디지털 사이니지 세로 이미지(정확히 1080×1920 세로 9:16 비율) 생성 프롬프트를 만드는 보조자다.
...
[중요] 배경에는 실제 환경(교실, 책장, 가구, 사람 등)을 그리지 말 것. 
오직 "사이니지 화면에 직접 디스플레이될 콘텐츠"만 생성하도록 명시.
배경은 단색 또는 추상적 패턴/그래디언트만 사용.
```

**보안 및 비용 관리**:
- 관리자 코드(SIGNAGE_LOGINCODE) Netlify env 저장, 함수에서 검증
- API 키는 서버사이드만 사용, 클라이언트 미노출
- 재생성 제한: 세션당 최대 2회 추가 생성 (총 3개)
- 함수 타임아웃: 26초 (Netlify Pro 한계)

**UI 개선 사항**:
1. **갤러리**: 생성일만 표시 (깔끔한 카드)
2. **Result 화면**: 
   - 상단: 이미지 갤러리 (클릭해서 선택)
   - 중단: 메인 이미지 표시
   - 하단: 텍스트/스타일 메타데이터 (2열 레이아웃)
   - 삭제 버튼: 항목 제거
3. **프롬프트 공유**: 파란색 박스로 강조
4. **관리자 코드**: 주황색 박스, 큰 폰트(18px) + 중앙 정렬

**파일 변경**:
- `/public/signage-maker/index.html` (652→750+ 줄)
  - 4-view SPA (home/compose/prompt/result)
  - 다중 이미지 갤러리 및 선택 기능
  - 메타데이터 표시 및 삭제 기능
- `/netlify/functions/signage-prompt.js` (신규)
  - Gemini 2.5 Flash Lite 사용
  - 한국어 사이니지 프롬프트 생성
  - 시스템 프롬프트: 배경 환경 제외
- `/netlify/functions/signage-image.js` (신규)
  - Gemini 3.1 Flash Image 사용
  - 1024×1536 이미지 생성
  - Base64 데이터 반환
- `/netlify.toml`
  - signage-image 함수 타임아웃: 26초
- `/public/index.html`
  - APPS 배열에 Signage Maker 추가 (🖼️ 아이콘, creative 카테고리)
- `/README.md`
  - Creative 섹션에 Signage Maker 행 추가

**최종 구현 사항** (완료):
- IndexedDB 마이그레이션: localStorage → 50MB+ 저장소
- 다중 이미지 관리: 3열 그리드 레이아웃, 각각 다운로드 버튼
- 갤러리 재방문: 기존 아이템 열기 시 재생성 가능 (1-2개 이미지만)
- 관리자 코드: 갤러리 재생성 시만 모달로 요청
- 프롬프트 저장: 각 아이템별 프롬프트 기억, 재생성 시 재사용
- 파일명: 텍스트+생성일시 조합으로 다운로드
- 메타데이터: 삽입 텍스트/스타일 2열 표시 + 삭제 기능

**배포 상태**:
- ✅ 메인 브랜치에 병합 완료
- ✅ 환경변수: GEMINI_API_KEY, SIGNAGE_LOGINCODE(1902)
- ✅ 테스트 브랜치 삭제 (개발 완료)

**향후 개선 사항** (V2):
- 배치 생성 (여러 텍스트 동시 처리)
- 프롬프트 템플릿 라이브러리
- 생성 이미지 온라인 공유 (S3/CDN)
- 프롬프트 버전 관리 (히스토리)
- 이미지 필터/편집 기능
- 생성 통계 대시보드

**V1.1 업데이트** (2026-04-26):

**개선 사항**:
1. **다운로드 기능 안정화**
   - 기존: `fetch(dataUrl)` 실패 (fetch는 data URL 미지원)
   - 개선: 데이터 속성(`data-img`, `data-filename`) 활용 + `downloadFromButton()` 함수 구현
   - 폴백: 직접 다운로드 → Blob 변환 → 오류 메시지 안내

2. **메타데이터 안정성**
   - 기존: `createdAt` 필드 누락 시 에러 발생
   - 개선: 삼항연산자로 null 체크 + 기본값('—') 설정
   - 영향: 구형 아이템도 정상 표시

3. **저장소 용량 관리**
   - IndexedDB 50MB+ 한계 도달 시 자동 정리
   - `saveDataWithCleanup()`: 저장 실패 시 가장 오래된 아이템부터 삭제
   - 3단계: 1개 삭제 → 3개 삭제 → 실패 메시지
   - 디버그 로그로 정리 작업 추적

4. **이미지 품질 및 크기 최적화**
   - PNG → JPEG 포맷 전환 (quality: 0.9)
   - 파일 크기: ~2.3MB → ~1MB (-50%)
   - Gemini 프롬프트 최적화: "Optimize image size and quality for fast generation" 추가
   - 생성 속도: 개선됨

5. **메타데이터 UI 확대**
   - 기존: 2열 레이아웃 (텍스트/스타일)
   - 개선: 3열 레이아웃 (텍스트 | 스타일 | **생성일시**)
   - 시간 포맷: 한국 로캘 (YYYY-MM-DD HH:mm:ss)

6. **스타일 프리셋 확장**
   - 기존: 5개 선택지
   - 추가: 3개 (총 8개)
     - "현대적이고 세련된 그래디언트" (Modern gradient)
     - "기하학적 패턴과 블록 형태" (Geometric patterns)
     - "따뜻하고 친근한 감성" (Warm, friendly)
   - 파일 변경: `STYLE_PRESETS` 배열 + HTML select 옵션

**파일 변경**:
- `/public/signage-maker/index.html`
  - `downloadFromButton()` 함수 추가 (이중 폴백 구현)
  - `openItem()`: createdAt null 체크
  - `saveDataWithCleanup()`: 저장 실패 시 자동 정리
  - `fitTo1080x1920()`: PNG → JPEG (quality 0.9)
  - 메타데이터 UI: 2열 → 3열 + 생성일시
  - `STYLE_PRESETS` 배열: 5 → 8개 옵션

- `/netlify/functions/signage-image.js`
  - 프롬프트 최적화 메시지 추가: "Optimize image size and quality for fast generation"
  - Temperature: 1.0 → 0.8 (일관성 개선)

**테스트 체크리스트**:
- [x] 다운로드 버튼: 생성 이미지 + 갤러리 이미지 모두 다운로드 가능
- [x] 메타데이터: 기존 아이템 열기 시 createdAt 오류 없음
- [x] 저장소 정리: 용량 초과 시 자동 삭제 + 로그 표시
- [x] 이미지 크기: PNG (2.3MB) → JPEG (1MB) 감소
- [x] 스타일 선택: 8개 선택지 모두 정상 작동
- [x] 재생성: 갤러리 아이템에서 프롬프트 재활용

---

### Phase 7: Cloudflare Pages 이전 (2026-04-29)
**상태**: 완료 ✅

**배경**:
- Netlify → Cloudflare Pages로 완전 이전
- 12개 Netlify Functions → Cloudflare Pages Functions 변환
- hwp-to-md 기능은 외부 서비스 필요로 일시 중단
- GitHub 레이트 제한 문제 해결 (서버사이드 API 호출)

**구현 사항**:

1. **프로젝트 구조 변경**
   ```
   netlify/functions/  →  functions/api/
   netlify.toml        →  wrangler.toml (Cloudflare Pages 설정)
   ```

2. **Netlify Functions → Cloudflare Pages Functions 변환 (12개)**
   
   변환 패턴:
   ```javascript
   // Netlify
   exports.handler = async (event) => {
     const { httpMethod, body } = event;
     return { statusCode: 200, body: JSON.stringify(...) };
   }
   
   // Cloudflare
   export async function onRequest(ctx) {
     const { request } = ctx;
     const body = await request.json();
     return new Response(JSON.stringify(...), { status: 200 });
   }
   ```
   
   변환된 함수:
   - `signage-image.js` — Gemini 이미지 생성 (26초 타임아웃)
   - `signage-prompt.js` — 프롬프트 최적화
   - `search.js` — 교육 문서 RAG 검색
   - `url-to-md.js` — URL 마크다운 변환
   - `html-to-md.js` — HTML 마크다운 변환
   - `get-page-title.js` — 페이지 제목 추출
   - `yt-thumb-img.js` — YouTube 썸네일
   - `yt-playlist.js` — YouTube 플레이리스트
   - `notion.js` — Notion API 프록시
   - `shorten.js` — short.io 단축 URL
   - `resolve-short-url.js` — 단축 URL 해석
   - `tree.js` — GitHub 저장소 트리 조회

3. **환경변수 설정** (Cloudflare 대시보드)
   - GEMINI_API_KEY
   - ALADIN_TTB_KEY
   - EDU_DOCS_REPO
   - SHORT_IO_API_KEY
   - SHORT_IO_DOMAIN
   - GITHUB_TOKEN
   - SIGNAGE_LOGINCODE

4. **클라이언트 API 경로 업데이트**
   ```javascript
   // Before: /.netlify/functions/*
   // After:  /api/*
   ```
   
   변경된 파일:
   - `public/md-editor/index.html` — html-to-md, url-to-md, shorten 경로 수정
   - `public/search/index.html` — /api/tree, /api/recent-docs 사용
   - 기타 앱들 — /api/* 엔드포인트 호출

5. **Search 앱 최적화** (GitHub API 레이트 제한 해결)
   
   문제점:
   - 클라이언트에서 GitHub API 직접 호출 → 403 Forbidden
   - 인증 없는 요청은 시간당 60회 제한
   
   해결책:
   - `/api/tree` — 전체 저장소 구조 (서버사이드 + 캐싱)
   - `/api/recent-docs` — 최근 수정 문서 (서버사이드 GITHUB_TOKEN 사용)
   - 클라이언트는 서버사이드 엔드포인트만 호출
   
   CORS 처리:
   - 모든 함수에 `Access-Control-Allow-Origin: *` 헤더 추가
   - OPTIONS 프리플라이트 요청 지원

6. **hwp-to-md 프록시** (임시 해결)
   - `/api/hwp-to-md` 프록시 생성 → Netlify 함수로 포워딩
   - CORS 문제 해결
   - **현재 상태**: Netlify 함수가 404 → 기능 일시 중단

7. **Git 브랜치 정리**
   - `cloudflare` 브랜치를 main으로 merge
   - 임시 브랜치 정리 (7개 삭제)
   - 최종: main 브랜치만 유지 (Cloudflare Pages 배포)

**배포 설정**:
- Cloudflare Pages 대시보드에서 main 브랜치로 자동 배포 설정
- 명령: `wrangler pages deploy --project-name=byeduin-vives`
- URL: https://byeduin-vives.pages.dev

**기능 상태**:
| 기능 | 상태 | 비고 |
|------|------|------|
| 정적 앱 (14개) | ✅ 작동 | 모두 Cloudflare Pages에서 배포 |
| Cloudflare Functions (12개) | ✅ 작동 | 모든 API 엔드포인트 정상 |
| Search 앱 | ✅ 작동 | 서버사이드 API 사용으로 안정화 |
| MD Editor (기본) | ✅ 작동 | HTML 변환, 파일 공유 |
| HWP 변환 | ⏸️ 중단 | Netlify 함수 404 (외부 서비스 필요) |
| URL 열기 | ⏸️ 중단 | 불안정으로 UI에서 숨김 |

**이점**:
- 글로벌 CDN 성능 향상 (Cloudflare)
- 더 많은 함수 호출량 (10만회/일)
- 서버사이드 인증으로 API 레이트 제한 해결
- 단일 브랜치 관리 (유지보수 간소화)

**향후 계획**:
1. hwp-to-md를 Railway/Render 같은 외부 서비스로 배포
2. URL 열기 기능 재개 (안정화 후)
3. Netlify 완전 탈출 (현재 하이브리드 상태)

---

### Phase 7: 이미지 최적화 도구 (File Tools)
**상태**: 완료 및 배포

**개발 개요**:
스캔 이미지(TIFF/PDF/JPG/PNG) 및 대용량 PPTX 프레젠테이션의 이미지를 클라이언트사이드에서 최적화하는 멀티탭 유틸리티 앱.

**주요 기능**:

#### Tab 1: 스캔 최적화
- **입력**: TIFF/PDF/JPG/PNG 파일 다중 선택 또는 드래그앤드롭
- **출력 형식**: PDF 또는 JPG 토글 선택
- **목표 용량**: 슬라이더 (파일 크기의 2.5% ~ 100%)
- **자동 압축**: 목표 용량에 도달하도록 이미지 폭과 품질 자동 조절
  - 그리드 서치: 4×4 조합(너비×품질) 시도 → 목표 달성 시 중단
  - 검증: 빈 이미지·손상된 아카이브 방지
- **다운로드**:
  - 단일 페이지 JPG: `.jpg` 파일
  - 다중 페이지/PDF: 단일 파일 또는 `.zip` (첫 파일명 기반)

#### Tab 2: PPTX 압축
- **입력**: PPTX 파일 단일 선택
- **목표 용량**: 슬라이더 (현재 파일의 2.5% ~ 100%)
- **이미지 처리**:
  - 해상도 축소 (기본 1600px)
  - JPEG 품질 조절 (기본 0.8)
  - PNG 알파채널 감지 후 포맷 보존
- **메타데이터 최적화**:
  - XML 공백 제거
  - 중복 이미지 콘텐츠 기반 제거
  - 병렬 처리 (Promise.all)
- **목표 용량 추적**: 최대 5회 시도 (품질/해상도 단계적 하향)
- **PDF 변환 옵션**: 압축 후 PDF 변환 여부 모달 확인

#### 자동 탭 전환
- 스캔 탭에 PPTX 파일 드롭 → PPTX 탭으로 자동 전환
- PPTX 탭에 스캔 파일(JPG/PNG/PDF/TIFF) 드롭 → 스캔 탭으로 자동 전환

**기술 스택**:
- **라이브러리** (모두 CDN):
  - `UTIF.js` — TIFF 디코딩
  - `pdf.js` + `pdf-lib` — PDF 읽기 및 생성
  - `JSZip` — PPTX ZIP 처리
- **API**: Web Canvas, createImageBitmap, Blob 변환
- **저장소**: 클라이언트사이드 메모리만 (로컬스토리지 미사용)

**파일 구조**:
```
public/file-tools/
├── index.html      — 헤더 + 2탭 UI + 드롭존 + 진행률 + 결과
├── app.js          — 탭 전환, 파일 처리, 압축 로직 (700+ 줄)
└── styles.css      — 앱 전용 스타일 (hero-theme 확장)
```

**핵심 함수**:
- `rasterizeAll(maxWidth, onProgress)` — 모든 페이지를 캔버스 배열로 변환
  - PDF: pdfjsLib 페이지 렌더링
  - TIFF: UTIF 디코딩
  - JPG/PNG: createImageBitmap
- `buildPdf(pages, quality)` — JPEG 페이지를 PDFLib로 단일 PDF 생성
- `buildJpgZip(pages, quality)` — 단일 JPG 또는 다중 파일 ZIP 생성
- `recompressPptx(zip, mediaNames, quality, maxWidth)` — 병렬 이미지 재인코딩
- `runScan()` / `runPptx()` — 그리드 서치로 목표 용량 추적

**UI/UX 특징**:
- 파일 목록 + 동적 슬라이더 범위 (2.5% ~ 100%)
- 예상 출력 용량 실시간 표시 (품질/너비 기반 추정)
- 진행률 바 + 단계별 상태 메시지
- 결과 박스 (성공/경고/에러 구분)
- 모바일 반응형 (탭/카드 2열)

**배포 및 성능**:
- ✅ 100% 클라이언트사이드 (서버 불필요)
- ✅ 큰 파일도 브라우저 메모리로 처리 가능
- 추정 처리 시간:
  - 5MB TIFF → PDF: 3-5초 (그리드 서치 포함)
  - 12MB PPTX → 3MB: 8-12초 (4-5회 재시도)
- PPTX 최적화:
  - ZIP 캐싱 (1회만 로드)
  - XML 사전 처리 (정규식 컴파일)
  - 병렬 이미지 처리 (Promise.all)
  - 추정 60-70% 속도 개선

**다음 단계** (V2):
- 배치 처리 (여러 파일 동시 변환)
- WEBP 형식 지원
- 고급 필터 (회전, 크롭, 명암도 조정)
- 처리 통계 대시보드
- 구글 드라이브/원드라이브 직접 연동

---

### Phase 7 업데이트 (2026-05-03)

**버그 수정**:
1. PPTX 압축 중 "i is not defined" 오류
   - 원인: `for...of` 루프에서 인덱스 변수 미정의
   - 해결: 전통적인 `for` 루프로 변경하여 인덱스 추적 가능하게 수정
   - 영향: recompressPptx() 함수의 결과 처리 부분

2. 탭 이름 변경
   - "📄 스캔 최적화" → "📄 이미지 최적화"
   - 앱 제목과 일관성 유지

**기능 변경**:
1. PPTX to PDF 변환 기능 제거
   - **문제**: 실제 렌더링 없이 단순히 임베드 이미지만 추출 → 프린터 드라이버 변환과 달함
   - **솔루션**: PPTX to PDF 모달 제거, PDF 변환 함수 삭제
   - **결과**: 압축 완료 후 자동으로 PPTX 파일 다운로드
   - 변경된 함수:
     * `convertPptxToPdf()` 삭제 (90줄 이상)
     * `closePptxPdfModal()` 삭제
     * `runPptx()` 단순화: 결과 표시 후 바로 다운로드

**UX 개선**:
- 압축 완료 → 모달 없이 자동 다운로드 (간결한 플로우)
- 에러 감소 (PDF 변환 관련 복잡도 제거)

**파일 변경**:
- `public/file-tools/index.html` — 모달 제거 (12줄 감소)
- `public/file-tools/app.js` — 함수 제거 (120줄 감소), 자동 다운로드 추가

---

### Phase 8: 채점표 (Scoring Table) 앱 개발 (2026-05-30)

대회·발표·공모 채점을 서버 없이 링크 하나로 처리하는 단일 HTML 앱. 한 명이 양식을 만들어 공동 채점자에게 배포하고, 각자 매긴 점수를 다시 모아 종합 결과를 산출한다. `docs/채점표-요구사항정의서.md` 명세 기반, `docs/design-system.md` 토큰 적용.

**파일**: `public/scoring-table/index.html` (단일 파일, 인라인 CSS·JS)

**3-탭 구조** (file-tools 탭 패턴 재사용):
1. **표 만들기** — 대회 제목, 참가 인원/시상 비율/영역 수 스테퍼, 영역별 만점 설정(만점 합계 실시간 표시), 시상자 점수 범위 옵션, 점수 랜덤 생성, 결과 표(엑셀형 그리드, contenteditable). 시상 비율 변경 시 예상 시상 인원 실시간 갱신. 정렬: 높은순/낮은순/이름순 순환.
2. **채점하기** — 양식 링크를 열면 채점자 이름 입력 후 점수 입력. 규칙에 따른 자동배점, 수합자에게 결과 링크 공유, xlsx 내려받기. 양식이 없으면 사용 안내 표시. 입력마다 localStorage 자동저장·복구.
3. **수합하기** — 결과 링크들을 textarea에 붙여넣고 합치기(book-share/gather 패턴, 단축주소는 `/api/resolve-short-url` 역추적). 채점자별×참가자별 종합 표 생성, 셀 편집 시 합계·평균·석차·시상 즉시 갱신(원본 영역 점수는 보존하는 오버라이드 방식). xlsx(종합+채점자별 멀티시트) 내려받기.

**재사용 패턴**:
- 링크 공유: `buildShareURL`/`decodeSharePayload` (vives-share base64url + `/api/shorten`)
- 결과 수집: book-share gather의 textarea 다중 링크 + `/api/resolve-short-url`
- 파일 저장: SheetJS(xlsx) `aoa_to_sheet`/`book_append_sheet`/`writeFile`
- 탭 UI: file-tools `.tabs`/`.tab-btn`/`.panel`/`switchTab()`

**localStorage 키**: `vives-scoring-make`(탭1), `vives-scoring-draft`(탭2), `vives-scoring-collect`(탭3) — 각 탭에 💾 임시저장 버튼.

**기타 변경 사항**:
- 엑셀형 그리드 CSS: sticky 헤더의 총점/합계 칸을 불투명 배경으로 처리해 세로 스크롤 시 본문 비침(어긋남) 제거.
- 인쇄·심사자 서명란 기능은 요청에 따라 제거.

**홈(index.html) 동기화**:
- 교육 카테고리에 `채점표`(/scoring-table/) 추가
- 소셜 카테고리에 `에듀링크`(dgedu.link) 모달 추가
- `Numberblocks` 메인 항목 숨김(주석 처리)
- `Notion Image DL` 이모지 🖼️ → ⬇️ (다운로드 의미 강조)

---

### Phase 10: 임베드 생성기 (2026-05-30)
**상태**: 완료 ✅

**배경**:
노션 임베드 블록은 X-Frame-Options·CSP로 차단된 사이트를 직접 임베드할 수 없고, 비율·제목바 등 표시 옵션도 없음. 이를 보완하기 위해 외부 URL을 반응형 iframe으로 래핑하는 단일 HTML SPA 제작.

**파일**: `public/embed/index.html` (단일 파일, 인라인 CSS·JS)

**한 파일 두 모드** (URL 해시 유무로 분기):

1. **빌더 모드** (해시 없을 때)
   - URL 입력 + https 검증
   - 비율 선택: 자동 높이 / 16:9 / 4:3 / 1:1 / 커스텀(가로:세로)
   - 옵션 토글: 전체화면 버튼, 둥근 모서리, 테두리, 상단 제목바
   - 제목바 활성화 시 `/api/get-page-title` 자동 호출 → 제목 자동 입력 (캐시 적용, 기존 입력 보호)
   - 실시간 레이아웃 미리보기 (비율·스타일 즉시 반영)
   - 임베드 URL 생성 → 복사 버튼 + `/api/shorten` 단축 URL 생성
   - 노션 사용법 안내

2. **뷰어 모드** (해시 있을 때)
   - 해시 base64url 디코딩 → 설정 복원 (서버 상태 없음)
   - `auto`: `flex: 1`로 컨테이너 채움
   - 고정 비율: `padding-top` 기법으로 반응형 유지
   - 상단 제목바 / 전체화면 버튼(타이틀바 내) / 플로팅 버튼 조건부 렌더
   - 8초 타임아웃 → 차단 폴백 카드 ("임베드 차단" + 새 탭 열기)

**인코딩**: `btoa(encodeURIComponent(JSON.stringify(state)))` → base64url (`+→-`, `/→_`, `=` 제거). book-share 패턴과 동일.

**단축 URL 임베드**: Short.io는 `#fragment` 포함 전체 URL을 저장·리다이렉트하므로 단축 URL도 노션 임베드에 정상 동작.

**파일 변경**:
- `public/embed/index.html` (신규)
- `public/index.html` — 노션 도구 카테고리에 임베드 생성기(🪟) 추가

---

### Phase 9: MD Editor 다중 파일 형식 열기 (2026-05-30)
**상태**: 완료 ✅

**배경**:
- MD Editor 열기 기능이 `.md/.txt` 외 포맷 미지원
- 서버 의존 변환 방식(html-to-md, url-to-md)은 turndown·타임아웃 문제로 비활성화 상태
- 순수 클라이언트사이드 구현으로 외부 서비스 없이 처리

**구현 사항**:

1. **열기 드롭다운에 "다른 파일 열기" 버튼 추가**
   - accept: `.json,.csv,.xml,.html,.htm`
   - 배지로 지원 포맷 표시: `JSON · CSV · XML · HTML`
   - 기존 `.MD 열기` 버튼 바로 아래에 삽입

2. **파일별 변환 로직 (순수 JS, 라이브러리 없음)**

   | 포맷 | 변환 방식 | 결과 |
   |------|----------|------|
   | JSON (배열 of 객체) | `jsonToHtmlTable()` 재귀 | 중첩 HTML 테이블 |
   | JSON (일반 객체) | `jsonToHtmlTable()` 재귀 | 키/값 중첩 HTML 테이블 |
   | CSV | 직접 파싱 (따옴표 이스케이프 처리) | 마크다운 테이블 |
   | XML | `DOMParser` → `xmlNodeToHtmlTable()` 재귀 | 중첩 HTML 테이블 |
   | HTML | `DOMParser` DOM 순회 | 마크다운 (h1~h6, 표, 목록, 링크 등) |

3. **중첩 테이블 알고리즘**
   - JSON: 값이 객체/배열이면 해당 셀 안에 재귀적으로 테이블 생성
   - XML: 반복 태그 → 열이 있는 표(속성은 `@attr` 컬럼), 혼합 구조 → 키/값 표
   - `DOMParser`의 `parsererror` 감지 → 코드블록 폴백

4. **변환 완료 토스트**
   - JSON: `✓ JSON → 중첩 테이블로 변환했습니다.`
   - CSV: `✓ CSV → 마크다운 테이블로 변환했습니다.`
   - XML(성공): `✓ XML → 테이블로 변환했습니다.`
   - XML(폴백): `✓ XML 불러왔습니다. (파싱 오류로 코드블록 표시)`
   - HTML: `✓ HTML → 마크다운으로 변환했습니다.`

**파일 변경**:
- `public/md-editor/index.html`
  - `<input id="multiFileInput">` 추가
  - 드롭다운에 "다른 파일 열기" 버튼 추가
  - `openMultiFileInput()`, `handleMultiLoad()` 추가
  - `convertJsonToMd()`, `jsonToHtmlTable()`, `esc()` 추가
  - `convertCsvToMd()` 추가
  - `convertXmlToMd()`, `xmlNodeToHtmlTable()`, `xmlArrayToTable()`, `xmlObjectToTable()` 추가
  - `convertHtmlDomToMd()`, `tableToMd()` (HTML 내부용) 추가
  - 공통 스타일 상수 `TBL`, `TD`, `TH_KV` 추가
- `README.md` — MD Editor 설명 업데이트

**기술 선택 근거**:
- turndown: 이전 시도에서 불안정(한국어 특수문자, 복잡한 구조)
- DOMParser: 브라우저 내장, 라이브러리 불필요
- HTML 테이블 출력: marked.js가 인라인 HTML을 그대로 렌더링하므로 중첩 구조 표현 가능

---

### Phase 11: SEO 자동화 및 미니앱 통합 아키텍처 구축 (2026-05-31)
**상태**: 완료 ✅

**배경**:
- 미니앱 추가가 반복되면서 개별 정적 파일 구조에서 메타태그 복제, 사이트맵/로봇 수동 관리의 비효율 발생
- 크롤러 수집을 고려한 빌드타임 정적 SEO 태그 선행 주입과 브라우저 내 유연한 런타임 동적 SEO 매핑을 합친 하이브리드 아키텍처 도입

**구현 사항**:
1. **중앙 앱 레지스트리 (`apps.json`)**:
   - 사이트 메타데이터 및 23개 미니앱의 메타데이터(카테고리, 이모지, Href, 최적화된 SEO 문구)를 중앙 제어로 통합
2. **메인 페이지 동적 Fetch화 (`index.html`)**:
   - 메인 카드의 하드코딩된 앱 목록을 걷어내고 `apps.json`을 비동기 Fetch하여 렌더링하도록 전환
   - 모던한 그라디언트 파비콘(`favicon.svg`) 및 로고(`logo.png`) 교체
3. **런타임 동적 SEO 보완 (`seo-injector.js`)**:
   - 클라이언트 사이드에서 현재 경로와 매핑하여 Twitter Card, Canonical URL, JSON-LD 구조화 데이터를 동적 추가
4. **정적 빌드타임 SEO 태그 주입기 (`inject-seo.js`)**:
   - `apps.json`을 기준으로 각 서브앱 HTML 파일들에 Canonical URL 및 Twitter Card, JSON-LD, `seo-injector.js`를 정적 자동 삽입
5. **카테고리별 맞춤 OG 이미지 자동 생성 (`generate-og.js`)**:
   - `canvas` 모듈을 이용하여 1200x630px 해상도의 균일하고 완성도 높은 OG 이미지 17종 자동 드로잉
6. **로봇 및 사이트맵 자동화 (`generate-sitemap.js` & `robots.txt`)**:
   - 유효한 `sitemap.xml`을 자동 발굴하여 22개 URL 등록 및 로봇 크롤링 지침 완성
7. **새로운 앱 스캐폴딩 CLI (`scaffold-app.js`)**:
   - 대화형 CLI 프롬프트를 통해 템플릿 파일 생성 및 `apps.json` 등록 과정을 원클릭 자동화
8. **유지보수 스크립트 단일화**:
   - `package.json` 도입을 통해 `npm run dev`, `npm run inject`, `npm run og`, `npm run sitemap`, `npm run scaffold` 명령 체계 구축

**파일 변경**:
- `public/index.html` - fetch 구현 및 메인 SEO 보강
- `public/common/init.js` - 새 파비콘.svg 매핑
- `public/common/seo-injector.js` (신규)
- `public/robots.txt` (신규)
- `scripts/generate-sitemap.js` (신규)
- `scripts/generate-og.js` (신규)
- `scripts/inject-seo.js` (신규)
- `scripts/scaffold-app.js` (신규)
- `package.json` (신규)
- `docs/app-development-guide.md` (신규) - 신규 개발 가이드 추가
- 모든 하위 앱 `index.html` - `inject-seo.js`를 통한 SEO 메타 주입 완료
---

### Phase 12: 수당 계산기 앱 개발 (2026-05-31)
**상태**: 완료 ✅

**배경**:
- 수당 정산 시 세전/세후 금액을 혼동하거나 8.8% 기타소득 원천징수 세금 및 과세최저한(125,000원 이하 비과세) 역산이 복잡하여 이를 자동화하는 계산기 추가 요구

**구현 사항**:
1. **수당 계산기 앱 제작 (`/allowance-calculator/`)**:
   - 세전 금액 기준 계산 및 세후 금액 기준 역산 지원
   - 수당 1,000원 단위 유무에 따른 세전/세후 자동 판별 로직(콤마 미세 금액 포함 시 세후로 자동 토글)
   - 8.8% 세율(기타소득세 8% + 지방세 0.8%) 및 125,000원 이하 비과세 적용
   - 국세기본법의 원천징수 소득세/지방소득세 단수 절사 원칙에 따른 10원 미만(1원 단위) 세금/세후 공제 처리 탑재
2. **로컬스토리지를 통한 최근 계산 내역**:
   - 계산된 이력을 로컬에 기억하고, 개별 삭제 및 전체 삭제 관리 지원
3. **vives-share 공유 패턴 적용**:
   - 입력한 값과 모드 상태를 URL 해시로 복원할 수 있는 공유 링크 연동
4. **HeroUI 컴포넌트 일치**:
   - `hero-input`, `hero-btn` 컴포넌트 클래스를 입력창과 저장 버튼에 완전 매핑하고, 결괏값 숫자-한글 폰트 패밀리 분리 및 웹폰트 명시적 로드 처리

**파일 변경**:
- `public/apps.json` - 수당 계산기 앱 메타데이터 추가
- `public/allowance-calculator/index.html` (신규)
- `README.md` - 유틸리티 앱 목록 및 앱 개수(24개) 갱신

---

### Phase 13: eduin.info 통합 홈 + 공지사항(티스토리 RSS) + 도메인/브랜드 정리 (2026-06-04)
**상태**: 코드 완료 ✅ / Cloudflare·short.io 설정 진행 중 🔧

**배경**:
- 기존 Notion+oopy로 운영되던 `eduin.info`(브랜드 홈)와 `by.eduin.info`(앱 모음)를 단일 정본 홈 `eduin.info`로 통합. 자주 업데이트하지 않으면서 앱 소개·공지·안내를 제공하는 홈으로 개편.

**구현 사항**:
1. **도메인 정본 전환 (`by.eduin.info` → `eduin.info`)**:
   - `apps.json` `site.url` 단일 소스 변경 후 `npm run inject`·`npm run sitemap` 재생성
   - 하위 앱 HTML의 하드코딩 canonical/og:url/twitter:image/JSON-LD를 일괄 치환 (inject-seo.js는 og:image만 갱신하고 나머지는 "없을 때만 추가"하므로 기존값은 수동 치환)
   - 리다이렉트는 코드가 아닌 **Cloudflare Redirect Rule**로 처리 (apex 연결 + `by`·`www` → `eduin.info` 301, 경로 보존)
2. **공지사항 기능 (티스토리 RSS, 아코디언)**:
   - `functions/api/notices.js` (신규) — `blog.eduin.info/rss` 우선 + `eduin.tistory.com/rss` 폴백(인증서 프로비저닝 대비), 정규식 파싱(제목·링크·날짜·요약), 30분 캐시, `source`는 실제 성공한 피드 도메인
   - `public/notices.json` (신규) — `recent`/`pinned`/`both` 모드, 지정글 상단 고정(📌)
   - 홈 아코디언 UI(한 번에 하나, 요약 미리보기 + "글 보러가기" 새 창, 펼침 시 흰 배경), 클라이언트 `no-cache` fetch로 신선도 확보, 외부 문자열은 `textContent`로 주입(XSS 안전)
3. **단축 URL 도메인**: `byeduin.short.gy` → `go.eduin.info` (환경변수 `SHORT_IO_DOMAIN`만 변경, `shorten.js`/`resolve-short-url.js` 로직 무변경). 기존 링크 호환 위해 short.io에 옛 도메인 유지
4. **블로그 연동**: `blog.eduin.info`(티스토리 2차 도메인)에 공지 작성. Login Helper 안내도 oopy 슬러그 → `blog.eduin.info/450`로 이전
5. **브랜드명**: 사이트 표시명 `byeduin VIVES` → `eduin VIVES` (apps.json `site.name`)

**파일 변경**:
- `functions/api/notices.js`·`public/notices.json` (신규)
- `public/index.html` — 공지 아코디언 섹션·CSS·렌더 로직 + canonical 등 도메인 치환
- `public/apps.json` — `site.url`(eduin.info)·`site.name`(eduin VIVES)·Login Helper href
- `public/common/seo-injector.js`·`scripts/*`·`robots.txt`·`sitemap.xml`·하위 앱 HTML 19개 — 도메인 치환
- `public/book-share/gather.html`·`public/scoring-table/index.html` — 단축 예시 `go.eduin.info`

**남은 설정(사용자 수행)**:
- Cloudflare: `eduin.info` apex를 Pages 프로젝트에 연결 + 기존 apex→www 룰 제거 + `by`·`www` → `eduin.info` 301 Redirect Rule (도메인 치환 **배포 전 선행** 권장)
- short.io: `go.eduin.info` 도메인 추가 + `SHORT_IO_DOMAIN=go.eduin.info` (Cloudflare 환경변수 + 로컬 `.env`)
- 티스토리: `blog.eduin.info` SSL 인증서 발급 대기(자동) → 발급 후 대표주소 설정(선택)
