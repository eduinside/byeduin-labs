// BlocksUniverse_Episodes_Final.xlsx → public/apps/blocks-universe/episodes.json
// 사용법: node scripts/build-blocks-data.js [xlsx경로]
// xlsx 패키지 필요: npm install xlsx --no-save
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || 'C:/Users/NT940XGQ/Downloads/BlocksUniverse_Episodes_Final.xlsx';
const OUT = path.join(__dirname, '..', 'public', 'apps', 'blocks-universe', 'episodes.json');

const SERIES = {
  Numberblocks: { id: 'numberblocks', ko: '넘버블록스' },
  Alphablocks: { id: 'alphablocks', ko: '알파블록스' },
  Colourblocks: { id: 'colourblocks', ko: '컬러블록스' },
  Wonderblocks: { id: 'wonderblocks', ko: '원더블록스' },
};

const ytId = (url) => {
  if (!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : '';
};

const wb = XLSX.readFile(SRC);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Episodes'], { defval: '' });

const seen = new Set();
const episodes = [];
let skipped = 0;

for (const r of rows) {
  const series = SERIES[r['방송제목']];
  if (!series) { console.warn('unknown series:', r['방송제목']); skipped++; continue; }
  const v = ytId(r['유튜브링크']);
  const id = v || `${series.id}-s${r['시즌']}e${r['에피소드']}`;
  if (seen.has(id)) { console.warn('duplicate id:', id, r['영상제목']); skipped++; continue; }
  seen.add(id);
  episodes.push({
    id,
    series: series.id,
    season: Number(r['시즌']) || 0,
    ep: Number(r['에피소드']) || 0,
    title: String(r['영상제목']).trim(),
    titleKo: String(r['한글제목']).trim(),
    desc: String(r['영상설명']).trim(),
    descKo: String(r['한글설명']).trim(),
    level: Number(r['레벨']) || 0,
    theme: String(r['테마']).trim(),
    yt: v,
    ytKo: ytId(r['한글유튜브']),
    official: String(r['공식링크']).trim(),
  });
}

episodes.sort((a, b) =>
  a.series.localeCompare(b.series) || a.season - b.season || a.ep - b.ep);

const meta = {};
for (const ep of episodes) {
  const m = meta[ep.series] || (meta[ep.series] = { count: 0, seasons: 0 });
  m.count++;
  if (ep.season > m.seasons) m.seasons = ep.season;
}

const out = { generated: new Date().toISOString().slice(0, 10), meta, episodes };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('episodes:', episodes.length, '| skipped:', skipped);
console.log('meta:', JSON.stringify(meta));
console.log('→', OUT, (fs.statSync(OUT).size / 1024).toFixed(1) + 'KB');
