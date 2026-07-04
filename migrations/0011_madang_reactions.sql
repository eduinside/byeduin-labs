-- 마당 v2 Phase 2 — 좋아요를 이모지 반응으로 확장. PK에 emoji 추가 위해 테이블 재생성.
-- 기존 좋아요 행은 모두 '❤️' 반응으로 이관(데이터 손실 없음).
CREATE TABLE madang_likes_new (
  board_id     TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  liker_token  TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '❤️',
  created_at   TEXT NOT NULL,
  PRIMARY KEY (board_id, card_id, liker_token, emoji)
);
INSERT INTO madang_likes_new (board_id, card_id, liker_token, emoji, created_at)
  SELECT board_id, card_id, liker_token, '❤️', created_at FROM madang_likes;
DROP TABLE madang_likes;
ALTER TABLE madang_likes_new RENAME TO madang_likes;
CREATE INDEX IF NOT EXISTS idx_madang_likes ON madang_likes (board_id, card_id);
