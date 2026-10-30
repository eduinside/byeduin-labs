// /api/mindmap — 마인드맵 동기화(선택). VivesSync doc 모드. 맵 여러 개를 통째로(칠판과 같은 512KB 한계).
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'mindmap_docs', maxBytes: 512 * 1024 });
