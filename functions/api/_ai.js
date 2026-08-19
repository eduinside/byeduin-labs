// IP-based Rate Limiter Store
const ipRequests = new Map();

function checkRateLimit(ip, limit, windowMs = 60 * 1000) {
  const now = Date.now();
  
  // Lazy memory cleanup if size exceeds 2000
  if (ipRequests.size > 2000) {
    for (const [key, value] of ipRequests.entries()) {
      if (now > value.resetTime) {
        ipRequests.delete(key);
      }
    }
  }
  
  let record = ipRequests.get(ip);
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowMs
    };
  }
  
  record.count++;
  ipRequests.set(ip, record);
  
  return record.count <= limit;
}

const TIMELY_ENDPOINT = 'https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai/chat/completions';

// Timely 호출 + 상태코드별 분기(429는 크레딧 등급 하락에 따른 일시 제한이므로 1회 재시도, 402는 크레딧 소진으로 재시도 무의미 → 즉시 Gemini 폴백)
async function callTimely(body, timelyKey) {
  const doFetch = () => fetch(TIMELY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${timelyKey}`
    },
    body: JSON.stringify(body)
  });

  let res = await doFetch();

  if (res.status === 429) {
    console.warn('⚠️ [AI Service] Timely 429(rate limit) — 400ms 후 1회 재시도...');
    await new Promise((resolve) => setTimeout(resolve, 400));
    res = await doFetch();
  }

  if (res.status === 402) {
    console.error('💳 [AI Service] Timely 402(크레딧 소진) — 충전 필요. 직접 Gemini로 폴백합니다.');
  } else if (!res.ok) {
    console.warn(`⚠️ [AI Service] Timely API 응답 실패 (status ${res.status}), falling back to direct Gemini...`);
  }

  return res;
}

export async function generateContent({
  systemPrompt,
  userMessage,
  env,
  temperature = 0.8,
  // 모델 오버라이드(선택). 기본값은 가장 저렴한 flash-lite 유지 → 기존 호출부 동작 불변.
  // 무거운 작업(예: 검색 최종 답변)은 'google/gemini-2.5-flash' / 'gemini-flash-latest'로 승격.
  timelyModel = 'google/gemini-2.5-flash-lite',
  geminiModel = 'gemini-flash-lite-latest',
  request = null // IP rate limiting용 request 객체
}) {
  if (request) {
    const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    if (!checkRateLimit(ip, 30)) { // 분당 최대 30회 텍스트 생성
      const err = new Error('요청 빈도가 너무 높습니다. 잠시 후 다시 시도해 주세요. (Too Many Requests)');
      err.status = 429;
      throw err;
    }
  }
  const timelyKey = env.TIMELY_API_KEY;
  const geminiKey = env.GEMINI_API_KEY;

  // 1. Try Timely GPT first if key exists
  if (timelyKey) {
    try {
      console.log('🤖 [AI Service] Trying Timely GPT API...', { model: timelyModel });
      const res = await callTimely({
        model: timelyModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature
      }, timelyKey);

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          console.log('✅ [AI Service] Timely GPT API success');
          return text.trim();
        }
      }
    } catch (e) {
      console.error('❌ [AI Service] Timely GPT API error:', e.message, 'falling back to direct Gemini...');
    }
  }

  // 2. Direct Gemini Fallback
  if (!geminiKey) {
    throw new Error('서버 환경변수(GEMINI_API_KEY 및 TIMELY_API_KEY)가 설정되지 않았습니다.');
  }

  console.log('🤖 [AI Service] Calling direct Gemini API...', { model: geminiModel });
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

export async function generateImage({ prompt, env, request = null }) {
  if (request) {
    const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    if (!checkRateLimit(ip, 5)) { // 분당 최대 5회 이미지 생성
      const err = new Error('이미지 생성 요청 빈도가 너무 높습니다. 1분 후에 다시 시도해 주세요. (Too Many Requests)');
      err.status = 429;
      throw err;
    }
  }
  const timelyKey = env.TIMELY_API_KEY;
  const geminiKey = env.GEMINI_API_KEY;
  let b64Data = null;

  // 1. Try Timely GPT first if key exists
  if (timelyKey) {
    try {
      console.log('🤖 [AI Service] Trying Timely GPT Image API...');
      const res = await callTimely({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'user', content: prompt }
        ],
        modalities: ['image'],
        // gemini-2.5-flash-image은 '1K'가 최소 지원 크기(0.5K/512 등은 400 에러 — 실측 확인).
        // 1K도 실측 1.5~2MB급이라 페이로드 절감 효과는 제한적이지만, aspect_ratio 고정으로
        // 카드 레이아웃 일관성은 확보하고 미지정 시 더 큰 크기(2K/4K)가 나오는 경우를 방지한다.
        image_config: { image_size: '1K', aspect_ratio: '1:1' }
      }, timelyKey);

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
    } catch (e) {
      console.error('❌ [AI Service] Timely GPT Image error:', e.message, 'falling back to direct Gemini...');
    }
  }

  // 2. Direct Gemini Fallback
  if (!geminiKey) {
    throw new Error('서버 환경변수(GEMINI_API_KEY 및 TIMELY_API_KEY)가 설정되지 않았습니다.');
  }

  // imagen-3.0-generate-002(:predict)는 이 프로젝트 키에서 더 이상 제공되지 않음(2026-08 확인, 404) —
  // 현재는 gemini-2.5-flash-image를 표준 generateContent + responseModalities:["IMAGE"]로 호출해야 함.
  console.log('🤖 [AI Service] Calling direct Gemini Image API...');
  const geminiModel = 'gemini-2.5-flash-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseModalities: ['IMAGE']
      }
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Gemini Image API error:', res.status, data?.error?.message);
    throw new Error(`AI 이미지 생성 실패 (Gemini): ${data?.error?.message || res.statusText}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imageData = parts.find((p) => p.inlineData)?.inlineData?.data;
  if (!imageData) {
    throw new Error('Gemini 이미지 응답이 비어 있습니다.');
  }
  return imageData.trim();
}

