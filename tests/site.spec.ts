import AxeBuilder from '@axe-core/playwright';
import {
  createLabState,
  labReducer,
  classificationScale,
} from '../src/lib/ml/experiment';
import { probabilityAt, fmt, pct } from '../src/lib/ml/presentation';
import { expect, test, type Page } from '@playwright/test';

const routes = [
  {
    path: '/',
    heading: 'Building data platforms and applications for analytical work.',
  },
  { path: '/about/', heading: 'Experience, education & approach.' },
  { path: '/work/', heading: 'Data, applications & machine learning.' },
  {
    path: '/work/analytical-data-platforms/',
    heading: 'Building an analytical data platform',
  },
  {
    path: '/work/analytical-applications/',
    heading: 'Designing an audit-tracking workspace',
  },
  {
    path: '/research/',
    heading: 'Research assistance & quantitative inquiry.',
  },
  {
    path: '/work/machine-learning-audit-prioritization/',
    heading: 'Developing machine-learning models for audit prioritization',
  },
  { path: '/lab/', heading: 'Learn how models learn' },
  { path: '/contact/', heading: 'Good work starts with a conversation.' },
  { path: '/colophon/', heading: 'A small site, built with care.' },
] as const;

function observeApplicationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    content: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

for (const route of routes) {
  test(`${route.path} loads, fits the viewport, and passes automated accessibility checks`, async ({
    page,
  }, testInfo) => {
    const errors = observeApplicationErrors(page);
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      route.heading,
    );
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    if (route.path === '/lab/') {
      await page
        .getByRole('navigation', { name: 'Lab lessons' })
        .scrollIntoViewIfNeeded();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('astro-island')).every(
          (island) => !island.hasAttribute('ssr'),
        ),
      );
    }
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    expect(errors).toEqual([]);
    if (route.path === '/') {
      const screenshot = testInfo.outputPath('home.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach('Home screenshot', {
        path: screenshot,
        contentType: 'image/png',
      });
    }
  });
}

test('navigation and case-study links reach their intended pages', async ({
  page,
}) => {
  const errors = observeApplicationErrors(page);
  await page.goto('/');
  for (const [label, path] of [
    ['About', '/about/'],
    ['Work', '/work/'],
    ['Research', '/research/'],
    ['Lab', '/lab/'],
    ['Contact', '/contact/'],
  ]) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page
    .getByRole('link', { name: 'Jorge Avilés, home', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole('link', { name: 'View technical case studies', exact: true })
    .click();
  for (const route of routes.filter(
    (item) => item.path.startsWith('/work/') && item.path !== '/work/',
  )) {
    await page
      .getByRole('link', { name: new RegExp(route.heading) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${route.path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      route.heading,
    );
    await page
      .getByRole('link', { name: 'All selected work', exact: false })
      .click();
    await expect(page).toHaveURL(/\/work\/$/);
  }
  expect(errors).toEqual([]);
});

test('contact links identify the approved destinations', async ({ page }) => {
  await page.goto('/contact/');
  const main = page.getByRole('main');
  await expect(
    main.getByRole('link', { name: 'Write an email' }),
  ).toHaveAttribute('href', 'mailto:jorge@jorgeaviles.net');
  await expect(main.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/jorgeaviles',
  );
  await expect(main.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/jraviles/',
  );
});

test('first-party page links resolve successfully', async ({
  page,
  request,
}) => {
  const links = new Set<string>();
  for (const route of routes) {
    await page.goto(route.path);
    const destinations = await page
      .locator('a[href]')
      .evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute('href') ?? '')
          .filter((href) => href.startsWith('/') && !href.startsWith('//')),
      );
    destinations.forEach((href) => links.add(href));
  }
  expect(links.size).toBeGreaterThan(5);
  for (const href of links) {
    const response = await request.get(href);
    expect(response.status(), `${href} returns a successful response`).toBe(
      200,
    );
  }
});

test('an unknown address returns HTTP 404 with useful navigation', async ({
  page,
}) => {
  const response = await page.goto('/this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A small detour.',
  );
  await expect(
    page.getByRole('link', { name: 'Back to home', exact: true }),
  ).toHaveAttribute('href', '/');
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page);
});

test('keyboard users can see focus and skip directly to the main content', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  const skipBounds = () =>
    page
      .locator('.skip-link')
      .evaluate((element) => element.getBoundingClientRect().bottom);
  expect(await skipBounds()).toBeLessThanOrEqual(0);
  // WebKit on macOS follows its platform preference: Option-Tab includes links.
  await page.keyboard.press(
    browserName === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab',
  );
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  const visibleFocus = await skip.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return (
      (style.outlineStyle !== 'none' &&
        Number.parseFloat(style.outlineWidth) > 0) ||
      style.boxShadow !== 'none'
    );
  });
  expect(visibleFocus).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL(/#main$/);
  expect(await skipBounds()).toBeLessThanOrEqual(0);
});

test('learning journeys train models and evaluate model-generated rankings', async ({
  page,
}, testInfo) => {
  const errors = observeApplicationErrors(page);
  await page.goto('/lab/');
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('astro-island')).every(
      (i) => !i.hasAttribute('ssr'),
    ),
  );
  const workspace = page.getByRole('region', {
    name: 'Machine learning workspace',
  });
  const before = (await workspace
    .locator('.training-feedback')
    .textContent())!.replace(/\s+/g, ' ');
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .press('Enter');
  await expect(workspace.locator('.training-feedback')).not.toHaveText(before);
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        (await page.locator('.training-feedback').textContent())!.match(
          /Step (\d+)/,
        )?.[1],
      ),
    )
    .toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(workspace.locator('.training-feedback')).toHaveText(before);
  await page.getByText('Explore parameters manually', { exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Weight 1', exact: true })
    .fill('0.3');
  await expect(
    page.getByRole('spinbutton', { name: 'Weight 1', exact: true }),
  ).toHaveValue('0.3');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page
    .getByRole('link', { name: '2 Logistic regression', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .click();
  await page.getByLabel('Show', { exact: true }).selectOption('validation');
  await page
    .getByRole('combobox', { name: 'Inspect example', exact: true })
    .selectOption('SYN-60');
  await page.getByText('Inspect the mathematics', { exact: true }).click();
  await expect(page.getByText(/Actual class:/)).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('link', { name: '3 Evaluation', exact: true }).click();
  const slider = page.getByRole('slider', {
    name: 'Review budget',
    exact: true,
  });
  await slider.fill('0');
  await expect(page.getByText('Undefined', { exact: true })).toBeVisible();
  await slider.press('End');
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(18);
  await slider.fill('6');
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(6);
  await page.getByLabel('Probability threshold', { exact: true }).check();
  await page.getByRole('slider', { name: 'Probability cutoff' }).fill('1');
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(0);
  await page.getByText('Inspect records', { exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
  const recordRegion = page.getByRole('region', {
    name: 'Validation records, scroll horizontally',
  });
  if (await recordRegion.evaluate((e) => e.scrollWidth > e.clientWidth)) {
    await recordRegion.focus();
    await recordRegion.press('ArrowRight');
    await expect
      .poll(() => recordRegion.evaluate((e) => e.scrollLeft))
      .toBeGreaterThan(0);
  }

  await page.getByText('Final test assessment', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Lock experiment and evaluate test' })
    .click();
  await expect(
    page.getByRole('slider', { name: 'Probability cutoff' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Reset experiment' }).click();
  await expect(
    page.getByRole('slider', { name: 'Review budget' }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('learning-lab.png'),
    fullPage: true,
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const route of routes) {
    test(`${route.path} retains readable core content`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        route.heading,
      );
      await expect(page.getByRole('main')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (route.path === '/work/analytical-data-platforms/') {
        await expect(
          page.getByRole('figure', { name: 'Conceptual analytical data flow' }),
        ).toBeVisible();
        await expect(page.locator('.analytical-flow figcaption')).toContainText(
          'Not a diagram of the internal production environment.',
        );
      }
      if (route.path === '/work/analytical-applications/') {
        await expect(
          page.getByRole('figure', { name: 'Conceptual record workflow' }),
        ).toBeVisible();
        await expect(
          page.locator('.case-study-workflow figcaption'),
        ).toContainText('Not a screenshot of the internal application.');
      }
      if (route.path === '/work/machine-learning-audit-prioritization/') {
        await expect(
          page.getByRole('figure', { name: 'Conceptual modeling process' }),
        ).toBeVisible();
        await expect(page.locator('article')).toContainText(
          'not a label for fraud',
        );
      }
      if (route.path === '/lab/') {
        const fallback = page.locator('noscript p');
        await expect(fallback).toContainText('JavaScript is disabled.');
        await expect(fallback).toBeVisible();
      }
    });
  }
});

test('independent histories and population inspection remain coherent without help prompts', async ({
  page,
}, testInfo) => {
  const errors = observeApplicationErrors(page);
  await page.goto('/lab/');
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
  );
  await expect(
    page.getByRole('button', { name: 'Help', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('note', { name: 'Lesson guidance' })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('Initial prediction: 0 minutes', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('lab-linear-initial.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .press('Enter');
  await expect(page.locator('.training-feedback')).toContainText(
    'since previous step',
  );
  const linearFeedback = (await page
    .locator('.training-feedback')
    .textContent())!.replace(/\s+/g, ' ');
  const trace = await page
    .getByRole('img', { name: /Loss history:/ })
    .getAttribute('aria-label');
  await page
    .getByRole('combobox', { name: 'Inspect example', exact: true })
    .selectOption('TASK-8');
  await page
    .getByRole('link', { name: '2 Logistic regression', exact: true })
    .click();
  await expect(page.getByText(/No unique 50% boundary:/)).toBeVisible();
  await expect(page.locator('.model-figure figcaption')).toContainText(
    '54 training examples',
  );
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(page.locator('.training-feedback')).not.toContainText('Step 0');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('decision-boundary')).toBeVisible();
  await page.getByText('Inspect the mathematics', { exact: true }).click();
  const weights = await page.getByText(/z = w · x/).innerText();
  await page.getByLabel('Show', { exact: true }).selectOption('validation');
  await expect(page.locator('.model-figure figcaption')).toContainText(
    '18 validation examples',
  );
  await expect(page.getByText(/z = w · x/)).toContainText(
    weights.split('The weighted score')[0],
  );
  await page
    .getByRole('combobox', { name: 'Inspect example', exact: true })
    .selectOption('SYN-60');
  await page.screenshot({
    path: testInfo.outputPath('lab-classifier-trained.png'),
    fullPage: true,
  });
  await page
    .getByRole('link', { name: '1 Linear regression', exact: true })
    .click();
  await expect(page.locator('.training-feedback')).toHaveText(linearFeedback);
  await expect(
    page.getByRole('img', { name: /Loss history:/ }),
  ).toHaveAttribute('aria-label', trace!);
  await expect(
    page.getByRole('combobox', { name: 'Inspect example', exact: true }),
  ).toHaveValue('TASK-8');
  await page.screenshot({
    path: testInfo.outputPath('lab-linear-trained.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: '3 Evaluation', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Inspect example', exact: true }),
  ).toHaveValue('SYN-60');
  const slider = page.getByRole('slider', {
    name: 'Review budget',
    exact: true,
  });
  await slider.fill('10');
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(10);
  await expect(page.locator('.ranked-strip [aria-pressed=true]')).toHaveCount(
    1,
  );
  // Read relative geometry in one frame so smooth scrolling cannot mix coordinate origins.
  const { metrics, control, strip } = await page.evaluate(() => ({
    metrics: document
      .querySelector('.essential-metrics')!
      .getBoundingClientRect()
      .toJSON(),
    control: document
      .querySelector('.learning-lab input[type="range"]')!
      .getBoundingClientRect()
      .toJSON(),
    strip: document
      .querySelector('.ranked-strip')!
      .getBoundingClientRect()
      .toJSON(),
  }));
  expect(metrics!.y - control!.y).toBeLessThan(110);
  expect(strip!.y - (metrics!.y + metrics!.height)).toBeLessThan(40);
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('lab-evaluation.png'),
    fullPage: true,
  });
  await page
    .getByRole('link', { name: '2 Logistic regression', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Inspect example', exact: true }),
  ).toHaveValue('SYN-60');
  await page.getByText('Inspect the mathematics', { exact: true }).click();
  await expect(page.getByText(/z = w · x/)).toContainText(
    weights.split('The weighted score')[0],
  );
});

test('lesson deep links explain an untrained ranking and off-window boundary', async ({
  page,
}) => {
  await page.goto('/lab/#evaluation');
  await page
    .getByRole('navigation', { name: 'Lab lessons' })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByText(/Untrained model: every score is 50%/),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Train the classifier', exact: true })
    .click();
  await expect(page).toHaveURL(/#logistic-regression$/);
  await page.getByText('Explore parameters manually', { exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Complexity weight', exact: true })
    .fill('1');
  await page.getByRole('spinbutton', { name: 'Bias', exact: true }).fill('100');
  await expect(
    page.getByText(/valid 50% boundary does not cross/),
  ).toBeVisible();
  await expect(page.getByTestId('decision-boundary')).toHaveCount(0);
  await page.getByRole('link', { name: '3 Evaluation', exact: true }).click();
  await expect(page.getByText(/Manual parameters: these scores/)).toBeVisible();
});

test('email text can be selected without launching a mail application', async ({
  page,
  isMobile,
}) => {
  await page.goto('/contact/');
  const email = page.locator('.contact-address');
  await expect(email).toHaveText('jorge@jorgeaviles.net');
  expect(await email.evaluate((el) => !!el.closest('a,button'))).toBe(false);
  const mailRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith('mailto:')) mailRequests.push(r.url());
  });
  await email.click();
  await expect(page).toHaveURL(/\/contact\/$/);
  if (!isMobile) {
    const box = await email.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    await page.mouse.move(box.x, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width, box.y + box.height / 2, {
      steps: 20,
    });
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      'jorge@jorgeaviles.net',
    );
  }
  await email.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
    'jorge@jorgeaviles.net',
  );
  expect(mailRequests).toEqual([]);
  await expect(
    page.getByRole('link', { name: 'Write an email' }),
  ).toHaveAttribute('href', 'mailto:jorge@jorgeaviles.net');
});

test('home contact invitation leads to contact choices', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Contact me' }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.locator('.contact-address')).toBeVisible();
});

test('approved case study stays consistent across listings and renders a static capability workflow', async ({
  page,
}, testInfo) => {
  const title = 'Designing an audit-tracking workspace';
  for (const route of ['/', '/work/']) {
    await page.goto(route);
    const link = page.getByRole('link', { name: new RegExp(title) });
    await expect(link).toHaveAttribute(
      'href',
      '/work/analytical-applications/',
    );
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
  await expect(
    page.getByText(
      'I am the sole hands-on developer across the analytical notebooks, data platform, and Audit Portal.',
      { exact: false },
    ),
  ).toBeVisible();
  const figure = page.getByRole('figure', {
    name: 'Conceptual record workflow',
  });
  await expect(figure.getByRole('heading', { level: 3 })).toHaveText([
    'Find records',
    'Review context',
    'Connect documents & analysis',
    'Save & trace changes',
  ]);
  await expect(figure).toContainText('server-side authorization');
  await expect(
    page.getByRole('region', { name: 'Project at a glance' }),
  ).toContainText('Blazor Interactive Server');
  await expect(
    page.getByRole('link', {
      name: 'FY2027 agency appropriations',
      exact: true,
    }),
  ).toHaveAttribute(
    'href',
    'https://malegislature.gov/Budget/FY2027/FinalBudget',
  );
  await expect(page.locator('article.prose')).toContainText(
    'approximately 10 staff users',
  );
  await expect(page.locator('article.prose')).toContainText(
    'not a count of portal users or a verified current active-panel count',
  );
  await expect(figure.locator('figcaption')).toHaveText(
    'Conceptual application workflow showing implemented capabilities. Not a screenshot of the internal application.',
  );
  await expect(page.locator('astro-island')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page);
  const screenshot = testInfo.outputPath('audit-tracker-case-study.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('Approved case study', {
    path: screenshot,
    contentType: 'image/png',
  });
});

test('data platform case study shares metadata and explains a static technology architecture', async ({
  page,
}, testInfo) => {
  const title = 'Building an analytical data platform';
  for (const route of ['/', '/work/']) {
    await page.goto(route);
    const link = page.getByRole('link', { name: new RegExp(title) });
    await expect(link).toHaveAttribute(
      'href',
      '/work/analytical-data-platforms/',
    );
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
  const figure = page.getByRole('figure', {
    name: 'Conceptual analytical data flow',
  });
  await expect(figure.getByRole('heading', { level: 3 })).toHaveText([
    'Source',
    'Prepare',
    'Serve',
    'Apply',
  ]);
  await expect(figure.locator('figcaption')).toHaveText(
    'Conceptual architecture using technology categories and responsibilities. Not a diagram of the internal production environment.',
  );
  await expect(figure).toContainText('Python / PySpark → Parquet');
  await expect(figure).toContainText(
    'Validated files → Synapse serverless SQL',
  );
  await expect(
    page.getByRole('region', { name: 'Project at a glance' }),
  ).toContainText('Sole hands-on developer');
  await expect(page.locator('article.prose')).toContainText(
    'This serverless access layer',
  );
  await expect(
    page.getByRole('link', { name: 'Synapse serverless SQL', exact: true }),
  ).toHaveAttribute(
    'href',
    'https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/on-demand-workspace-overview',
  );
  await expect(page.locator('astro-island')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page);
  const screenshot = testInfo.outputPath('data-platform-case-study.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('Data platform case study', {
    path: screenshot,
    contentType: 'image/png',
  });
});

test('recent technical work leads both listings and related navigation', async ({
  page,
}) => {
  const ordered = [
    '/work/analytical-applications/',
    '/work/analytical-data-platforms/',
    '/work/machine-learning-audit-prioritization/',
  ];
  for (const route of ['/', '/work/']) {
    await page.goto(route);
    expect(
      await page
        .locator('.work-row')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    ).toEqual(ordered);
  }
  await page.goto('/work/analytical-applications/');
  expect(
    await page
      .locator('.related-work a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(ordered.slice(1));
});

test('page metadata, canonical URLs, and identity remain coherent without third-party requests', async ({
  page,
  request,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      external.push(r.url());
  });
  for (const route of routes) {
    await page.goto(route.path);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description?.length).toBeGreaterThan(25);
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute('content', description!);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      await page.title(),
    );
    const canonical = `https://jorgeaviles.net${route.path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      canonical,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      canonical,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://jorgeaviles.net/social-preview.png',
    );
    const graph = JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    )['@graph'];
    expect(graph[0].name).toBe('Jorge Avilés');
    expect(graph[1].name).toBe('Jorge Avilés');
    await expect(page.locator('.wordmark')).toHaveAccessibleName(
      'Jorge Avilés, home',
    );
    await expect(page.locator('.wordmark')).toContainText('Jorge Avilés');
    await expect(page.locator('.site-footer')).toContainText('Jorge Avilés');
    await expect(page.locator('.copyright')).toContainText('Jorge Avilés');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      /^Jorge Avilés —/,
    );
    expect(graph[0].sameAs).toEqual([
      'https://github.com/jorgeaviles',
      'https://www.linkedin.com/in/jraviles/',
    ]);
    expect(graph[1].description).toContain('application development');
    if (route.path.startsWith('/work/') && route.path !== '/work/') {
      await expect(page).toHaveTitle(`${route.heading} — Jorge Avilés`);
    }
  }
  await page.goto('/');
  await expect(page.locator('.hero-main .eyebrow')).toContainText(
    'Jorge Avilés',
  );
  await expect(page.locator('.hero-description')).toContainText(
    'I’m a Senior Auditor Data Analyst',
  );
  await page.goto('/about/');
  await expect(page.locator('main')).toContainText(
    'Senior Auditor Data Analyst · June 2020–present',
  );
  for (const path of [
    '/work/analytical-applications/',
    '/work/analytical-data-platforms/',
    '/work/machine-learning-audit-prioritization/',
  ]) {
    await expect(
      page.locator(`article a[href="${path}"], .prose a[href="${path}"]`),
    ).toHaveCount(1);
  }
  await expect(page.locator('.prose')).toContainText(
    'grouped cross-validation',
  );
  await expect(page.locator('.prose')).toContainText(
    'modeling program remains experimental',
  );
  await expect(page.locator('.prose')).toContainText(
    'predictive-score integration into the Portal proposed',
  );
  await page.goto('/contact/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /^Get in touch with Jorge Avilés /,
  );
  await page.goto('/research/');
  await expect(page.locator('main')).toContainText('J. Avilés');
  await expect(page.locator('main')).toContainText('Anand N. Asthana');
  const social = await request.get('/social-preview.svg');
  expect(await social.text()).toContain('Jorge Avilés</text>');
  const png = await (await request.get('/social-preview.png')).body();
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  await page.goto('/lab/');
  await page
    .getByRole('navigation', { name: 'Lab lessons' })
    .scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('astro-island')).every(
      (island) => !island.hasAttribute('ssr'),
    ),
  );
  expect(external).toEqual([]);
  const sitemap = await request.get('/sitemap-0.xml');
  const xml = await sitemap.text();
  for (const route of routes)
    expect(xml).toContain(`https://jorgeaviles.net${route.path}`);
});

test('logistic landscape, parameters, loss and inspected task share actual training state', async ({
  page,
}) => {
  await page.goto('/lab/#logistic-regression');
  await page
    .getByRole('navigation', { name: 'Lab lessons' })
    .scrollIntoViewIfNeeded();
  await expect(page.getByTestId('probability-field')).toBeVisible();
  await expect(
    page.getByText('Lower estimated probability', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Higher estimated probability', { exact: true }),
  ).toBeVisible();
  const cells = page.getByTestId('probability-field').locator('rect');
  let state = labReducer(createLabState(), { type: 'navigate', lesson: 1 });
  let previousStep = 0;
  for (const steps of [0, 1, 11, 100]) {
    for (let i = previousStep; i < steps; i++) {
      await page
        .getByRole('button', { name: 'Train one step', exact: true })
        .click();
      state = labReducer(state, { type: 'step' });
    }
    const experiment = state.logistic;
    await expect(page.locator('.training-feedback')).toContainText(
      `Step ${steps} · Log loss ${fmt(experiment.history.at(-1)!.loss)}`,
    );
    await expect(page.locator('.learned-parameters dd')).toHaveText(
      [...experiment.model.w, experiment.model.b].map(fmt),
    );
    await expect(cells).toHaveCount(625);
    for (const index of [0, 150, 312, 624]) {
      const cell = cells.nth(index),
        x = Number(await cell.getAttribute('data-x')),
        y = Number(await cell.getAttribute('data-y'));
      expect(Number(await cell.getAttribute('data-probability'))).toBeCloseTo(
        probabilityAt(experiment.model, classificationScale, x, y),
        12,
      );
    }
    const selectedProbability = Number(
      await page
        .locator('.plot-point[data-record-id="SYN-01"]')
        .getAttribute('data-probability'),
    );
    await expect(page.getByTestId('selected-probability')).toHaveText(
      pct(selectedProbability),
    );
    if (steps === 0) {
      expect(
        await cells.evaluateAll((rects) => [
          ...new Set(rects.map((r) => r.getAttribute('data-probability'))),
        ]),
      ).toEqual(['0.5']);
      await expect(page.getByTestId('decision-boundary')).toHaveCount(0);
      await expect(page.locator('.training-feedback')).toContainText(
        'Model not trained',
      );
    } else {
      await expect(page.getByTestId('decision-boundary')).toBeVisible();
      const delta =
        experiment.history.at(-1)!.loss - experiment.history.at(-2)!.loss;
      await expect(page.locator('.training-feedback')).toContainText(
        `↓ ${fmt(Math.abs(delta))} since previous step`,
      );
    }
    previousStep = steps;
  }
  await expect(page.locator('.model-figure')).toContainText(
    'Task complexity (0–10)',
  );
  await expect(page.locator('.model-figure')).toContainText(
    'Information uncertainty (0–10)',
  );
  await expect(
    page.getByRole('button', { name: 'Help', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Try this', { exact: true })).toHaveCount(0);
  await page.locator('.plot-point[data-record-id="SYN-03"]').click();
  await expect(
    page.getByRole('combobox', { name: 'Inspect example', exact: true }),
  ).toHaveValue('SYN-03');
  await expect(
    page.locator('.plot-point[data-record-id="SYN-03"] circle[r="11"]'),
  ).toHaveCount(1);
  await page
    .getByRole('combobox', { name: 'Inspect example', exact: true })
    .selectOption('SYN-02');
  const selectedProbability = Number(
    await page
      .locator('.plot-point[data-record-id="SYN-02"]')
      .getAttribute('data-probability'),
  );
  await expect(page.getByTestId('selected-probability')).toHaveText(
    pct(selectedProbability),
  );
  const before = await cells.evaluateAll((rects) =>
    rects.map((r) => r.getAttribute('data-probability')),
  );
  await page.getByLabel('Show', { exact: true }).selectOption('validation');
  await expect(page.locator('.plot-point')).toHaveCount(18);
  expect(
    await cells.evaluateAll((rects) =>
      rects.map((r) => r.getAttribute('data-probability')),
    ),
  ).toEqual(before);
  await page.getByRole('link', { name: '3 Evaluation', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Help', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('radio', { name: 'Probability threshold', exact: true })
    .check();
  await page
    .getByRole('slider', { name: 'Probability cutoff', exact: true })
    .fill('0.8');
  await page
    .getByRole('link', { name: '2 Logistic regression', exact: true })
    .click();
  expect(
    await cells.evaluateAll((rects) =>
      rects.map((r) => r.getAttribute('data-probability')),
    ),
  ).toEqual(before);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(
    await cells.evaluateAll((rects) => [
      ...new Set(rects.map((r) => r.getAttribute('data-probability'))),
    ]),
  ).toEqual(['0.5']);
  await page.getByText('Explore parameters manually', { exact: true }).click();
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Complexity weight', exact: true })
    .fill('1');
  await expect(
    page.getByRole('button', { name: 'Train', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.training-feedback')).toContainText(
    'Manual parameters · new baseline',
  );
  await expect(page.locator('.learned-parameters dd').first()).toHaveText(
    '1.000',
  );
  expect(
    new Set(
      await cells.evaluateAll((rects) =>
        rects.map((r) => r.getAttribute('data-probability')),
      ),
    ).size,
  ).toBeGreaterThan(1);
  await expectNoHorizontalOverflow(page);
});

test('recruiter, engineering, and admissions paths expose evidence without ambiguous links', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.hero-description')).toContainText(
    'Senior Auditor Data Analyst',
  );
  await page
    .getByRole('link', { name: 'Experience & education', exact: true })
    .click();
  await expect(page.locator('main')).toContainText('June 2020–present');
  await expect(page.locator('main')).toContainText(
    'Change Management Business Analyst',
  );
  await expect(page.locator('#education')).toContainText('2011');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Contact', exact: true })
    .click();
  await expect(page.locator('.contact-address')).toHaveText(
    'jorge@jorgeaviles.net',
  );
  await page.goto('/');
  await page.locator('.work-row').first().click();
  await expect(
    page.getByRole('region', { name: 'Project at a glance' }),
  ).toContainText('Server-side authorization');
  await expect(page.locator('article')).toContainText('Version-aware writes');
  await page
    .locator('.related-work a[href="/work/analytical-data-platforms/"]')
    .click();
  await expect(page.locator('article')).toContainText('Engineering decisions');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Research', exact: true })
    .click();
  await expect(page.locator('main')).toContainText('Asthana');
  await expect(page.locator('.research-entry')).toContainText(
    'research assistance',
  );
  await expect(page.locator('.research-note')).toHaveCount(0);
  await page
    .locator('.research-context')
    .getByRole('link', { name: 'machine-learning lab', exact: true })
    .click();
  await expect(page.locator('.lab-page-intro')).toContainText(
    'separate from my professional case studies',
  );
});

test('professional modeling explains the target, evaluation, and proposed integration without production claims', async ({
  page,
}) => {
  await page.goto('/research/');
  await page
    .getByRole('link', {
      name: 'audit-prioritization modeling case study',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    /\/work\/machine-learning-audit-prioritization\/$/,
  );
  const article = page.locator('article.prose');
  await expect(
    page.getByRole('region', { name: 'Project at a glance' }),
  ).toContainText('Experimental modeling program');
  await expect(
    page.getByRole('region', { name: 'Project at a glance' }),
  ).toContainText('integration into the Audit Portal is proposed');
  await expect(article).toContainText('not a label for fraud');
  await expect(article).toContainText('rather than a measured model ranking');
  for (const boundary of [
    'a recorded zero counts as positive',
    'ten folds grouped by BBO',
    'pandas supports fold-metric summaries',
    'Completed evaluation is unverified',
    'exports contain no execution outputs',
    'label-name mismatch',
    'not an estimate of recoverable funds',
  ]) {
    await expect(article).toContainText(boundary);
  }
  const candidates = article.getByRole('table');
  await expect(candidates.getByRole('row')).toHaveCount(6);
  await expect(
    candidates.getByRole('row').filter({ hasText: 'CatBoost' }),
  ).toContainText('disabled');

  for (const method of [
    'logistic regression',
    'Random Forest',
    'Gradient-boosted trees',
    'LightGBM',
    'ROC AUC',
    'Brier score',
    'Platt calibration',
    'Precision at a fixed review capacity',
    'Drift diagnostics',
  ]) {
    await expect(article).toContainText(method);
  }
  await expect(
    page
      .getByRole('figure', { name: 'Conceptual modeling process' })
      .getByRole('heading', { level: 3 }),
  ).toHaveText([
    'Define the target',
    'Prepare features',
    'Fit candidates',
    'Validate & calibrate',
    'Score & investigate',
  ]);
  await expect(article).toContainText('Predictive-score integration');
  await expect(article).toContainText(
    'Review, validation, and approval are required before operational use',
  );
  await expect(
    article.getByRole('link', { name: 'educational ML Lab', exact: true }),
  ).toHaveAttribute('href', '/lab/');
  await expect(page.locator('astro-island')).toHaveCount(0);
  await article
    .getByRole('link', { name: 'Audit Portal', exact: true })
    .click();
  await expect(page.locator('article')).toContainText(
    'Predictive-score integration',
  );
  await page
    .locator('article')
    .getByRole('link', { name: 'machine-learning program', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Developing machine-learning models for audit prioritization',
  );
});

test('research methods retain named authorship and acknowledged assistance', async ({
  page,
}) => {
  await page.goto('/research/');
  const entry = page.locator('.research-entry');
  await expect(entry).toContainText('J. Avilés');
  await expect(entry).toContainText('Anand N. Asthana');
  await expect(entry).toContainText('randomized ten-fold cross-validation');
  await expect(entry).toContainText('study by Anand N. Asthana');
  await expect(entry).toContainText('acknowledged as J. Avilés on page 478');
  await expect(page.locator('main')).toContainText(
    'April 2012 to September 2014',
  );
  await expect(entry).not.toContainText('does not establish');
  await expectNoHorizontalOverflow(page);
});

test('About distinguishes academic education from compact technical coursework and provides a keyboard-accessible credential', async ({
  page,
  browserName,
}) => {
  await page.goto('/about/');
  const education = page.getByRole('region', {
    name: 'Education & Professional Development',
    exact: true,
  });
  await expect(education).toHaveAttribute('id', 'education');
  await expect(education.locator('.education-intro')).toContainText(
    'My education in economics has been complemented by continuing technical coursework',
  );
  await expect(education.getByRole('heading', { level: 3 })).toHaveText([
    'Academic Education',
    'Selected Technical Coursework',
  ]);
  const academic = education.getByRole('region', {
    name: 'Academic Education',
    exact: true,
  });
  await expect(academic).toContainText('Bachelor of Arts in Economics');
  await expect(academic).toContainText('Suffolk University');
  await expect(academic.locator('.university-name')).toHaveCSS(
    'font-size',
    '26px',
  );
  await expect(academic.locator('.university-name p')).toHaveCount(0);
  await expect(academic).toContainText('Boston, Massachusetts');
  await expect(academic.locator('time')).toHaveAttribute('datetime', '2011');
  const coursework = education.getByRole('region', {
    name: 'Selected Technical Coursework',
    exact: true,
  });
  await expect(coursework.locator('time')).toHaveText([
    '2015',
    '2024',
    '2024',
    '2024',
    '2024',
    '2020',
  ]);
  for (const title of [
    'Introduction to R Programming (DAT204x)',
    'Intermediate Python',
    'Developing Python Packages',
    'Joining Data with pandas',
    'Data Manipulation with pandas',
    'Introduction to Python',
  ]) {
    await expect(coursework.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(coursework).toContainText('Microsoft ·');
  await expect(coursework.getByAltText('edX')).toBeVisible();
  await expect(coursework).toContainText('edX Honor Code Certificate');
  await expect(coursework).toContainText('DataCamp');
  const credential = coursework.getByRole('link', {
    name: /Introduction to R Programming \(DAT204x\)/,
  });
  await expect(credential).toHaveAttribute(
    'href',
    'https://verify.edx.org/cert/687402c185b84079a0fd00be4cd1a40a',
  );
  const accomplishments = [
    ['Developing Python Packages', 'fd798f0e03cdecc2e81e24371c2beb9e5bda853c'],
    ['Joining Data with pandas', '13aadd1963844af79b33a370d820be64dc4c094f'],
    [
      'Data Manipulation with pandas',
      '49278034a38c29b47828bad234e00500d571ddd0',
    ],
    ['Intermediate Python', 'c073b50b12424055585ca2e578d0930040f8f746'],
  ];
  await expect(coursework).toContainText('Statements of Accomplishment');
  await expect(coursework.getByRole('link')).toHaveCount(8);
  await expect(
    coursework.locator(
      'a[href*="statement-of-accomplishment"], a[href*="verify.edx.org"]',
    ),
  ).toHaveCount(6);
  const provider = coursework.getByRole('link', {
    name: 'Visit DataCamp platform',
    exact: true,
  });
  await expect(provider).toHaveAttribute('href', 'https://www.datacamp.com/');
  await expect(provider.locator('img')).toHaveAttribute(
    'src',
    '/brands/datacamp.svg',
  );
  await expect(provider.locator('img')).toHaveAttribute('alt', '');
  await expect(coursework.locator('.course-grid h4')).toHaveText([
    ...accomplishments.map(([title]) => title),
    'Introduction to Python',
  ]);
  const completionDates: Record<string, string> = {
    'Developing Python Packages': '2024-06-18',
    'Joining Data with pandas': '2024-07-15',
    'Data Manipulation with pandas': '2024-06-17',
    'Intermediate Python': '2024-05-31',
  };
  for (const [title, id] of accomplishments) {
    const entry = coursework.locator('.course-grid > li').filter({
      has: page.getByRole('heading', { name: title, exact: true }),
    });
    const link = entry.getByRole('link', {
      name: new RegExp(title),
      exact: true,
    });
    await expect(link).toHaveAttribute(
      'href',
      `https://www.datacamp.com/completed/statement-of-accomplishment/course/${id}`,
    );
    await expect(entry.getByRole('link')).toHaveCount(1);
    await expect(entry.locator('time')).toHaveAttribute(
      'datetime',
      completionDates[title],
    );
    await expect(entry.locator('time')).toHaveText('2024');
  }
  const introduction = coursework
    .locator('.course-grid > li')
    .filter({ hasText: 'Introduction to Python' });
  const introductoryCredential = introduction.getByRole('link', {
    name: /Introduction to Python/,
    exact: true,
  });
  await expect(introductoryCredential).toHaveAttribute(
    'href',
    'https://www.datacamp.com/completed/statement-of-accomplishment/course/80c41f1670973091fd734aef396c78c6a848472f',
  );
  await expect(introduction.getByRole('link')).toHaveCount(1);
  await expect(introduction.locator('time')).toHaveAttribute(
    'datetime',
    '2020-06-28',
  );
  await expect(education).not.toContainText('Professional Certifications');
  // Reach every credential through sequential keyboard navigation.
  for (const link of [
    academic.getByRole('link'),
    coursework.getByRole('link', { name: 'Visit edX platform' }),
    credential,
    provider,
    ...accomplishments.map(([title]) =>
      coursework.getByRole('link', {
        name: new RegExp(title),
        exact: true,
      }),
    ),
    introductoryCredential,
  ]) {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(
        browserName === 'webkit' && process.platform === 'darwin'
          ? 'Alt+Tab'
          : 'Tab',
      );
      if (await link.evaluate((element) => document.activeElement === element))
        break;
    }
    await expect(link).toBeFocused();
    const outline = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline).toEqual({ style: 'solid', width: '2px' });
  }
  const geometry = await coursework
    .locator('.course-grid')
    .evaluate((grid) => ({
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      width: grid.getBoundingClientRect().width,
      containerWidth: grid.parentElement!.getBoundingClientRect().width,
      tiles: [...grid.querySelectorAll('a')].map((tile) => ({
        height: tile.getBoundingClientRect().height,
        width: tile.getBoundingClientRect().width,
      })),
    }));
  expect(geometry.tiles).toHaveLength(5);
  expect(geometry.columns).toBe(geometry.containerWidth > 520 ? 2 : 1);
  expect(
    Math.max(...geometry.tiles.map((tile) => tile.height)) -
      Math.min(...geometry.tiles.map((tile) => tile.height)),
  ).toBeLessThan(1);
  expect(geometry.tiles[4].width).toBeCloseTo(geometry.width, 0);
  await expect(coursework.locator('a a')).toHaveCount(0);
  await expect(education.locator('img')).toHaveCount(2);
  await expect(education.locator('svg')).toHaveCount(0);
  for (const entry of await coursework.locator('.credential-link').all()) {
    await expect(entry).toHaveCSS('padding', '0px');
    await expect(entry).toHaveCSS('border-width', '0px');
    await expect(entry.locator('h4')).toHaveCSS(
      'text-decoration-line',
      'underline',
    );
  }
  await expect(academic.locator('.credential-entry a')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  const placement = await page.evaluate(() => {
    const experience = document.querySelector('.editorial-grid')!;
    const educationSection = document.querySelector('#education')!;
    return !!(
      experience.compareDocumentPosition(educationSection) &
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
  expect(placement).toBe(true);
  await page.route('https://www.datacamp.com/completed/**', (route) =>
    route.fulfill({ body: 'Credential navigation test' }),
  );
  await coursework
    .locator('.course-grid .credential-link')
    .first()
    .click({ position: { x: 6, y: 6 } });
  await expect(page).toHaveURL(
    'https://www.datacamp.com/completed/statement-of-accomplishment/course/fd798f0e03cdecc2e81e24371c2beb9e5bda853c',
  );
});

test('education course columns follow the available container width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/about/');
  const group = page.locator('.datacamp-group');
  for (const width of [519, 520, 521, 600]) {
    await group.evaluate((element, size) => {
      (element as HTMLElement).style.width = `${size}px`;
    }, width);
    const columns = await group
      .locator('.course-grid')
      .evaluate(
        (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      );
    expect(columns).toBe(width > 520 ? 2 : 1);
  }
});

test('editorial reading width stays stable around layout breakpoints', async ({
  page,
}) => {
  await page.goto('/about/');
  let previous = 0;
  for (const width of [
    320, 390, 639, 640, 641, 768, 999, 1000, 1001, 1024, 1099, 1100, 1101, 1280,
    1440,
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    const measure = await page
      .locator('.editorial-grid .prose')
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(measure).toBeGreaterThanOrEqual(previous - 1);
    expect(measure).toBeLessThanOrEqual(691);
    previous = measure;
    const headings = await page
      .locator('.major-sections h2, #education h2, .capabilities h2')
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).fontSize),
      );
    expect(new Set(headings).size).toBe(1);
    await expectNoHorizontalOverflow(page);
  }
  const headings = await page
    .locator('.major-sections h2, #education h2, .capabilities h2')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).fontSize),
    );
  expect(new Set(headings).size).toBe(1);
});

test('Work titles use contextual heading levels without changing their visual role', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.work-list h3.work-title')).toHaveCount(3);
  const size = await page
    .locator('.work-title')
    .first()
    .evaluate((element) => getComputedStyle(element).fontSize);
  await page.goto('/work/');
  await expect(page.locator('.work-list h2.work-title')).toHaveCount(3);
  await expect(page.locator('.work-list h3')).toHaveCount(0);
  await expect(page.locator('.work-title').first()).toHaveCSS(
    'font-size',
    size,
  );
});

test('article comparison preserves table relationships and readable narrow records', async ({
  page,
}) => {
  await page.goto('/work/machine-learning-audit-prioritization/');
  const table = page.getByRole('table', { name: 'Model candidate comparison' });
  await expect(table.getByRole('columnheader')).toHaveText([
    'Candidate',
    'Framework',
    'Implementation and configuration',
  ]);
  await expect(table.getByRole('rowheader')).toHaveCount(5);
  for (const width of [320, 390, 760, 761, 768, 1101, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoHorizontalOverflow(page);
    await expect(table.locator('td').first()).toHaveCSS(
      'vertical-align',
      'top',
    );
    await expect(table.locator('tbody tr').first()).toHaveCSS(
      'display',
      width <= 760 ? 'block' : 'table-row',
    );
    const cells = await table
      .locator('tbody tr')
      .first()
      .locator('th, td')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().toJSON()),
      );
    if (width <= 760) {
      const tableWidth = await table.evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      for (const cell of cells)
        expect(cell.width).toBeGreaterThanOrEqual(tableWidth - 1);
      expect(cells[1].top).toBeGreaterThan(cells[0].bottom);
      expect(cells[2].top).toBeGreaterThan(cells[1].bottom);
    } else {
      expect(cells[0].top).toBe(cells[2].top);
      await expect(table.locator('td').first()).toHaveCSS(
        'padding-top',
        '12px',
      );
    }
  }
  await expectAccessible(page);
});

test('About connects experience to capabilities before supporting education', async ({
  page,
}) => {
  await page.goto('/about/');
  await expect(page.locator('main h2')).toHaveText([
    'Professional experience',
    'How I work',
    'Different tools. A shared purpose.',
    'Education & Professional Development',
  ]);
  const employer = page.getByRole('region', {
    name: 'Committee for Public Counsel Services',
    exact: true,
  });
  await expect(employer.locator(':scope > ul > li')).toHaveCount(2);
  await expect(employer).toContainText(
    'The data platform and Audit Portal support analytical and operational workflows.',
  );
  await expect(employer).toContainText(
    'predictive-score integration into the Portal proposed for future evaluation and approval.',
  );
  await expect(employer).toContainText(
    'Audit & Oversight colleagues contribute firsthand knowledge',
  );
  const links = page.getByRole('navigation', { name: 'CPCS case studies' });
  await expect(links.getByRole('link')).toHaveText([
    'Audit Portal case study',
    'Analytical data platform case study',
    'Machine-learning case study',
  ]);
  for (const [index, path] of [
    '/work/analytical-applications/',
    '/work/analytical-data-platforms/',
    '/work/machine-learning-audit-prioritization/',
  ].entries()) {
    await expect(links.getByRole('link').nth(index)).toHaveAttribute(
      'href',
      path,
    );
  }
  expect(
    await employer.evaluate((element) => {
      const status = [...element.querySelectorAll('p')].find((paragraph) =>
        paragraph.textContent?.startsWith('The data platform and Audit Portal'),
      )!;
      return Boolean(
        status.compareDocumentPosition(element.querySelector('nav')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
  await expect(
    page
      .getByRole('region', { name: 'Santander Bank, N.A.', exact: true })
      .locator('.experience-roles > li'),
  ).toHaveText([
    'Change Management Business Analyst · October 2018–June 2020',
    'Retail Operations Database Analyst · March 2017–October 2018',
    'Operations Data Quality Specialist · March 2015–March 2017',
  ]);
  await expect(
    page.getByRole('region', {
      name: 'CENTRUM Católica Graduate Business School',
      exact: true,
    }),
  ).toContainText('Graduate Research Assistant · April 2012–September 2014');
  await expectAccessible(page);
});

test('About reflows with text enlarged to 200 percent', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/about/');
  const originalTitleSize = await page
    .locator('main h1')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  // Controlled text-only enlargement; this does not claim native browser zoom.
  await page.locator('main').evaluate((main) => {
    const textElements = [...main.querySelectorAll<HTMLElement>('*')].filter(
      (element) =>
        [...element.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        ),
    );
    const sizes = textElements.map((element) => ({
      font: parseFloat(getComputedStyle(element).fontSize),
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    textElements.forEach((element, index) => {
      element.style.fontSize = `${sizes[index].font * 2}px`;
      if (Number.isFinite(sizes[index].line))
        element.style.lineHeight = `${sizes[index].line * 2}px`;
    });
  });
  expect(
    await page
      .locator('main h1')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeCloseTo(originalTitleSize * 2, 1);
  await expectNoHorizontalOverflow(page);
  await expect(
    page
      .getByRole('navigation', { name: 'CPCS case studies' })
      .getByRole('link'),
  ).toHaveCount(3);
  const clipped = await page
    .locator('main')
    .evaluate((main) =>
      [...main.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, li, time')]
        .filter(
          (element) =>
            ['hidden', 'clip'].includes(getComputedStyle(element).overflowY) &&
            element.scrollHeight > element.clientHeight + 1,
        )
        .map((element) => element.textContent),
    );
  expect(clipped).toEqual([]);
  if (['chromium-desktop', 'webkit-desktop'].includes(testInfo.project.name)) {
    await testInfo.attach('about-text-200-percent', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }
});

test('About full-page composition review captures', async ({
  page,
}, testInfo) => {
  test.skip(
    !['chromium-desktop', 'webkit-desktop'].includes(testInfo.project.name),
    'One desktop context per engine captures the six review widths.',
  );
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/about/');
    await page.locator('img').evaluateAll((images) =>
      Promise.all(
        images.map((image) => {
          const img = image as HTMLImageElement;
          img.loading = 'eager';
          return img.decode();
        }),
      ),
    );
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({
      width,
      height: await page.evaluate(() =>
        Math.max(1000, document.documentElement.scrollHeight),
      ),
    });
    await page.evaluate(() => scrollTo(0, 0));
    await testInfo.attach(`about-B-proposed-order-${width}`, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
    // Compare the current order with the same content refinements, isolating composition.
    await page.evaluate(() =>
      document
        .querySelector('#education')!
        .after(document.querySelector('.capabilities')!),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await testInfo.attach(`about-A-current-order-${width}`, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});

test('Lab training controls and inspector use the available workspace width', async ({
  page,
}) => {
  await page.goto('/lab/');
  await page.locator('.lesson-nav').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
  );
  const training = page.getByRole('group', {
    name: 'Model training',
    exact: true,
  });
  await expect(training.getByRole('button')).toHaveCount(3);
  await expect(training.getByRole('status')).toContainText('Step 0');
  for (const width of [
    320, 390, 430, 480, 481, 699, 700, 800, 801, 999, 1000, 1001, 1280, 1440,
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await page.evaluate(() => ({
      links: [...document.querySelectorAll('.lesson-nav a')].map((element) =>
        element.getBoundingClientRect().toJSON(),
      ),
      buttons: [...document.querySelectorAll('.ml-actions button')].map(
        (element) => element.getBoundingClientRect().toJSON(),
      ),
      columns: getComputedStyle(
        document.querySelector('.ml-workspace')!,
      ).gridTemplateColumns.split(' ').length,
      primary: document
        .querySelector('.ml-primary')!
        .getBoundingClientRect()
        .toJSON(),
      controls: document
        .querySelector('.ml-controls')!
        .getBoundingClientRect()
        .toJSON(),
      rate: document
        .querySelector('.ml-controls select')!
        .getBoundingClientRect()
        .toJSON(),
      loss: document
        .querySelector('.loss-history')!
        .getBoundingClientRect()
        .toJSON(),
      advanced: document
        .querySelector('.parameter-explorer')!
        .getBoundingClientRect()
        .toJSON(),
      workspace: document
        .querySelector('.ml-workspace')!
        .getBoundingClientRect()
        .toJSON(),
    }));
    expect(boxes.columns).toBe(width > 1000 ? 2 : 1);
    expect(boxes.links.every((box) => box.height >= 48)).toBe(true);
    expect(boxes.buttons.every((box) => box.height >= 48)).toBe(true);
    expect(
      Math.max(...boxes.buttons.map((box) => box.height)) -
        Math.min(...boxes.buttons.map((box) => box.height)),
    ).toBeLessThan(1);
    if (width <= 480) {
      expect(boxes.links[1].top).toBeGreaterThanOrEqual(boxes.links[0].bottom);
      expect(boxes.links[2].top).toBeGreaterThanOrEqual(boxes.links[1].bottom);
    }
    if (width > 1000)
      expect(boxes.primary.width).toBeGreaterThan(boxes.controls.width);
    else
      expect(boxes.controls.top).toBeGreaterThanOrEqual(boxes.primary.bottom);
    if (width >= 700 && width <= 1000)
      expect(boxes.loss.top - boxes.rate.bottom).toBeLessThan(48);
    expect(boxes.advanced.width).toBeCloseTo(boxes.workspace.width, 0);
    expect(boxes.advanced.top).toBeGreaterThanOrEqual(boxes.workspace.bottom);
    await expectNoHorizontalOverflow(page);
  }
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .focus();
  await expect(
    page.getByRole('button', { name: 'Train one step', exact: true }),
  ).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
  await expect(training.getByRole('status')).toContainText('Step 1');
  await expectAccessible(page);
});

test('Lab expanded controls reflow with 200 percent HTML text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  for (const [index, lesson] of [
    'Linear regression',
    'Logistic regression',
    'Evaluation',
  ].entries()) {
    await page.goto(`/lab/?text-review=${index}`);
    await page.locator('.lesson-nav').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
    );
    await page
      .getByRole('link', { name: `${index + 1} ${lesson}`, exact: true })
      .click();
    const maths = page.getByText('Inspect the mathematics', { exact: true });
    await maths.click();
    if (index < 2)
      await page
        .getByText('Explore parameters manually', { exact: true })
        .click();
    const originalSize = await page
      .locator('.learning-lab h2')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    // Controlled HTML text enlargement; SVG geometry and model calculations remain unchanged.
    await page.locator('.learning-lab').evaluate((lab) => {
      const elements = [...lab.querySelectorAll('*')].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
      const sizes = elements.map((element) => ({
        font: parseFloat(getComputedStyle(element).fontSize),
        line: parseFloat(getComputedStyle(element).lineHeight),
      }));
      elements.forEach((element, i) => {
        element.style.fontSize = `${sizes[i].font * 2}px`;
        if (Number.isFinite(sizes[i].line))
          element.style.lineHeight = `${sizes[i].line * 2}px`;
      });
    });
    expect(
      await page
        .locator('.learning-lab h2')
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeCloseTo(originalSize * 2, 1);
    await expectNoHorizontalOverflow(page);
    if (index === 2) {
      const clippedRecords = await page
        .locator('.ranked-strip')
        .evaluate((strip) =>
          [
            ...strip.querySelectorAll<HTMLElement>(
              '.record-id, .record-rank, .record-score, .record-outcome, .record-policy, .inspection-flag',
            ),
          ]
            .filter(
              (element) =>
                element.scrollWidth > element.clientWidth + 1 ||
                element.scrollHeight > element.clientHeight + 1,
            )
            .map((element) => element.textContent),
        );
      expect(clippedRecords).toEqual([]);
    }
    await expect(maths).toBeVisible();
    await expect(
      page.getByLabel('Inspect example', { exact: true }),
    ).toBeEnabled();
    const clipped = await page
      .locator('.learning-lab')
      .evaluate((lab) =>
        [
          ...lab.querySelectorAll<HTMLElement>(
            'button, select, summary, p, label',
          ),
        ]
          .filter(
            (element) =>
              ['hidden', 'clip'].includes(
                getComputedStyle(element).overflowY,
              ) && element.scrollHeight > element.clientHeight + 1,
          )
          .map((element) => element.textContent),
      );
    expect(clipped).toEqual([]);
  }
});

test('Lab interface review captures trained and expanded lesson states', async ({
  page,
}, testInfo) => {
  test.skip(
    !['chromium-desktop', 'webkit-desktop'].includes(testInfo.project.name),
    'Two engines capture representative interaction states.',
  );
  for (const width of [320, 430, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/lab/');
    await page.locator('.lesson-nav').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
    );
    for (const [index, lesson] of [
      'Linear regression',
      'Logistic regression',
      'Evaluation',
    ].entries()) {
      await page
        .getByRole('link', { name: `${index + 1} ${lesson}`, exact: true })
        .click();
      if (index < 2)
        await page
          .getByRole('button', { name: 'Train one step', exact: true })
          .press('Enter');
      else
        await page
          .getByRole('slider', { name: 'Review budget', exact: true })
          .fill('10');
      const maths = page.getByText('Inspect the mathematics', { exact: true });
      if (
        !(await maths.evaluate(
          (element) => (element.parentElement as HTMLDetailsElement).open,
        ))
      )
        await maths.click();
      if (index < 2) {
        const manual = page.getByText('Explore parameters manually', {
          exact: true,
        });
        if (
          !(await manual.evaluate(
            (element) => (element.parentElement as HTMLDetailsElement).open,
          ))
        )
          await manual.click();
      }
      await expectNoHorizontalOverflow(page);
      await page.evaluate(() => scrollTo(0, 0));
      await page.setViewportSize({
        width,
        height: await page.evaluate(() =>
          Math.max(1000, document.documentElement.scrollHeight),
        ),
      });
      await testInfo.attach(`lab-${index + 1}-${width}-expanded`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
      await page.setViewportSize({ width, height: 1000 });
    }
  }
});

test('Evaluation records expose actual values and keep review policy separate from inspection', async ({
  page,
}) => {
  await page.goto('/lab/#evaluation');
  await page.locator('.lesson-nav').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('slider', { name: 'Review budget', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('slider', { name: 'Review budget', exact: true })
    .fill('10');
  const records = page
    .getByRole('group', { name: 'Ranked validation records' })
    .getByRole('button');
  await expect(records).toHaveCount(18);
  const tableRows = await page
    .locator('.ml-table tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent!.trim()),
      ),
    );
  const metrics = (await page.locator('.essential-metrics').textContent())!;
  for (const [index, row] of tableRows.entries()) {
    const button = records.nth(index);
    await expect(button.locator('.record-id')).toHaveText(row[1]);
    await expect(button.locator('.record-rank')).toHaveText(
      `#${String(index + 1).padStart(2, '0')}`,
    );
    await expect(button.locator('.record-score strong')).toHaveText(row[4]);
    await expect(button.locator('.record-policy')).toHaveText(
      row[6] === 'Yes' ? '✓ Review' : '– Leave',
    );
    await expect(button).toHaveAttribute(
      'aria-description',
      new RegExp(`Rank ${index + 1}, ${row[1]}, estimated probability`),
    );
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button.locator('.inspection-flag')).toHaveText('Inspecting');
    await expect(button).toHaveCSS('outline-width', '2px');
    await expect(
      page.locator('.ranked-strip [aria-pressed="true"]'),
    ).toHaveCount(1);
    await expect(
      page.getByLabel('Inspect example', { exact: true }),
    ).toHaveValue(row[1]);
    await expect(
      page.getByRole('heading', { name: `Inspecting ${row[1]}`, exact: true }),
    ).toBeVisible();
    await expect(page.locator('.essential-metrics')).toHaveText(metrics);
  }
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(10);
  await expect(records.last()).not.toHaveClass(/chosen/);
  await expect(records.last()).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Probability threshold', { exact: true }).check();
  await page
    .getByRole('slider', { name: 'Probability cutoff', exact: true })
    .fill('1');
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(0);
  await expect(records.last()).toHaveAttribute('aria-pressed', 'true');
  await page.getByText('Final test assessment', { exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Lock experiment and evaluate test',
      exact: true,
    })
    .click();
  await expect(page.locator('.test-metrics dt')).toHaveText([
    'Precision',
    'Recall',
    'Accuracy',
  ]);
  await expect(
    page.getByRole('slider', { name: 'Probability cutoff', exact: true }),
  ).toBeDisabled();
  await expectAccessible(page);
});

test('Lab axes and loss values remain readable and reflect unchanged training histories', async ({
  page,
}, testInfo) => {
  await page.goto('/lab/');
  await page.locator('.lesson-nav').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => !document.querySelector('astro-island')?.hasAttribute('ssr'),
  );
  let state = createLabState();
  for (const [index, lesson] of [
    'Linear regression',
    'Logistic regression',
  ].entries()) {
    await page
      .getByRole('link', { name: `${index + 1} ${lesson}`, exact: true })
      .click();
    state = labReducer(state, { type: 'navigate', lesson: index as 0 | 1 });
    let previous = 0;
    for (const updates of [0, 1, 11, 100]) {
      await page.evaluate((count) => {
        const button = [...document.querySelectorAll('button')].find(
          (button) => button.textContent === 'Train one step',
        )!;
        for (let i = 0; i < count; i++) button.click();
      }, updates - previous);
      for (let i = previous; i < updates; i++)
        state = labReducer(state, { type: 'step' });
      await expect(page.locator('.training-feedback')).toContainText(
        `Step ${updates} ·`,
      );
      const history = (index === 0 ? state.linear : state.logistic).history;
      await expect(page.locator('.loss-values dd')).toHaveText([
        fmt(history[0].loss),
        fmt(history.at(-1)!.loss),
      ]);
      await expect(
        page.getByRole('img', { name: /Loss history:/ }),
      ).toHaveAttribute(
        'aria-label',
        new RegExp(
          `Vertical scale zero to ${fmt(Math.max(...history.map((point) => point.loss), Number.EPSILON) * 1.05).replace('.', '\\.')}`,
        ),
      );
      if (
        ['chromium-desktop', 'webkit-desktop'].includes(testInfo.project.name)
      ) {
        const width = page.viewportSize()!.width;
        await page.evaluate(() => scrollTo(0, 0));
        await page.setViewportSize({
          width,
          height: await page.evaluate(() =>
            Math.max(1000, document.documentElement.scrollHeight),
          ),
        });
        await testInfo.attach(
          `${index === 0 ? 'linear' : 'logistic'}-${updates}-updates`,
          {
            body: await page.screenshot({
              fullPage: true,
              animations: 'disabled',
            }),
            contentType: 'image/png',
          },
        );
        await page.setViewportSize({ width, height: 1000 });
      }
      previous = updates;
    }
    for (const width of [320, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator('.ml-plot')).toHaveAttribute(
        'viewBox',
        '0 0 600 390',
      );
      const labels = await page
        .locator('.ml-plot text, .loss-history text')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const text = element as unknown as SVGTextElement;
            const matrix = text.getScreenCTM()!;
            const bounds = text.getBBox();
            const svg = text.ownerSVGElement!.viewBox.baseVal;
            return {
              paintedSize:
                parseFloat(getComputedStyle(text).fontSize) *
                Math.hypot(matrix.a, matrix.b),
              fits:
                bounds.x >= 0 &&
                bounds.y >= 0 &&
                bounds.x + bounds.width <= svg.width + 1 &&
                bounds.y + bounds.height <= svg.height + 1,
            };
          }),
        );
      expect(labels.every((label) => label.paintedSize >= 12)).toBe(true);
      expect(labels.every((label) => label.fits)).toBe(true);
      await expect(page.locator('.axis-y')).toContainText(
        index === 0
          ? 'Completion time (minutes)'
          : 'Information uncertainty (0–10)',
      );
      await expect(page.locator('.axis-x')).toContainText(
        index === 0 ? 'Task complexity (points)' : 'Task complexity (0–10)',
      );
      await expectNoHorizontalOverflow(page);
    }
  }
});

test('Evaluation grid and metrics respond to their container without clipping record labels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.goto('/lab/#evaluation');
  await page.locator('.lesson-nav').scrollIntoViewIfNeeded();
  await expect(page.locator('.ranked-strip button')).toHaveCount(18);
  for (const width of [280, 350, 480, 481, 599, 600, 819, 820]) {
    await page.locator('.evaluation-primary').evaluate((element, value) => {
      (element as HTMLElement).style.width = `${value}px`;
    }, width);
    const layout = await page.evaluate(() => ({
      records: getComputedStyle(
        document.querySelector('.ranked-strip')!,
      ).gridTemplateColumns.split(' ').length,
      metrics: getComputedStyle(
        document.querySelector('.essential-metrics')!,
      ).gridTemplateColumns.split(' ').length,
      clipped: [
        ...document.querySelectorAll<HTMLElement>(
          '.record-id, .record-rank, .record-score, .record-outcome, .record-policy, .inspection-flag',
        ),
      ]
        .filter(
          (element) =>
            element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1,
        )
        .map((element) => element.textContent),
    }));
    expect(layout.records).toBe(width >= 820 ? 4 : width >= 600 ? 3 : 2);
    expect(layout.metrics).toBe(width <= 480 ? 2 : 4);
    expect(layout.clipped).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }
});

test('the former research route has a static fallback and one canonical destination', async ({
  page,
  request,
}) => {
  const response = await request.get('/work/applied-predictive-research/');
  const html = await response.text();
  expect(html).toContain('/research/');
  await page.goto('/work/applied-predictive-research/');
  await expect(page).toHaveURL(/\/research\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jorgeaviles.net/research/',
  );
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('https://jorgeaviles.net/research/');
  expect(sitemap).not.toContain('/work/applied-predictive-research/');
});
