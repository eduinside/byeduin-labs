/**
 * Cloudflare Pages Function: URL을 마크다운으로 변환
 * 요청: POST { url: "https://example.com" }
 * 응답: { markdown: "# 제목\n...", filename: "page.md" } 또는 에러 메시지
 */
import TurndownService from 'turndown';

export async function onRequest(ctx) {
  // HTTP 메서드 검증
  if (ctx.request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    // 요청 본문 파싱
    let url;
    try {
      const body = await ctx.request.json();
      url = body.url;

      if (!url) {
        throw new Error('url 필드가 필수입니다.');
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '잘못된 요청: ' + e.message }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // URL 형식 검증
    try {
      new URL(url);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '유효한 URL이 아닙니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // URL에서 HTML 가져오기
    let htmlContent;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const response = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      htmlContent = await response.text();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '웹페이지를 불러올 수 없습니다: ' + e.message }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // HTML 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024;
    const htmlSize = new TextEncoder().encode(htmlContent).length;
    if (htmlSize > maxSize) {
      return new Response(
        JSON.stringify({ error: '웹페이지 크기가 5MB를 초과합니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // HTML → 마크다운 변환
    let markdownContent;
    try {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced'
      });
      markdownContent = turndownService.turndown(htmlContent);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '변환 실패: ' + e.message }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 변환 결과 검증
    if (!markdownContent) {
      return new Response(
        JSON.stringify({ error: '변환된 콘텐츠가 비어 있습니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 파일명 생성 (URL에서)
    const urlObj = new URL(url);
    let filename = urlObj.hostname.replace('www.', '') + '.md';
    filename = filename.replace(/[^a-z0-9._-]/gi, '_').slice(0, 50);

    // 성공 응답
    return new Response(
      JSON.stringify({ markdown: markdownContent, filename }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (err) {
    // 예상치 못한 에러
    return new Response(
      JSON.stringify({ error: '서버 오류: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
