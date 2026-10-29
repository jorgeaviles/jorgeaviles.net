import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
const endpoint = 'https://portfolio-api.jorgeaviles.net/ask';
const answer = {
  status: 'answered',
  answer:
    'The program remains experimental. Execution records are needed to substantiate completed evaluations.',
  references: [
    {
      title: 'Developing machine-learning models for audit prioritization',
      url: 'https://jorgeaviles.net/work/machine-learning-audit-prioritization/',
    },
  ],
  indexVersion: 'a'.repeat(64),
};
async function mock(page: Page, body = answer, code = 200) {
  const requests: string[] = [];
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'POST')
      requests.push(route.request().postData() ?? '');
    await route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : code,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4322',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: route.request().method() === 'OPTIONS' ? '' : JSON.stringify(body),
    });
  });
  return requests;
}
async function ready(page: Page) {
  await page.goto('/ask/');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every(
      (island) => !island.hasAttribute('ssr'),
    ),
  );
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test('one deliberate keyboard submission returns cited passages and fits the viewport', async ({
  page,
  browserName,
}, testInfo) => {
  const requests = await mock(page);
  await ready(page);
  await accessible(page);
  expect(requests).toHaveLength(0);
  await page
    .getByRole('button', {
      name: 'What is the status of the machine-learning program?',
    })
    .click();
  expect(requests).toHaveLength(0);
  await expect(page.getByLabel('Your question')).toBeFocused();
  await page.keyboard.press(
    browserName === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab',
  );
  await expect(
    page.getByRole('button', { name: 'Ask a question', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'From the public sources' }),
  ).toBeFocused();
  await expect(page.getByText(answer.answer)).toBeVisible();
  await expect(
    page.getByRole('link', { name: answer.references[0].title }),
  ).toHaveAttribute('href', answer.references[0].url);
  expect(requests).toHaveLength(1);
  expect(JSON.parse(requests[0])).toEqual({
    question: 'What is the status of the machine-learning program?',
  });
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath('portfolio-assistant.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('Your question')).toHaveValue('');
  await expect(page.getByLabel('Your question')).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'From the public sources' }),
  ).toHaveCount(0);
});
test('unsupported questions have a clear fallback and no invented source links', async ({
  page,
}) => {
  await mock(page, {
    ...answer,
    status: 'unsupported',
    answer:
      'The approved public sources do not support an answer to that question.',
    references: [],
  });
  await ready(page);
  await page.getByLabel('Your question').fill('What is the weather on Mars?');
  await page
    .getByRole('button', { name: 'Ask a question', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'No supported answer' }),
  ).toBeVisible();
  await expect(page.getByText('Read the original pages')).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Portfolio source pages' }),
  ).toBeVisible();
});
test('rate limits and quota failures never automatically retry or bypass cooldown through Clear', async ({
  page,
}) => {
  await page.clock.install();
  const requests = await mock(page, answer, 429);
  await ready(page);
  await page.getByLabel('Your question').fill('Describe the Audit Portal.');
  await page
    .getByRole('button', { name: 'Ask a question', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('request limit');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Your question').fill('Describe the data platform.');
  await page.clock.fastForward(30_000);
  await expect(
    page.getByRole('button', { name: 'Please wait before asking again' }),
  ).toBeDisabled();
  expect(requests).toHaveLength(1);
  await page.clock.fastForward(31_000);
  await expect(
    page.getByRole('button', { name: 'Ask a question', exact: true }),
  ).toBeEnabled();
  expect(requests).toHaveLength(1);
  await page.unroute(endpoint);
  const later = await mock(page, answer, 503);
  await page
    .getByRole('button', { name: 'Ask a question', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('free allowance');
  await page.clock.fastForward(61_000);
  expect(later).toHaveLength(1);
});
test('rapid submissions and request timeout invoke at most one fetch', async ({
  page,
}) => {
  await page.clock.install();
  let count = 0;
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'OPTIONS')
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:4322',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    else count++;
  });
  await ready(page);
  await page.getByLabel('Your question').fill('Describe the Audit Portal.');
  await page
    .getByRole('button', { name: 'Ask a question', exact: true })
    .click();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Finding sources…' }),
  ).toBeDisabled();
  await expect.poll(() => count).toBe(1);
  await page.clock.fastForward(21_000);
  await expect(page.getByRole('status')).toContainText('unavailable');
  await page.clock.fastForward(61_000);
  expect(count).toBe(1);
});
test('unsafe or uncited responses are refused and drafts are not browser storage', async ({
  page,
}) => {
  await mock(page, {
    ...answer,
    references: [{ title: 'Untrusted', url: 'https://evil.example/' }],
  });
  await ready(page);
  await page.getByLabel('Your question').fill('Describe the Audit Portal.');
  await page
    .getByRole('button', { name: 'Ask a question', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('unavailable');
  await expect(page.getByRole('link', { name: 'Untrusted' })).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await page.reload();
  await expect(page.getByLabel('Your question')).toHaveValue('');
});
