// POST /api/hwp-to-md
// Proxy to Netlify hwp-to-md function with CORS support

export async function onRequest(ctx) {
  const { request, env } = ctx;

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  try {
    // Get the request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers,
      });
    }

    // Validate required fields
    if (!body.fileData || !body.filename) {
      return new Response(
        JSON.stringify({ error: 'Missing fileData or filename' }),
        { status: 400, headers }
      );
    }

    // Forward to Netlify hwp-to-md function
    const netlifyUrl = 'https://byeduin-vives.netlify.app/hwp-to-md';

    console.log('[hwp-to-md] Forwarding to Netlify:', {
      url: netlifyUrl,
      filename: body.filename,
      fileDataLength: body.fileData?.length || 0,
    });

    // Add timeout for Netlify call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds

    const response = await fetch(netlifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check if response is OK
    if (!response.ok) {
      console.error('[hwp-to-md] Netlify error:', {
        status: response.status,
        statusText: response.statusText,
      });

      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { error: 'Failed to convert file' };
      }

      return new Response(JSON.stringify(errorBody), {
        status: response.status,
        headers,
      });
    }

    // Get the result
    const result = await response.json();

    console.log('[hwp-to-md] Success:', {
      markdownLength: result.markdown?.length || 0,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('[hwp-to-md] Error:', {
      name: err.name,
      message: err.message,
      code: err.code,
    });

    // Check if it's a timeout
    if (err.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Conversion timeout (exceeded 25s)' }),
        { status: 504, headers }
      );
    }

    return new Response(
      JSON.stringify({ error: err.message || 'Server error' }),
      { status: 500, headers }
    );
  }
}
