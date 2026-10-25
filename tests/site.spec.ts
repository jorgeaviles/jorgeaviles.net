import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const routes = [
  {
    path: '/',
    heading: 'Turning complex information into useful decisions and systems.',
  },
  { path: '/about/', heading: 'The question comes first.' },
  { path: '/work/', heading: 'Making information useful.' },
  {
    path: '/work/analytical-data-platforms/',
    heading: 'Building an analytical data platform',
  },
  {
    path: '/work/applied-predictive-research/',
    heading: 'Applied predictive-model research',
  },
  {
    path: '/work/analytical-applications/',
    heading: 'Designing an audit-tracking workspace',
  },
  { path: '/research/', heading: 'Following the evidence.' },
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
    .getByRole('link', { name: 'Jorge Aviles, home', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole('link', { name: 'Explore my work', exact: true })
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
  await page
    .getByRole('button', { name: 'Reset this model', exact: true })
    .click();
  await expect(workspace.locator('.training-feedback')).toHaveText(before);
  await page.getByText('Explore parameters manually', { exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Weight 1', exact: true })
    .fill('0.3');
  await expect(
    page.getByRole('spinbutton', { name: 'Weight 1', exact: true }),
  ).toHaveValue('0.3');
  await page
    .getByRole('button', { name: 'Reset this model', exact: true })
    .click();
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
      if (route.path === '/lab/') {
        const fallback = page.locator('noscript p');
        await expect(fallback).toContainText('JavaScript is disabled.');
        await expect(fallback).toBeVisible();
      }
    });
  }
});

test('guidance, independent histories and population inspection remain coherent', async ({
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
  const hint = page.getByRole('note', { name: 'Lesson guidance' });
  await expect(hint).toBeVisible();
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
  await expect(hint).toBeHidden();
  await expect(page.locator('.training-feedback')).toContainText(
    'Error decreased',
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
  await expect(hint).toBeVisible();
  await expect(page.getByText(/No unique 50% boundary:/)).toBeVisible();
  await expect(page.locator('.model-figure figcaption')).toContainText(
    '54 training examples',
  );
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(hint).toBeHidden();
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
  await expect(hint).toBeHidden();
  await page.getByRole('button', { name: 'Help', exact: true }).press('Enter');
  await expect(hint).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).press('Enter');
  await expect(hint).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath('lab-linear-trained.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: '3 Evaluation', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Inspect example', exact: true }),
  ).toHaveValue('SYN-60');
  await expect(hint).toBeVisible();
  const slider = page.getByRole('slider', {
    name: 'Review budget',
    exact: true,
  });
  await slider.fill('10');
  await expect(hint).toBeHidden();
  await expect(page.locator('.ranked-strip .chosen')).toHaveCount(10);
  await expect(page.locator('.ranked-strip [aria-pressed=true]')).toHaveCount(
    1,
  );
  const metrics = await page.locator('.essential-metrics').boundingBox(),
    control = await slider.boundingBox(),
    strip = await page.locator('.ranked-strip').boundingBox();
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
  await expect(hint).toBeHidden();
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
    .getByRole('spinbutton', { name: 'Weight 1', exact: true })
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
  await page.getByRole('link', { name: 'Get in touch' }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.locator('.contact-address')).toBeVisible();
});

test('approved case study stays consistent across listings and renders a static fictional workflow', async ({
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
    'Find',
    'Understand',
    'Update',
  ]);
  await expect(figure.getByText('Harbor review', { exact: true })).toHaveCount(
    3,
  );
  await expect(figure.locator('.record-state')).toHaveText([
    'Needs context',
    'Ready for review',
    'Briefing reviewed',
  ]);
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
    'Conceptual workflow illustrated with fictional information. Not a screenshot of the internal application.',
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

test('data platform case study shares metadata and explains a static fictional data flow', async ({
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
    'Conceptual analytical workflow using fictional data. Not a diagram of the internal production environment.',
  );
  await expect(figure.getByRole('table')).toHaveCount(2);
  await expect(figure.getByRole('table').nth(1).locator('tbody tr')).toHaveText(
    ['Sketch25'],
  );
  await expect(figure).toContainText('it is not treated as zero');
  await expect(page.locator('article.prose')).toContainText(
    'It is not a dedicated provisioned SQL warehouse',
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
    '/work/analytical-data-platforms/',
    '/work/analytical-applications/',
    '/work/applied-predictive-research/',
  ];
  for (const route of ['/', '/work/']) {
    await page.goto(route);
    expect(
      await page
        .locator('.work-row')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    ).toEqual(ordered);
  }
  await page.goto('/work/applied-predictive-research/');
  expect(
    await page
      .locator('.related-work a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(ordered.slice(0, 2));
  await expect(page.locator('article')).toContainText(
    'Asthana is the paper’s author.',
  );
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
    expect(graph[0].sameAs).toEqual([
      'https://github.com/jorgeaviles',
      'https://www.linkedin.com/in/jraviles/',
    ]);
    expect(graph[1].description).toContain('application development');
    if (route.path.startsWith('/work/') && route.path !== '/work/') {
      await expect(page).toHaveTitle(`${route.heading} — Jorge Aviles`);
    }
  }
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
