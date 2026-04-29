/**
 * Get YouTube video information (title, author)
 * Uses YouTube oEmbed API (no authentication needed)
 */
export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId required' }),
        { status: 400 }
      );
    }

    // YouTube oEmbed API (no auth needed)
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404 }
      );
    }

    const data = await res.json();

    return new Response(
      JSON.stringify({
        videoId,
        title: data.title || 'Unknown Title',
        author: data.author_name || 'Unknown Channel',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
