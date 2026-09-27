-- 에듀서치(apps/search) 매뉴얼 색인 — GitHub md 연동을 대체한다(2026-09-27).
-- 원본(HWP·HWPX·PDF)을 scripts/manual-ingest.mjs가 kordoc으로 파싱해 채운다.
--
-- 로컬 적용:  npx wrangler d1 execute byeduin --local  --file=migrations/0013_manual.sql
-- 원격 적용:  npx wrangler d1 execute byeduin --remote --file=migrations/0013_manual.sql

CREATE TABLE IF NOT EXISTS manual_docs (
  id TEXT PRIMARY KEY,          -- 예: field-trip-2026
  title TEXT NOT NULL,
  category TEXT NOT NULL,       -- 사이드바 분류
  dept TEXT,                    -- 소관 부서
  year INTEGER,
  file_key TEXT,                -- R2(MEDIA_R2) 원본 키, 예: manual/field-trip-2026.pdf
  file_type TEXT,               -- pdf | hwpx | hwp
  pages INTEGER,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  seq INTEGER NOT NULL,         -- 문서 안 순서(이웃 문맥 확장용)
  path TEXT,                    -- 장·절 경로
  page_from INTEGER,
  page_to INTEGER,
  text TEXT NOT NULL,           -- 마크다운(표는 GFM 표)
  UNIQUE (doc_id, seq)
);

-- rowid = manual_chunks.id. grams = _manual-text.js toGrams() 결과를 공백으로 이은 것.
CREATE VIRTUAL TABLE IF NOT EXISTS manual_fts USING fts5(grams, tokenize = 'unicode61');
