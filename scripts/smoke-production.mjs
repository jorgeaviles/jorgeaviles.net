/** Read-only edge verification. No credential or build step is involved. */
export async function smokeProduction(base, expectedCommit, fetcher = fetch) {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? ''))
    throw new Error('Expected a full commit SHA');
  const origin = new URL(base).origin;
  const get = async (path) => {
    const response = await fetcher(new URL(path, origin), {
      cache: 'no-store',
      signal: globalThis.AbortSignal.timeout(15000),
    });
    return response;
  };
  const provenance = await get('/deployment.json');
  const observed =
    provenance.status === 200 ? (await provenance.json()).commit : null;
  if (provenance.status !== 200 || observed !== expectedCommit)
    throw new Error(
      `Deployed commit mismatch: expected ${expectedCommit}, received ${observed ?? 'unavailable'} (HTTP ${provenance.status}; cache ${provenance.headers.get('cf-cache-status') ?? 'unknown'}).`,
    );
  const page = await get('/lab/');
  const html = await page.text();
  if (
    page.status !== 200 ||
    !page.headers.get('content-type')?.includes('text/html') ||
    !html.includes('Learn how models learn') ||
    !html.includes('<astro-island') ||
    !html.includes('<main')
  )
    throw new Error('Lab HTML is incomplete');
  const assets = new Set(
    Array.from(
      html.matchAll(/(?:src|href|component-url|renderer-url)="([^"#]+)"/g),
      (m) => m[1],
    ).filter(
      (p) =>
        p.startsWith('/_astro/') ||
        (/\.(?:svg|css|js)$/.test(p) && p.startsWith('/')),
    ),
  );
  if (
    ![...assets].some((p) => p.endsWith('.js')) ||
    ![...assets].some((p) => p.endsWith('.css'))
  )
    throw new Error('Lab asset references missing');
  for (const path of assets) {
    const response = await get(path);
    const type = response.headers.get('content-type') ?? '';
    const expected = path.endsWith('.css')
      ? /text\/css/
      : path.endsWith('.js')
        ? /(?:javascript|ecmascript)/
        : /image\/svg\+xml/;
    if (
      response.status !== 200 ||
      !expected.test(type) ||
      !(await response.text()).length
    )
      throw new Error(`Invalid static asset: ${path}`);
  }
  const missing = await get('/production-smoke-route-does-not-exist/');
  if (
    missing.status !== 404 ||
    !(await missing.text()).includes('A small detour.')
  )
    throw new Error('Custom 404 missing');
  return {
    commit: expectedCommit,
    assets: assets.size,
    lab: 200,
    unknown: 404,
  };
}
// Deployment completion can precede the public edge serving the new assets.
// Retry read-only checks, retaining the exact commit and all asset/404 assertions.
export async function smokeProductionWithRetry(
  base,
  expectedCommit,
  {
    fetcher = fetch,
    wait = (milliseconds) =>
      new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)),
    report = console.warn,
  } = {},
) {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      return await smokeProduction(base, expectedCommit, fetcher);
    } catch (error) {
      report(`Production check ${attempt}/12: ${error.message}`);
      if (attempt === 12) throw error;
      await wait(5000);
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  console.log(
    JSON.stringify(
      await smokeProductionWithRetry(
        'https://jorgeaviles.net',
        process.env.GITHUB_SHA,
      ),
    ),
  );
}
