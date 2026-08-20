// GET /api/book-lookup?isbn=9791193732380
// 알라딘 TTB ItemLookUp 서버사이드 프록시. 키는 env.ALADIN_TTB_KEY (배포본·클라이언트에 노출 안 됨).
//
// 공용 TTB 키 1개로 전 이용자의 조회를 대행하므로 알라딘 일시 차단(10분)의 폭발 반경이 크다.
// 이를 줄이기 위해 D1(book_cache)에 서지정보를 캐시하고, 차단이 감지되면 429로 명확히 알린다.
// 설계 배경: docs/book-share-aladin-plan.md

// 알라딘 API 호스트. 2026-08-20 공지로 openapi.aladin.co.kr이 폐지됐으나(실측 403)
// 이 앱은 처음부터 정본 호스트를 써서 영향 없음. 추가 통합 공지 시 이 한 줄만 바꾼다.
const ALADIN_HOST = 'https://www.aladin.co.kr';

// 서지정보는 사실상 불변이지만 개정판 정가 변동을 감안해 90일.
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// 알라딘 차단 해제까지 안내할 대기 시간(초). 공지 기준 10분.
const BLOCK_RETRY_SEC = 600;

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  const ttbkey = env.ALADIN_TTB_KEY;
  if (!ttbkey) {
    return new Response(
      JSON.stringify({ error: '서버에 ALADIN_TTB_KEY 환경변수가 설정되지 않았습니다.' }),
      { status: 500, headers }
    );
  }

  let isbn = '';
  try { isbn = (new URL(request.url).searchParams.get('isbn') || '').replace(/\D/g, ''); } catch {}
  if (isbn.length !== 13) {
    return new Response(JSON.stringify({ error: '유효한 ISBN-13이 필요합니다.' }), { status: 400, headers });
  }

  // ── 1) 캐시 조회 (실패해도 조용히 통과 — 캐시는 최적화이지 필수 경로가 아님)
  const cached = await readCache(env, isbn);
  if (cached) {
    return new Response(JSON.stringify({ item: cached }), {
      status: 200,
      headers: { ...headers, 'X-Cache': 'HIT' },
    });
  }

  const api = ALADIN_HOST + '/ttb/api/ItemLookUp.aspx'
    + '?ttbkey=' + encodeURIComponent(ttbkey)
    + '&itemId=' + encodeURIComponent(isbn)
    + '&itemIdType=ISBN13'
    + '&output=js'
    + '&Version=20131101';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let text;
    try {
      const res = await fetch(api, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; byeduin-bot/1.0)' },
        signal: ctrl.signal,
      });
      // 429/403은 호출량 제한에 의한 차단. openapi 폐지 후 403도 같은 취급이 안전하다.
      if (res.status === 429 || res.status === 403) return blockedResponse(headers);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `알라딘 응답 ${res.status}` }), { status: 502, headers });
      }
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }

    // output=js 응답 정리: BOM 제거, JSONP 래퍼(callback({...})) 있으면 내부만, 말미 세미콜론 제거
    let body = (text || '').replace(/^﻿/, '').trim();
    if (body && body[0] !== '{' && body[0] !== '[') {
      const m = body.match(/^[A-Za-z_$][\w$]*\s*\(([\s\S]*)\)\s*;?\s*$/);
      if (m) body = m[1].trim();
    }
    body = body.replace(/;\s*$/, '');

    let data;
    try { data = JSON.parse(body); }
    catch (e) {
      // 차단 시 알라딘은 JSON 대신 안내 HTML을 반환한다. 파싱 실패는 차단으로 간주하는 편이
      // 사용자에게도(10분 후 재시도) 알라딘에게도(추가 호출 중단) 옳다.
      return blockedResponse(headers);
    }

    if (data && data.errorCode) {
      const msg = String(data.errorMessage || '');
      if (/차단|초과|제한/.test(msg)) return blockedResponse(headers);
      return new Response(
        JSON.stringify({ error: msg || ('알라딘 오류 ' + data.errorCode) }),
        { status: 502, headers }
      );
    }

    const item = (data && Array.isArray(data.item) && data.item.length > 0) ? data.item[0] : null;
    if (!item) {
      return new Response(JSON.stringify({ error: '도서를 찾을 수 없습니다.', item: null }), { status: 404, headers });
    }

    // ── 2) 성공한 조회만 캐시. 실패·404를 캐시하면 일시 장애가 90일 고착된다.
    await writeCache(env, isbn, item);

    return new Response(JSON.stringify({ item }), {
      status: 200,
      headers: { ...headers, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err && err.message) || '알라딘 연결 실패' }),
      { status: 502, headers }
    );
  }
}

/* ── 알라딘 일시 차단 응답 ── */
function blockedResponse(headers) {
  return new Response(
    JSON.stringify({
      error: '알라딘 조회가 일시 제한되었습니다. 10분 후 다시 시도해 주세요.',
      blocked: true,
      retryAfter: BLOCK_RETRY_SEC,
    }),
    { status: 429, headers: { ...headers, 'Retry-After': String(BLOCK_RETRY_SEC) } }
  );
}

/* ── D1 캐시 ── */
async function readCache(env, isbn) {
  if (!env.BYEDUIN_DB) return null;
  try {
    const row = await env.BYEDUIN_DB
      .prepare('SELECT payload, fetched_at FROM book_cache WHERE isbn13 = ?')
      .bind(isbn)
      .first();
    if (!row) return null;
    const age = Date.now() - Date.parse(row.fetched_at);
    if (!(age >= 0) || age > CACHE_TTL_MS) return null; // 만료·시각 이상 → 미스 처리
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

async function writeCache(env, isbn, item) {
  if (!env.BYEDUIN_DB) return;
  try {
    await env.BYEDUIN_DB
      .prepare(
        'INSERT INTO book_cache (isbn13, payload, fetched_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(isbn13) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at'
      )
      .bind(isbn, JSON.stringify(item), new Date().toISOString())
      .run();
  } catch {
    // 캐시 쓰기 실패는 조회 결과에 영향을 주지 않는다.
  }
}
