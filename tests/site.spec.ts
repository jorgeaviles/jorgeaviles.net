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
    heading: 'Analytical data platforms',
  },
  {
    path: '/work/applied-predictive-research/',
    heading: 'Applied predictive-model research',
  },
  {
    path: '/work/analytical-applications/',
    heading: 'Analytical applications',
  },
  { path: '/research/', heading: 'Following the evidence.' },
  { path: '/lab/', heading: 'A question you can interact with.' },
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
        .getByRole('slider', { name: 'Records to review' })
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
    main.getByRole('link', { name: /jorge@jorgeaviles\.net/ }),
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

test('ranked-review controls update the visible results at both boundaries', async ({
  page,
}) => {
  const errors = observeApplicationErrors(page);
  await page.goto('/lab/');
  const number = page.getByRole('spinbutton', {
    name: 'Selection size',
    exact: true,
  });
  const range = page.getByRole('slider', {
    name: 'Records to review',
    exact: true,
  });
  await number.scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('astro-island')).every(
      (island) => !island.hasAttribute('ssr'),
    ),
  );
  const metrics = page.locator('.lab-metrics');
  const precision = metrics
    .locator('.lab-metric')
    .filter({ hasText: 'Precision' });
  const recall = metrics.locator('.lab-metric').filter({ hasText: 'Recall' });
  const selectedRows = page
    .getByRole('table')
    .locator('tbody tr[data-selected="true"]');
  await expect(number).toHaveValue('4');
  await expect(range).toHaveValue('4');
  await expect(precision.locator('strong')).toHaveText('75%');
  await expect(recall.locator('strong')).toHaveText('50%');
  await expect(selectedRows).toHaveCount(4);

  await number.fill('0');
  await expect(range).toHaveValue('0');
  await expect(precision.locator('strong')).toHaveText('0%');
  await expect(recall.locator('strong')).toHaveText('0%');
  await expect(selectedRows).toHaveCount(0);

  await range.press('End');
  await expect(number).toHaveValue('12');
  await expect(precision.locator('strong')).toHaveText('50%');
  await expect(recall.locator('strong')).toHaveText('100%');
  await expect(selectedRows).toHaveCount(12);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(13);
  expect(errors).toEqual([]);
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
      if (route.path === '/lab/') {
        await expect(page.getByRole('table')).toBeVisible();
        await expect(page.getByRole('table').getByRole('row')).toHaveCount(13);
        const fallback = page.locator('noscript p');
        await expect(fallback).toContainText('JavaScript is disabled.');
        await expect(fallback).toBeVisible();
      }
    });
  }
});
