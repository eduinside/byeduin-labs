---
description: eduin VIVES에 새 미니앱 스캐폴딩 — scaffold-app.js 위임
argument-hint: [app-slug] [category]
allowed-tools: [Read, Bash]
---

# /new-app — 새 앱 스캐폴딩

사용자가 `/new-app` 명령을 실행했습니다. 인수: `$ARGUMENTS`

새 앱은 **단일 소스인 `scripts/scaffold-app.js`** 로 생성합니다 — 폴더 + 셸 HTML + `apps.json` 등록 + `inject`·`og`·`sitemap` 후처리가 한 커맨드로 처리됩니다. 별도의 수동 템플릿/등록 단계는 없습니다.

---

## 단계 1: 정보 수집

먼저 [public/apps.json](../../public/apps.json)을 읽어 현재 `categories`와 각 `subcategories`를 확인하세요. 인수가 불완전하면 다음을 질문합니다:

1. **slug** (영소문자·하이픈) — URL은 `/apps/<slug>/`
2. **이름** · **이모지** · **한 줄 설명**
3. **category / subcategory** — apps.json의 `categories`(edu·utility)와 그 `subcategories` 중 선택 (홈 자동 배치)
4. **base(셸 유형)** — `column`(중앙 컬럼) · `split`(2-페인) · `sidebar`(내비+메인) · `gallery`(카드 그리드) · `immersive`(풀뷰포트)
5. **width** — `narrow`(480) · `medium`(720) · `wide`(1120) — column/gallery에만
6. **플래그** — `focus`(아이템→전체화면) · `print`(A4 인쇄) — 필요한 경우만
7. **SEO 제목 / 설명**

---

## 단계 2: 스캐폴드 실행 (비대화형)

수집한 값으로 실행하세요:

```bash
node scripts/scaffold-app.js --id <slug> --name "<이름>" --emoji <이모지> --desc "<설명>" \
  --category <cat> --subcategory <subcat> --base <base> --width <width> \
  --seo-title "<SEO 제목>" --seo-desc "<SEO 설명>" [--focus] [--print]
```

모달/외부/다운로드 항목(셸 없음)은:

```bash
node scripts/scaffold-app.js --kind modal --id <slug> --name "<이름>" --emoji <이모지> \
  --desc "<설명>" --category <cat> --subcategory <subcat> \
  --href "<URL 또는 /downloads/..>" --link-label "<라벨 ↗>" [--external]
```

스캐폴드가 폴더·`apps.json`·OG 이미지·sitemap을 자동 처리합니다 (canvas 미설치 시 OG만 경고 후 계속).

---

## 단계 3: 구현 & 확인

- `public/apps/<slug>/index.html`의 셸 골격 위에 UI를 구현하세요. 플로팅 크롬(홈·테마·공유)은 `app-shell.js`가 주입하므로 추가하지 않습니다.
- `npm run dev` → `http://localhost:8788/apps/<slug>/` 에서 확인하세요.
- 디자인 토큰·컴포넌트는 [docs/design-system.md](../../docs/design-system.md), 셸 유형은 [docs/app-development-guide.md](../../docs/app-development-guide.md) 참고.
