// POST /api/doc-parse  (multipart/form-data: file, output_format) → Corepin 변환 결과 JSON
// 서버의 Corepin 키로 문서를 변환한다. 같은 출처에서만 받고(_guard.js), 한도는 LIMITS['doc-parse'].
import { guard, json, readBody } from './_guard.js';

const MAX_BYTES = 50 * 1024 * 1024;   // 50MB(화면 안내와 같은 값)
const UPSTREAM_TIMEOUT_MS = 60000;    // 큰 HWP·PDF 변환 대기 상한

// Corepin 오류 상태 → 사용자 문구(원문 메시지는 로그에만)
function upstreamMessage(status) {
  if (status === 413) return '파일이 너무 큽니다 (50MB 초과).';
  if (status === 415) return '지원하지 않는 파일 형식입니다.';
  if (status === 422) return '파일을 처리할 수 없습니다 (손상되었거나 암호화된 파일).';
  if (status === 429) return '요청이 많아 잠시 멈췄어요. 잠시 후 다시 시도해 주세요.';
  return '문서 변환에 실패했어요. 잠시 후 다시 시도해 주세요.';
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'POST') return json({ error: '허용되지 않은 방식입니다.' }, 405);

  // raw body + 원본 Content-Type(boundary 포함) 그대로 포워딩
  // FormData 재구성 시 boundary가 바뀌어 405가 발생할 수 있어 직접 전달
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'multipart/form-data 요청이 필요합니다.' }, 400);
  }

  // Content-Length 사전 검증 — body를 읽기 전에 50MB 초과 차단
  const clRaw = request.headers.get('content-length');
  const cl = clRaw == null ? NaN : Number(clRaw);
  if (cl > MAX_BYTES) return json({ error: '파일 크기가 50MB를 초과합니다.' }, 413);

  const blocked = await guard(request, 'doc-parse');
  if (blocked) return blocked;

  const apiKey = env.COREPIN_API_KEY;
  if (!apiKey) {
    console.error('[doc-parse] COREPIN_API_KEY 없음');
    return json({ error: '문서 변환 기능이 아직 준비되지 않았어요.' }, 503);
  }

  // content-length가 있으면 HTTP 규약상 본문이 그 길이를 넘을 수 없으므로 스트림을 그대로 넘긴다(기존 동작).
  // 없으면(chunked) 상한까지 세며 읽어 버퍼로 넘긴다.
  let upstreamBody = request.body;
  if (!Number.isFinite(cl)) {
    const buf = await readBody(request, MAX_BYTES);
    if (buf instanceof Response) return json({ error: '파일 크기가 50MB를 초과합니다.' }, 413);
    upstreamBody = buf;
  }

  let upstream;
  try {
    upstream = await fetch('https://api.corepin.ai/v1/doc/parse', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': contentType,
      },
      body: upstreamBody,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    console.error('[doc-parse] Corepin 연결 실패:', e && e.message);
    return json({ error: '문서 변환 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 502);
  }

  let raw;
  try {
    raw = await upstream.text();
  } catch (e) {
    console.error('[doc-parse] 응답 읽기 실패:', e && e.message);
    return json({ error: '문서 변환이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.' }, 504);
  }

  // 429일 때 Retry-After 헤더 전달
  const retryAfter = upstream.headers.get('retry-after');
  const resHeaders = retryAfter ? { 'Retry-After': retryAfter } : {};

  if (!upstream.ok) {
    console.error('[doc-parse] Corepin 오류:', upstream.status, raw.slice(0, 300));
    return json({ error: upstreamMessage(upstream.status) }, upstream.status, resHeaders);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error('[doc-parse] 비-JSON 응답:', raw.slice(0, 300));
    return json({ error: '문서 변환 결과를 읽지 못했어요.' }, 502);
  }
  return json(payload, 200, resHeaders);
}
