# Flash Deck — 개발 계획 및 구현 현황

> 작성: 2026-03-26 / 구현 완료: 2026-03-26

---

## 앱 개요

| 항목 | 내용 |
|---|---|
| 앱 이름 | **Flash Deck** |
| 배지 | `◆ EDU` |
| 경로 | `/flash-deck/` |
| 카테고리 | edu |
| 설명 | 텍스트로 플래시카드 덱을 만들고 학습하는 도구 |

---

## 구현 현황

### ✅ 완료된 기능

#### 덱 관리
- [x] 여러 덱 생성·삭제
- [x] 덱 목록 홈 화면 (카드 그리드)
- [x] 덱별 카드 수 / 마스터 수 / 학습 횟수 / 마지막 학습일 표시
- [x] 진행률 바 (마스터 카드 비율)
- [x] localStorage 영구 저장 (`vives-flashdeck`)

#### 카드 입력
- [x] 단건 입력 (앞면/뒷면 필드, Enter 키 지원)
- [x] 일괄 입력 (`앞면 :: 뒷면` 형식, 토글 패널)
- [x] 카드 삭제

#### 학습 모드
- [x] CSS 3D 플립 애니메이션 (perspective 1200px, 카드 높이 340px)
- [x] 플립 전 결과 버튼 숨김 → 플립 후 fade-in
- [x] ✓ 알아요 / ✗ 모르겠어요 결과 기록
- [x] passCount ≥ 2 → mastered 처리
- [x] 진행 표시 (n / 전체) + 프로그레스 바
- [x] 학습 범위 옵션: 전체 / 모르는 것만
- [x] 섞기 ON/OFF
- [x] **전체화면 모드** (버튼 + F키, Esc 해제)

#### 결과 화면
- [x] 정확도별 이모지/메시지 (100% 🎉 / 70%+ 😊 / 40%+ 💪 / 미만 📚)
- [x] 전체 / 알아요 / 모르겠어요 통계 카드
- [x] 정확도 진행률 바 애니메이션
- [x] 세션 완료 시 `studyCount` 증가
- [x] 버튼: 전체 목록 / 덱으로 돌아가기 / 다시 학습

#### 키보드 단축키
- [x] `Space` / `↑` — 카드 뒤집기
- [x] `→` — 알아요
- [x] `←` — 모르겠어요
- [x] `F` — 전체화면 토글
- [x] `Esc` — 전체화면 해제

---

## 데이터 구조 (localStorage)

키: `vives-flashdeck`

```json
{
  "decks": [
    {
      "id": "uid",
      "name": "생물 용어",
      "createdAt": 1711440000000,
      "lastStudied": 1711526400000,
      "studyCount": 3,
      "cards": [
        {
          "id": "uid",
          "front": "photosynthesis",
          "back": "광합성",
          "mastered": false,
          "failCount": 2,
          "passCount": 1
        }
      ]
    }
  ]
}
```

---

## 기술 스택

| 항목 | 선택 |
|---|---|
| 구조 | 순수 HTML + CSS + Vanilla JS (빌드 없음) |
| 상태 | JS 객체 + localStorage |
| 애니메이션 | CSS 3D perspective + transition (flip, fadeUp, popIn) |
| 공통 스타일 | `/common/hero-theme.css`, `/common/theme.js` |
| 폰트 | JetBrains Mono (일괄 입력), 시스템 폰트 (본문) |

---

## 대기 중 아이디어

- 덱 이름 변경, 덱 복제
- 카드 앞/뒤 직접 편집 (인라인 편집)
- 학습 기록 그래프 (날짜별 정확도 추이)
- 마크다운 지원 (볼드, 이탤릭 등)
- 카드 가져오기/내보내기 (CSV)

---

## 파일 구조

```
public/flash-deck/
└── index.html     ← 단일 파일 (CSS + JS 인라인, ~1000줄)
```
