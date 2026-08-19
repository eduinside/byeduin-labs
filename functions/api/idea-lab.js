// functions/api/idea-lab.js
// ─────────────────────────────────────────────────────────────────────────────
// 발명 아이디어 공작소 — 무상태(stateless) AI 프록시. DB·세션 없음, 서버는 아무것도 기억하지 않는다.
// 클라이언트가 물건×발명 마법 카드를 고르면, 이 프록시가 질문 생성·정리문·이름 후보·그림을 만들어 준다.
//
//   POST /api/idea-lab   body: { action, ... }
//     action: 'coach'  { item, item2?, magic, step, answers[] } → { question, choices[3] }
//             'refine' { item, item2?, magic, answers[] }        → { summary }
//             'name'   { summary, customName? }                  → { names[3], customNameOk? }
//             'image'  { summary }                                → { b64 }
//
//   검열: 로컬 금칙어 프리필터(즉시 차단) + OpenAI Moderation(타임아웃 시 통과 — 가용성 우선,
//   madang과 동일 정책). 아이가 직접 쓴 텍스트(물건 이름·답변·발명 이름)에 매 호출마다 적용
//   — 클라이언트가 검열을 건너뛰어도 서버가 매번 다시 검사하므로 우회 불가.
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_MAX = 20;
const ANSWER_MAX = 100;
const NAME_MAX = 20;
const SUMMARY_MAX = 400;
const MAGIC_LABEL = {
  combine: '합치기(결합)',
  split: '나누기·빼기(분해)',
  resize: '크기 바꾸기',
  material: '재료 바꾸기',
};
const MOD_TIMEOUT_MS = 2500;

// 로컬 금칙어 프리필터 — madang과 동일한 1차 방어선(API 왕복 없이 즉시 차단).
const LOCAL_BAD_PATTERNS = [
  /씨\s*발|시\s*발|씨\s*팔|ㅅ\s*ㅂ|ㅆ\s*ㅂ/i,
  /개\s*새\s*끼|개\s*색\s*끼|개\s*새\s*기/i,
  /병\s*신|븅\s*신|ㅂ\s*ㅅ/i,
  /좆|존\s*나|조\s*낸/i,
  /지\s*랄|ㅈ\s*ㄹ/i,
  /미친\s*놈|미친\s*년/i,
  /창\s*녀|걸레\s*년/i,
  /죽어라|뒤져라/i,
  /fuck|shit|bitch|asshole/i,
];
function localFilterHit(text) { return LOCAL_BAD_PATTERNS.some((re) => re.test(text)); }

// 검열: 텍스트 하나(또는 여러 개를 합친 것)를 검사. 키 없음/오류/타임아웃이면 통과(가용성 우선).
async function moderate(env, text) {
  if (!text || !text.trim()) return { flagged: false };
  if (localFilterHit(text)) return { flagged: true, local: true };
  const key = env.OPENAI_API_KEY;
  if (!key) return { flagged: false, noKey: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MOD_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text.slice(0, 4000) }),
      signal: controller.signal,
    });
    if (!r.ok) return { flagged: false, ok: false };
    const d = await r.json();
    const res = d && d.results && d.results[0];
    return { flagged: !!(res && res.flagged) };
  } catch (e) {
    return { flagged: false, timedOut: e && e.name === 'AbortError' };
  } finally {
    clearTimeout(timer);
  }
}
async function moderateAll(env, texts) {
  const joined = texts.filter((t) => typeof t === 'string' && t.trim()).join('\n');
  return moderate(env, joined);
}

const cors = { 'Access-Control-Allow-Origin': '*' };
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function cleanStr(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

const SAFETY_RULE =
  '너는 초등학교 저학년(2학년) 아이의 발명 발상을 도와주는 다정한 코치야. ' +
  '아주 짧고 쉬운 문장, 존댓말을 쓰고, 아이의 생각을 절대 부정 평가하지 마("멋진 생각이에요" 같은 응원 톤 유지). ' +
  '만약 아이가 쓴 물건이나 답이 무기·칼·폭발물·불 등 위험한 것과 관련 있다면, 그 위험한 부분은 다루지 말고 ' +
  '안전하고 즐거운 방향으로 부드럽게 돌려서 이야기해줘. 응답은 반드시 지정된 JSON 형식으로만, 다른 텍스트 없이.';

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
  return JSON.parse(match ? match[0] : text);
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON 파싱 실패' }, 400); }

  const action = body.action;
  const { generateContent, generateImage } = await import('./_ai.js');

  // ── 공통 입력 정리 ──
  const item = cleanStr(body.item, ITEM_MAX);
  const item2 = cleanStr(body.item2, ITEM_MAX);
  // magic: 'combine' 단일 또는 'combine,resize' 처럼 콤마로 최대 2개 — 각 라벨을 '+'로 이어붙인다.
  const magicKeys = String(body.magic || '').split(',').map((s) => s.trim()).filter((k) => MAGIC_LABEL[k]).slice(0, 2);
  const magicLabel = magicKeys.map((k) => MAGIC_LABEL[k]).join(' + ');
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 3).map((a) => cleanStr(a, ANSWER_MAX)) : [];

  try {
    if (action === 'coach') {
      if (!item) return json({ error: '물건 이름이 필요합니다' }, 400);
      if (!magicLabel) return json({ error: '발명 마법을 선택해주세요' }, 400);
      const step = Math.min(Math.max(parseInt(body.step, 10) || 1, 1), 3);

      const mod = await moderateAll(env, [item, item2, ...answers]);
      if (mod.flagged) return json({ error: '표현을 다시 써볼까요?', flagged: true }, 400);

      const things = item2 ? `${item}와(과) ${item2}` : item;
      const prevQA = answers.length
        ? `지금까지 아이의 대답: ${answers.map((a, i) => `${i + 1}) ${a}`).join(' / ')}`
        : '(아직 대답 없음, 첫 질문)';
      const systemPrompt = [
        SAFETY_RULE,
        '아이가 고른 물건과 발명 마법을 보고, 아이가 스스로 아이디어를 구체화하도록 짧은 질문 1개를 던져주세요.',
        '질문은 한 문장, 20자 안팎으로 짧아야 합니다.',
        '아이가 선택할 수 있는 3개의 선택지(choices)를 생성할 때 다음 규칙을 철저히 지키십시오:',
        '1. 선택지는 질문에 대한 언어적/논리적으로 직접적이고 정확하게 어울리는 대답이어야 합니다.',
        '   (예: 질문이 "재료를 무엇으로 바꿀까요?"이면 선택지는 "가벼운 플라스틱", "따뜻한 나무", "말랑한 실리콘"처럼 실제 재료 종류여야 합니다. "귀여운 모양" 같은 형태나 디자인을 재료로 제시해서는 결코 안 됩니다.)',
        '2. 아동의 수준에서 실현 가능하고 매력적이며 해당 물건에 어울리는 아이디어들을 구체적으로 제시해야 합니다.',
        '3. 각 선택지는 12자 이내로 짧게 작성해야 합니다.',
        `JSON 형식으로만 답해: {"question":"...", "choices":["...","...","..."]}`,
      ].join('\n');
      const userMessage =
        `물건: ${things}\n발명 마법: ${magicLabel}\n질문 번호: ${step}/3\n${prevQA}`;

      let text;
      try {
        text = await generateContent({ systemPrompt, userMessage, env, temperature: 0.8, request });
      } catch (e) {
        return json({ error: e.message }, e.status || 502);
      }
      let out;
      try {
        out = extractJson(text);
        if (typeof out.question !== 'string' || !Array.isArray(out.choices)) throw new Error('shape');
      } catch {
        return json({ error: `LLM 응답 파싱 실패: ${text.slice(0, 120)}` }, 502);
      }
      const question = cleanStr(out.question, 40);
      const choices = out.choices.filter((c) => typeof c === 'string').map((c) => cleanStr(c, 20)).slice(0, 3);
      if (!question || choices.length < 2) return json({ error: 'LLM 응답 형식이 올바르지 않습니다' }, 502);
      return json({ question, choices });
    }

    if (action === 'refine') {
      if (!item) return json({ error: '물건 이름이 필요합니다' }, 400);
      if (!magicLabel) return json({ error: '발명 마법을 선택해주세요' }, 400);
      if (!answers.length) return json({ error: '답변이 필요합니다' }, 400);

      const mod = await moderateAll(env, [item, item2, ...answers]);
      if (mod.flagged) return json({ error: '표현을 다시 써볼까요?', flagged: true }, 400);

      const things = item2 ? `${item}와(과) ${item2}` : item;
      const systemPrompt = [
        SAFETY_RULE,
        '아이가 만든 발명 아이디어를 2~3문장의 짧고 신나는 소개 글로 정리해줘.',
        '아이의 대답 내용을 자연스럽게 녹여내고, 문장마다 25자 안팎으로 짧게 써.',
        `JSON 형식으로만 답해: {"summary":"..."}`,
      ].join('\n');
      const userMessage =
        `물건: ${things}\n발명 마법: ${magicLabel}\n아이의 대답: ${answers.map((a, i) => `${i + 1}) ${a}`).join(' / ')}`;

      let text;
      try {
        text = await generateContent({ systemPrompt, userMessage, env, temperature: 0.8, request });
      } catch (e) {
        return json({ error: e.message }, e.status || 502);
      }
      let out;
      try {
        out = extractJson(text);
        if (typeof out.summary !== 'string') throw new Error('shape');
      } catch {
        return json({ error: `LLM 응답 파싱 실패: ${text.slice(0, 120)}` }, 502);
      }
      const summary = cleanStr(out.summary, SUMMARY_MAX);
      if (!summary) return json({ error: 'LLM 응답 형식이 올바르지 않습니다' }, 502);
      return json({ summary });
    }

    if (action === 'name') {
      const summary = cleanStr(body.summary, SUMMARY_MAX);
      if (!summary) return json({ error: '정리문이 필요합니다' }, 400);

      const modSummary = await moderate(env, summary);
      if (modSummary.flagged) return json({ error: '표현을 다시 써볼까요?', flagged: true }, 400);

      let customNameOk;
      const customName = body.customName != null ? cleanStr(body.customName, NAME_MAX) : null;
      if (customName) {
        const modCustom = await moderate(env, customName);
        customNameOk = !modCustom.flagged;
      }

      const systemPrompt = [
        SAFETY_RULE,
        '아이의 발명품 소개 글을 읽고, 귀엽고 재미있는 발명품 이름 후보 3개를 만들어줘.',
        `각 이름은 ${NAME_MAX}자 이내, 서로 다른 느낌으로.`,
        `JSON 형식으로만 답해: {"names":["...","...","..."]}`,
      ].join('\n');
      const userMessage = `발명품 소개: ${summary}`;

      let text;
      try {
        text = await generateContent({ systemPrompt, userMessage, env, temperature: 0.9, request });
      } catch (e) {
        return json({ error: e.message, customNameOk }, e.status || 502);
      }
      let out;
      try {
        out = extractJson(text);
        if (!Array.isArray(out.names)) throw new Error('shape');
      } catch {
        return json({ error: `LLM 응답 파싱 실패: ${text.slice(0, 120)}`, customNameOk }, 502);
      }
      const names = out.names.filter((n) => typeof n === 'string').map((n) => cleanStr(n, NAME_MAX)).slice(0, 3);
      if (!names.length) return json({ error: 'LLM 응답 형식이 올바르지 않습니다', customNameOk }, 502);
      return json({ names, customNameOk });
    }

    if (action === 'image') {
      const summary = cleanStr(body.summary, SUMMARY_MAX);
      if (!summary) return json({ error: '정리문이 필요합니다' }, 400);

      const mod = await moderate(env, summary);
      if (mod.flagged) return json({ error: '표현을 다시 써볼까요?', flagged: true }, 400);

      // 스타일 지정 부분은 전부 서버 고정 — 아이 입력은 마지막 지정 슬롯에만 삽입(프롬프트 주입 축소).
      // 플랫 일러스트(단색 면 채색)가 크레파스 질감보다 PNG 압축이 훨씬 잘 돼 결과물 용량이 약 45% 작음(실측).
      const prompt =
        '어린이 그림책 스타일의 플랫 일러스트. 굵고 깔끔한 검은 윤곽선, 그라데이션·질감 없이 단순한 단색 면 채색, ' +
        '단순하고 귀여운 형태, 밝고 따뜻한 색, 깨끗한 흰 배경, 텍스트 없음. ' +
        '무섭거나 위험한 요소는 절대 넣지 않는다. 안전하고 사랑스러운 발명품 그림 한 장.\n' +
        `그릴 발명품: ${summary}`;

      let b64;
      try {
        b64 = await generateImage({ prompt, env, request });
      } catch (e) {
        return json({ error: e.message || '이미지 생성에 실패했습니다.' }, e.status || 502);
      }
      return json({ b64 });
    }

    return json({ error: `알 수 없는 action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e && e.message ? e.message : '서버 오류' }, 500);
  }
}
