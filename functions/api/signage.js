// /api/signage — 사이니지 갤러리 '메타데이터' 동기화(선택). VivesSync doc 모드.
// 이미지(IndexedDB)는 제외하고 항목 메타(텍스트·스타일·프롬프트·생성일)만 동기화한다.
import { createDocSync } from './_sync.js';
export const onRequest = createDocSync({ table: 'signage_docs' });
