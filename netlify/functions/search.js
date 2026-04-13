/**
 * Netlify Function: 교육문서 RAG 검색
 * - GitHub 공개 리포에서 MD 파일을 fetch하여 Gemini 2.0 Flash Lite로 검색
 * - GEMINI_API_KEY, EDU_DOCS_REPO 환경 변수 필요
 * - GITHUB_TOKEN 환경 변수 선택 (없으면 비인증 60req/h)
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { query, categories } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { statusCode: 400, body: 'Missing query' };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const REPO = process.env.EDU_DOCS_REPO || 'eduinside/byeduin-edu-docs';
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: 'Server configuration error' };
  }

  try {
    // 1. GitHub API로 파일 트리 조회
    const treeHeaders = { 'User-Agent': 'byeduin-edu-search' };
    if (GITHUB_TOKEN) treeHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;

    const treeRes = await fetch(
      `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`,
      { headers: treeHeaders }
    );

    if (!treeRes.ok) {
      return { statusCode: 502, body: 'Failed to fetch document tree' };
    }

    const treeData = await treeRes.json();
    let files = (treeData.tree || [])
      .filter(f => f.type === 'blob' && f.path.endsWith('.md'));

    // 카테고리 필터 (배열이 비어있으면 전체)
    if (Array.isArray(categories) && categories.length > 0) {
      files = files.filter(f =>
        categories.some(cat => f.path.startsWith(cat + '/') || f.path.startsWith(cat))
      );
    }

    if (files.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: '해당 카테고리에 문서가 없습니다.', sources: [] }),
      };
    }

    // 최대 10개 파일로 제한 (타임아웃 방지)
    const targetFiles = files.slice(0, 10);

    // 2. MD 파일 내용 병렬 fetch
    const rawBase = `https://raw.githubusercontent.com/${REPO}/main`;
    const fetchResults = await Promise.allSettled(
      targetFiles.map(f =>
        fetch(`${rawBase}/${f.path}`)
          .then(r => r.ok ? r.text() : null)
          .then(text => text ? { path: f.path, text } : null)
      )
    );

    const contents = fetchResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    if (contents.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: '문서를 불러오지 못했습니다.', sources: [] }),
      };
    }

    // 3. Gemini 프롬프트 구성 (토큰 절약: 파일당 최대 4000자)
    const MAX_CHARS_PER_FILE = 4000;
    const context = contents
      .map(f => {
        const truncated = f.text.length > MAX_CHARS_PER_FILE
          ? f.text.slice(0, MAX_CHARS_PER_FILE) + '\n...(이하 생략)'
          : f.text;
        return `## [출처: ${f.path}]\n${truncated}`;
      })
      .join('\n\n---\n\n');

    const prompt = `당신은 교육 행정 전문가입니다. 아래 교육 문서들을 참고하여 질문에 정확하게 답하십시오.

규칙:
- 반드시 제공된 문서 내용에 근거하여 답변하십시오.
- 답변 마지막에 인용한 출처 파일명을 "**출처:** 파일명" 형식으로 명시하십시오.
- 문서에서 관련 내용을 찾을 수 없으면 "제공된 문서에서 관련 내용을 찾을 수 없습니다."라고 답하십시오.
- 답변은 명확하고 간결하게 작성하십시오.

교육 문서:
${context}

질문: ${query.trim()}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return { statusCode: 502, body: 'Gemini API request failed' };
    }

    const geminiData = await geminiRes.json();
    const answer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';
    const sources = contents.map(f => f.path);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, sources }),
    };
  } catch {
    return { statusCode: 502, body: 'Upstream request failed' };
  }
};
