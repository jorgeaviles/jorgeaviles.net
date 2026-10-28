import { expect, it, vi } from 'vitest';
import {
  smokeProduction,
  smokeProductionWithRetry,
} from '../../scripts/smoke-production.mjs';
const sha = 'a'.repeat(40);
const fetcher =
  (commit = sha, missing = 404, assetType = 'text/javascript') =>
  async (input: Parameters<typeof fetch>[0]) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    if (path === '/deployment.json') return Response.json({ commit });
    if (path === '/lab/')
      return new Response(
        '<main><h1>Predicting profitability</h1><astro-island component-url="/_astro/lab.js"><link href="/_astro/site.css"></main>',
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

it('waits for the expected public release without accepting the stale commit', async () => {
  const wait = vi.fn().mockResolvedValue(undefined);
  const report = vi.fn();
  let provenanceRequests = 0;
  const stale = 'b'.repeat(40);
  const request = async (input: Parameters<typeof fetch>[0]) => {
    if (
      new URL(input instanceof Request ? input.url : input).pathname ===
      '/deployment.json'
    ) {
      provenanceRequests++;
      return Response.json({ commit: provenanceRequests < 4 ? stale : sha });
    }
    return fetcher()(input);
  };
  await expect(
    smokeProductionWithRetry('https://example.test', sha, {
      fetcher: request,
      wait,
      report,
    }),
  ).resolves.toEqual({ commit: sha, assets: 2, lab: 200, unknown: 404 });
  expect(wait).toHaveBeenCalledTimes(3);
  expect(report.mock.calls[0][0]).toContain(
    `expected ${sha}, received ${stale}`,
  );
});
it('fails after the bounded readiness window if the wrong release persists', async () => {
  const wait = vi.fn().mockResolvedValue(undefined);
  const report = vi.fn();
  await expect(
    smokeProductionWithRetry('https://example.test', sha, {
      fetcher: fetcher('b'.repeat(40)),
      wait,
      report,
    }),
  ).rejects.toThrow(`expected ${sha}, received ${'b'.repeat(40)}`);
  expect(report).toHaveBeenCalledTimes(12);
  expect(wait).toHaveBeenCalledTimes(11);
});
it('does not pass readiness when the commit is correct but asset checks fail', async () => {
  await expect(
    smokeProductionWithRetry('https://example.test', sha, {
      fetcher: fetcher(sha, 404, 'text/html'),
      wait: vi.fn().mockResolvedValue(undefined),
      report: vi.fn(),
    }),
  ).rejects.toThrow('Invalid static asset');
});
