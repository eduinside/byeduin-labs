-- 협의 도우미(apps/meeting-helper) 동기화 문서. VIVES 동기화 코드(vives:code)당 1개.
-- 내용: { mine:[{id,key,title,kind,at}], joined:[{id,kind,title,rid,rkey,sid,skey,at}] } — 협의 관리키·응답키 꾸러미.
-- docs/meet-date-plan.md §13
--
-- 로컬:  npx wrangler d1 execute byeduin --local  --file=migrations/0018_meet_sync_docs.sql
-- 원격:  npx wrangler d1 execute byeduin --remote --file=migrations/0018_meet_sync_docs.sql

CREATE TABLE IF NOT EXISTS meet_sync_docs (
  code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
