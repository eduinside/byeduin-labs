// /api/search-sync — 검색 기록 동기화(선택). VivesSync doc 모드.
// (/api/search 는 RAG 검색 엔드포인트라 별도 이름 사용.)
import { createDocSync } from './_sync.js';
import { appClosed } from './_closed.js';
const APP_CLOSED = true;

const sync = createDocSync({ table: 'search_docs' });
export const onRequest = (ctx) => {
  if (APP_CLOSED) return appClosed(); // 비공개 앱 — functions/api/_closed.js 참고
  return sync(ctx);
};
