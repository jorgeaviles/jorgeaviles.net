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
  if (
    provenance.status !== 200 ||
    (await provenance.json()).commit !== expectedCommit
  )
    throw new Error('Deployed commit mismatch');
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
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(
        JSON.stringify(
          await smokeProduction(
            'https://jorgeaviles.net',
            process.env.GITHUB_SHA,
          ),
        ),
      );
      failure = null;
      break;
    } catch (error) {
      failure = error;
      if (attempt < 2)
        await new Promise((resolve) => globalThis.setTimeout(resolve, 5000));
    }
  }
  if (failure) throw failure;
}
