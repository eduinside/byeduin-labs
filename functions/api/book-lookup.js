// GET /api/book-lookup?isbn=9791193732380
// 카카오 책 검색 API(target=isbn) 서버사이드 프록시. 키는 env.KAKAO_REST_API_KEY
// (배포본·클라이언트에 노출 안 됨).
// 알라딘 Open API 종료(2026-10-30)에 따라 전환 검토 → 네이버 책 검색 API는 2026-07-31자로
// 이미 종료되어 채택 불가 → 카카오 책 검색 API로 전환.
//
// 공용 키 1개로 전 이용자의 조회를 대행하므로 카카오 일일 호출량(기본 300,000/일) 소진 리스크가 있다.
// 이를 줄이기 위해 D1(book_cache)에 서지정보를 캐시하고, 429가 오면 명확히 안내한다.

const KAKAO_HOST = 'https://dapi.kakao.com/v3/search/book';

// 서지정보는 사실상 불변이지만 개정판 정가 변동을 감안해 90일.
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// 호출량 초과 시 안내할 대기 시간(초).
const BLOCK_RETRY_SEC = 600;

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  const kakaoKey = env.KAKAO_REST_API_KEY;
  if (!kakaoKey) {
    return new Response(
      JSON.stringify({ error: '서버에 KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.' }),
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

  const api = KAKAO_HOST + '?target=isbn&query=' + encodeURIComponent(isbn);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let data;
    try {
      const res = await fetch(api, {
        headers: { Authorization: 'KakaoAK ' + kakaoKey },
        signal: ctrl.signal,
      });
      if (res.status === 429) return blockedResponse(headers);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: `카카오 응답 ${res.status}` }), { status: 502, headers });
      }
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }

    const raw = (data && Array.isArray(data.documents) && data.documents.length > 0) ? data.documents[0] : null;
    if (!raw) {
      return new Response(JSON.stringify({ error: '도서를 찾을 수 없습니다.', item: null }), { status: 404, headers });
    }

    // 카카오 isbn 필드는 "ISBN10 ISBN13" 공백 구분. 13자리만 취한다.
    const isbnMatch = String(raw.isbn || '').match(/\d{13}/);
    const item = {
      isbn13: isbnMatch ? isbnMatch[0] : isbn,
      title: raw.title || '',
      author: Array.isArray(raw.authors) ? raw.authors.join(', ') : '',
      publisher: raw.publisher || '',
      priceStandard: Number(raw.price) || 0,
      cover: raw.thumbnail || '',
      description: raw.contents || '',
      pubDate: raw.datetime ? raw.datetime.slice(0, 10) : '',
    };

    // ── 2) 성공한 조회만 캐시. 실패·404를 캐시하면 일시 장애가 90일 고착된다.
    await writeCache(env, isbn, item);

    return new Response(JSON.stringify({ item }), {
      status: 200,
      headers: { ...headers, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err && err.message) || '카카오 연결 실패' }),
      { status: 502, headers }
    );
  }
}

/* ── 호출량 초과 응답 ── */
function blockedResponse(headers) {
  return new Response(
    JSON.stringify({
      error: '도서 조회가 일시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
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
