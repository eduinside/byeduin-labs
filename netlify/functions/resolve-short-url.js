const https = require('https');

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

  // 환경변수에서 API 키와 도메인 읽기
  const apiKey = process.env.SHORT_IO_API_KEY;
  const domain = process.env.SHORT_IO_DOMAIN;

  if (!apiKey || !domain) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API configuration missing' })
    };
  }

  try {
    // Short.io URL 형식에서 코드 추출
    // 예: https://byeduin.short.gy/b5Ycho → b5Ycho
    //     https://book.byeduin.com/sh/abc123 → abc123
    const match = shortURL.match(/\/([a-zA-Z0-9]+)$/);
    if (!match) {
      throw new Error('Invalid short URL format');
    }

    const code = match[1];

    // Short.io REST API 호출: GET /links/expand?domain={domain}&path={code}
    const options = {
      hostname: 'api.short.io',
      port: 443,
      path: `/links/expand?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(code)}`,
      method: 'GET',
      headers: {
        'Authorization': apiKey,
      },
      timeout: 10000,
    };

    const resolvedURL = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('Short.io API Response - Status:', res.statusCode, 'Body:', data.substring(0, 500));
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              console.log('Short.io API Parsed JSON:', JSON.stringify(json, null, 2));
              // Short.io API 응답에서 originalURL 필드 추출
              const url = json.originalURL || json.redirect || json.url;
              if (url) {
                resolve(url);
              } else {
                reject(new Error('No URL found in response'));
              }
            } catch (err) {
              reject(new Error('Failed to parse response: ' + err.message));
            }
          } else if (res.statusCode === 404) {
            reject(new Error('Short URL not found'));
          } else {
            reject(new Error(`API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error('Request failed: ' + err.message));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedURL })
    };
  } catch (err) {
    console.error('Short.io API error:', err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'URL resolution failed: ' + err.message })
    };
  }
};
