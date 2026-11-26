-- 협의 날짜 모으기(apps/meet-date) — docs/meet-date-plan.md §4, §11
-- 협의 1건 = meet_events 1행, 응답 = meet_responses, 손글씨 서명 = meet_signs.
-- 마감 30일 뒤 모두 자동 삭제(purge_at). 관리키·응답키·서명키는 원본 대신 SHA-256만 저장
-- (무작위 128비트라 페퍼 불필요).
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0017_meet_date.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0017_meet_date.sql

CREATE TABLE IF NOT EXISTS meet_events (
  id          TEXT PRIMARY KEY,
  owner_hash  TEXT NOT NULL,
  config      TEXT NOT NULL,
  confirmed   TEXT,
  closes_at   TEXT NOT NULL,
  purge_at    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  live_open   INTEGER NOT NULL DEFAULT 0,   -- 실시간 등록부 출석 받는 중
  rev         INTEGER NOT NULL DEFAULT 0    -- 서명이 바뀔 때마다 +1
);
CREATE INDEX IF NOT EXISTS meet_events_purge ON meet_events (purge_at);

CREATE TABLE IF NOT EXISTS meet_responses (
  event_id    TEXT NOT NULL,
  id          TEXT NOT NULL,
  edit_hash   TEXT NOT NULL,
  name        TEXT NOT NULL,
  fields      TEXT,
  picks       TEXT NOT NULL,
  memo        TEXT,
  status      TEXT,                         -- 확인서: 'file'(파일 받음) | 'direct'(바로 냄) | NULL
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (event_id, id)
);

CREATE TABLE IF NOT EXISTS meet_signs (
  event_id    TEXT NOT NULL,
  id          TEXT NOT NULL,                -- 's…' 출석, 'c'+응답id 확인서
  kind        TEXT NOT NULL,                -- 'live' | 'cert'
  resp_id     TEXT,
  name        TEXT NOT NULL,
  fields      TEXT,
  png         TEXT,                         -- data:image/png;base64,… (담당자가 지우면 NULL)
  edit_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (event_id, id)
);
CREATE INDEX IF NOT EXISTS meet_signs_updated ON meet_signs (event_id, updated_at);
