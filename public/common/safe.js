/* 외부에서 들어온 값(공유 링크·QR·닉네임·AI 답변 등)을 화면에 넣기 전에 쓰는 공용 헬퍼.
   AppLayout이 모든 앱 페이지 <head>에서 동기로 불러온다. 독립 HTML은 직접 <script src="/common/safe.js">.

   VSafe.esc(s)          HTML 텍스트·속성값 이스케이프(& < > " ' 모두). innerHTML 템플릿에 넣을 때.
   VSafe.safeUrl(u)      http:/https: 주소만 그대로 돌려주고, 나머지(javascript:, data: 등)는 ''.
   VSafe.num(v, min, max, def)  숫자로 강제 + 범위 제한. 숫자가 아니면 def.
   VSafe.int(v, min, max, def)  위와 같되 정수로 자름.

   주의: onclick="fn('${값}')" 같은 인라인 핸들러는 esc로도 막을 수 없다(속성 파싱 때 엔티티가 복원됨).
   data-* 속성 + addEventListener(이벤트 위임)로 바꿀 것. */
(function () {
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(s) {
    return s == null ? '' : String(s).replace(/[&<>"']/g, function (c) { return MAP[c]; });
  }

  function safeUrl(u) {
    if (u == null) return '';
    var s = String(u).trim();
    if (!s) return '';
    try {
      var url = new URL(s, location.href);
      return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : '';
    } catch (e) { return ''; }
  }

  function num(v, min, max, def) {
    var n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return def === undefined ? 0 : def;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }

  function int(v, min, max, def) {
    var n = num(v, min, max, def);
    return isFinite(n) ? Math.trunc(n) : n;
  }

  window.VSafe = { esc: esc, safeUrl: safeUrl, num: num, int: int };
})();
