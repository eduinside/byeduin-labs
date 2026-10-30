# R2 byeduin-media 의 데스크톱 앱(apps/) 중 옛 판 파일 정리 (2026-10-31).
# 지우는 기준: 현재 latest.json 이 가리키지 않고, 옛 판 업데이트가 읽지도 않는 파일만.
#   - login-helper: 0.5.x 설치 파일·포터블 zip (옛 Velopack 판은 releases.win.json + nupkg 만 읽음 → nupkg·releases.win.json 은 그대로)
#   - gnote: 0.9.1~0.9.3 설치 파일, 현재 latest.json(0.9.4)에 없는 팩 5개
# 실행: 이 폴더(byeduin-labs)에서  powershell -File scripts\prune-r2-desktop-old.ps1   (-WhatIf 로 목록만 확인)
param([switch]$WhatIf)

$keys = @(
  'apps/login-helper/LoginHelper-0.5.2-win-Setup.exe',
  'apps/login-helper/LoginHelper-0.5.3-win-Setup.exe',
  'apps/login-helper/LoginHelper-0.5.4-win-Setup.exe',
  'apps/login-helper/LoginHelper-0.5.2-win-Portable.zip',
  'apps/login-helper/LoginHelper-0.5.3-win-Portable.zip',
  'apps/login-helper/LoginHelper-0.5.4-win-Portable.zip',
  'apps/gnote/GNote-0.9.1-Setup.exe',
  'apps/gnote/GNote-0.9.2-Setup.exe',
  'apps/gnote/GNote-0.9.3-Setup.exe',
  'apps/gnote/pack-7de78a652d5f3f930348c68cdf4a8a77a4d2fbcc71e7fc2d9d621a39f1a53413.zip',
  'apps/gnote/pack-80d6cbefc86fab4a537366bf1b1a5771c659809f3abb83ac1a43d30488724e76.zip',
  'apps/gnote/pack-990c56f02228bffc47b693338e587979d23bbbd2e24e3eabe4f12c03a8720321.zip',
  'apps/gnote/pack-c1849a65c8af7464b73091885da9ab664a1cc9ffdc7fcbd5040f594b25ad9295.zip',
  'apps/gnote/pack-f73f5d5455bcc52d89467367fc2a4ae1246a2619b252fa032a31cf411cf4821d.zip'
)

foreach ($k in $keys) {
  if ($WhatIf) { "삭제 예정: $k"; continue }
  npx wrangler r2 object delete "byeduin-media/$k" --remote
}
