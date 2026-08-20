-- book-share 알라딘 서지정보 캐시 (docs/book-share-aladin-plan.md)
-- ISBN13 -> 알라딘 item JSON. 공용 TTB 키 1개로 전 이용자를 대행하므로
-- 중복 호출을 없애 알라딘 일시 차단(10분)을 예방하는 것이 목적.
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0012_book_cache.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0012_book_cache.sql

CREATE TABLE IF NOT EXISTS book_cache (
  isbn13 TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
