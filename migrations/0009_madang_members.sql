-- 마당 참여자(멤버) — 개설자가 참여 닉네임 전체를 확인. 입장·닉네임변경 시 기록.
CREATE TABLE IF NOT EXISTS madang_members (
  board_id   TEXT NOT NULL,
  token      TEXT NOT NULL,              -- HMAC author 토큰(참여 신원)
  nickname   TEXT NOT NULL DEFAULT '',
  is_owner   INTEGER NOT NULL DEFAULT 0,
  joined_at  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (board_id, token)
);
CREATE INDEX IF NOT EXISTS idx_madang_members ON madang_members (board_id);
