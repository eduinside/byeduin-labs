#!/usr/bin/env node
/**
 * 에듀서치 매뉴얼 적재 — 원본(HWP·HWPX·PDF) → kordoc 파싱 → 정제·재청크 → D1 SQL + R2 업로드 목록.
 *
 * 사용:
 *   node scripts/manual-ingest.mjs                 # manual-sources.json 전체
 *   node scripts/manual-ingest.mjs field-trip-2026 # 특정 문서만
 * 결과: .manual-build/manual.sql, .manual-build/<id>.json(검수용), .manual-build/files/<id>.<ext>(R2 업로드용)
 * 반영:
 *   npx wrangler d1 execute byeduin --remote --file=.manual-build/manual.sql
 *   (선택) npx wrangler r2 object put byeduin-media/manual/<id>.<ext> --file=.manual-build/files/<id>.<ext> --remote
 *   원본을 올리지 않으면 질의응답·본문 보기는 그대로 되고, 문서 화면의 "원문 보기" 버튼만 숨겨진다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, blocksToChunks } from 'kordoc';
import { toGrams } from '../functions/api/_manual-text.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.manual-build');
const MAX_CHARS = 1400;   // 본문 조각 목표 크기
const MIN_CHARS = 400;    // 이보다 짧으면 제목이 바뀌어도 다음 절과 이어 붙임
const TABLE_PIECE = 2000; // 큰 표를 나누는 크기(머리행 반복)

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/manual-sources.json'), 'utf8'));
const only = process.argv.slice(2);
const docs = manifest.docs.filter(d => !only.length || only.includes(d.id));
fs.mkdirSync(path.join(OUT, 'files'), { recursive: true });

// ── 정제 ──────────────────────────────────────────────
// PDF(InDesign) 바닥글이 깨진 글자로 나오는 줄("2026 SC)00- '\*E-D 53\*1 .ANUA-")과 쪽 번호만 있는 줄을 지운다.
function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^[-–—\s]*\d{1,3}[-–—\s]*$/.test(t)) return true;
  if (!/[가-힣]/.test(t) && t.length < 60 && (t.match(/[\\*')(]/g) || []).length >= 2 && /[A-Z]{2}/.test(t)) return true;
  return false;
}
function cleanText(text) {
  return text.replace(/<img[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .split('\n').filter(l => !isNoiseLine(l)).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// HTML 표 → GFM 표 행 배열(중첩 표는 평탄화). rowspan/colspan은 버리고 셀 글자만 남긴다.
function tableRows(html) {
  const rows = [];
  for (const tr of html.replace(/<img[^>]*>/g, '').split(/<\/tr>/i)) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)(?=<t[dh][^>]*>|$)/gi)]
      .map(m => m[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\|/g, '/').replace(/\s+/g, ' ').trim());
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}
function rowsToGfm(head, rows) {
  const cols = Math.max(head.length, ...rows.map(r => r.length));
  const line = r => '| ' + Array.from({ length: cols }, (_, i) => r[i] || '').join(' | ') + ' |';
  return [line(head), '|' + ' --- |'.repeat(cols), ...rows.map(line)].join('\n');
}
// 표 하나 → GFM 조각 목록(길면 머리행을 반복하며 나눔)
function tablePieces(html) {
  const rows = tableRows(html);
  if (!rows.length) return [];
  const [head, ...body] = rows;
  if (!body.length) return [rowsToGfm(head, [])];
  const pieces = [];
  let cur = [];
  for (const r of body) {
    cur.push(r);
    if (rowsToGfm(head, cur).length > TABLE_PIECE && cur.length > 1) {
      const last = cur.pop();
      pieces.push(rowsToGfm(head, cur));
      cur = [last];
    }
  }
  if (cur.length) pieces.push(rowsToGfm(head, cur));
  return pieces;
}

// ── 재청크 ────────────────────────────────────────────
// kordoc section 청크는 PDF 줄바꿈 때문에 한두 줄 단위로 잘게 나온다. 제목(heading) 경로가 바뀌거나
// MAX_CHARS를 넘을 때까지 이어 붙여 검색·답변에 알맞은 조각으로 만든다.
function rechunk(chunks) {
  const out = [];
  const stack = []; // [{level, title}]
  let cur = null;
  const pathStr = () => stack.map(s => s.title).join(' > ');
  const flush = () => { if (cur && cur.text.trim()) out.push(cur); cur = null; };
  const add = (text, page, standalone = false) => {
    if (!text) return;
    if (standalone || (cur && cur.text.length + text.length > MAX_CHARS)) flush();
    if (!cur) cur = { path: pathStr(), page_from: page, page_to: page, text: '' };
    cur.text += (cur.text ? '\n\n' : '') + text;
    if (page) { cur.page_from ??= page; cur.page_to = Math.max(cur.page_to || page, page); }
    if (standalone) flush();
  };

  for (const c of chunks) {
    const page = c.page ?? null;
    if (c.type === 'heading') {
      const m = c.text.match(/^(#+)\s*(.*)$/s);
      const level = m ? m[1].length : 1;
      const title = cleanText(m ? m[2] : c.text).replace(/\s+/g, ' ');
      if (!title) continue;
      // PDF는 법령 목록 줄까지 제목으로 잡혀 조각이 너무 잘아진다 — 모인 본문이 짧으면 끊지 않고 제목을 본문에 이어 쓴다
      if (cur && cur.text.length >= MIN_CHARS) flush();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title: title.slice(0, 80) });
      add(`**${title}**`, page);
      continue;
    }
    if (c.type === 'table') {
      const pieces = tablePieces(c.text);
      const small = pieces.length === 1 && pieces[0].length <= 600;
      for (const p of pieces) add(p, page, !small);
      continue;
    }
    add(cleanText(c.text), page);
  }
  flush();
  return out;
}

// ── SQL ──────────────────────────────────────────────
const q = v => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

const sql = [];
for (const d of docs) {
  const src = path.join(manifest.srcDir, d.file);
  const ext = path.extname(d.file).slice(1).toLowerCase();
  console.log(`📄 ${d.id}: ${d.file}`);
  const r = await parse(fs.readFileSync(src));
  if (!r.success) { console.error(`❌ 파싱 실패: ${r.error}`); process.exitCode = 1; continue; }
  const passages = rechunk(blocksToChunks(r.blocks));
  const lens = passages.map(p => p.text.length);
  console.log(`   ${r.metadata?.pageCount ?? '?'}쪽 → ${passages.length}조각 (평균 ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}자, 최대 ${Math.max(...lens)}자)`);

  fs.writeFileSync(path.join(OUT, `${d.id}.json`), JSON.stringify(passages, null, 1));
  fs.copyFileSync(src, path.join(OUT, 'files', `${d.id}.${ext}`));

  sql.push(`DELETE FROM manual_fts WHERE rowid IN (SELECT id FROM manual_chunks WHERE doc_id = ${q(d.id)});`);
  sql.push(`DELETE FROM manual_chunks WHERE doc_id = ${q(d.id)};`);
  sql.push(`INSERT OR REPLACE INTO manual_docs (id, title, category, dept, year, file_key, file_type, pages, chunk_count, updated_at) VALUES (${
    [d.id, d.title, d.category, d.dept, d.year, `manual/${d.id}.${ext}`, ext, r.metadata?.pageCount ?? null, passages.length, new Date().toISOString()].map(q).join(', ')});`);
  passages.forEach((p, seq) => {
    sql.push(`INSERT INTO manual_chunks (doc_id, seq, path, page_from, page_to, text) VALUES (${[d.id, seq, p.path, p.page_from, p.page_to, p.text].map(q).join(', ')});`);
    // 문서 제목·장절 경로도 함께 색인해 "현장체험 인솔" 같은 질문이 해당 절에 걸리게 한다
    const grams = toGrams(`${d.title} ${p.path} ${p.text}`).join(' ');
    sql.push(`INSERT INTO manual_fts (rowid, grams) VALUES ((SELECT id FROM manual_chunks WHERE doc_id = ${q(d.id)} AND seq = ${seq}), ${q(grams)});`);
  });
}
fs.writeFileSync(path.join(OUT, 'manual.sql'), sql.join('\n') + '\n');
console.log(`✅ ${path.relative(ROOT, path.join(OUT, 'manual.sql'))} (${sql.length}문)`);
