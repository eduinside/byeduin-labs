---
description: apps.json(단일 소스)과 public/apps/ 폴더·README를 동기화하고 불일치를 감지
allowed-tools: [Read, Edit, Glob, Grep]
---

# /sync-docs — 문서 자동 동기화

사용자가 `/sync-docs` 명령을 실행했습니다.

## 목표

**단일 소스인 [public/apps.json](../../public/apps.json)** 을 기준으로 실제 앱 폴더(`public/apps/`)와 [README.md](../../README.md) 앱 목록을 동기화하고 불일치를 보고합니다.

---

## 단계 1: 소스 수집

1. `public/apps.json`을 읽어 `categories`(각 `subcategories` 포함)와 `apps`(각 `id`/`title`/`desc`/`href`/`category`/`subcategory`/`type`)를 파악하세요.
2. `public/apps/` 하위에서 `index.html`(또는 `*.html`)을 가진 폴더 목록을 수집하세요. (`common/`·`downloads/`·`og-images/`는 앱 아님)

---

## 단계 2: 불일치 검사

`apps.json`의 내부 페이지 앱(`href`가 `/apps/`로 시작)과 실제 `public/apps/` 폴더를 비교하세요:

```
📁 폴더는 있지만 apps.json에 미등록:
  - public/apps/<id>/
🔗 apps.json에 있지만 폴더 없음:
  - <id> (type:modal/external 이면 정상 — 외부/다운로드 항목)
🏷  subcategory 누락 앱 (홈에 '기타'로 빠짐):
  - <id>
```

`type:"modal"`(외부·다운로드)은 폴더가 없어도 정상입니다.

---

## 단계 3: README 앱 목록 갱신

`README.md`의 앱 목록 섹션을 `apps.json` 기준으로 갱신하세요. 구조는 **카테고리 → 서브카테고리 → 표**:

```markdown
### {category.label} ({해당 카테고리 앱 수})

#### {subcategory.label}
| 앱 | 경로 | 설명 |
|---|---|---|
| **{app.title}** | `{app.href}` | {app.desc} |
```

- 카테고리·서브카테고리 순서와 라벨은 `apps.json`의 `categories[].subcategories` 순서를 따르세요.
- 각 앱은 자신의 `subcategory` 표에 배치하고, `subcategory`가 없으면 카테고리 말단 "기타" 표에 넣으세요.
- 상단의 총 앱 수(`## 앱 목록 (N개)`)도 갱신하세요.

---

## 단계 4: 완료 보고

```
✅ 동기화 완료
- apps.json 앱 수: N (페이지 M + 모달/외부 K)
- public/apps/ 폴더: M
- 미등록 폴더 / 폴더 없는 항목 / subcategory 누락: 각각 N개 (있으면 목록)
- README.md 갱신: ✓
```

불일치(미등록 폴더 등)가 있으면 `/new-app` 또는 `apps.json` 수정을 제안하세요.
