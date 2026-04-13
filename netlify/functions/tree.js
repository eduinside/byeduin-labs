/**
 * Netlify Function: 교육문서 트리 조회
 * - GitHub API를 서버에서 호출하여 rate limit 해결
 * - GITHUB_TOKEN 없어도 동작 (환경 변수 있으면 인증 호출)
 */

exports.handler = async (event) => {
  try {
    const REPO = process.env.EDU_DOCS_REPO || 'eduinside/byeduin-edu-docs';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    const headers = { 'User-Agent': 'byeduin-search' };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    console.log(`📥 [tree] Fetching from ${REPO}...`);

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`,
      { headers }
    );

    if (!res.ok) {
      console.error(`❌ [tree] GitHub API failed: ${res.status}`);
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `GitHub API failed: ${res.status}` })
      };
    }

    const data = await res.json();

    // 캐시 헤더 설정 (1시간)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600, public'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('❌ [tree] Error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
