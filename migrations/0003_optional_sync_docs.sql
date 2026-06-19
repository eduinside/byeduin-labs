-- 선택 동기화 앱 doc 테이블 (Phase 4)
-- flash-deck / blocks-universe / timer / search — 코드당 상태 1개(JSON blob), 문서 단위 LWW.
-- 공용 _sync.js createDocSync 스키마.
--
-- 로컬 적용:  npx wrangler d1 execute byeduin --local  --file=migrations/0003_optional_sync_docs.sql
-- 원격 적용:  npx wrangler d1 execute byeduin --remote --file=migrations/0003_optional_sync_docs.sql

CREATE TABLE IF NOT EXISTS flash_deck_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks_universe_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timer_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS search_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
