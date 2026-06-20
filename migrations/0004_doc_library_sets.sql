-- 코드 기반 문서 라이브러리 (Phase 5) — math-sheet 세트 / md-editor 문서
-- set 스키마(코드당 다수 항목). 항목 value = 문서 JSON 전체. 항목 단위 LWW.
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0004_doc_library_sets.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0004_doc_library_sets.sql

CREATE TABLE IF NOT EXISTS math_sheet_sets (
  code       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, item_id)
);
CREATE INDEX IF NOT EXISTS idx_math_sheet_sets_code ON math_sheet_sets (code);

CREATE TABLE IF NOT EXISTS md_editor_docs (
  code       TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, item_id)
);
CREATE INDEX IF NOT EXISTS idx_md_editor_docs_code ON md_editor_docs (code);
