// /api/blocks-universe — 즐겨찾기·재생목록·최근 동기화(선택). VivesSync doc 모드.
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'blocks_universe_docs' });
