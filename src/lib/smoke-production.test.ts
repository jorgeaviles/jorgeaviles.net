import { expect, it } from 'vitest';
import { smokeProduction } from '../../scripts/smoke-production.mjs';
const sha = 'a'.repeat(40);
const fetcher =
  (commit = sha, missing = 404, assetType = 'text/javascript') =>
  async (input: Parameters<typeof fetch>[0]) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    if (path === '/deployment.json') return Response.json({ commit });
    if (path === '/lab/')
      return new Response(
        '<main><h1>Learn how models learn</h1><astro-island component-url="/_astro/lab.js"><link href="/_astro/site.css"></main>',
        { headers: { 'content-type': 'text/html' } },
      );
    if (path.endsWith('.js'))
      return new Response('export{}', {
        headers: { 'content-type': assetType },
      });
    if (path.endsWith('.css'))
      return new Response('body{}', {
        headers: { 'content-type': 'text/css' },
      });
    return new Response('A small detour.', { status: missing });
  };
it('checks provenance, lab assets and a genuine custom 404', async () => {
  await expect(
    smokeProduction('https://example.test', sha, fetcher()),
  ).resolves.toEqual({ commit: sha, assets: 2, lab: 200, unknown: 404 });
});
it('rejects a stale release, HTML asset fallback or SPA 404 fallback', async () => {
  await expect(
    smokeProduction('https://example.test', sha, fetcher('b'.repeat(40))),
  ).rejects.toThrow('commit mismatch');
  await expect(
    smokeProduction('https://example.test', sha, fetcher(sha, 200)),
  ).rejects.toThrow('404');
  await expect(
    smokeProduction(
      'https://example.test',
      sha,
      fetcher(sha, 404, 'text/html'),
    ),
  ).rejects.toThrow('asset');
});
