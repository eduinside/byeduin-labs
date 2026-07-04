-- 마당 v2 — 성능 재설계 기반: rev 조건부 폴링 + 카드 상태(승인/숨김) 칼럼.
ALTER TABLE madang_boards ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE madang_cards  ADD COLUMN status TEXT NOT NULL DEFAULT 'live';  -- live|pending|hidden
CREATE INDEX IF NOT EXISTS idx_madang_comments_card ON madang_comments (board_id, card_id);
