// 비공개 앱(apps.json의 hidden: true)의 서버 API를 막는 응답.
// 페이지는 src/pages/apps/_<id>/로 빌드에서 빠지지만 API는 주소로 계속 호출될 수 있어 함께 막는다.
// 다시 공개할 때는 각 파일의 `if (APP_CLOSED) return appClosed();` 줄과 import를 지우면 된다.
export function appClosed() {
  return new Response(JSON.stringify({ error: '현재 제공하지 않는 기능입니다.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
