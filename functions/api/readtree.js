// /api/readtree — Read Tree 읽기기록 동기화 (byeduin 전용 D1, env.BYEDUIN_DB)
//
//   VivesSync 표준 set 모드로 전환(공용 헬퍼 functions/api/_sync.js 사용).
//   GET    ?code=ABC123                                  -> { items: { bookId: { v, at } } }
//   PUT    { code, itemId, value, updatedAt }            -> 읽음 upsert (value=at=읽은날짜)
//   DELETE { code, itemId }                              -> 읽음 해제
//
//   코드 = 통합 익명 코드(개인정보 없음). 테이블: read_tree_reads(code,item_id,value,updated_at).
//   book_id 형식(예: L2-ST-01) 검증을 위해 itemRe 지정.
import { createSetSync } from './_sync.js';

export const onRequest = createSetSync({
  table: 'read_tree_reads',
  itemRe: /^[A-Za-z0-9-]{3,40}$/,
});
