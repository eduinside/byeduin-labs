-- read-tree → VivesSync 표준 set 스키마 전환 (Phase 3)
-- 기존 read_tree_reads(code, book_id, read_at) 를
-- 공용 _sync.js set 스키마(code, item_id, value, updated_at)로 이관. 데이터 보존.
--   value = updated_at = 기존 read_at (read-tree는 값=읽은날짜=LWW키).
--
-- 로컬 적용:  npx wrangler d1 execute byeduin --local  --file=migrations/0002_read_tree_setschema.sql
-- 원격 적용:  npx wrangler d1 execute byeduin --remote --file=migrations/0002_read_tree_setschema.sql

CREATE TABLE IF NOT EXISTS read_tree_reads_v2 (
  code       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, item_id)
);

INSERT OR IGNORE INTO read_tree_reads_v2 (code, item_id, value, updated_at)
  SELECT code, book_id, read_at, read_at FROM read_tree_reads;

DROP TABLE read_tree_reads;
ALTER TABLE read_tree_reads_v2 RENAME TO read_tree_reads;
CREATE INDEX IF NOT EXISTS idx_read_tree_reads_code ON read_tree_reads (code);

-- read_tree_codes(코드 등록 테이블)는 더 이상 쓰지 않음(있어도 무해). 보존.
