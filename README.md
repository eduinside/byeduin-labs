# byeduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음. 순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).

**로컬 실행**: `npx serve public -l 3000`  
**배포**: [Cloudflare Pages](https://byeduin-vives.pages.dev) (자동 배포: main 브랜치)  
**개발 진행**: [`DEVPLAN.md`](DEVPLAN.md) 참고

---

## 앱 목록 (20개)

### 교육 (7)
| 앱 | 경로 | 설명 |
|---|---|---|
| **채점표** | `/scoring-table/` | 대회·발표 채점 양식 배포, 공동 채점, 결과 수합 (링크 공유 + xlsx) |
| **에듀서치** | `/search/` | 교육문서 AI 검색 (Gemini RAG) |
| **Flash Deck** | `/flash-deck/` | 플래시카드 학습 앱 |
| **Chalkboard** | `/chalkboard/` | 칠판/화이트보드 메모 |
| **Step Squad** | `/numberblocks/step-squad.html` | 계단수 개념 블록 시각화 + 퀴즈 |
| **Club Badge** | `/numberblocks/clubs.html` | 1~100 수의 넘버블록스 클럽 탐색 + 퀴즈 |
| **Moon Phase** | `/moon-phase/` | 달의 위상 시뮬레이터 |

### 유틸리티 (6)
| 앱 | 경로 | 설명 |
|---|---|---|
| **MD Editor** | `/md-editor/` | 마크다운 편집기 (JSON·CSV·XML·HTML 불러오기, 중첩 테이블 변환, 파일 공유 지원) |
| **QR Master** | `/qr/` | QR 코드 생성, 카메라/이미지 스캔, 단축주소 |
| **이미지 최적화 도구** | `/file-tools/` | 스캔 이미지 및 대용량 PPTX 이미지 최적화 |
| **Smart Timer** | `/timer/` | 반복 알람 타이머 |
| **MP4 Finder** | `/chrome-extentions/mp4-finder.zip` | 웹페이지 내 MP4 링크 자동 감지 및 클립보드 복사 (Chrome 확장) |
| **Content ID Viewer** | `/chrome-extentions/content-id-viewer-for-edunavi.zip` | 에듀나비 콘텐츠 ID 조회 (Chrome 확장) |

### 소셜 도구 (3)
| 앱 | 경로 | 설명 |
|---|---|---|
| **에듀링크** | `https://dgedu.link/` | 교육용 단축주소·설문조사·체험 지도 서비스 |
| **도서 정보 나눔** | `/book-share/` | ISBN으로 도서 정보 조회 및 공유 |
| **Bubble Chat** | `/bubble-chat/` | P2P 실시간 채팅 |

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

> 홈 화면에는 외부 연동·확장 항목(에듀링크, Content ID Viewer, Login Helper)도 모달로 노출됩니다.
> `/numberblocks/` 메인(에피소드 파인더)은 현재 홈에서 숨김 처리되어 있습니다.

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

---

## 오픈소스 출처 & 라이선스

모든 외부 라이브러리는 CDN을 통해 로드됩니다. 빌드 단계 없음.

| 라이브러리 | 버전 | 라이선스 | 사용 앱 |
|---|---|---|---|
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | MIT | 이미지 최적화 도구, Grid Maker, YT Thumbnail |
| [UTIF.js](https://github.com/photopea/UTIF.js) | 3.1.0 | MIT | 이미지 최적화 도구 |
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | Apache-2.0 | 이미지 최적화 도구 |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | MIT | 이미지 최적화 도구 |
| [SheetJS (xlsx)](https://sheetjs.com/) | latest | Apache-2.0 | 채점표, 도서 정보 나눔 |
| [PeerJS](https://peerjs.com/) | 1.5.2 | MIT | Bubble Chat |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | 1.0.0 | MIT | Bubble Chat, QR Master |
| [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache-2.0 | QR Master |
| [marked](https://marked.js.org/) | latest | MIT | MD Editor, 에듀서치 |
| [KaTeX](https://katex.org/) | 0.16.8 | MIT | Notion Styler |
| [React](https://react.dev/) | 18 | MIT | Notion Styler |
| [Babel Standalone](https://babeljs.io/docs/babel-standalone) | latest | MIT | Notion Styler |
| [Tailwind CSS](https://tailwindcss.com/) | CDN | MIT | Grid Maker, Notion Styler |
| [Lucide](https://lucide.dev/) | latest | ISC | Grid Maker, Smart Timer |
| [Google Fonts](https://fonts.google.com/) | — | SIL OFL | 전체 (JetBrains Mono, Noto Sans KR, Dongle) |
