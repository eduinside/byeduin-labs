/**
 * Cloudflare Pages Function: 교육문서 트리 조회
 * - GitHub API를 서버에서 호출하여 rate limit 해결
 * - GITHUB_TOKEN 없어도 동작 (환경 변수 있으면 인증 호출)
 */
export async function onRequest(ctx) {
  try {
    const REPO = ctx.env.EDU_DOCS_REPO || 'eduinside/byeduin-edu-docs';
    const GITHUB_TOKEN = ctx.env.GITHUB_TOKEN;

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
      return new Response(
        JSON.stringify({ error: `GitHub API failed: ${res.status}` }),
        { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const data = await res.json();

    // 캐시 헤더 설정 (1시간)
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=3600, public',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (err) {
    console.error('❌ [tree] Error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
