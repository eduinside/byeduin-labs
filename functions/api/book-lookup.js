// GET /api/book-lookup?isbn=9791193732380
// 알라딘 TTB ItemLookUp 서버사이드 프록시. 키는 env.ALADIN_TTB_KEY (배포본·클라이언트에 노출 안 됨).

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

  const api = 'https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx'
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
    catch (e) { return new Response(JSON.stringify({ error: '알라딘 응답 파싱 실패' }), { status: 502, headers }); }

    if (data && data.errorCode) {
      return new Response(
        JSON.stringify({ error: data.errorMessage || ('알라딘 오류 ' + data.errorCode) }),
        { status: 502, headers }
      );
    }

    const item = (data && Array.isArray(data.item) && data.item.length > 0) ? data.item[0] : null;
    if (!item) {
      return new Response(JSON.stringify({ error: '도서를 찾을 수 없습니다.', item: null }), { status: 404, headers });
    }

    return new Response(JSON.stringify({ item }), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err && err.message) || '알라딘 연결 실패' }),
      { status: 502, headers }
    );
  }
}
