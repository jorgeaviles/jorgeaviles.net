import { describe, it, expect } from 'vitest';
import {
  createLabState,
  labReducer,
  samples,
  lessonFromHash,
  MAX_UPDATES,
} from './experiment';
import { loss, step } from './models';
import { boundary, lossChange } from './presentation';
describe('lesson controller', () => {
  it('advances model, counter and trace from the same state', () => {
    let state = createLabState();
    for (let i = 0; i < 20; i++) state = labReducer(state, { type: 'step' });
    let model = createLabState().linear.model;
    for (let i = 0; i < 20; i++)
      model = step(samples.linear, model, false, 0.05);
    expect(state.linear.model).toEqual(model);
    expect(state.linear.steps).toBe(20);
    expect(state.linear.history).toHaveLength(21);
    expect(state.linear.history.at(-1)?.loss).toBe(
      loss(samples.linear, model, false),
    );
  });
  it('preserves independent histories and selections on navigation', () => {
    let s = labReducer(createLabState(), { type: 'step' });
    s = labReducer(s, { type: 'select', key: 'linear', id: 'TASK-8' });
    const linear = s.linear;
    s = labReducer(s, { type: 'navigate', lesson: 1 });
    s = labReducer(s, { type: 'step' });
    const logistic = s.logistic;
    s = labReducer(s, { type: 'population', value: 'validation' });
    s = labReducer(s, { type: 'select', key: 'validation', id: 'SYN-60' });
    s = labReducer(s, { type: 'navigate', lesson: 2 });
    s = labReducer(s, { type: 'budget', value: 10 });
    s = labReducer(s, { type: 'policy', value: 'threshold' });
    expect(s.logistic).toBe(logistic);
    s = labReducer(s, { type: 'navigate', lesson: 0 });
    expect(s.linear).toBe(linear);
    expect(s.selected).toMatchObject({
      linear: 'TASK-8',
      validation: 'SYN-60',
    });
  });
  it('distinguishes model reset, full reset and held-out test lock', () => {
    let s = labReducer(createLabState(), { type: 'step' });
    const linear = s.linear;
    s = labReducer(s, { type: 'navigate', lesson: 1 });
    s = labReducer(s, { type: 'step' });
    s = labReducer(s, { type: 'reset-model' });
    expect(s.linear).toBe(linear);
    expect(s.logistic.steps).toBe(0);
    s = labReducer(s, { type: 'test' });
    const locked = s;
    expect(labReducer(s, { type: 'step' })).toBe(locked);
    expect(
      labReducer(s, { type: 'parameters', model: { w: [1, 1], b: 1 } }),
    ).toBe(locked);
    expect(labReducer(s, { type: 'budget', value: 18 })).toBe(locked);
    s = labReducer(s, { type: 'reset-all' });
    expect(s.finished).toBeNull();
    expect(s.linear.steps).toBe(0);
  });
  it('stops continuous training at the existing update cap', () => {
    let s = labReducer(createLabState(), { type: 'navigate', lesson: 1 });
    s = labReducer(s, { type: 'toggle-running' });
    for (let i = 0; i < MAX_UPDATES; i++) s = labReducer(s, { type: 'step' });
    expect(s.logistic.steps).toBe(MAX_UPDATES);
    expect(s.running).toBe(false);
    const capped = s.logistic;
    s = labReducer(s, { type: 'step' });
    expect(s.logistic).toBe(capped);
  });
  it('manual exploration starts a trace and actual training replaces its status', () => {
    let s = labReducer(createLabState(), {
      type: 'parameters',
      model: { w: [100], b: -100 },
    });
    expect(s.linear.mode).toBe('manual');
    expect(s.linear.history[0].loss).toBe(
      loss(samples.linear, s.linear.model, false),
    );
    s = labReducer(s, { type: 'step' });
    expect(s.linear.mode).toBe('trained');
    expect(s.linear.steps).toBe(1);
    expect(lessonFromHash('#evaluation')).toBe(2);
    expect(lessonFromHash('#unknown')).toBe(0);
  });
});
describe('presentation geometry', () => {
  const scale = { mean: [0, 0], scale: [1, 1] };
  it('distinguishes constant, outside, vertical and diagonal boundaries', () => {
    expect(boundary({ w: [0, 0], b: 0 }, scale)).toEqual({
      kind: 'constant',
      probability: 0.5,
    });
    expect(boundary({ w: [1, 0], b: 1 }, scale)).toEqual({ kind: 'outside' });
    expect(boundary({ w: [1, 0], b: -5 }, scale)).toEqual({
      kind: 'visible',
      points: [
        [5, 0],
        [5, 10],
      ],
    });
    expect(boundary({ w: [1, 1], b: -10 }, scale)).toEqual({
      kind: 'visible',
      points: [
        [0, 10],
        [10, 0],
      ],
    });
  });
  it('reports increases, decreases and zero denominators honestly', () => {
    expect(lossChange(10, 12)).toEqual({ direction: 'increased', percent: 20 });
    expect(lossChange(10, 8)).toEqual({ direction: 'decreased', percent: 20 });
    expect(lossChange(0, 0)).toEqual({ direction: 'unchanged', percent: null });
  });
});
