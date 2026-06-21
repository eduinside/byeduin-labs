-- 마당 카드 분류 섹션(레이아웃 확장: 분류 칼럼). 섹션 목록은 board settings.sections(JSON).
ALTER TABLE madang_cards ADD COLUMN section TEXT NOT NULL DEFAULT '';
