const TurndownService = require('turndown');

/**
 * HTML 파일을 마크다운으로 변환하는 Netlify 함수
 * 요청: POST { htmlContent: "<html>...", filename: "file.html" }
 * 응답: { markdown: "# 제목\n..." } 또는 에러 메시지
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
    let htmlContent, filename;
    try {
      const body = JSON.parse(event.body);
      htmlContent = body.htmlContent;
      filename = body.filename;

      if (!htmlContent || !filename) {
        throw new Error('htmlContent와 filename 필드가 필수입니다.');
      }
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '잘못된 요청: ' + e.message })
      };
    }

    // HTML 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (Buffer.byteLength(htmlContent, 'utf8') > maxSize) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `파일 크기가 5MB를 초과합니다.`
        })
      };
    }

    // 파일 형식 검증
    if (!filename.toLowerCase().endsWith('.html') && !filename.toLowerCase().endsWith('.htm')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: '지원하지 않는 파일 형식입니다. (.html 또는 .htm만 가능)'
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
          error: 'HTML 파일 변환 실패: ' + e.message
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

    // 성공 응답
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: markdownContent })
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
