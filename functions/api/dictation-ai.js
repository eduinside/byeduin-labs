import { generateContent } from './_ai.js';

/**
 * POST /api/dictation-ai
 * 
 * 학생의 받아쓰기 오답 패턴을 분석하고 AI 맞춤 학습 조언 + 추천 문항을 제공합니다.
 * 
 * Request body:
 *   { weakRules: [{ rule, errorRate, count }], recentWrong: [{ text, tags }], grade: "1-1"|"2-2" }
 * 
 * Response:
 *   { explanation, tips: string[], recommendedRules: string[] }
 */
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { weakRules = [], recentWrong = [], grade = '' } = body;

    if (!weakRules.length && !recentWrong.length) {
      return new Response(JSON.stringify({ error: '분석할 오답 데이터가 없습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
      .slice(0, 10)
      .map(w => `- "${w.text}" (규칙: ${w.tags.join(', ')})`)
      .join('\n');

    const userMessage = `## 학생 오답 분석 요청

### 학년: ${grade || '미지정'}

### 약점 규칙 (오답률 높은 순):
${weakSummary || '(데이터 없음)'}

### 최근 틀린 문항 예시:
${wrongSamples || '(데이터 없음)'}

위 정보를 바탕으로 학생의 약점을 분석하고 맞춤 학습 조언을 JSON으로 제공해 주세요.`;

    const raw = await generateContent({
      systemPrompt,
      userMessage,
      env,
      temperature: 0.7,
      timelyModel: 'google/gemini-2.5-flash',
      geminiModel: 'gemini-flash-latest',
      request
    });

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

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || '서버 오류가 발생했습니다.' }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
