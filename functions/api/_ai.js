export async function generateContent({
  systemPrompt,
  userMessage,
  env,
  temperature = 0.8
}) {
  const timelyKey = env.TIMELY_API_KEY;
  const geminiKey = env.GEMINI_API_KEY;

  // 1. Try Timely GPT first if key exists
  if (timelyKey) {
    try {
      console.log('🤖 [AI Service] Trying Timely GPT API...');
      const timelyModel = 'google/gemini-2.5-flash-lite';
      const res = await fetch('https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${timelyKey}`
        },
        body: JSON.stringify({
          model: timelyModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          console.log('✅ [AI Service] Timely GPT API success');
          return text.trim();
        }
      }
      console.warn('⚠️ [AI Service] Timely GPT API response was not OK, falling back to direct Gemini...');
    } catch (e) {
      console.error('❌ [AI Service] Timely GPT API error:', e.message, 'falling back to direct Gemini...');
    }
  }

  // 2. Direct Gemini Fallback
  if (!geminiKey) {
    throw new Error('서버 환경변수(GEMINI_API_KEY 및 TIMELY_API_KEY)가 설정되지 않았습니다.');
  }

  console.log('🤖 [AI Service] Calling direct Gemini API...');
  const geminiModel = 'gemini-flash-lite-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: { text: systemPrompt }
      },
      contents: [{
        role: 'user',
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        temperature,
      }
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Gemini API error:', res.status, data?.error?.message);
    throw new Error(`AI 호출 실패 (Gemini): ${data?.error?.message || res.statusText}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini 응답이 비어 있습니다.');
  }
  return text.trim();
}
