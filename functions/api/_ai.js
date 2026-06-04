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

export async function generateImage({ prompt, env }) {
  const timelyKey = env.TIMELY_API_KEY;
  const geminiKey = env.GEMINI_API_KEY;
  let b64Data = null;

  // 1. Try Timely GPT first if key exists
  if (timelyKey) {
    try {
      console.log('🤖 [AI Service] Trying Timely GPT Image API...');
      const res = await fetch('https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${timelyKey}`
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          messages: [
            { role: 'user', content: prompt }
          ],
          modalities: ['image']
        })
      });

      if (res.ok) {
        const data = await res.json();
        const message = data?.choices?.[0]?.message;
        
        // Extract base64 from images array
        if (message?.images && message.images[0]?.image_url?.url) {
          const url = message.images[0].image_url.url;
          const match = url.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/);
          b64Data = match ? match[1] : url;
        }

        // Fallback to extraction from content markdown if not found
        if (!b64Data && message?.content) {
          const match = message.content.match(/!\[\]\(data:image\/[a-zA-Z]+;base64,([^)]+)\)/);
          if (match && match[1]) {
            b64Data = match[1];
          } else {
            const matchRaw = message.content.match(/data:image\/[a-zA-Z]+;base64,([a-zA-Z0-9+/=]+)/);
            if (matchRaw && matchRaw[1]) {
              b64Data = matchRaw[1];
            }
          }
        }

        if (b64Data) {
          console.log('✅ [AI Service] Timely GPT Image success');
          return b64Data.trim();
        }
      }
      console.warn('⚠️ [AI Service] Timely GPT Image response was not OK, falling back to direct Gemini...');
    } catch (e) {
      console.error('❌ [AI Service] Timely GPT Image error:', e.message, 'falling back to direct Gemini...');
    }
  }

  // 2. Direct Gemini Fallback
  if (!geminiKey) {
    throw new Error('서버 환경변수(GEMINI_API_KEY 및 TIMELY_API_KEY)가 설정되지 않았습니다.');
  }

  console.log('🤖 [AI Service] Calling direct Gemini Image API...');
  const geminiModel = 'gemini-3.1-flash-image-preview';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `Optimize image size and quality for fast generation:\n${prompt}` }]
      }],
      generationConfig: {
        temperature: 0.8,
      }
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Gemini Image API error:', res.status, data?.error?.message);
    throw new Error(`AI 이미지 생성 실패 (Gemini): ${data?.error?.message || res.statusText}`);
  }

  const imageData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!imageData) {
    throw new Error('Gemini 이미지 응답이 비어 있습니다.');
  }
  return imageData.trim();
}

