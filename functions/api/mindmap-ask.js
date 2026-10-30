// POST /api/mindmap-ask  { path[], children[], mode, question?, level? } → { items[] }
// 마인드맵 가지에서 AI에게 묻기. 답은 가지로 바로 붙일 수 있게 짧은 항목 목록으로만 받는다.
//   mode: expand(작은 가지 추천) · explain(쉽게 설명) · example(예시) · ask(자유 질문, question 필수)
// 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['mindmap-ask'] + AI 텍스트 한도.
import { generateContent } from './_ai.js';
import { guard, json, readJson, errorResponse } from './_guard.js';

const BODY_MAX = 8 * 1024;
const TOPIC_MAX = 200;
const QUESTION_MAX = 300;
const LEVELS = {
  low: '초등학교 1~2학년. 아주 쉬운 낱말',
  high: '초등학교 5~6학년. 교과서에 나오는 쉬운 낱말',
  middle: '중학생. 교과서 용어를 그대로 쓴다',
  adult: '고등학생·성인. 정확한 개념어를 쓴다',
};
const TASKS = {
  expand: '마지막 가지 아래에 붙일 작은 가지 4~6개를 추천한다. 이미 있는 작은 가지와 겹치지 않게 한다. 한 줄은 15자 안팎의 낱말·구.',
  explain: '마지막 가지의 뜻을 쉽게 설명한다. 3~5줄, 한 줄은 40자 안팎의 짧은 문장.',
  example: '마지막 가지에 맞는 구체적인 예를 3~5개 든다. 한 줄은 25자 안팎.',
  ask: '사용자의 질문에 마지막 가지와 이어서 답한다. 3~5줄, 한 줄은 40자 안팎의 짧은 문장.',
};

function cleanList(v, max, len) {
  return Array.isArray(v)
    ? v.filter((s) => typeof s === 'string').map((s) => s.trim().slice(0, len)).filter(Boolean).slice(0, max)
    : [];
}

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const blocked = await guard(ctx.request, 'mindmap-ask');
  if (blocked) return blocked;

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;
  const path = cleanList(body.path, 6, TOPIC_MAX);
  const children = cleanList(body.children, 30, TOPIC_MAX);
  const mode = TASKS[body.mode] ? body.mode : '';
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, QUESTION_MAX) : '';
  const level = LEVELS[body.level] ? body.level : 'high';
  if (!path.length || !mode || (mode === 'ask' && !question)) {
    return json({ error: '물어볼 가지와 질문을 확인해 주세요.' }, 400);
  }

  const systemPrompt = [
    '너는 수업용 마인드맵을 돕는 보조원이다.',
    '사용자가 고른 가지(가운데 주제부터 이어진 경로의 마지막)에 대해 아래 할 일을 한다.',
    `할 일: ${TASKS[mode]}`,
    '출력 형식 규칙:',
    '1) `- ` 로 시작하는 목록 줄만 쓴다. 제목, 번호, 들여쓰기, 코드 블록, 굵게(**), 이모지는 쓰지 않는다.',
    '2) 각 줄은 그대로 마인드맵 가지가 되므로 따로 읽어도 뜻이 통하게 쓴다.',
    '3) 사실이 정확해야 한다. 확실하지 않은 숫자·연도·인물은 넣지 않는다.',
    '4) 실생활에서 쓰는 쉬운 우리말로 쓴다. 긴 줄표(—)는 쓰지 않는다.',
    `대상: ${LEVELS[level]}.`,
  ].join('\n');

  const userMessage = [
    `가지 경로: ${path.join(' > ')}`,
    children.length ? `이미 있는 작은 가지: ${children.join(', ')}` : '이미 있는 작은 가지: 없음',
    mode === 'ask' ? `질문: ${question}` : '',
  ].filter(Boolean).join('\n');

  try {
    const text = await generateContent({
      systemPrompt,
      userMessage,
      env: ctx.env,
      temperature: mode === 'expand' ? 0.7 : 0.4,
      request: ctx.request,
    });
    const items = String(text || '')
      .replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '')
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l && !/^#/.test(l))
      .map((l) => l.slice(0, 120))
      .slice(0, 8);
    if (!items.length) {
      return json({ error: 'AI가 답을 만들지 못했어요. 다시 물어봐 주세요.' }, 502);
    }
    return json({ items });
  } catch (e) {
    console.error('mindmap-ask error:', e?.message);
    return errorResponse(e, 'AI에게 묻는 중 오류가 났어요. 잠시 후 다시 해 주세요.');
  }
}
