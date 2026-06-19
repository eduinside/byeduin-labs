// /api/search-sync — 검색 기록 동기화(선택). VivesSync doc 모드.
// (/api/search 는 RAG 검색 엔드포인트라 별도 이름 사용.)
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'search_docs' });
