// /api/math-sheet — 코드 기반 학습지 세트 라이브러리(선택). VivesSync set 모드.
// 항목 value = 세트 JSON({title,config,problems,...}). 큰 값 허용.
import { createSetSync } from './_sync.js';
export const onRequest = createSetSync({ table: 'math_sheet_sets', valueMax: 200 * 1024 });
