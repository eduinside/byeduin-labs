-- byeduin 전용 D1 — Read Tree (Phase 2)
-- 코드 단위 식별(개인정보 없음). byeduin 공용 DB 공유 대비해 앱별 접두 read_tree_ 사용.
--
-- 로컬 적용:  npx wrangler d1 execute byeduin --local  --file=migrations/0001_read_tree.sql
-- 원격 적용:  npx wrangler d1 execute byeduin --remote --file=migrations/0001_read_tree.sql

CREATE TABLE IF NOT EXISTS read_tree_codes (
  code       TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS read_tree_reads (
  code     TEXT NOT NULL,
  book_id  TEXT NOT NULL,
  read_at  TEXT NOT NULL,
  PRIMARY KEY (code, book_id)
);

CREATE INDEX IF NOT EXISTS idx_read_tree_reads_code ON read_tree_reads (code);
