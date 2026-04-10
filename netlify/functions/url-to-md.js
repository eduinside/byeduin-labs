const TurndownService = require('turndown');

/**
 * URL의 웹페이지를 마크다운으로 변환하는 Netlify 함수
 * 요청: POST { url: "https://example.com" }
 * 응답: { markdown: "# 제목\n...", filename: "page.md" } 또는 에러 메시지
 */
exports.handler = async (event) => {
  // HTTP 메서드 검증
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 요청 본문 파싱
    let url;
    try {
      const body = JSON.parse(event.body);
      url = body.url;

      if (!url) {
        throw new Error('url 필드가 필수입니다.');
      }
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '잘못된 요청: ' + e.message })
      };
    }

    // URL 형식 검증
    try {
      new URL(url);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '유효한 URL이 아닙니다.' })
      };
    }

    // URL에서 HTML 가져오기
    let htmlContent;
    try {
      const response = await fetch(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      htmlContent = await response.text();
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: '웹페이지를 불러올 수 없습니다: ' + e.message
        })
      };
    }

    // HTML 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (Buffer.byteLength(htmlContent, 'utf8') > maxSize) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: '웹페이지 크기가 5MB를 초과합니다.'
        })
      };
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
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: '변환 실패: ' + e.message
        })
      };
    }

    // 변환 결과 검증
    if (!markdownContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: '변환된 콘텐츠가 비어 있습니다.'
        })
      };
    }

    // 파일명 생성 (URL에서)
    const urlObj = new URL(url);
    let filename = urlObj.hostname.replace('www.', '') + '.md';
    filename = filename.replace(/[^a-z0-9._-]/gi, '_').slice(0, 50);

    // 성공 응답
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: markdownContent, filename })
    };

  } catch (err) {
    // 예상치 못한 에러
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '서버 오류: ' + err.message
      })
    };
  }
};
