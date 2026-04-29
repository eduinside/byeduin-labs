# byeduin-labs 세션 요약 (2026-04-30)

## 🎯 주요 성과

### 1. Cloudflare Pages 마이그레이션 완료 ✅
- **상태**: Netlify → Cloudflare Pages 완전 이전
- **정적 파일**: 13개 앱 모두 배포 완료
- **Functions**: 10개 Cloudflare Functions 배포 (html-to-md, url-to-md 제외)
- **배포 전략**: GitHub Actions (Functions) + Cloudflare Pages 자동배포 (정적 파일)

**제거된 Functions** (Cloudflare 런타임 호환 불가):
- `html-to-md.js` (turndown 라이브러리 필요)
- `url-to-md.js` (turndown 라이브러리 필요)
- → 향후 외부 서비스로 이전 검토

---

### 2. YT Thumbnail 앱 버그 수정 🎬

#### 문제
- 재생목록 히스토리에서 **고정된 Rick Roll 썸네일**과 "📺 재생목록" 텍스트만 표시
- 실제 첫 영상의 썸네일과 제목 정보 부재

#### 해결책
1. **새 API 추가**: `/api/yt-video-info`
   - YouTube oEmbed API 활용 (인증 불필요)
   - 영상 ID → 제목 조회

2. **히스토리 데이터 개선**
   - 기존: URL 또는 ID만 저장
   - 개선: `{videoId, title, author}` 또는 `{url, title, firstVideoId, firstVideoTitle}` 객체로 저장

3. **UI 개선**
   - 영상: 실제 제목 + `· 영상` 타입 배지 표시
   - 재생목록: 플레이리스트명 + `· 재생목록` 타입 배지 표시
   - "(1번 항목)" 표현 제거

4. **하위호환성**: 기존 히스토리 데이터도 정상 작동

**관련 커밋**:
- `6c6b13c` - Fix yt-thumb playlist history
- `a61d8f5` - Add YouTube video info API

---

### 3. YT Thumbnail UI/UX 개선 🎨

| 항목 | 변경사항 |
|------|---------|
| **재생목록 탭 하단 히스토리** | 제거 |
| **MD 정리 버튼** | "📋 링크 정리 (MD Editor로)" → "📋 MD로 정리" |
| **히스토리 섹션** | 상단 가로선 제거 |
| **히스토리 스크롤** | 스크롤바 제거 (자동 높이 조정) |
| **영상 히스토리 클릭** | 썸네일 탭으로 자동 전환 |

**커밋**: `bb1117d`

---

### 4. 배포 최적화 ⚡

#### 배포 구조
```
GitHub 푸시
├─ Cloudflare Pages 자동배포 (~5초)
│  └─ public/ 정적 파일 배포
│
└─ GitHub Actions (~30초)
   └─ functions/ + public/ 배포 (wrangler pages deploy)
```

#### 배포 흐름
1. GitHub에 푸시
2. GitHub Actions 자동 트리거
3. Node.js 설정 + wrangler 설치
4. `wrangler pages deploy public` 실행
5. Cloudflare에 배포

**관련 커밋**:
- `740eebe` - Initial GitHub Actions setup
- `de3d537` - Fix wrangler command path
- `0a437f4` - Restore for Functions deployment

---

### 5. 파비콘 통일 🎨

**문제**: 4개 앱에서 다른 파비콘 사용
- YT Thumbnail
- MD Editor
- Chalkboard
- Grid Maker

**해결**: `/common/init.js`에서 JavaScript로 강제 설정
```javascript
// 모든 페이지에서 /logo.jpg로 강제 지정
```

**커밋**: `6301959`

---

## 📊 현재 상태

### 배포 현황
| 항목 | 상태 |
|------|------|
| 정적 파일 (13개 앱) | ✅ Cloudflare Pages |
| Cloudflare Functions (10개) | ✅ GitHub Actions |
| 환경변수 (7개) | ✅ Cloudflare 대시보드 |
| 도메인 | ✅ Cloudflare Pages 연결 |
| GitHub 자동배포 | ✅ GitHub Actions |

### 앱 상태
| 앱 | 상태 | 비고 |
|---|------|------|
| QR Master | ✅ | 모든 기능 정상 |
| Smart Timer | ✅ | 모든 기능 정상 |
| MD Editor | ✅ | HWP 변환은 Netlify 유지 |
| YT Thumbnail | ✅ | 버그 수정, 새 API 추가 |
| 기타 앱 | ✅ | 모두 정상 |

---

## 🔧 기술 스택

### 배포
- **정적 호스팅**: Cloudflare Pages
- **Functions**: Cloudflare Workers (12개)
  - Gemini API (signage-image, search)
  - YouTube API (yt-thumb-img, yt-playlist, yt-video-info)
  - GitHub API (tree)
  - Notion API (notion)
  - short.io API (shorten, resolve-short-url)
  - 기타 (signage-prompt, get-page-title)
- **CI/CD**: GitHub Actions
- **정적 서빙**: 빌드 없음 (순수 HTML+CSS+JS)

### 환경변수 (Cloudflare)
```
- GEMINI_API_KEY
- ALADIN_TTB_KEY
- EDU_DOCS_REPO
- SHORT_IO_API_KEY
- SHORT_IO_DOMAIN
- GITHUB_TOKEN
- SIGNAGE_LOGINCODE
```

---

## ⚠️ 알려진 제한사항

### Cloudflare Pages Functions
- **CPU 시간**: 10ms 제한
  - I/O 작업(API 호출)은 제한 외
  - Gemini 이미지 생성은 ~10초 소요지만 I/O이므로 정상 작동
  
### 제외된 Functions
- `html-to-md.js` - turndown 라이브러리 호환 불가
- `url-to-md.js` - turndown 라이브러리 호환 불가
- `hwp-to-md.js` - Node.js 런타임 필요, Netlify 유지

---

## 📝 향후 작업 (다음 세션)

### 우선순위 높음
1. **hwp-to-md 외부 서비스 이전**
   - Railway 또는 Render 검토
   - Netlify에서 분리

2. **html-to-md, url-to-md 복원**
   - Cloudflare Worker 호환 라이브러리 찾기
   - 또는 외부 API 활용

3. **배포 속도 모니터링**
   - GitHub Actions: ~30초
   - Cloudflare Pages: ~5초

### 우선순위 중간
1. YT Thumbnail 영상 정보 캐싱 (API 호출 최소화)
2. 에러 페이지 개선
3. 모바일 최적화 점검

### 우선순위 낮음
1. 성능 최적화 (번들 크기)
2. SEO 개선
3. 분석 대시보드 구성

---

## 📚 참고 파일

- `.github/workflows/deploy.yml` - GitHub Actions 워크플로우
- `wrangler.toml` - Cloudflare 프로젝트 설정
- `public/common/init.js` - 공통 초기화 (파비콘, GA)
- `public/yt-thumb/index.html` - 수정된 YT Thumbnail 앱
- `functions/api/yt-video-info.js` - 새 API 함수

---

## 💡 주요 학습사항

1. **Cloudflare Pages 배포**
   - 자동배포 vs 수동배포 (wrangler CLI) 역할 분리
   - Functions 배포에는 `wrangler pages deploy` 필요

2. **GitHub Actions 최적화**
   - Node.js 버전 호환성 중요 (v20 → v24 마이그레이션)
   - Actions v5 사용으로 Node.js 24 지원

3. **YouTube oEmbed API**
   - 인증 없이 영상 메타데이터 조회 가능
   - 응답: {title, author_name, thumbnail_url, ...}

4. **하위호환성 관리**
   - localStorage 데이터 형식 변경 시 기존 데이터도 처리
   - `typeof` 체크로 유연하게 대응

---

**작업 완료**: 2026-04-30 16:00  
**총 커밋**: 12개  
**수정 파일**: 4개 (HTML, JS, Markdown, YAML)
