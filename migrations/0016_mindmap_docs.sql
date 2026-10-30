-- mindmap 동기화 doc 테이블. 맵 목록 전체(localStorage 'vives-mindmap')를 코드당 문서 1개로.
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0016_mindmap_docs.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0016_mindmap_docs.sql

CREATE TABLE IF NOT EXISTS mindmap_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
