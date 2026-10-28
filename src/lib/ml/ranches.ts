import {
  random,
  fitScaler,
  scaled,
  initial,
  step,
  score,
  probability,
  transform,
  type Row,
  type Model,
  type Scaler,
} from './models';
export type Ranch = {
  id: string;
  cattle: number;
  feed: number;
  profit: number;
  profitable: 0 | 1;
};
export const PROFIT_UNIT = 100_000;
export const TRAINING_STEPS = { linear: 200, logistic: 600 } as const;
export const LEARNING_RATE = 0.08;
export type Kind = keyof typeof TRAINING_STEPS;
export function shuffle<T>(values: readonly T[], seed: number): T[] {
  const out = [...values],
    rng = random(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** Invented dollar economics, deliberately not calibrated to industry benchmarks. */
export function generateRanches(seed = 42): Ranch[] {
  const rng = random(seed);
  return Array.from({ length: 90 }, (_, i) => {
    const cattle = 50 + Math.floor(rng() * 451);
    const feed = 400 + Math.floor(rng() * 1001);
    const profit = Math.round(
      cattle * (1850 - feed - 500 + (rng() - 0.5) * 300) -
        90000 +
        (rng() - 0.5) * 80000,
    );
    return {
      id: `RANCH-${String(i + 1).padStart(2, '0')}`,
      cattle,
      feed,
      profit,
      profitable: profit > 0 ? 1 : 0,
    };
  });
}
export function partitionRanches(records = generateRanches()) {
  const positive = shuffle(
    records.filter((r) => r.profitable),
    91,
  );
  const negative = shuffle(
    records.filter((r) => !r.profitable),
    92,
  );
  const positivesInTest = Math.round(positive.length * 0.2);
  const negativesInTest = 18 - positivesInTest;
  return {
    development: shuffle(
      [...positive.slice(positivesInTest), ...negative.slice(negativesInTest)],
      93,
    ),
    test: shuffle(
      [
        ...positive.slice(0, positivesInTest),
        ...negative.slice(0, negativesInTest),
      ],
      94,
    ),
  };
}
export const input = (r: Pick<Ranch, 'cattle' | 'feed'>, kind: Kind) =>
  kind === 'linear' ? [r.cattle] : [r.cattle, r.feed];
export const toRows = (records: readonly Ranch[], kind: Kind): Row[] =>
  records.map((r) => ({
    id: r.id,
    x: input(r, kind),
    y: kind === 'linear' ? r.profit / PROFIT_UNIT : r.profitable,
  }));
export type Fit = { model: Model; scaler: Scaler };
export function fitRanches(records: readonly Ranch[], kind: Kind): Fit {
  const raw = toRows(records, kind),
    scaler = fitScaler(raw),
    rows = scaled(raw, scaler);
  let model = initial(kind === 'linear' ? 1 : 2);
  for (let i = 0; i < TRAINING_STEPS[kind]; i++)
    model = step(rows, model, kind === 'logistic', LEARNING_RATE);
  return { model, scaler };
}
export const predictProfit = (fit: Fit, cattle: number) =>
  score(fit.model, transform([cattle], fit.scaler)) * PROFIT_UNIT;
export const predictProfitability = (fit: Fit, cattle: number, feed: number) =>
  probability(fit.model, transform([cattle, feed], fit.scaler));
export function classificationMetrics(
  predictions: { actual: number; probability: number }[],
) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  for (const p of predictions) {
    if (p.probability >= 0.5) {
      if (p.actual === 1) tp++;
      else fp++;
    } else if (p.actual === 1) fn++;
    else tn++;
  }
  const correct = tp + tn,
    count = predictions.length;
  return {
    tp,
    tn,
    fp,
    fn,
    correct,
    count,
    accuracy: count ? correct / count : 0,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}
export type Metrics = ReturnType<typeof classificationMetrics>;
export function stratifiedFolds(records: readonly Ranch[]): Ranch[][] {
  const folds: Ranch[][] = Array.from({ length: 5 }, () => []);
  let offset = 0;
  for (const label of [0, 1]) {
    const group = shuffle(
      records.filter((r) => r.profitable === label),
      500 + label,
    );
    group.forEach((r, i) => folds[(offset + i) % 5].push(r));
    offset = (offset + group.length) % 5;
  }
  return folds;
}
export function assess(fit: Fit, records: readonly Ranch[]) {
  const predictions = records.map((r) => ({
    id: r.id,
    actual: r.profitable,
    probability: predictProfitability(fit, r.cattle, r.feed),
  }));
  return { predictions, metrics: classificationMetrics(predictions) };
}
export function crossValidate(development: readonly Ranch[]) {
  const folds = stratifiedFolds(development);
  const results = folds.map((validation, index) => {
    const training = folds.flatMap((fold, i) => (i === index ? [] : fold));
    const fit = fitRanches(training, 'logistic');
    return {
      ...fit,
      trainingIds: training.map((r) => r.id),
      validationIds: validation.map((r) => r.id),
      ...assess(fit, validation),
    };
  });
  return {
    folds: results,
    pooled: classificationMetrics(results.flatMap((fold) => fold.predictions)),
    meanAccuracy: results.reduce((sum, r) => sum + r.metrics.accuracy, 0) / 5,
  };
}
export type Validation = ReturnType<typeof crossValidate>;
