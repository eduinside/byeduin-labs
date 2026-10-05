-- 중복 인덱스·미사용 테이블 정리 (docs/audit-2026-10.md 4.4)
-- 아래 인덱스는 모두 같은 테이블의 PRIMARY KEY(또는 다른 인덱스)의 앞부분 칼럼과 똑같아
-- SQLite가 PK 인덱스로 같은 조회를 처리한다. 남겨 두면 쓰기마다 인덱스 행만 더 계산된다.
--
--   인덱스                       칼럼                       대신 쓰이는 인덱스
--   idx_read_tree_reads_code     read_tree_reads(code)      PK (code, item_id)
--   idx_math_sheet_sets_code     math_sheet_sets(code)      PK (code, item_id)
--   idx_md_editor_docs_code      md_editor_docs(code)       PK (code, item_id)
--   idx_madang_likes             madang_likes(board_id, card_id)     PK (board_id, card_id, liker_token, emoji)
--   idx_madang_members           madang_members(board_id)            PK (board_id, token)
--   idx_madang_comments_card     madang_comments(board_id, card_id)  idx_madang_comments (board_id, card_id, created_at)
--
-- read_tree_codes: 0001에서 만든 코드 등록 테이블. 0002에서 set 스키마로 바꾼 뒤 어떤 코드도 읽거나 쓰지 않는다.
-- (먼저 행 수를 보고 싶으면: SELECT COUNT(*) FROM read_tree_codes;)
--
-- 아직 적용하지 않았다. 적용:
--   로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0014_drop_redundant_indexes.sql
--   원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0014_drop_redundant_indexes.sql

DROP INDEX IF EXISTS idx_read_tree_reads_code;
DROP INDEX IF EXISTS idx_math_sheet_sets_code;
DROP INDEX IF EXISTS idx_md_editor_docs_code;
DROP INDEX IF EXISTS idx_madang_likes;
DROP INDEX IF EXISTS idx_madang_members;
DROP INDEX IF EXISTS idx_madang_comments_card;

DROP TABLE IF EXISTS read_tree_codes;
