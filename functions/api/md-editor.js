// /api/md-editor — 코드 기반 문서 라이브러리(선택). VivesSync set 모드.
// 항목 value = 문서 JSON({name,content,...}). 큰 값(마크다운 본문) 허용.
import { createSetSync } from './_sync.js';
export const onRequest = createSetSync({ table: 'md_editor_docs', valueMax: 200 * 1024 });
