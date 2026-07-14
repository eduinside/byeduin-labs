#!/usr/bin/env node
// scripts/translate-bu-episodes.js
// Pre-fills descKo (and titleKo for case 3) in episodes.json using AI translation.
//
// Case 2: ep.ytKo exists but ep.descKo missing → fill descKo
// Case 3: no ep.ytKo, has ep.desc, no ep.descKo → fill titleKo (if empty) + descKo
//
// Reads API keys from .env in the project root.
// Run: node scripts/translate-bu-episodes.js

const fs = require('fs');
const path = require('path');

// ── env ────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^(\w+)=(.+)$/);
    if (m) envVars[m[1]] = m[2].trim();
  });
}
const TIMELY_KEY = envVars.TIMELY_API_KEY;
const GEMINI_KEY = envVars.GEMINI_API_KEY;

if (!TIMELY_KEY && !GEMINI_KEY) {
  console.error('❌ No API keys found in .env (TIMELY_API_KEY or GEMINI_API_KEY required)');
  process.exit(1);
}

// ── config ─────────────────────────────────────────────────
const EPISODES_PATH = path.join(__dirname, '../public/apps/blocks-universe/episodes.json');
const CONCURRENCY = 5;

const DESC_SYSTEM = [
  'BBC 어린이 교육 애니메이션(Numberblocks·Alphablocks·Colourblocks·Wonderblocks) 에피소드 설명을 영어에서 한국어로 번역해.',
  '대상은 유아~초등 저학년 어린이와 학부모야. 쉽고 자연스러운 문체를 사용해.',
  '번역문만 출력하고 다른 설명이나 접두사는 절대 포함하지 마.',
].join(' ');

const TITLE_SYSTEM = [
  'BBC 어린이 교육 애니메이션 에피소드 제목을 영어에서 한국어로 번역해.',
  '유아~초등 저학년 어린이 대상의 자연스럽고 간결한 한국어 제목으로.',
  '제목만 출력하고 다른 설명은 절대 포함하지 마.',
].join(' ');

// ── AI call ────────────────────────────────────────────────
async function callAI(systemPrompt, text, retries = 3) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    // 1. Timely GPT
    if (TIMELY_KEY) {
      try {
        const res = await fetch('https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TIMELY_KEY}` },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          const result = d?.choices?.[0]?.message?.content?.trim();
          if (result) return result;
        }
      } catch { /* fall through to Gemini */ }
    }

    // 2. Gemini direct
    if (GEMINI_KEY) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: { text: systemPrompt } },
              contents: [{ role: 'user', parts: [{ text }] }],
              generationConfig: { temperature: 0.3 },
            }),
          }
        );
        if (res.ok) {
          const d = await res.json();
          const result = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (result) return result;
        }
      } catch { /* retry */ }
    }

    if (attempt < retries - 1) await sleep(1200 * (attempt + 1));
  }
  throw new Error('All attempts failed');
}

// ── concurrent worker pool ─────────────────────────────────
async function runPool(items, fn, concurrency) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const item = items[idx++]; // synchronous capture before any await
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

// ── main ───────────────────────────────────────────────────
async function main() {
  const raw = fs.readFileSync(EPISODES_PATH, 'utf8');
  const data = JSON.parse(raw);
  const eps = data.episodes;

  const case2 = eps.filter(e => e.ytKo && !e.descKo && e.desc);
  const case3 = eps.filter(e => !e.ytKo && e.desc && !e.descKo);
  const total = case2.length + case3.length;

  console.log(`Case 2 (Korean video, desc needs translation): ${case2.length}`);
  console.log(`Case 3 (English-only, needs title+desc):       ${case3.length}`);
  console.log(`Total to translate: ${total}\n`);

  if (total === 0) { console.log('Nothing to do — all episodes already have descKo.'); return; }

  let done = 0, errors = 0;

  function save() {
    fs.writeFileSync(EPISODES_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
  function status(ep) {
    process.stdout.write(`\r[${String(done).padStart(3)}/${total}] ${ep.title.slice(0, 50).padEnd(50)} err:${errors}`);
  }

  // ── Case 2: desc only ───────────────────────────────────
  console.log('── Case 2: translating desc ──');
  await runPool(case2, async ep => {
    try {
      ep.descKo = await callAI(DESC_SYSTEM, ep.desc.slice(0, 2000));
      save();
      done++;
      status(ep);
    } catch (e) {
      errors++;
      console.error(`\n❌ [C2] ${ep.id} "${ep.title}": ${e.message}`);
    }
  }, CONCURRENCY);
  console.log(`\nCase 2 done (${done} ok, ${errors} err).\n`);

  // ── Case 3: title + desc ────────────────────────────────
  console.log('── Case 3: translating title + desc ──');
  await runPool(case3, async ep => {
    try {
      if (!ep.titleKo) ep.titleKo = await callAI(TITLE_SYSTEM, ep.title);
      ep.descKo = await callAI(DESC_SYSTEM, ep.desc.slice(0, 2000));
      save();
      done++;
      status(ep);
    } catch (e) {
      errors++;
      console.error(`\n❌ [C3] ${ep.id} "${ep.title}": ${e.message}`);
    }
  }, CONCURRENCY);
  console.log(`\n\nAll done — ${done}/${total} translated, ${errors} errors.`);

  if (errors > 0) {
    const rem2 = eps.filter(e => e.ytKo && !e.descKo && e.desc).length;
    const rem3 = eps.filter(e => !e.ytKo && e.desc && !e.descKo).length;
    console.log(`Remaining: case2=${rem2}, case3=${rem3}. Re-run to retry failed episodes.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
