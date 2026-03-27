# byeduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음. 순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).

**로컬 실행**: `npx serve public -l 3000`
**배포**: Netlify 정적 호스팅

---

## 앱 목록

### 유틸리티
| 앱 | 경로 | 설명 |
|---|---|---|
| **QR Master** | `/qr/` | QR 코드 생성 및 카메라/이미지 스캔. 히스토리 저장. |
| **Smart Timer** | `/timer/` | 반복 알람 타이머. 세션 종료 알림 지원. |

### 크리에이티브
| 앱 | 경로 | 설명 |
|---|---|---|
| **Grid Maker** | `/grid-maker/` | 이미지를 N×M 그리드로 분할. 드래그 업로드 지원. |
| **YT Thumbnail** | `/yt-thumb/` | 유튜브 URL로 썸네일 이미지 추출. |

### 노션 도구
| 앱 | 경로 | 설명 |
|---|---|---|
| **Notion Image DL** | `/notion-image-downloader/` | Notion DB의 이미지를 일괄 다운로드. |
| **Notion Styler** | `/notion-styler/` | LaTeX 수식에 색상·폰트·크기 스타일을 적용하고 HTML 코드를 생성. |

### 교육
| 앱 | 경로 | 설명 |
|---|---|---|
| **Flash Deck** | `/flash-deck/` | 플래시카드 덱 제작 및 학습. 단건/일괄 입력, 3D 플립, 전체화면 모드. |
| **Chalkboard** | `/chalkboard/` | 칠판·화이트보드 메모 앱. 텍스트·선 추가, 4색 팔레트, 자동저장. |
| **Numberblocks** | `/numberblocks/` | 넘버블록스 에피소드 파인더. 숫자·시즌별 검색 + 유튜브 연동. |
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

## 문서

- [`docs/DEVPLAN.md`](docs/DEVPLAN.md) — 전체 개발 계획 및 앱별 구현 현황
- [`docs/PLAN.md`](docs/PLAN.md) — 진행 중 / 완료 / 대기 작업 플랜
- [`docs/PLAN-flashcard.md`](docs/PLAN-flashcard.md) — Flash Deck 상세 계획 및 구현 현황
- [`docs/PLAN-chalkboard.md`](docs/PLAN-chalkboard.md) — Chalkboard 상세 계획 및 구현 현황
- [`docs/numberblocks-readme.md`](docs/numberblocks-readme.md) — Numberblocks 앱 상세 문서
