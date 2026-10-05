/**
 * Cloudflare Pages Function: YouTube 플레이리스트 API 프록시
 * - YOUTUBE_API_KEY 환경변수에서 API 키 읽기
 * - 클라이언트에 API 키 노출 없음
 * - 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['yt-playlist']
 */
import { guard, json, readJson } from './_guard.js';

const BODY_MAX = 4 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{1,200}$/;
// API 키에 HTTP 리퍼러 제한을 걸어 둔 경우를 위해 정본 도메인을 리퍼러로 보낸다.
const REFERER = 'https://eduin.info/';

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return json({ error: '허용되지 않은 방식입니다.' }, 405);
  }

  const blocked = await guard(ctx.request, 'yt-playlist');
  if (blocked) return blocked;

  const apiKey = ctx.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[yt-playlist] YOUTUBE_API_KEY 없음');
    return json({ error: '재생목록 조회 기능이 아직 준비되지 않았어요.' }, 503);
  }

  const body = await readJson(ctx.request, BODY_MAX);
  if (body instanceof Response) return body;

  const { playlistId, pageToken } = body;

  if (typeof playlistId !== 'string' || !/^[A-Za-z0-9_-]{10,60}$/.test(playlistId)) {
    return json({ error: '재생목록 주소가 올바르지 않습니다.' }, 400);
  }
  if (pageToken != null && pageToken !== '' && (typeof pageToken !== 'string' || !PAGE_TOKEN_RE.test(pageToken))) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }

  const BASE = 'https://www.googleapis.com/youtube/v3';
  const opts = () => ({ headers: { Referer: REFERER }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  try {
    // 플레이리스트 제목 조회 (첫 페이지 요청 시에만)
    let playlistTitle = null;
    if (!pageToken) {
      const plRes = await fetch(`${BASE}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`, opts());
      const plData = await plRes.json().catch(() => ({}));
      playlistTitle = plData.items?.[0]?.snippet?.title ?? '플레이리스트';
    }

    // 플레이리스트 아이템 조회
    let itemsUrl = `${BASE}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}`;
    if (pageToken) itemsUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

    const itemsRes = await fetch(itemsUrl, opts());
    const itemsData = await itemsRes.json().catch(() => ({}));

    if (!itemsRes.ok) {
      const errMsg = itemsData.error?.message ?? '';
      console.error('[yt-playlist] YouTube API 오류:', itemsRes.status, errMsg);
      // 리퍼러 제한 오류면 화면이 '개인 API 키 사용' 안내로 넘어가도록 'referer' 낱말을 넣는다
      const displayMsg = /referer/i.test(errMsg)
        ? '서버 API 키의 referer 제한 때문에 조회하지 못했어요. 개인 API 키를 설정하면 바로 쓸 수 있어요.'
        : itemsRes.status === 404
          ? '재생목록을 찾을 수 없어요. 공개 또는 일부 공개 재생목록인지 확인해 주세요.'
          : '재생목록을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.';
      return json({ error: displayMsg }, itemsRes.status);
    }

    const items = (itemsData.items ?? [])
      .filter(it => it.snippet?.resourceId?.videoId)
      .map(it => ({
        videoId: it.snippet.resourceId.videoId,
        title: it.snippet.title ?? '',
        description: it.snippet.description ?? '',
        thumbnailUrl:
          it.snippet.thumbnails?.high?.url ??
          it.snippet.thumbnails?.medium?.url ??
          `https://img.youtube.com/vi/${it.snippet.resourceId.videoId}/hqdefault.jpg`,
      }));

    return json({
      playlistTitle,
      items,
      nextPageToken: itemsData.nextPageToken ?? null,
    });
  } catch (e) {
    console.error('[yt-playlist] 연결 실패:', e && e.message);
    return json({ error: '재생목록을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' }, 502);
  }
}
