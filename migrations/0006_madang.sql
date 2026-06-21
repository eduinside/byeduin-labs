-- 마당(madang) — 실시간 응답 보드 (패들렛형).
--   코드 동기화(_sync.js)가 "개인 코드 1개 = 그 사람 데이터"인 것과 달리,
--   마당은 board_id로 파티션하고 여러 사람의 카드가 한 보드에 모인다.
--   소유권(개설자/작성자)은 원본 코드 대신 HMAC 해시(author_token/owner_token)로 판정 →
--   D1이 유출돼도 사용자 동기화 코드(vives:code)가 새지 않는다.

CREATE TABLE IF NOT EXISTS madang_boards (
  id          TEXT PRIMARY KEY,            -- 마당(입장) 코드. 혼동 문자(0/O/1/I/L) 제외 6자리
  owner_token TEXT NOT NULL,               -- HMAC(pepper, 'owner:'+id+':'+개설자코드)
  title       TEXT NOT NULL DEFAULT '',
  settings    TEXT NOT NULL DEFAULT '{}',  -- JSON: { pinHash?, allowedTypes?:["text","link","html"] }
  shared      INTEGER NOT NULL DEFAULT 1,  -- 1=공유중(입장 가능), 0=공유중단(개설자만 접근)
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS madang_cards (
  id           TEXT NOT NULL,              -- 카드 id (uuid)
  board_id     TEXT NOT NULL,
  author_token TEXT NOT NULL,              -- HMAC(pepper, 'author:'+board_id+':'+작성자코드)
  nickname     TEXT NOT NULL DEFAULT '',   -- 표시 이름(자유 입력 — 실명·학번 금지 안내)
  type         TEXT NOT NULL DEFAULT 'text', -- text | link | html
  content      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (board_id, id)
);
CREATE INDEX IF NOT EXISTS idx_madang_cards_board ON madang_cards (board_id, created_at);
