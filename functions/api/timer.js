// /api/timer — 알람·기록 동기화(선택). VivesSync doc 모드.
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'timer_docs' });
