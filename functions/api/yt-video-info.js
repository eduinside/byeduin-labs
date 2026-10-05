/**
 * Get YouTube video information (title, author)
 * Uses YouTube oEmbed API (no authentication needed)
 * 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['yt-video-info']
 */
import { guard, json, readJson } from './_guard.js';

const BODY_MAX = 2 * 1024;
const FETCH_TIMEOUT_MS = 6000;

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const blocked = await guard(request, 'yt-video-info');
  if (blocked) return blocked;

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;
  const { videoId } = body;

  if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return json({ error: 'videoId required' }, 400);
  }

  try {
    // YouTube oEmbed API (no auth needed)
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

    if (!res.ok) {
      try { await res.body?.cancel(); } catch {}
      return json({ error: 'Video not found' }, 404);
    }

    const data = await res.json();

    return json({
      videoId,
      title: data.title || 'Unknown Title',
      author: data.author_name || 'Unknown Channel',
    });
  } catch (error) {
    console.error('[yt-video-info]', error && error.message);
    return json({ error: '영상 정보를 가져오지 못했어요.' }, 502);
  }
}
