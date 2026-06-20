// /api/chalkboard — 칠판/화이트보드 동기화(선택). VivesSync doc 모드.
// 보드가 많거나 글씨가 많으면 커질 수 있어 값 한계를 넉넉히(512KB).
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'chalkboard_docs', maxBytes: 512 * 1024 });
