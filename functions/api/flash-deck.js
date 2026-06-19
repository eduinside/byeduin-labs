// /api/flash-deck — 플래시카드 덱 동기화(선택). VivesSync doc 모드.
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'flash_deck_docs' });
