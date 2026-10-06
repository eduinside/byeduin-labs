import { generateContent } from './_ai.js';
import { guard, json, readJson, str, errorResponse } from './_guard.js';

/**
 * POST /api/dictation-ai
 *
 * 학생의 받아쓰기 오답 패턴을 분석하고 AI 맞춤 학습 조언 + 추천 문항을 제공합니다.
 * 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['dictation-ai'] + AI 텍스트 한도.
 *
 * Request body:
 *   { weakRules: [{ rule, errorRate, count }], recentWrong: [{ text, tags }], grade: "1-1"|"2-2" }
 *
 * Response:
 *   { explanation, tips: string[], recommendedRules: string[] }
 */

// 입력 상한
const BODY_MAX = 32 * 1024;
const RULES_MAX = 20;      // 약점 규칙 수
const WRONG_MAX = 10;      // 최근 틀린 문항 수
const TAGS_MAX = 5;        // 문항당 규칙 태그 수
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || 0));

export async function onRequestPost({ request, env }) {
  const blocked = await guard(request, 'dictation-ai');
  if (blocked) return blocked;

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;

  const weakRules = (Array.isArray(body.weakRules) ? body.weakRules : [])
    .slice(0, RULES_MAX)
    .filter(r => r && typeof r === 'object')
    .map(r => ({ rule: str(r.rule, 30), errorRate: clampInt(r.errorRate, 0, 100), count: clampInt(r.count, 0, 100000) }))
    .filter(r => r.rule);
  const recentWrong = (Array.isArray(body.recentWrong) ? body.recentWrong : [])
    .slice(0, WRONG_MAX)
    .filter(w => w && typeof w === 'object')
    .map(w => ({
      text: str(w.text, 50),
      tags: (Array.isArray(w.tags) ? w.tags : []).slice(0, TAGS_MAX).map(t => str(t, 30)).filter(Boolean),
    }))
    .filter(w => w.text);
  const grade = str(body.grade, 10);

  if (!weakRules.length && !recentWrong.length) {
    return json({ error: '분석할 오답 데이터가 없습니다.' }, 400);
  }

  const systemPrompt = `당신은 초등학교 1~2학년 국어 받아쓰기 전문 지도교사입니다.
학생의 받아쓰기 오답 패턴을 분석하여 다음을 제공합니다:
1. 학생이 어려워하는 음운 규칙에 대한 쉽고 친절한 설명 (학부모나 교사가 이해할 수 있도록)
2. 가정에서 할 수 있는 구체적인 연습 팁 3가지
3. 집중 연습이 필요한 규칙 목록

음운 규칙 종류: 연음화, 경음화, 격음화, 비음화, 겹받침_단순화, 받침없음/규칙없음

반드시 아래 JSON 형식으로만 응답하세요. 마크다운이나 코드블록 없이 순수 JSON만 출력하세요:
{
  "explanation": "학생의 약점에 대한 종합적인 설명 (2~3문단, 한국어)",
  "tips": ["연습 팁 1", "연습 팁 2", "연습 팁 3"],
  "recommendedRules": ["집중 연습이 필요한 규칙1", "규칙2"]
}`;

  const weakSummary = weakRules
    .map(r => `- ${r.rule}: 오답률 ${r.errorRate}% (총 ${r.count}회 출제 중 틀림)`)
    .join('\n');

  const wrongSamples = recentWrong
    .map(w => `- "${w.text}" (규칙: ${w.tags.join(', ')})`)
    .join('\n');

  const userMessage = `## 학생 오답 분석 요청

### 학년: ${grade || '미지정'}

### 약점 규칙 (오답률 높은 순):
${weakSummary || '(데이터 없음)'}

### 최근 틀린 문항 예시:
${wrongSamples || '(데이터 없음)'}

위 정보를 바탕으로 학생의 약점을 분석하고 맞춤 학습 조언을 JSON으로 제공해 주세요.`;

  let raw;
  try {
    raw = await generateContent({
      systemPrompt,
      userMessage,
      env,
      temperature: 0.7,
      geminiModel: 'gemini-flash-latest',
      request
    });
  } catch (err) {
    console.error('[dictation-ai]', err && err.message);
    return errorResponse(err, 'AI 분석을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  // Parse AI response - strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // If JSON parsing fails, return a structured fallback
    parsed = {
      explanation: cleaned,
      tips: ['받아쓰기 연습 시 소리 내어 읽고 쓰기를 반복해 보세요.', '틀린 낱말은 3번씩 다시 써 보세요.', '교과서 본문을 천천히 읽으며 글자의 모양을 익혀 보세요.'],
      recommendedRules: weakRules.slice(0, 3).map(r => r.rule)
    };
  }

  return json(parsed);
}
