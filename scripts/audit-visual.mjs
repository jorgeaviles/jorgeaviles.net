/* global document, scrollTo, innerWidth */
import { chromium, webkit } from '@playwright/test';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// Run against a separately built and served site. Evidence stays outside source control.
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = args.url ?? 'http://127.0.0.1:4334';
const dist = args.dist ?? 'dist';
const out = args.out ?? '.local/site-d3/after';
await mkdir(out, { recursive: true });
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();
}
const routes = [];
const redirects = [];
for (const file of (await files(dist))
  .filter((f) => f.endsWith('.html'))
  .sort()) {
  const route = '/' + relative(dist, file).replace(/index\.html$/, '');
  // Redirect documents have no page composition; navigation tests cover them.
  const html = await readFile(file, 'utf8');
  if (/<meta\s+http-equiv="refresh"/i.test(html)) redirects.push(route);
  else routes.push(route);
}
const widths = [320, 390, 430, 768, 1024, 1280, 1440];
const captures = [];
const legacy = [
  'lab-intro',
  'synthetic-label',
  'lab-panel',
  'lab-control',
  'lab-metrics',
  'lab-metric',
  'lab-table-wrap',
  'lab-record-id',
  'lab-explanation',
];
for (const [engine, launcher] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await launcher.launch();
  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    async function capture(route, state) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => {
            i.loading = 'eager';
            return i.decode().catch(() => {});
          }),
        );
        scrollTo(0, 0);
      });
      await page.setViewportSize({
        width,
        height: await page.evaluate(() =>
          Math.max(1000, document.documentElement.scrollHeight),
        ),
      });
      const name = `${engine}-${width}-${route.replace(/[^a-z0-9]/gi, '_')}-${state}.png`;
      const png = await page.screenshot({
        path: join(out, name),
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });
      const metrics = await page.evaluate(
        (legacyClasses) => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          h1: document.querySelectorAll('main h1').length,
          skipHidden:
            document.querySelector('.skip-link').getBoundingClientRect()
              .bottom <= 0,
          legacy: legacyClasses.filter(
            (c) => document.getElementsByClassName(c).length,
          ),
          feedback: document.querySelector('.training-feedback')?.textContent,
          parameters: [
            ...document.querySelectorAll('.ranch-parameters dd'),
          ].map((e) => e.textContent),
          loss: document
            .querySelector('.loss-history svg')
            ?.getAttribute('aria-label'),
          field: [
            ...document.querySelectorAll(
              '[data-testid="probability-field"] rect',
            ),
          ].map((e) => e.getAttribute('data-probability')),
          metrics: [
            ...document.querySelectorAll(
              '[data-testid="validation-mean"], [data-testid="fold-result"], [data-testid="final-result"]',
            ),
          ].map((e) => e.textContent),
          table: [...document.querySelectorAll('.ranch-confusion dd')].map(
            (e) => e.textContent,
          ),
        }),
        legacy,
      );
      captures.push({
        name,
        engine,
        width,
        route,
        state,
        sha256: createHash('sha256').update(png).digest('hex'),
        ...metrics,
      });
      await page.setViewportSize({ width, height: 1000 });
    }
    for (const route of routes) {
      await page.goto(base + route);
      if (route === '/lab/')
        await page.waitForFunction(
          () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
        );
      await capture(route, 'initial');
    }
    await page.goto(base + '/lab/');
    await page.waitForFunction(
      () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
    );
    for (const [index, lesson] of [
      'Predict profit',
      'Profitability',
    ].entries()) {
      await page.getByRole('link', { name: lesson, exact: true }).click();
      await capture('/lab/', `${index}-fitted`);
      await page
        .getByRole('slider', { name: /Cattle sold annually/ })
        .fill('400');
      if (index === 1)
        await page
          .getByRole('slider', { name: /Feed cost per animal/ })
          .fill('1300');
      await capture('/lab/', `${index}-adjusted`);
      await page.getByText('Explore model training', { exact: true }).click();
      await capture('/lab/', `${index}-training-expanded`);
      await page
        .getByRole('button', { name: 'Reset training', exact: true })
        .click();
      await capture('/lab/', `${index}-training-reset`);
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(
          (b) => b.textContent === 'Train one step',
        );
        for (let i = 0; i < 11; i++) button.click();
      });
      await page.waitForFunction(() =>
        document
          .querySelector('.training-feedback')
          ?.textContent.includes('Step 11 ·'),
      );
      await page
        .getByText(
          index === 0
            ? 'How the line is learned'
            : 'How probabilities are learned',
          { exact: true },
        )
        .click();
      await capture('/lab/', `${index}-trained-details`);
    }
    await page
      .getByRole('link', { name: 'Test predictions', exact: true })
      .click();
    await capture('/lab/', 'validation-before');
    await page
      .getByRole('button', { name: 'Run five-fold validation', exact: true })
      .click();
    await capture('/lab/', 'validation-results');
    await page.getByRole('button', { name: /Fold 4/ }).click();
    for (const title of [
      'Explore evaluation details',
      'Other ways to validate models',
    ])
      await page.getByText(title, { exact: true }).click();
    await capture('/lab/', 'validation-fold-details');
    await page
      .getByRole('button', { name: 'Test on unseen ranches', exact: true })
      .click();
    await capture('/lab/', 'final-test');
    await page.close();
  }
  await browser.close();
}
const css = await readFile(args.css ?? 'src/styles/global.css', 'utf8');
const inventory = {
  lines: css.split('\n').length,
  tokens: [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
    m[1],
    m[2].trim(),
  ]),
  colors: [...new Set(css.match(/#[\da-f]{3,8}\b/gi))],
  media: [...css.matchAll(/@media\s*([^{]+)/g)].map((m) => m[1].trim()),
  legacySelectors: legacy.filter((c) => css.includes('.' + c)),
};
let comparison;
if (args.reference) {
  const previous = JSON.parse(await readFile(args.reference, 'utf8'));
  comparison = captures
    .filter(
      (c) =>
        previous.captures.find((p) => p.name === c.name)?.sha256 !== c.sha256,
    )
    .map((c) => c.name);
}
await writeFile(
  join(out, 'manifest.json'),
  JSON.stringify(
    {
      routes,
      redirects,
      widths,
      inventory,
      captures,
      changedScreenshots: comparison,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    captures: captures.length,
    overflow: captures.filter((c) => c.overflow).map((c) => c.name),
    legacyRuntime: captures.filter((c) => c.legacy.length).map((c) => c.name),
    changedScreenshots: comparison,
  }),
);
if (
  captures.some(
    (c) => c.overflow || c.h1 !== 1 || !c.skipHidden || c.legacy.length,
  ) ||
  comparison?.length
)
  process.exitCode = 1;
