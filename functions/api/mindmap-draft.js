// POST /api/mindmap-draft  { topic, level, depth } → { markdown }
// 마인드맵 AI 초안. 출력은 마인드맵 마크다운 개요(# 주제 / - 가지 / 들여쓰기 2칸) — 앱의 MindmapMD.fromMd로 읽는다.
// 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['mindmap-draft'] + AI 텍스트 한도.
import { generateContent } from './_ai.js';
import { guard, json, readJson, errorResponse } from './_guard.js';

const TOPIC_MAX = 200;
const BODY_MAX = 4 * 1024;
const LEVELS = {
  low: '초등학교 1~2학년. 아주 쉬운 낱말, 한 가지는 2~6글자',
  high: '초등학교 5~6학년. 교과서에 나오는 쉬운 낱말',
  middle: '중학생. 교과서 용어를 그대로 쓴다',
  adult: '고등학생·성인. 정확한 개념어를 쓴다',
};

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const blocked = await guard(ctx.request, 'mindmap-draft');
  if (blocked) return blocked;

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic || topic.length > TOPIC_MAX) {
    return json({ error: '주제를 200자 안으로 적어 주세요.' }, 400);
  }
  const level = LEVELS[body.level] ? body.level : 'high';
  const depth = body.depth === 3 ? 3 : 2;

  const systemPrompt = [
    '너는 수업용 마인드맵 초안을 만드는 보조원이다.',
    '사용자가 준 주제로 학습에 도움이 되는 마인드맵을 마크다운 개요로만 출력한다.',
    '출력 형식 규칙:',
    '1) 첫 줄은 `# 가운데 주제` 한 줄.',
    '2) 그 아래는 `- ` 목록만 쓴다. 한 단계 들어갈 때마다 공백 2칸을 앞에 붙인다.',
    `3) 큰 가지(들여쓰기 없음)는 4~6개, 각 큰 가지 아래 작은 가지는 2~4개. 가지는 모두 ${depth}단계까지만.`,
    '4) 한 가지는 15자 안팎의 짧은 낱말·구로 쓴다. 문장으로 길게 풀지 않는다.',
    '5) 설명 문단, 코드 블록(```), 번호, 굵게(**), 이모지는 쓰지 않는다.',
    '6) 사실이 정확해야 한다. 확실하지 않은 숫자·연도·인물은 넣지 않는다.',
    '7) 실생활에서 쓰는 쉬운 우리말로 쓴다. 긴 줄표(—)는 쓰지 않는다.',
    `대상: ${LEVELS[level]}.`,
    '예시:',
    '# 광합성',
    '- 재료',
    '  - 이산화탄소',
    '  - 물',
    '- 필요한 조건',
    '  - 빛',
    '  - 엽록체',
    '- 만들어지는 것',
    '  - 포도당(양분)',
    '  - 산소',
  ].join('\n');

  const userMessage = `주제: ${topic}\n이 주제로 마인드맵 개요를 만들어 줘.`;

  try {
    let text = await generateContent({
      systemPrompt,
      userMessage,
      env: ctx.env,
      temperature: 0.7,
      request: ctx.request,
    });
    // 코드 블록 표시·앞뒤 공백 제거, 너무 길면 자름
    text = String(text || '').replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim().slice(0, 8000);
    const lines = text.split('\n').filter((l) => /^\s*(#|[-*+]\s)/.test(l));
    if (lines.length < 3) {
      return json({ error: 'AI가 초안을 만들지 못했어요. 주제를 조금 바꿔 다시 해 주세요.' }, 502);
    }
    return json({ markdown: lines.join('\n') });
  } catch (e) {
    console.error('mindmap-draft error:', e?.message);
    return errorResponse(e, '초안을 만드는 중 오류가 났어요. 잠시 후 다시 해 주세요.');
  }
}
