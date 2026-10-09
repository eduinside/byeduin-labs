# byeduin 데스크톱 앱 배포 규약

작성: 2026-10-09 · 상태: 첫 적용(Login Helper) 준비 — Function 구현, 실제 R2 업로드·배포 전

byeduin에서 내놓는 Windows 앱(첫 사례: Login Helper, `apps.json` id `login-helper`)을 같은 방식으로 배포·업데이트하기 위한 규약. 앱 쪽 계획: `D:\Proj\local-edunavi-cowork\docs\02-plan-csharp.md` §3.3.

## 왜

- 크롬 확장 zip처럼 작은 파일은 `public/downloads/`(정적)로 충분하지만, 데스크톱 앱은 수십~수백 MB라 Pages 정적 파일 한도(25MB)를 넘고 버전마다 바뀌어 git에 넣을 수 없다.
- 주소는 기존과 같이 `/downloads/` 아래로 맞추고 실제 파일은 **R2 `byeduin-media`**(바인딩 `MEDIA_R2`, 마당 이미지와 공유)에 둔다.

## 규약

| 항목 | 규칙 |
|---|---|
| 앱 ID | `public/apps.json`의 `id` |
| R2 키 | `apps/{id}/{파일명}` (마당 `madang/…`과 프리픽스로 구분) |
| 공개 주소 | `https://eduin.info/downloads/apps/{id}/{파일명}` |
| 서빙 | `functions/downloads/apps/[[path]].js` 하나로 모든 앱 (GET/HEAD, Range, 허용 목록 `DESKTOP_APPS`) |
| 고정 주소 | `/downloads/apps/{id}/setup`, `/portable` → `latest.json`이 가리키는 파일로 302 |
| 업로드 | 개발자 PC에서 `npx wrangler r2 object put byeduin-media/apps/{id}/{파일} --file=… --remote` (업로드 API 없음) |
| 정적 소용량 파일 | 기존처럼 `public/downloads/*.zip` (경로 충돌 없음) |

## 파일 구성 (앱마다)

```
apps/{id}/
├── latest.json                 byeduin 공통 매니페스트 (사이트·포터블 사용자용)
├── releases.win.json           Velopack 매니페스트 (.NET 앱 자동 업데이트)
├── {Pkg}-{ver}-full.nupkg      Velopack 패키지 (최근 2개 버전만)
├── {Pkg}-{ver}-delta.nupkg
├── {Pkg}-{ver}-win-Setup.exe   버전이 붙은 설치 파일
├── {Pkg}-{ver}-win-Portable.zip
└── (앱 전용, 예: site-profile.json)
```

`latest.json`:

```json
{ "id": "login-helper", "name": "Login Helper", "version": "0.3.0", "date": "2026-10-09",
  "notes": ["…"],
  "files": { "setup": { "name": "LoginHelper-0.3.0-win-Setup.exe", "size": 0, "sha256": "…" },
             "portable": { "name": "LoginHelper-0.3.0-win-Portable.zip", "size": 0, "sha256": "…" } } }
```

## 응답 규칙

- `*.json`: `Cache-Control: no-cache` · 별칭(302): `no-store` · 그 밖(버전이 붙은 파일): `public, max-age=31536000, immutable`
- `exe/zip/msi`: `Content-Disposition: attachment`
- `Range` 요청 → 206 (큰 패키지 이어받기)
- 허용 목록에 없는 앱, 하위 폴더, `..`, 허용되지 않은 문자 → 404

## 업로드 순서

1. 패키지(nupkg)·Setup·Portable
2. `releases.win.json`
3. **`latest.json`은 마지막** (아직 없는 파일을 가리키지 않게)
4. 오래된 버전(최근 2개 초과) 삭제

## 무료 티어

- 업데이트 확인은 앱마다 15일 주기(±2일) → 사용자 수백 명이어도 하루 수십 요청. Pages Functions 일 10만 요청에 영향 미미.
- 저장: 앱당 약 0.3~0.5GB(2개 버전). `byeduin-media` 10GB 공유. R2 송신 무료.

## 사이트 연결 (앱 완성 후)

`public/apps.json`의 해당 항목(모달) `href`를 `/downloads/apps/{id}/setup`으로, `linkLabel`을 "프로그램 다운로드 ⬇"로. Login Helper는 앱 1.0.0 공개 때 교체(현재 `https://blog.eduin.info/450`).

## 상태

- [x] Function 구현 + 로컬 시험(`scripts/test-desktop-dist.mjs`)
- [ ] 실제 R2 업로드·Pages 배포 (사람 확인 후)
- [ ] `apps.json` 버튼 교체 (앱 1.0.0)
