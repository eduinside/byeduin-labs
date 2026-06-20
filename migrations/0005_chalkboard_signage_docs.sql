-- chalkboard / signage-maker 동기화 doc 테이블 (Phase 6)
-- chalkboard: 보드 전체(localStorage) doc 동기화.
-- signage-maker: 갤러리 '메타데이터만'(이미지 제외) doc 동기화.
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0005_chalkboard_signage_docs.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0005_chalkboard_signage_docs.sql

CREATE TABLE IF NOT EXISTS chalkboard_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS signage_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
