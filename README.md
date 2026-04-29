# byeduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음. 순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).

**로컬 실행**: `npx serve public -l 3000`  
**배포**: [Cloudflare Pages](https://byeduin-vives.pages.dev) (자동 배포: main 브랜치)  
**개발 진행**: [`DEVPLAN.md`](DEVPLAN.md) 참고

---

## 앱 목록 (13개)

### 유틸리티 (3)
| 앱 | 경로 | 설명 |
|---|---|---|
| **QR Master** | `/qr/` | QR 코드 생성, 카메라/이미지 스캔 |
| **Smart Timer** | `/timer/` | 반복 알람 타이머 |
| **MD Editor** | `/md-editor/` | 마크다운 편집기 (HTML 변환, 파일 공유 지원) |

### 소셜 도구 (2)
| 앱 | 경로 | 설명 |
|---|---|---|
| **Bubble Chat** | `/bubble-chat/` | P2P 실시간 채팅 |
| **도서 정보 나눔** | `/book-share/` | ISBN으로 도서 정보 조회 및 공유 |

### 크리에이티브 (3)
| 앱 | 경로 | 설명 |
|---|---|---|
| **Grid Maker** | `/grid-maker/` | 이미지 그리드 분할 |
| **YT Thumbnail** | `/yt-thumb/` | 유튜브 썸네일 추출 및 아카이빙 |
| **Signage Maker** | `/signage-maker/` | 학교 사이니지용 AI 세로 이미지 생성기 (Gemini) |

### 노션 도구 (2)
| 앱 | 경로 | 설명 |
|---|---|---|
| **Notion Image DL** | `/notion-image-downloader/` | Notion DB 이미지 일괄 다운로드 |
| **Notion Styler** | `/notion-styler/` | LaTeX 수식 스타일링 및 HTML 생성 |

### 교육 (3)
| 앱 | 경로 | 설명 |
|---|---|---|
| **에듀서치** | `/search/` | 교육문서 AI 검색 (Gemini RAG) |
| **Flash Deck** | `/flash-deck/` | 플래시카드 학습 앱 |
| **Chalkboard** | `/chalkboard/` | 칠판/화이트보드 메모 |

### 그 외
| 앱 | 경로 | 설명 |
|---|---|---|
| **Numberblocks** | `/numberblocks/` | 넘버블록스 에피소드 파인더 + 부가 기능 |
| **Moon Phase** | `/moon-phase/` | 달의 위상 시뮬레이터 |

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

## 📖 개발 문서

자세한 개발 계획, 테스트 체크리스트, 알려진 이슈, 성능 분석은 [`DEVPLAN.md`](DEVPLAN.md)를 참고하세요.
