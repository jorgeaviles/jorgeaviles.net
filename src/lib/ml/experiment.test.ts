import { expect, it } from 'vitest';
import {
  createLabState,
  labReducer,
  fixtures,
  MAX_UPDATES,
  lessonFromHash,
} from './experiment';
import { fitRanches, assess, toRows } from './ranches';
import { step, scaled, loss } from './models';
it('starts fitted, paused and without held-out results', () => {
  const s = createLabState();
  expect(s.running).toBe(false);
  expect(s.finished).toBeNull();
  expect(s.validation).toBeNull();
  for (const kind of ['linear', 'logistic'] as const) {
    expect(s[kind].model).toEqual(fitRanches(fixtures.development, kind).model);
    expect(s[kind].history.at(-1)!.loss).toBeLessThan(s[kind].history[0].loss);
  }
});
it('advances actual weights and loss atomically and resets only the chosen model', () => {
  let s = labReducer(createLabState(), { type: 'reset-model' });
  expect(s.linear.steps).toBe(0);
  const old = s.linear,
    rows = scaled(toRows(fixtures.development, 'linear'), old.scaler);
  s = labReducer(s, { type: 'step' });
  expect(s.linear.model).toEqual(step(rows, old.model, false, 0.08));
  expect(s.linear.history.at(-1)!.loss).toBe(loss(rows, s.linear.model, false));
  const linear = s.linear;
  s = labReducer(s, { type: 'navigate', lesson: 1 });
  s = labReducer(s, { type: 'reset-model' });
  expect(s.linear).toBe(linear);
  expect(s.logistic.steps).toBe(0);
});
it('isolates input inspection from learning and pauses on navigation', () => {
  let s = createLabState();
  const model = s.linear.model;
  s = labReducer(s, { type: 'input', feature: 'cattle', value: 400 });
  expect(s.linear.model).toBe(model);
  s = labReducer(s, { type: 'toggle-running' });
  expect(s.running).toBe(true);
  s = labReducer(s, { type: 'navigate', lesson: 2 });
  expect(s.running).toBe(false);
  const inspected = labReducer(s, {
    type: 'inspect',
    id: fixtures.development[0].id,
  });
  expect(inspected.cattle).toBe(fixtures.development[0].cattle);
  expect(labReducer(s, { type: 'inspect', id: fixtures.test[0].id })).toBe(s);
  expect(labReducer(s, { type: 'input', feature: 'feed', value: NaN })).toBe(s);
  expect(labReducer(s, { type: 'fold', value: 5 })).toBe(s);
});
it('requires validation before testing, fits the final model on 72 ranches, locks evaluation but preserves independent exploration', () => {
  let s = labReducer(createLabState(), { type: 'navigate', lesson: 1 });
  s = labReducer(s, { type: 'reset-model' });
  s = labReducer(s, { type: 'navigate', lesson: 2 });
  expect(labReducer(s, { type: 'test' })).toBe(s);
  s = labReducer(s, { type: 'validate' });
  expect(s.finished).toBeNull();
  const saved = s.validation;
  s = labReducer(s, { type: 'fold', value: 3 });
  expect(s.validation).toBe(saved);
  expect(s.fold).toBe(3);
  s = labReducer(s, { type: 'test' });
  const fit = fitRanches(fixtures.development, 'logistic');
  expect(s.finished).toEqual({ ...fit, ...assess(fit, fixtures.test) });
  for (const type of [
    'test',
    'validate',
    'step',
    'reset-model',
    'toggle-running',
  ] as const)
    expect(labReducer(s, { type })).toBe(s);
  const final = s.finished,
    validation = s.validation;
  for (const lesson of [0, 1] as const) {
    s = labReducer(s, { type: 'navigate', lesson });
    s = labReducer(s, { type: 'reset-model' });
    expect(s[lesson === 0 ? 'linear' : 'logistic'].steps).toBe(0);
    s = labReducer(s, { type: 'toggle-running' });
    expect(s.running).toBe(true);
    s = labReducer(s, { type: 'step' });
    expect(s[lesson === 0 ? 'linear' : 'logistic'].steps).toBe(1);
    expect(s.finished).toBe(final);
    expect(s.validation).toBe(validation);
  }
  const logistic = s.logistic,
    linear = s.linear;
  s = labReducer(s, { type: 'reset-evaluation' });
  expect(s.finished).toBeNull();
  expect(s.validation).toBeNull();
  expect(s.logistic).toBe(logistic);
  expect(s.linear).toBe(linear);
  expect(s.running).toBe(false);
  expect(labReducer(s, { type: 'test' })).toBe(s);
  expect(labReducer(s, { type: 'reset-all' })).toEqual({
    ...createLabState(),
    lesson: 1,
  });
});
it('caps automatic updates and preserves deep-link anchors', () => {
  let s = createLabState();
  s = { ...s, linear: { ...s.linear, steps: MAX_UPDATES }, running: true };
  expect(labReducer(s, { type: 'step' }).running).toBe(false);
  expect(lessonFromHash('#evaluation')).toBe(2);
  expect(lessonFromHash('#logistic-regression')).toBe(1);
  expect(lessonFromHash('#unknown')).toBe(0);
});
