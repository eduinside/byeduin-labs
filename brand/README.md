# brand/ — 브랜드 원본 에셋 (소스 오브 트루스)

`public/`에 배포되는 모든 브랜드 이미지의 **고해상도 원본**입니다. 이 폴더는 웹으로
서빙되지 않으며(`wrangler pages dev public` 기준), 빌드 스크립트의 입력으로만 쓰입니다.

| 파일 | 용도 | 생성 스크립트 |
|------|------|---------------|
| `logo.png` (700×700, 흰 배경 라운드 아이콘) | 로고·파비콘 일체 | `node scripts/generate-icons.js` → `public/logo.png`·`logo.jpg`·`favicon.svg`·`favicon.ico` |
| `logo-seo.png` (1254×1254, 아이콘+워드마크+태그라인) | 홈 기본 공유(OG) 이미지 | `node scripts/generate-og-default.js` (또는 `npm run og`) → `public/og-default.png` (1200×630) |

## 재생성

원본을 교체한 뒤 아래를 실행하면 `public/`의 파생 에셋이 갱신됩니다.

```bash
node scripts/generate-icons.js        # 로고 + 파비콘
node scripts/generate-og-default.js   # 홈 OG 이미지
```

두 스크립트 모두 첫 번째 인자로 다른 소스 경로를 받을 수 있습니다
(예: `node scripts/generate-icons.js ./brand/logo.png`).
