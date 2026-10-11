# byeduin 데스크톱 앱 배포 규약

작성: 2026-10-09 · 상태: 첫 적용(에듀나비 교원업무지원 자동 로그인) — R2 업로드 완료(0.5.2, 2026-10-10), 사이트 배포 전

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

앱마다 안내 페이지 `src/pages/apps/{id}/index.astro`(AppLayout·공용 카드/버튼)를 두고, `apps.json` 항목은 모달이 아닌 일반 페이지(`href: /apps/{id}/`)로 둔다. 페이지의 내려받기 버튼은 고정 주소 `/downloads/apps/{id}/setup`·`/portable`, 버전·날짜·크기는 `latest.json`을 읽어 표시. 첫 사례: `/apps/login-helper/`.

## 상태

- [x] Function 구현 + 로컬 시험(`scripts/test-desktop-dist.mjs`)
- [x] 실제 R2 업로드: login-helper 0.5.2 (2026-10-10)
- [x] 안내 페이지 `/apps/login-helper/` + `apps.json` 일반 페이지로 전환
- [ ] main 병합·Pages 배포 (사람 확인 후)

## 데스크톱 앱 저장소는 여기 하나 (2026-10-11 결정)

공용 설치·업데이트 모듈 **DesktopKit**(`LOCAL/local-desktop-kit`)를 쓰는 앱은 dgedu 계열이어도 **모두 이 R2(`byeduin-media` `apps/<id>/`)와 이 서빙 함수**로 배포한다. 각 앱의 웹페이지(eduin.info·dic.dgedu.link·team.dgedu.link)는 **내려받기 단추만** 단다 — `https://eduin.info/downloads/apps/<id>/setup`.

| id | 앱 | 상태 |
|---|---|---|
| `gnote` | G노트 | kit 0.9.0 준비 — R2 업로드 전 |
| `login-helper` | 에듀나비 | Velopack (kit 로 옮길 예정, 같은 경로) |
| `edu-dic` | 어린이 쉬운 사전 | kit 0.6.0(다리 판) 준비 — 함수 허용 목록 추가(2026-10-12), R2 업로드 전. 옛 `edu-dic-downloads` 는 두 판 동안 다리 판에 머묾. 안내·단추는 dic.dgedu.link (`dgedu-dic/docs/plan-desktop-kit.md`) |
| `edu-team` | 에듀팀 데스크탑 | kit 0.8.0 준비 — 함수 허용 목록 추가(2026-10-11), R2 업로드 전. 안내·단추는 team.dgedu.link 마이페이지 |
| (`rec-note`) | Rec Note v2 | byeduin 계열 — 준비만, 아직 배포 안 함 |
| (`music-to-score`) | 악보 만들기 | byeduin 계열 — 준비만, 아직 배포 안 함 |
| (`keyvault`) | 키 관리 | byeduin 계열 — 준비만, 아직 배포 안 함 |

안내 페이지는 계열별로 나뉜다 — byeduin(eduin.info/apps/…): G노트·에듀나비(+ 준비 중 3개), dgedu: 사전(dic.dgedu.link)·에듀팀(team.dgedu.link). 수업꾸러미(dgedu-kit)는 앱이 아니라 해당 없음.

예외: 에듀포털(교내 설치형·인증 배포) — 이 저장소를 쓰지 않는다.

## G노트 (`gnote`) — 공용 모듈 DesktopKit (2026-10-11)

G노트는 Velopack 대신 공용 설치·업데이트 모듈(`LOCAL/local-desktop-kit`, docs/spec.md)을 쓴다. 같은 서빙 함수·같은 R2 경로 규칙, 파일만 다르다.

```
apps/gnote/
├── latest.json                kit 1 매니페스트 (byeduin latest.json 확장 — version·date·files.setup 은 같음, packs·sig 추가)
├── GNote-<판>-Setup.exe        설치 파일(net48, 약 0.1MB) — 고정 주소 /downloads/apps/gnote/setup
└── pack-<sha256>.zip           팩(app·lib·runtime·tools). 내용 주소라 판이 바뀌어도 같은 팩은 다시 올리지 않음
```

- 올리기: `LOCAL/local-law/tools/release.ps1 -Upload` (이 폴더의 wrangler 로 팩 → 설치 파일 → latest.json)
- 정리: 최근 2판의 latest.json 이 가리키지 않는 팩·설치 파일은 손으로 지운다
- 페이지: `/apps/gnote/`(안내), `/apps/gnote/terms/`(이용 안내 — `src/pages/apps/gnote/_terms.md` 는 local-law `docs/terms.md` 복사본)
- [x] 함수 허용 목록 `gnote`, apps.json, 안내·이용 안내 페이지, Pages 배포 (2026-10-11 — latest.json 없으면 ‘준비 중’)
- [x] R2 첫 업로드 0.9.1 (2026-10-11) — `/setup` 으로 받아 실제 설치까지 확인

## 에듀팀 데스크탑 (`edu-team`) — 공용 모듈 DesktopKit (2026-10-11)

옛 방식(team.dgedu.link Worker + R2 `edu-team-downloads`, 폴더 바꿔치기)에서 옮겨 온다. 계획: `DGEDU-LINK/dgedu-team/docs/plan-2026-10-11-desktop-kit.md`.

```
apps/edu-team/
├── latest.json                 kit 1 매니페스트
├── EduTeam-<판>-Setup.exe       설치 파일(net48, 약 0.14MB) — 고정 주소 /downloads/apps/edu-team/setup (team.dgedu.link 마이페이지 단추)
└── pack-<sha256>.zip            팩(app 약 0.6MB · web 1.3MB · runtime 71MB)
```

- 올리기: `DGEDU-LINK/dgedu-team/desktop-net/tools/release.ps1 -Upload` (이 폴더의 wrangler). 다리 판 기간(0.8.0 + 다음 판)엔 `-Bridge` 로 옛 버킷에도 같은 판을 올린다 — 옛 판이 그것으로 다리 판을 받고, 다리 판이 이 설치 파일로 옮긴다.
- 사용 통계: 앱 설정 › 업데이트 › ‘사용 통계 보내기’ + 이용 안내(앱 설정·team.dgedu.link 도움말).
- [x] 함수 허용 목록 `edu-team` (2026-10-11)
- [ ] R2 첫 업로드 0.8.0

## 사용자 수 (DesktopKit kit 0.2, 2026-10-11~)

앱이 `latest.json` 요청에 `X-Kit-Install`(무작위 32자 16진수)을 붙이면 서빙 함수가 D1 `desktop_pings(app, day, inst, version)` 에 하루 한 줄 — `inst` 는 SHA-256(`app:번호`) 앞 16자, **번호 원문·IP·User-Agent 는 저장하지 않는다**. `/setup` 고정 주소는 `desktop_downloads(app, day, n)` +1. 90일 지난 줄은 가끔(약 1/200 요청) `desktop_daily(app, day, users)` 로 접는다. 기록은 `waitUntil` + 실패 무시라 표가 없어도 내려받기는 정상.

- 표: `migrations/0015_desktop_stats.sql`. **원격 적용은 `npx wrangler d1 execute byeduin --remote --file migrations/0015_desktop_stats.sql`** — ⚠ `d1 migrations apply --remote` 는 쓰지 말 것: 원격 추적표(`d1_migrations`)에 0001 만 기록돼 있어 0002~0014 를 다시 돌린다(0014 는 색인 삭제).
- 새 앱: `DESKTOP_APPS` 에 id 를 더하고, 그 앱 이용 안내에 ‘무엇을·왜·얼마나·끄는 법’을 먼저 적는다(kit docs/integrate.md §2-6).
- 보기: `npx wrangler d1 execute byeduin --remote --command "SELECT app, day, COUNT(*) AS users FROM desktop_pings GROUP BY app, day ORDER BY day DESC LIMIT 30"`
- [x] 원격 D1 에 0015 적용 (2026-10-11, `d1 execute --file`) — 설치 1분 뒤 ping 기록 확인
