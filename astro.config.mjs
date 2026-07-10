// @ts-check
import { defineConfig } from 'astro/config';

// 정적 출력(전 페이지 프리렌더). 배포는 Cloudflare Pages —
// dist/를 pages_build_output_dir로 서빙하고 /api/*는 functions/ Pages Functions가 담당.
// (@astrojs/cloudflare 어댑터는 SSR 페이지가 없어 제거함 — 재도입 시 functions/와의 충돌 주의)
export default defineConfig({});
