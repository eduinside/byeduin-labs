// functions/api/_madang-common.js
// ─────────────────────────────────────────────────────────────────────────────
// 마당(madang) 공용 헬퍼 — madang.js · madang-upload.js · madang-img/[board]/[key].js가 공유.
// 접근제어(checkAccess)를 여기 한 곳에만 두어 이미지 프록시도 GET 폴링과 동일한 규칙을 따르게 한다.
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_RE = /^[A-Z0-9]{6}$/;            // vives:code (작성자/개설자 신원)
export const BOARD_RE = /^[A-HJ-NP-Z2-9]{6}$/;     // 마당 코드(혼동 문자 0/O/1/I/L 제외)

export function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
export function nowIso() { return new Date().toISOString(); }
export function parseSettings(s) { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } }
// 자동종료: settings.expiresAt(ISO) 지난 보드는 만료. 무기한이면 expiresAt 없음.
export function isExpired(settings) { return !!(settings.expiresAt && new Date(settings.expiresAt).getTime() < Date.now()); }

// ── HMAC(pepper) 해시 — 코드 원본 미저장 ──
export function pepperOf(env) { return env.MADANG_PEPPER || 'madang-default-pepper-v1'; }
export async function hmacHex(pepper, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function ownerToken(env, boardId, code) { return hmacHex(pepperOf(env), 'owner:' + boardId + ':' + code); }
export function authorToken(env, boardId, code) { return hmacHex(pepperOf(env), 'author:' + boardId + ':' + code); }
export function pinHashOf(env, boardId, pin) { return hmacHex(pepperOf(env), 'pin:' + boardId + ':' + pin); }

// 공유중단·만료·PIN 접근 검사(개설자는 통과). 막히면 {error,status,...}, OK면 null.
export async function checkAccess(env, board, settings, isOwner, pin) {
  if (!board.shared && !isOwner) return { error: '공유가 중단된 마당입니다.', closed: true, status: 403 };
  if (isExpired(settings) && !isOwner) return { error: '운영 기간이 종료된 마당입니다.', expired: true, status: 403 };
  if (settings.pinHash && !isOwner) {
    if (!pin || (await pinHashOf(env, board.id, pin)) !== settings.pinHash) return { error: 'PIN이 필요합니다.', pinRequired: true, status: 401 };
  }
  return null;
}

// R2 키 규약: madang/{boardId}/{filename}. 다른 앱과 버킷(byeduin-media)을 공유하므로 prefix로 구분.
export function madangR2Key(boardId, filename) { return 'madang/' + boardId + '/' + filename; }
export function madangR2Prefix(boardId) { return 'madang/' + boardId + '/'; }
