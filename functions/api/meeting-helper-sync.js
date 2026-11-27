// /api/meeting-helper-sync — 협의 도우미 '내 협의·참여 목록' 동기화(VivesSync doc 모드).
// 문서에 협의 관리키·응답키가 들어 있어 6자리 코드가 곧 열쇠 꾸러미의 열쇠다(docs/meet-date-plan.md §13).
// 그래서 공용 동기화와 달리 읽기(GET)에도 횟수 제한을 건다(코드 맞히기 막기).
import { createDocSync } from './_sync.js';
import { rateLimit } from './_guard.js';

const doc = createDocSync({ table: 'meet_sync_docs', maxBytes: 64 * 1024 });

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') {
    const limited = await rateLimit(ctx.request, 'meet-sync-read');
    if (limited) return limited;
  }
  return doc(ctx);
}
