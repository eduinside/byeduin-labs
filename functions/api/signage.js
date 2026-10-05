// /api/signage — 사이니지 갤러리 '메타데이터' 동기화(선택). VivesSync doc 모드.
// 이미지(IndexedDB)는 제외하고 항목 메타(텍스트·스타일·프롬프트·생성일)만 동기화한다.
import { createDocSync } from './_sync.js';
import { appClosed } from './_closed.js';
const docSync = createDocSync({ table: 'signage_docs' });
const APP_CLOSED = true; // 비공개 앱 — functions/api/_closed.js 참고
export const onRequest = (ctx) => (APP_CLOSED ? appClosed() : docSync(ctx));
