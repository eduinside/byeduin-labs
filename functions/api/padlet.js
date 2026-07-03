/**
 * Cloudflare Pages Function: 패들렛(Padlet) API 프록시
 * - API 키는 요청 body로만 전달, 서버에 저장/로깅 없음
 * - action 화이트리스트(verifyBoard/createPost)만 통과 — 임의 경로 호출 불가
 */

const BOARD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const COLORS = new Set(['red', 'orange', 'green', 'blue', 'purple']);
const API_BASE = 'https://api.padlet.dev';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest(ctx) {
  if (ctx.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { apiKey, boardId, action, item } = body || {};

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 500) {
    return json({ error: 'Missing or invalid apiKey' }, 400);
  }
  if (!boardId || !BOARD_ID_RE.test(boardId)) {
    return json({ error: 'Missing or invalid boardId' }, 400);
  }

  const headers = {
    'X-API-KEY': apiKey,
    'Accept': 'application/vnd.api+json',
  };

  try {
    if (action === 'verifyBoard') {
      const resp = await fetch(`${API_BASE}/v1/boards/${boardId}`, { headers });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        return json({ error: pickErrorDetail(data, resp.status) }, resp.status);
      }
      return json({ title: data?.data?.attributes?.title ?? null }, 200);
    }

    if (action === 'createPost') {
      if (!item || typeof item !== 'object') {
        return json({ error: 'Missing item' }, 400);
      }
      const subject = trimOrUndef(item.subject, 500);
      const bodyText = trimOrUndef(item.body, 5000);
      const linkUrl = trimOrUndef(item.linkUrl, 2000);
      if (!subject && !bodyText && !linkUrl) {
        return json({ error: 'Item has no subject/body/link' }, 400);
      }

      const content = {};
      if (subject) content.subject = subject;
      if (bodyText) content.body = bodyText;
      if (linkUrl) content.attachment = { url: linkUrl };

      const attributes = { content };
      if (item.color && COLORS.has(item.color)) attributes.color = item.color;

      const resp = await fetch(`${API_BASE}/v1/boards/${boardId}/posts`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/vnd.api+json' },
        body: JSON.stringify({ data: { type: 'post', attributes } }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        return json({ error: pickErrorDetail(data, resp.status) }, resp.status);
      }
      return json({ id: data?.data?.id ?? null }, 201);
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    // 에러 메시지에 API 키 등 민감정보 포함하지 않음
    return json({ error: 'Upstream request failed' }, 502);
  }
}

function trimOrUndef(v, maxLen) {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function pickErrorDetail(data, status) {
  const detail = data?.errors?.[0]?.detail || data?.errors?.[0]?.title;
  return detail || `Padlet API 오류 (${status})`;
}
