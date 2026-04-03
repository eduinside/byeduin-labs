// Google Analytics 4 초기화
// localhost 환경 제외 (개발 환경 데이터 보호)

(function() {
  // 로컬 테스트 환경 감지
  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    console.log('[GA4] Skipped on localhost');
    return;
  }

  // Google Analytics 스크립트 동적 로드
  const GA_ID = 'G-PNSBXTYTX9';

  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(gaScript);

  // Google Analytics 초기화
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    dataLayer.push(arguments);
  };
  gtag('js', new Date());
  gtag('config', GA_ID);
})();
