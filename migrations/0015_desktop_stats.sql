-- 데스크톱 앱 사용자 수 (DesktopKit kit 0.2 — LOCAL/local-desktop-kit docs/spec.md §6.1, G노트 0.9.1~)
-- 익명 설치 번호 원문·IP·User-Agent 는 저장하지 않는다. inst = SHA-256(app + ':' + installId) 앞 16자
CREATE TABLE IF NOT EXISTS desktop_pings (
  app     TEXT NOT NULL,
  day     TEXT NOT NULL,   -- 'YYYY-MM-DD' (UTC)
  inst    TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (app, day, inst)
);

-- 90일 지난 desktop_pings 를 접어 둔 날짜별 합계
CREATE TABLE IF NOT EXISTS desktop_daily (
  app   TEXT NOT NULL,
  day   TEXT NOT NULL,
  users INTEGER NOT NULL,
  PRIMARY KEY (app, day)
);

-- 고정 주소 /downloads/apps/<id>/setup 내려받기 횟수 (누가 받았는지는 남기지 않음)
CREATE TABLE IF NOT EXISTS desktop_downloads (
  app TEXT NOT NULL,
  day TEXT NOT NULL,
  n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (app, day)
);
