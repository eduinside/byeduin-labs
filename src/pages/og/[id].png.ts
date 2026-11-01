// 앱별 공유(OG) 이미지 — apps.json의 앱마다 빌드 때 /og/<id>.png를 만든다.
import type { APIRoute, GetStaticPaths } from 'astro';
import { apps, type AppEntry } from '../../components/app-meta';
import { renderOgPng } from '../../components/og-card';

export const getStaticPaths = (() =>
  apps.map((app) => ({ params: { id: app.id }, props: { app } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgPng(props.app as AppEntry);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
