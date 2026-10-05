-- book-share 서지정보 캐시 (functions/api/book-lookup.js)
-- ISBN13 -> 도서 정보 JSON. 서버 키 1개로 전 이용자를 대행하므로 중복 호출을 줄이는 것이 목적.
-- (처음엔 알라딘 기준으로 만들었으나 알라딘 Open API 종료로 현재 조회처는 카카오. 테이블 구조는 그대로 사용)
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0012_book_cache.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0012_book_cache.sql

CREATE TABLE IF NOT EXISTS book_cache (
  isbn13 TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
