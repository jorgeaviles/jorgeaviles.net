import { describe, it, expect } from 'vitest';
import {
  fitScaler,
  scaled,
  initial,
  score,
  sigmoid,
  loss,
  gradient,
  step,
} from './models';
import {
  generateRanches,
  partitionRanches,
  toRows,
  fitRanches,
  predictProfit,
  predictProfitability,
  stratifiedFolds,
  crossValidate,
  assess,
  classificationMetrics,
} from './ranches';
const data = partitionRanches();
it('generates reproducible, coherent targets and a disjoint 72/18 split', () => {
  const ranches = generateRanches();
  expect(ranches).toEqual(generateRanches());
  expect(ranches).not.toEqual(generateRanches(43));
  expect(new Set(ranches.map((r) => r.id)).size).toBe(90);
  for (const r of ranches) {
    expect(r.profitable).toBe(Number(r.profit > 0));
    expect(toRows([r], 'linear')[0]).toEqual({
      id: r.id,
      x: [r.cattle],
      y: r.profit / 100000,
    });
    expect(toRows([r], 'logistic')[0]).toEqual({
      id: r.id,
      x: [r.cattle, r.feed],
      y: r.profitable,
    });
  }
  expect([data.development.length, data.test.length]).toEqual([72, 18]);
  expect(
    new Set([...data.development, ...data.test].map((r) => r.id)).size,
  ).toBe(90);
  for (const group of [data.development, data.test])
    expect(new Set(group.map((r) => r.profitable)).size).toBe(2);
  const altered = ranches.map((r) => ({
    ...r,
    profit: r.profit + 999999,
    profitable: (1 - r.profitable) as 0 | 1,
  }));
  expect(toRows(altered, 'logistic').map((r) => r.x)).toEqual(
    toRows(ranches, 'logistic').map((r) => r.x),
  );
});
describe.each(['linear', 'logistic'] as const)(
  'real %s optimization',
  (kind) => {
    const rows = toRows(data.development, kind),
      scaler = fitScaler(rows),
      normalized = scaled(rows, scaler),
      logistic = kind === 'logistic';
    it('centers only its fitting rows', () => {
      for (let j = 0; j < scaler.mean.length; j++)
        expect(
          normalized.reduce((s, r) => s + r.x[j], 0) / rows.length,
        ).toBeCloseTo(0, 12);
      expect(
        scaled(
          [{ id: 'outlier', x: scaler.mean.map((v) => v + 999999), y: 1 }],
          scaler,
        )[0].x.every((v) => v > 100),
      ).toBe(true);
    });
    it('matches finite-difference gradients for each parameter', () => {
      const m = { w: Array(logistic ? 2 : 1).fill(0.2), b: -0.1 },
        g = gradient(normalized, m, logistic),
        epsilon = 1e-5;
      for (let j = 0; j <= m.w.length; j++) {
        const plus = structuredClone(m),
          minus = structuredClone(m);
        if (j === m.w.length) {
          plus.b += epsilon;
          minus.b -= epsilon;
        } else {
          plus.w[j] += epsilon;
          minus.w[j] -= epsilon;
        }
        expect(j === m.w.length ? g.b : g.w[j]).toBeCloseTo(
          (loss(normalized, plus, logistic) -
            loss(normalized, minus, logistic)) /
            (2 * epsilon),
          7,
        );
      }
    });
    it('lowers loss, fits deterministically and predicts finite raw-unit values', () => {
      const fit = fitRanches(data.development, kind),
        zero = initial(logistic ? 2 : 1);
      expect(fit).toEqual(fitRanches(data.development, kind));
      expect(loss(normalized, fit.model, logistic)).toBeLessThan(
        loss(normalized, zero, logistic),
      );
      const next = step(normalized, zero, logistic, 0.08);
      expect(loss(normalized, next, logistic)).toBeLessThan(
        loss(normalized, zero, logistic),
      );
      for (const r of generateRanches()) {
        const p = logistic
          ? predictProfitability(fit, r.cattle, r.feed)
          : predictProfit(fit, r.cattle);
        expect(Number.isFinite(p)).toBe(true);
        if (logistic) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        } else
          expect(p).toBe(
            score(fit.model, [(r.cattle - scaler.mean[0]) / scaler.scale[0]]) *
              100000,
          );
      }
      expect(fit.model.w[0]).toBeGreaterThan(0);
      if (logistic) expect(fit.model.w[1]).toBeLessThan(0);
    });
  },
);
it('keeps sigmoid and binary cross-entropy numerically stable', () => {
  expect(sigmoid(0)).toBe(0.5);
  expect(sigmoid(-1000)).toBe(0);
  expect(sigmoid(1000)).toBe(1);
  expect(loss([{ id: 'a', x: [1], y: 0 }], { w: [1000], b: 0 }, true)).toBe(
    1000,
  );
  expect(loss([{ id: 'a', x: [2], y: 3 }], { w: [1], b: 0 }, false)).toBe(1);
});
it('covers every development ranch in one balanced fold, with no final-test records', () => {
  const folds = stratifiedFolds(data.development);
  expect(folds.map((f) => f.length).sort()).toEqual([14, 14, 14, 15, 15]);
  expect(
    folds
      .flat()
      .map((r) => r.id)
      .sort(),
  ).toEqual(data.development.map((r) => r.id).sort());
  for (const label of [0, 1]) {
    const counts = folds.map(
      (f) => f.filter((r) => r.profitable === label).length,
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  }
});
it('trains five independent models with fold-local scalers and actual held-out predictions', () => {
  const cv = crossValidate(data.development);
  for (const fold of cv.folds) {
    const training = fold.trainingIds.map((id) =>
      data.development.find((r) => r.id === id)!,
    );
    expect(fold.validationIds.some((id) => fold.trainingIds.includes(id))).toBe(
      false,
    );
    expect(fold.scaler).toEqual(fitScaler(toRows(training, 'logistic')));
    const independentlyFit = fitRanches(training, 'logistic');
    fold.model.w.forEach((w, i) =>
      expect(w).toBeCloseTo(independentlyFit.model.w[i], 12),
    );
    expect(fold.metrics).toEqual(classificationMetrics(fold.predictions));
    for (const prediction of fold.predictions) {
      const ranch = data.development.find((r) => r.id === prediction.id)!;
      expect(prediction.probability).toBe(
        predictProfitability(fold, ranch.cattle, ranch.feed),
      );
    }
  }
  expect(new Set(cv.folds.map((f) => f.model)).size).toBe(5);
  expect(
    new Set(cv.folds.map((f) => JSON.stringify(f.model))).size,
  ).toBeGreaterThan(1);
  expect(cv.meanAccuracy).toBe(
    cv.folds.reduce((s, f) => s + f.metrics.accuracy, 0) / 5,
  );
  const changed = data.development.map((r) =>
    cv.folds[0].validationIds.includes(r.id)
      ? { ...r, cattle: 999999, feed: 999999 }
      : r,
  );
  const after = crossValidate(changed).folds[0];
  expect(after.scaler).toEqual(cv.folds[0].scaler);
  expect(after.model).toEqual(cv.folds[0].model);
});
it('calculates accuracy and confusion counts against an independent hand example', () => {
  expect(
    classificationMetrics([
      { actual: 1, probability: 0.9 },
      { actual: 0, probability: 0.8 },
      { actual: 1, probability: 0.1 },
      { actual: 0, probability: 0.2 },
      { actual: 1, probability: 0.5 },
    ]),
  ).toEqual({
    tp: 2,
    fp: 1,
    fn: 1,
    tn: 1,
    correct: 3,
    count: 5,
    accuracy: 0.6,
    precision: 2 / 3,
    recall: 2 / 3,
  });
  expect(classificationMetrics([]).precision).toBeNull();
  expect(classificationMetrics([]).recall).toBeNull();
});
it('does not let changes to final-test values affect development fitting or CV', () => {
  const before = crossValidate(data.development),
    fit = fitRanches(data.development, 'logistic');
  const changed = {
    development: structuredClone(data.development),
    test: data.test.map((r) => ({
      ...r,
      cattle: 999999,
      profit: -999999,
      profitable: 0 as const,
    })),
  };
  expect(crossValidate(changed.development)).toEqual(before);
  expect(fitRanches(changed.development, 'logistic')).toEqual(fit);
  expect(assess(fit, data.test).metrics.count).toBe(18);
});

it('retains seeded reference predictions, rotated scores and held-out results', () => {
  const linear = fitRanches(data.development, 'linear');
  const logistic = fitRanches(data.development, 'logistic');
  expect(predictProfit(linear, 250)).toBeCloseTo(23706.691628016397, 6);
  expect(predictProfitability(logistic, 250, 900)).toBeCloseTo(
    0.485528729739374,
    10,
  );
  const cv = crossValidate(data.development);
  expect(cv.folds.map((f) => [f.metrics.correct, f.metrics.count])).toEqual([
    [12, 15],
    [14, 15],
    [12, 14],
    [11, 14],
    [11, 14],
  ]);
  expect(cv.meanAccuracy).toBeCloseTo(0.8323809523809524, 12);
  expect(assess(logistic, data.test).metrics).toMatchObject({
    correct: 13,
    count: 18,
    tp: 7,
    fp: 2,
    tn: 6,
    fn: 3,
  });
});
