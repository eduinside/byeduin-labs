---
name: "source-command-sync-docs"
description: "apps.json(단일 소스)과 앱 소스(src/pages/apps/)·README를 동기화하고 불일치를 감지"
---

# source-command-sync-docs

Use this skill when the user asks to run the migrated source command `sync-docs`.

## Command Template

# /sync-docs — 문서 자동 동기화

사용자가 `/sync-docs` 명령을 실행했습니다.

## 목표

**단일 소스인 [public/apps.json](../../public/apps.json)** 을 기준으로 실제 앱 소스(`src/pages/apps/`)와 [README.md](../../README.md) 앱 목록을 동기화하고 불일치를 보고합니다.

> **경로 주의** — Astro 전환 이후 앱 페이지는 `src/pages/apps/<id>/index.astro`입니다.
> `public/apps/`에는 **index.html이 없습니다**(일부 앱의 정적 자산·하위 페이지만 있음).
> 앱 폴더를 `public/apps/`에서 찾으면 "앱 0개"라는 잘못된 결론이 납니다.

---

## 단계 1: 소스 수집

1. `public/apps.json`을 읽어 `categories`(각 `subcategories` 포함)와 `apps`(각 `id`/`title`/`desc`/`href`/`category`/`subcategory`/`type`)를 파악하세요.
2. `src/pages/apps/*/index.astro`를 Glob으로 수집해 실제 앱 id 목록을 만드세요.
3. 하위 페이지 검증이 필요하면 `public/apps/**/*.html`도 함께 수집하세요.

---

## 단계 2: 불일치 검사

`apps.json` 항목을 `href` 모양에 따라 **세 갈래로 나눠** 비교하세요. 세 갈래를 구분하지 않으면 정상 항목이 오탐으로 잡힙니다.

| 갈래 | href 모양 | 있어야 할 것 |
|---|---|---|
| 앱 루트 | `/apps/<id>/` | `src/pages/apps/<id>/index.astro` |
| 하위 페이지 | `/apps/<id>/<name>.html` | `public/apps/<id>/<name>.html` (정적 파일) |
| 모달·외부 | `type:"modal"`/외부 URL | 없어도 정상 |

```
📁 앱 폴더는 있지만 apps.json에 미등록:
  - src/pages/apps/<id>/
🔗 apps.json 앱 루트인데 소스 없음:
  - <id>
📄 apps.json 하위 페이지인데 파일 없음:
  - <href>
🏷  subcategory 누락 앱 (홈에 '기타'로 빠짐):
  - <id>
```

`type:"modal"`(외부·다운로드)은 소스가 없어도 정상입니다.
`blocks-universe`처럼 앱 루트 아래에 하위 페이지를 따로 등록한 경우, 그 하위 페이지는 `src/pages/apps/`에 폴더가 **없는 것이 정상**입니다.

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
- 각 서브카테고리 표 안의 앱 순서도 `apps.json`의 `apps` 배열 순서를 따르세요.
- 각 앱은 자신의 `subcategory` 표에 배치하고, `subcategory`가 없으면 카테고리 말단 "기타" 표에 넣으세요.
- 상단의 총 앱 수(`## 앱 목록 (N개)`)와 **각 카테고리 헤더의 수**(`### 📚 교육 (N)`)도 함께 갱신하세요. 총계만 고치고 카테고리 수를 빠뜨리기 쉽습니다.

검증: README의 `| **앱명**` 행 수 == `apps.json`의 앱 수. 카테고리별 행 수 == 해당 카테고리 앱 수.

---

## 단계 4: 완료 보고

```
✅ 동기화 완료
- apps.json 앱 수: N (앱 루트 R + 하위 페이지 S + 모달/외부 K)
- src/pages/apps/ 앱 소스: R
- 미등록 폴더 / 소스 없는 앱 / 파일 없는 하위 페이지 / subcategory 누락: 각각 N개 (있으면 목록)
- README.md 갱신: ✓ (총계·카테고리 수 포함)
```

불일치(미등록 폴더 등)가 있으면 `/new-app` 또는 `apps.json` 수정을 제안하세요.
