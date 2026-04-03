# byeduin VIVES

바이브 코딩으로 만든 소형 웹 앱 모음. 순수 정적 사이트 (HTML + CSS + JS, 빌드 없음).

**로컬 실행**: `npx serve public -l 3000`
**배포**: Netlify 정적 호스팅

---

## 앱 목록

### 유틸리티
| 앱 | 경로 | 설명 |
|---|---|---|
| **QR Master** | `/qr/` | QR 코드 생성 및 카메라/이미지 스캔. 히스토리 저장. 스캔 URL의 페이지 제목 추출. |
| **Smart Timer** | `/timer/` | 반복 알람 타이머. 세션 종료 알림 지원. |
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

### 유틸리티 (고급)
| 앱 | 경로 | 설명 |
|---|---|---|
| **MD Editor** | `/md-editor/` | 간편한 마크다운 문서 편집기. 실시간 미리보기, 파일 저장, 링크 공유, 브라우저 로컬 저장, 다중 문서 관리. |

### 교육
| 앱 | 경로 | 설명 |
|---|---|---|
| **Flash Deck** | `/flash-deck/` | 플래시카드 덱 제작 및 학습. 단건/일괄 입력, 3D 플립, 전체화면 모드. |
| **Chalkboard** | `/chalkboard/` | 칠판·화이트보드 메모 앱. 텍스트·선 더블클릭 편집, 4색 팔레트, 자동저장. |
| **Numberblocks** | `/numberblocks/` | 넘버블록스 에피소드 파인더. 숫자·시즌별 검색 + 유튜브 연동. |
| **Step Squad** | `/numberblocks/step-squad.html` | 계단수(Step Squad) 블록 시각화. 슬라이더·비교·퀴즈 모드. |
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
