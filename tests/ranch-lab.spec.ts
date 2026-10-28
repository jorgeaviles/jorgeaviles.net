import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createLabState, fixtures } from '../src/lib/ml/experiment';
import {
  fitRanches,
  predictProfit,
  predictProfitability,
  crossValidate,
  assess,
} from '../src/lib/ml/ranches';
import { dollars, pct, fmt } from '../src/lib/ml/presentation';
async function open(page: Page, hash = '') {
  await page.goto(`/lab/${hash}`);
  await expect(page.locator('.ranch-interactive')).toBeEnabled();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
        ) <=
        innerWidth + 1,
    ),
  ).toBe(true);
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
}
test('profit and probability sliders update real fitted predictions and chart markers', async ({
  page,
}) => {
  await open(page);
  const reference = createLabState();
  await expect(page.getByTestId('profit-prediction')).toHaveText(
    dollars(Math.abs(predictProfit(reference.linear, 250))),
  );
  const cattle = page.getByRole('slider', { name: /Cattle sold annually/ });
  await cattle.fill('400');
  await expect(page.getByTestId('profit-prediction')).toHaveText(
    dollars(Math.abs(predictProfit(reference.linear, 400))),
  );
  await expect(page.getByTestId('prediction-marker')).toHaveAttribute(
    'data-profit',
    String(predictProfit(reference.linear, 400)),
  );
  await expect(page.getByTestId('zero-profit')).toHaveCount(1);
  await page.getByRole('link', { name: 'Profitability', exact: true }).click();
  await page.getByRole('slider', { name: /Feed cost per animal/ }).fill('1300');
  await expect(page.getByTestId('profitability-prediction')).toHaveText(
    pct(predictProfitability(reference.logistic, 400, 1300)),
  );
  const cells = await page
    .getByTestId('probability-field')
    .locator('rect')
    .evaluateAll((nodes) =>
      nodes.map((n) => Number(n.getAttribute('data-probability'))),
    );
  expect(cells).toHaveLength(625);
  expect(cells.every(Number.isFinite)).toBe(true);
  await expect(page.getByTestId('prediction-marker')).toHaveAttribute(
    'data-feed',
    '1300',
  );
  await page
    .getByText('How probabilities are learned', { exact: true })
    .click();
  const ranch = fixtures.development[0];
  await page.getByLabel('Inspect a development ranch').selectOption(ranch.id);
  await expect(
    page.getByRole('slider', { name: /Cattle sold annually/ }),
  ).toHaveValue(String(ranch.cattle));
  await expect(page.locator('.ranch-observation')).toContainText(
    dollars(Math.abs(ranch.profit)),
  );
  await accessible(page);
});
test('optional training uses real gradients, pauses on navigation and closing, and keeps independent histories', async ({
  page,
}) => {
  await open(page);
  await page.getByText('Explore model training', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Reset training', exact: true })
    .click();
  await expect(page.locator('.training-feedback')).toContainText('Step 0');
  await page
    .getByRole('button', { name: 'Train one step', exact: true })
    .click();
  await expect(page.locator('.training-feedback')).toContainText('Step 1');
  const value = await page.getByTestId('profit-prediction').innerText();
  await page
    .getByRole('button', { name: 'Train automatically', exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(
        (await page.locator('.training-feedback').innerText()).match(
          /Step (\d+)/,
        )?.[1],
      ),
    )
    .toBeGreaterThan(1);
  await page.getByText('Explore model training', { exact: true }).click();
  await page.getByText('Explore model training', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Train automatically', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: 'Profitability', exact: true }).click();
  await page.getByText('Explore model training', { exact: true }).click();
  await expect(page.locator('.training-feedback')).toContainText('Step 600');
  await page.getByRole('link', { name: 'Predict profit', exact: true }).click();
  await page.getByText('Explore model training', { exact: true }).click();
  await expect(page.locator('.training-feedback')).not.toContainText(
    'Step 200',
  );
  expect(await page.getByTestId('profit-prediction').innerText()).not.toBe(
    value,
  );
});
test('five-fold results and final test are computed from independent fits and lock until a complete reset', async ({
  page,
}) => {
  await open(page, '#evaluation');
  await expect(
    page.getByRole('button', { name: 'Test on unseen ranches', exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId('final-result')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Run five-fold validation', exact: true })
    .click();
  const cv = crossValidate(fixtures.development);
  await expect(page.getByTestId('validation-mean')).toHaveText(
    pct(cv.meanAccuracy),
  );
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole('button', { name: new RegExp(`Fold ${i + 1}`) })
      .click();
    const m = cv.folds[i].metrics;
    await expect(page.getByTestId('fold-result')).toHaveText(
      `Fold ${i + 1}: ${m.correct} of ${m.count} correct · ${pct(m.accuracy)}`,
    );
  }
  await page.getByText('Explore evaluation details', { exact: true }).click();
  await expect(page.locator('.ranch-confusion')).toContainText(
    String(cv.folds[4].metrics.tp),
  );
  await page
    .getByRole('button', { name: 'Test on unseen ranches', exact: true })
    .click();
  const final = assess(
    fitRanches(fixtures.development, 'logistic'),
    fixtures.test,
  ).metrics;
  await expect(page.getByTestId('final-result')).toContainText(
    `${final.correct} of 18 correct`,
  );
  await expect(page.getByTestId('final-result')).toContainText(
    pct(final.accuracy),
  );
  await expect(
    page.getByRole('button', { name: 'Test on unseen ranches', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Run five-fold validation', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: 'Profitability', exact: true }).click();
  await page.getByText('Explore model training', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reset training', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Reset whole experiment', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reset training', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('link', { name: 'Test predictions', exact: true })
    .click();
  await expect(page.getByTestId('final-result')).toHaveCount(0);
  await expect(page.getByTestId('validation-mean')).toHaveCount(0);
  await accessible(page);
});
test('keyboard controls, deep links and browser history expose all three lessons', async ({
  page,
}) => {
  await open(page, '#logistic-regression');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Will a ranch be profitable?',
  );
  const slider = page.getByRole('slider', { name: /Cattle sold annually/ });
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('251');
  const before = await page.getByTestId('profitability-prediction').innerText();
  await slider.press('End');
  await expect(slider).toHaveValue('500');
  expect(
    await page.getByTestId('profitability-prediction').innerText(),
  ).not.toBe(before);
  await page
    .getByRole('link', { name: 'Test predictions', exact: true })
    .click();
  await expect(page).toHaveURL(/#evaluation$/);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Will a ranch be profitable?',
  );
  await page.goForward();
  await expect(
    page.getByRole('button', { name: 'Run five-fold validation', exact: true }),
  ).toBeVisible();
  const fold = page.getByRole('button', { name: /Fold 3/ });
  await fold.focus();
  await fold.press('Enter');
  await expect(fold).toHaveAttribute('aria-pressed', 'true');
  expect(await fold.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe(
    'none',
  );
});
test('all lessons and expanded details reflow at seven widths and enlarged text', async ({
  page,
}) => {
  await open(page);
  for (const width of [320, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [i, label] of [
      'Predict profit',
      'Profitability',
      'Test predictions',
    ].entries()) {
      await page.getByRole('link', { name: label, exact: true }).click();
      if (i < 2) {
        const slider = page.getByRole('slider', {
          name: /Cattle sold annually/,
        });
        if (width <= 430) {
          await page.evaluate(() => scrollTo(0, 0));
          expect((await slider.boundingBox())!.y).toBeLessThan(700);
        }
        await page.getByText('Explore model training', { exact: true }).click();
        await page
          .getByText(
            i === 0
              ? 'How the line is learned'
              : 'How probabilities are learned',
            { exact: true },
          )
          .click();
        const labels = await page
          .locator('.ranch-plot svg text')
          .evaluateAll((nodes) =>
            nodes.map((e) => {
              const svg = e.closest('svg')!;
              return (
                (parseFloat(getComputedStyle(e).fontSize) *
                  svg.getBoundingClientRect().width) /
                640
              );
            }),
          );
        expect(labels.every((size) => size >= 12)).toBe(true);
      } else {
        await page
          .getByRole('button', {
            name: 'Run five-fold validation',
            exact: true,
          })
          .click();
        for (const title of [
          'Explore evaluation details',
          'Other ways to validate models',
        ])
          await page.getByText(title, { exact: true }).click();
        for (const button of await page.locator('.folds button').all()) {
          const box = (await button.boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
      await noOverflow(page);
    }
  }
  for (const textWidth of [320, 640]) {
    await page.setViewportSize({ width: textWidth, height: 1000 });
    for (const label of [
      'Predict profit',
      'Profitability',
      'Test predictions',
    ]) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await page.locator('.learning-lab').evaluate((lab) => {
        const nodes = [...lab.querySelectorAll<HTMLElement>('*')].filter((e) =>
          [...e.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          ),
        );
        const sizes = nodes.map((e) =>
          parseFloat(getComputedStyle(e).fontSize),
        );
        nodes.forEach((e, i) => {
          e.style.fontSize = `${sizes[i] * 2}px`;
        });
      });
      await noOverflow(page);
      // Navigation remains shared across lessons; remove enlargement before the next pass.
      await page
        .locator('.learning-lab [style]')
        .evaluateAll((nodes) =>
          nodes.forEach((e) =>
            (e as HTMLElement).style.removeProperty('font-size'),
          ),
        );
    }
  }
  await accessible(page);
});
test('readable numeric training state and privacy framing remain quiet and coherent', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByText('Explore model training', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Train automatically', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.loss-values dd').last()).toHaveText(
    fmt(createLabState().linear.history.at(-1)!.loss),
  );
  await page
    .getByRole('button', { name: 'Train automatically', exact: true })
    .click();
  await expect(page.locator('.training-feedback')).toHaveAttribute(
    'aria-live',
    'off',
  );
  await page
    .getByRole('button', { name: 'Pause training', exact: true })
    .click();
  await expect(page.locator('.training-feedback')).toHaveAttribute(
    'aria-live',
    'polite',
  );
  await expect(page.locator('.learning-lab > .section-footnote')).toContainText(
    'does not reproduce the published study',
  );
  await info.attach('Ranch prediction lesson', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
