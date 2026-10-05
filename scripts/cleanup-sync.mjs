#!/usr/bin/env node
// scripts/cleanup-sync.mjs — 오래 쓰지 않은 동기화(VivesSync) 데이터 정리 (docs/audit-2026-10.md 4.2)
//
// Pages에는 cron이 없으므로 학기마다 손으로 실행한다. 기본은 "미리 보기(dry-run)":
// 지울 행 수와 실행할 SQL만 보여 주고 아무것도 지우지 않는다. 실제 삭제는 --yes를 붙일 때만.
//
//   node scripts/cleanup-sync.mjs                 # 미리 보기(원격 D1에서 개수만 셈 — 읽기 전용)
//   node scripts/cleanup-sync.mjs --yes           # 실제 삭제(원격)
//   node scripts/cleanup-sync.mjs --days=540      # 기준 변경(기본 365일)
//   node scripts/cleanup-sync.mjs --local         # 로컬 D1(wrangler dev)로 시험
//
// 기준:
//   • doc 모드(코드당 문서 1개): updated_at이 기준일보다 오래된 문서 삭제
//   • set 모드(코드당 여러 항목): 그 코드의 가장 최근 updated_at이 기준일보다 오래되면 코드의 항목 전체 삭제
//     (read-tree는 값=읽은 날짜라 항목별로 지우면 아직 쓰는 사람의 옛 기록이 사라지므로 코드 단위로 본다)
// 날짜 비교는 문자열 비교(ISO8601·YYYY-MM-DD 모두 사전순 = 시간순).
import { execFileSync } from 'node:child_process';

const DB_NAME = 'byeduin';
const args = process.argv.slice(2);
const YES = args.includes('--yes');
const LOCAL = args.includes('--local');
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 365;
if (!Number.isInteger(DAYS) || DAYS < 30) {
  console.error('--days는 30 이상의 정수여야 합니다.');
  process.exit(1);
}

// migrations/0001~0005의 동기화 테이블
const DOC_TABLES = ['flash_deck_docs', 'blocks_universe_docs', 'timer_docs', 'search_docs', 'chalkboard_docs', 'signage_docs'];
const SET_TABLES = ['read_tree_reads', 'math_sheet_sets', 'md_editor_docs'];

const cutoff = new Date(Date.now() - DAYS * 86400 * 1000).toISOString();

function d1(sql) {
  const cmd = ['wrangler', 'd1', 'execute', DB_NAME, LOCAL ? '--local' : '--remote', '--json', '--command', sql];
  const out = execFileSync('npx', cmd, { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'] });
  const start = out.indexOf('[');
  const parsed = JSON.parse(start >= 0 ? out.slice(start) : out);
  return parsed[0]?.results ?? [];
}
const q = (sql) => (process.platform === 'win32' ? `"${sql.replace(/"/g, '\\"')}"` : sql);

const plans = [
  ...DOC_TABLES.map(t => ({
    table: t,
    count: `SELECT COUNT(*) AS n FROM ${t} WHERE updated_at < '${cutoff}'`,
    del: `DELETE FROM ${t} WHERE updated_at < '${cutoff}'`,
  })),
  ...SET_TABLES.map(t => ({
    table: t,
    count: `SELECT COUNT(*) AS n FROM ${t} WHERE code IN (SELECT code FROM ${t} GROUP BY code HAVING MAX(updated_at) < '${cutoff}')`,
    del: `DELETE FROM ${t} WHERE code IN (SELECT code FROM ${t} GROUP BY code HAVING MAX(updated_at) < '${cutoff}')`,
  })),
];

console.log(`동기화 데이터 정리 — 기준: ${DAYS}일 이상 갱신 없음 (${cutoff} 이전), 대상 DB: ${DB_NAME} (${LOCAL ? '로컬' : '원격'})`);
console.log(YES ? '모드: 실제 삭제(--yes)\n' : '모드: 미리 보기(삭제하지 않음). 실제로 지우려면 --yes\n');

let total = 0;
for (const p of plans) {
  let n;
  try {
    n = Number(d1(q(p.count))[0]?.n ?? 0);
  } catch (e) {
    console.log(`- ${p.table}: 조회 실패(테이블이 없거나 wrangler 오류) — 건너뜀`);
    continue;
  }
  total += n;
  console.log(`- ${p.table}: ${n}행`);
  console.log(`    SQL: ${p.del}`);
  if (YES && n > 0) {
    d1(q(p.del));
    console.log('    → 삭제함');
  }
}
console.log(`\n합계 ${total}행${YES ? ' 삭제' : ' (미리 보기)'}`);
