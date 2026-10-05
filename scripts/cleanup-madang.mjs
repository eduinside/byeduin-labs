#!/usr/bin/env node
// scripts/cleanup-madang.mjs — 만료된 마당 보드와 그 이미지 정리 (docs/audit-2026-10.md 4.2, 9 "숨김 앱")
//
// 마당은 현재 비공개(API 410)다. 데이터를 비울지는 운영자가 결정한다. 이 스크립트는 그때 쓴다.
// 기본은 "미리 보기(dry-run)": 대상 보드·카드·이미지 수와 실행할 SQL만 보여 주고 아무것도 지우지 않는다.
//
//   node scripts/cleanup-madang.mjs                # 미리 보기: 만료 후 30일 지난 보드(원격 D1 읽기 전용)
//   node scripts/cleanup-madang.mjs --days=0       # 만료된 보드 전부
//   node scripts/cleanup-madang.mjs --all          # 만료 여부와 관계없이 모든 보드(마당을 완전히 비울 때)
//   node scripts/cleanup-madang.mjs --yes          # 실제 삭제(R2 이미지 → D1 행 순서)
//   node scripts/cleanup-madang.mjs --local        # 로컬 D1·R2로 시험
//
// 대상 판정: settings.expiresAt(ISO)이 (지금 - N일)보다 이전인 보드. 무기한 보드(expiresAt 없음)는 --all일 때만.
// 지우는 것: R2 madang/{보드}/{파일}(이미지 카드에 기록된 것), D1 madang_likes·comments·members·cards·boards.
// 한계: 업로드만 하고 게시하지 않은 이미지(고아 객체)는 D1에 기록이 없어 여기서 찾을 수 없다.
//   마당을 완전히 비울 때는 Cloudflare 대시보드 → R2 → byeduin-media에서 madang/ 접두사를 지우거나
//   객체 수명 주기 규칙(접두사 madang/, N일 후 삭제)을 설정한다(무료).
import { execFileSync } from 'node:child_process';

const DB_NAME = 'byeduin';
const BUCKET = 'byeduin-media';
const BOARD_RE = /^[A-HJ-NP-Z2-9]{6}$/;          // _madang-common.js와 같은 형식(SQL에 넣기 전 검증)
const FILE_RE = /^[A-Za-z0-9._-]{1,100}$/;

const args = process.argv.slice(2);
const YES = args.includes('--yes');
const ALL = args.includes('--all');
const LOCAL = args.includes('--local');
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 30;
if (!Number.isInteger(DAYS) || DAYS < 0) {
  console.error('--days는 0 이상의 정수여야 합니다.');
  process.exit(1);
}
const cutoff = new Date(Date.now() - DAYS * 86400 * 1000).toISOString();
const WIN = process.platform === 'win32';
const q = (s) => (WIN ? `"${s.replace(/"/g, '\\"')}"` : s);

function npx(cmd) {
  return execFileSync('npx', cmd, { encoding: 'utf8', shell: WIN, stdio: ['ignore', 'pipe', 'inherit'] });
}
function d1(sql) {
  sql = sql.replace(/\s+/g, ' ').trim(); // 한 줄로(Windows 셸은 인자 안 줄바꿈을 처리하지 못함)
  const out = npx(['wrangler', 'd1', 'execute', DB_NAME, LOCAL ? '--local' : '--remote', '--json', '--command', q(sql)]);
  const start = out.indexOf('[');
  return JSON.parse(start >= 0 ? out.slice(start) : out)[0]?.results ?? [];
}
function r2Delete(key) {
  npx(['wrangler', 'r2', 'object', 'delete', q(`${BUCKET}/${key}`), LOCAL ? '--local' : '--remote']);
}

const where = ALL
  ? '1 = 1'
  : `json_extract(settings, '$.expiresAt') IS NOT NULL AND json_extract(settings, '$.expiresAt') < '${cutoff}'`;

console.log(`마당 정리 — 대상: ${ALL ? '모든 보드(--all)' : `만료 후 ${DAYS}일 지난 보드 (expiresAt < ${cutoff})`}, DB: ${DB_NAME} (${LOCAL ? '로컬' : '원격'})`);
console.log(YES ? '모드: 실제 삭제(--yes)\n' : '모드: 미리 보기(삭제하지 않음). 실제로 지우려면 --yes\n');

const boards = d1(`SELECT id, title, created_at, json_extract(settings, '$.expiresAt') AS expires_at FROM madang_boards WHERE ${where} ORDER BY created_at`)
  .filter(b => BOARD_RE.test(b.id));
if (!boards.length) {
  console.log('대상 보드가 없습니다.');
  process.exit(0);
}
// 명령줄 길이(Windows 8191자) 때문에 보드 200개씩 나눠 처리한다
const CHUNK = 200;
const idLists = [];
for (let i = 0; i < boards.length; i += CHUNK) idLists.push(boards.slice(i, i + CHUNK).map(b => `'${b.id}'`).join(','));

const counts = { cards: 0, comments: 0, likes: 0, members: 0 };
const images = [];
for (const idList of idLists) {
  const c = d1(`SELECT
    (SELECT COUNT(*) FROM madang_cards WHERE board_id IN (${idList})) AS cards,
    (SELECT COUNT(*) FROM madang_comments WHERE board_id IN (${idList})) AS comments,
    (SELECT COUNT(*) FROM madang_likes WHERE board_id IN (${idList})) AS likes,
    (SELECT COUNT(*) FROM madang_members WHERE board_id IN (${idList})) AS members`)[0] || {};
  for (const k of Object.keys(counts)) counts[k] += Number(c[k] || 0);
  images.push(...d1(`SELECT board_id, content FROM madang_cards WHERE board_id IN (${idList}) AND type = 'image'`)
    .filter(r => BOARD_RE.test(r.board_id) && FILE_RE.test(String(r.content || '')))
    .map(r => `madang/${r.board_id}/${r.content}`));
}

console.log(`보드 ${boards.length}개`);
for (const b of boards.slice(0, 20)) console.log(`  - ${b.id}  만료 ${b.expires_at || '무기한'}  생성 ${b.created_at}`);
if (boards.length > 20) console.log(`  … 외 ${boards.length - 20}개`);
console.log(`카드 ${counts.cards ?? '?'} · 댓글 ${counts.comments ?? '?'} · 반응 ${counts.likes ?? '?'} · 참여자 ${counts.members ?? '?'} · R2 이미지 ${images.length}개`);

const deletes = (idList) => [
  `DELETE FROM madang_likes WHERE board_id IN (${idList})`,
  `DELETE FROM madang_comments WHERE board_id IN (${idList})`,
  `DELETE FROM madang_members WHERE board_id IN (${idList})`,
  `DELETE FROM madang_cards WHERE board_id IN (${idList})`,
  `DELETE FROM madang_boards WHERE id IN (${idList})`,
];
console.log(`\n실행할 SQL(보드 ${CHUNK}개 묶음마다 반복, 첫 묶음 예시):`);
for (const s of deletes(idLists[0])) console.log(`  ${s.length > 200 ? s.slice(0, 200) + '…)' : s}`);
console.log(`R2: ${BUCKET}에서 위 이미지 ${images.length}개를 하나씩 삭제`);

if (!YES) {
  console.log('\n미리 보기만 했습니다. 실제로 지우려면 --yes를 붙여 다시 실행하세요.');
  process.exit(0);
}

// 이미지 먼저(실패해도 D1 기록이 남아 다음 실행에서 다시 시도할 수 있게)
let ok = 0, fail = 0;
for (const key of images) {
  try { r2Delete(key); ok++; } catch { fail++; console.log(`  R2 삭제 실패: ${key}`); }
}
console.log(`R2 이미지 삭제: 성공 ${ok}, 실패 ${fail}`);
if (fail) {
  console.log('이미지 삭제 실패가 있어 D1 삭제를 건너뜁니다. 원인을 확인한 뒤 다시 실행하세요.');
  process.exit(1);
}
for (const idList of idLists) for (const s of deletes(idList)) d1(s);
console.log(`D1 삭제 완료: 보드 ${boards.length}개와 관련 행`);
