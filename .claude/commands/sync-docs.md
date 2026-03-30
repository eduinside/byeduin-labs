---
description: public/ 앱 폴더에서 메타 정보를 추출해 README.md를 동기화하고 APPS 배열 불일치를 감지
allowed-tools: [Read, Edit, Glob, Grep]
---

# /sync-docs — 문서 자동 동기화

사용자가 `/sync-docs` 명령을 실행했습니다.

## 목표

`public/` 폴더 내 실제 앱과 `README.md` 및 `public/index.html`의 APPS 배열을 동기화합니다.

---

## 단계 1: 앱 목록 수집

1. `public/` 디렉토리에서 `index.html`을 포함하는 모든 하위 폴더를 스캔하세요.
   - 제외: `common/`, `chrome-extentions/`, 루트 `index.html` 자체

2. 각 앱 폴더의 `index.html`에서 다음을 추출하세요:
   - `<title>` 태그 내용 (` — byeduin` 제거)
   - `<meta name="description">` content (있는 경우)
   - `<h1>` 첫 번째 태그 (title이 없는 경우 대체)

---

## 단계 2: APPS 배열과 폴더 불일치 검사

`public/index.html`의 APPS 배열에서 모든 `href` 값을 추출하고,
실제 폴더 목록과 비교하세요.

결과를 두 가지로 분류해서 출력하세요:

```
📁 폴더는 있지만 APPS에 미등록:
  - /color-picker/

🔗 APPS에 있지만 폴더 없음 (또는 외부 링크 타입):
  - /chrome-extentions/... (type: modal — 정상)
```

외부 링크(`type: "link"` 또는 `type: "modal"`)는 정상으로 표시하세요.

---

## 단계 3: README.md 앱 목록 테이블 업데이트

`README.md`의 앱 목록 테이블을 현재 APPS 배열 기준으로 업데이트하세요.

테이블 형식:

```markdown
| 이모지 | 앱 이름 | 설명 | 카테고리 |
|--------|---------|------|---------|
| 📚 | 도서 정보 나눔 | ISBN으로 도서 정보 자동 조회, 파일 저장 및 링크 공유 | utility |
...
```

기존 테이블이 있으면 교체하고, 없으면 `## Apps` 섹션 아래에 새로 추가하세요.

---

## 단계 4: 완료 보고

```
✅ 동기화 완료
- 발견된 앱 수: N
- APPS 미등록 폴더: N개 (있으면 목록 출력)
- README.md 업데이트: ✓
```

불일치 항목이 있으면 `/new-app` 실행을 제안하세요.
