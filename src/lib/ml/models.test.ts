import { describe, it, expect } from 'vitest';
import {
  datasets,
  fitScaler,
  scaled,
  initial,
  score,
  sigmoid,
  loss,
  gradient,
  step,
  rank,
  evaluate,
} from './models';
describe('deterministic data and training-only preprocessing', () => {
  it('replays fixed disjoint partitions', () => {
    const a = datasets();
    expect(a).toEqual(datasets());
    expect(a).not.toEqual(datasets(43));
    const rows = [...a.train, ...a.validation, ...a.test];
    expect(new Set(rows.map((r) => r.id)).size).toBe(90);
    expect([a.train.length, a.validation.length, a.test.length]).toEqual([
      54, 18, 18,
    ]);
  });
  it('centers training without fitting validation or test', () => {
    const a = datasets(),
      s = fitScaler(a.train);
    const rows = scaled(a.train, s);
    for (let j = 0; j < 2; j++)
      expect(rows.reduce((n, r) => n + r.x[j], 0) / rows.length).toBeCloseTo(
        0,
        12,
      );
    a.validation[0].x = [1000, 1000];
    expect(fitScaler(a.train)).toEqual(s);
    expect(scaled(a.validation, s)[0].x[0]).toBeGreaterThan(100);
  });
});
describe.each([false, true])(
  'actual optimization (logistic=%s)',
  (logistic) => {
    const rows = logistic
      ? scaled(datasets().train, fitScaler(datasets().train))
      : scaled(datasets().regression, fitScaler(datasets().regression));
    it('matches finite differences for every weight and bias', () => {
      const m = { w: logistic ? [0.2, -0.3] : [0.2], b: 0.1 };
      const g = gradient(rows, m, logistic),
        eps = 1e-5;
      for (let i = 0; i <= m.w.length; i++) {
        const plus = { w: [...m.w], b: m.b },
          minus = { w: [...m.w], b: m.b };
        if (i === m.w.length) {
          plus.b += eps;
          minus.b -= eps;
        } else {
          plus.w[i] += eps;
          minus.w[i] -= eps;
        }
        expect(i === m.w.length ? g.b : g.w[i]).toBeCloseTo(
          (loss(rows, plus, logistic) - loss(rows, minus, logistic)) /
            (2 * eps),
          6,
        );
      }
    });
    it('updates using the analytical gradient, reduces loss and replays after reset', () => {
      const m = initial(logistic ? 2 : 1),
        g = gradient(rows, m, logistic),
        next = step(rows, m, logistic, 0.05);
      expect(next.b).toBeCloseTo(m.b - 0.05 * g.b, 12);
      next.w.forEach((w, j) =>
        expect(w).toBeCloseTo(m.w[j] - 0.05 * g.w[j], 12),
      );
      expect(loss(rows, next, logistic)).toBeLessThan(loss(rows, m, logistic));
      expect(step(rows, initial(m.w.length), logistic, 0.05)).toEqual(next);
      expect(m).toEqual(initial(m.w.length));
    });
  },
);
it('computes predictions, sigmoid saturation and stable BCE', () => {
  expect(score({ w: [2, 3], b: 1 }, [4, 5])).toBe(24);
  expect(sigmoid(0)).toBe(0.5);
  expect(sigmoid(-1000)).toBe(0);
  expect(sigmoid(1000)).toBe(1);
  expect(loss([{ id: 'a', x: [1], y: 0 }], { w: [1000], b: 0 }, true)).toBe(
    1000,
  );
  expect(loss([{ id: 'a', x: [1], y: 1 }], { w: [1000], b: 0 }, true)).toBe(0);
  expect(loss([{ id: 'a', x: [2], y: 3 }], { w: [1], b: 0 }, false)).toBe(1);
});
it('ranks scores stably and evaluates policies without modifying weights', () => {
  const model = initial(1),
    before = structuredClone(model),
    rows = rank(
      [
        { id: 'b', x: [1], y: 0 },
        { id: 'a', x: [0], y: 1 },
      ],
      model,
    );
  expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  expect(evaluate(rows, 'budget', 0).precision).toBeNull();
  expect(evaluate(rows, 'budget', 0).recall).toBe(0);
  expect(evaluate(rows, 'budget', 1)).toMatchObject({
    tp: 1,
    fp: 0,
    tn: 1,
    fn: 0,
    precision: 1,
    recall: 1,
    accuracy: 1,
  });
  expect(evaluate(rows, 'budget', 2)).toMatchObject({
    tp: 1,
    fp: 1,
    count: 2,
    precision: 0.5,
    recall: 1,
  });
  expect(evaluate(rows, 'threshold', 0.5).count).toBe(2);
  expect(evaluate(rows, 'threshold', 0.51).count).toBe(0);
  expect(
    evaluate([{ id: 'n', x: [0], y: 0, p: 0.1 }], 'budget', 0).recall,
  ).toBeNull();
  expect(model).toEqual(before);
});

it('learns real score order reproducibly and preserves held-out partitions', () => {
  const data = datasets(),
    rows = scaled(data.train, fitScaler(data.train));
  function learn() {
    let m = initial(2);
    for (let i = 0; i < 100; i++) m = step(rows, m, true, 0.05);
    return m;
  }
  const model = learn();
  expect(model).toEqual(learn());
  expect(loss(rows, model, true)).toBeLessThan(loss(rows, initial(2), true));
  const validation = scaled(data.validation, fitScaler(data.train));
  expect(rank(validation, model).map((r) => r.id)).not.toEqual(
    rank(validation, initial(2)).map((r) => r.id),
  );
  expect(evaluate([], 'budget', 0)).toMatchObject({
    precision: null,
    recall: null,
    accuracy: null,
    selectionRate: null,
  });
});
