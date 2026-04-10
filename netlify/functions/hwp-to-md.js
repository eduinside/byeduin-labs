const { parseHwp, parseHwpx } = require('kordoc');

/**
 * HWP/HWPX 파일을 마크다운으로 변환하는 Netlify 함수
 * 요청: POST { fileData: "base64...", filename: "file.hwp" }
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
    let fileData, filename;
    try {
      const body = JSON.parse(event.body);
      fileData = body.fileData;
      filename = body.filename;

      if (!fileData || !filename) {
        throw new Error('fileData와 filename 필드가 필수입니다.');
      }
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '잘못된 요청: ' + e.message })
      };
    }

    // Base64 → Buffer 디코딩
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(fileData, 'base64');
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Base64 디코딩 실패: ' + e.message })
      };
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `파일 크기가 5MB를 초과합니다. (현재: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`
        })
      };
    }

    // 파일 확장자로 변환 함수 결정
    const ext = filename.toLowerCase().slice(-5); // .hwpx 또는 마지막 4자 (.hwp)
    let markdownContent;

    try {
      if (ext.endsWith('.hwpx')) {
        // HWPX (최신 한글 형식)
        markdownContent = await parseHwpx(fileBuffer);
      } else if (filename.toLowerCase().endsWith('.hwp')) {
        // HWP (구 한글 형식)
        markdownContent = await parseHwp(fileBuffer);
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: '지원하지 않는 파일 형식입니다. (.hwp 또는 .hwpx만 가능)'
          })
        };
      }
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'HWP 파일 변환 실패: ' + e.message
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
