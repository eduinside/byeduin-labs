const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 요청 파싱
  let shortURL;
  try {
    const body = JSON.parse(event.body);
    shortURL = body.shortURL;
    if (!shortURL) {
      throw new Error('shortURL 필드 필수');
    }
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request: ' + e.message })
    };
  }

  try {
    // HTTP 리다이렉트 따라가기 (Short.io API 대신 직접 리다이렉트 사용)
    const resolvedURL = await followRedirect(shortURL, 0, 10);

    if (!resolvedURL) {
      throw new Error('리다이렉트 따라가기 실패');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedURL })
    };
  } catch (err) {
    console.error('URL resolution error:', err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'URL resolution failed: ' + err.message })
    };
  }
};

// HTTP 리다이렉트 따라가기
function followRedirect(urlString, redirectCount = 0, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (redirectCount > maxRedirects) {
      return reject(new Error('Max redirects exceeded'));
    }

    try {
      const url = new URL(urlString);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(url, {
        method: 'HEAD',
        timeout: 10000,
      }, (res) => {
        // 리다이렉트 응답 (3xx)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location;
          // 상대 경로인 경우 절대 경로로 변환
          const absoluteUrl = redirectUrl.startsWith('http')
            ? redirectUrl
            : new URL(redirectUrl, urlString).href;

          followRedirect(absoluteUrl, redirectCount + 1, maxRedirects)
            .then(resolve)
            .catch(reject);
        }
        // 최종 URL (2xx)
        else if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(urlString);
        }
        // 에러 응답
        else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
