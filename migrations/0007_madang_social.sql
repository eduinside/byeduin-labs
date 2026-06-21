-- 마당 댓글·좋아요 (개설자가 설정에서 켰을 때만 노출/허용).
--   소유권은 카드와 동일하게 코드 HMAC(author 토큰) 재사용 — 원본 코드 미저장.

CREATE TABLE IF NOT EXISTS madang_comments (
  id           TEXT PRIMARY KEY,
  board_id     TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  author_token TEXT NOT NULL,             -- HMAC(pepper,'author:'+board_id+':'+code)
  nickname     TEXT NOT NULL DEFAULT '',
  text         TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_madang_comments ON madang_comments (board_id, card_id, created_at);

CREATE TABLE IF NOT EXISTS madang_likes (
  board_id     TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  liker_token  TEXT NOT NULL,             -- author 토큰 재사용(중복 방지·토글)
  created_at   TEXT NOT NULL,
  PRIMARY KEY (board_id, card_id, liker_token)
);
CREATE INDEX IF NOT EXISTS idx_madang_likes ON madang_likes (board_id, card_id);
