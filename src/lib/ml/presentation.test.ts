import { describe, expect, it } from 'vitest';
import {
  createLabState,
  labReducer,
  classificationScale,
  fixtures,
} from './experiment';
import { probability, transform } from './models';
import {
  boundary,
  probabilityAt,
  probabilityField,
  displayRows,
} from './presentation';

describe('probability landscape from the authoritative model', () => {
  it.each([
    [0, 0.5, 0.5],
    [1, 0.491458355494, 0.507318042992],
    [11, 0.414046696073, 0.573894099119],
    [100, 0.131776968142, 0.834272699734],
  ])(
    'matches current model scoring and deterministic reference at step %i',
    (steps, low, high) => {
      let s = labReducer(createLabState(), { type: 'navigate', lesson: 1 });
      for (let i = 0; i < steps; i++) s = labReducer(s, { type: 'step' });
      const model = s.logistic.model;
      expect(probabilityAt(model, classificationScale, 2, 2)).toBeCloseTo(
        low,
        10,
      );
      expect(probabilityAt(model, classificationScale, 8, 8)).toBeCloseTo(
        high,
        10,
      );
      const field = probabilityField(model, classificationScale);
      expect(field).toHaveLength(625);
      for (const c of field) {
        expect(c.p).toBe(
          probability(
            model,
            transform(
              [c.x + c.size / 2, c.y + c.size / 2],
              classificationScale,
            ),
          ),
        );
        expect(c.p).toBeGreaterThanOrEqual(0);
        expect(c.p).toBeLessThanOrEqual(1);
      }
      if (steps === 0)
        expect(new Set(field.map((c) => c.p))).toEqual(new Set([0.5]));
      for (const row of displayRows(
        fixtures.validation,
        model,
        classificationScale,
      )) {
        expect(row.p).toBe(
          probabilityAt(model, classificationScale, row.x[0], row.x[1]),
        );
      }
    },
  );
  it('shows confidence changes even with an identical boundary', () => {
    const scale = { mean: [5, 5], scale: [2, 2] };
    const a = { w: [0.1, 0.1], b: 0 },
      b = { w: [1, 1], b: 0 };
    expect(boundary(a, scale)).toEqual(boundary(b, scale));
    expect(probabilityAt(b, scale, 8, 8)).toBeGreaterThan(
      probabilityAt(a, scale, 8, 8),
    );
    expect(probabilityAt(b, scale, 2, 2)).toBeLessThan(
      probabilityAt(a, scale, 2, 2),
    );
  });
  it('policy, population and selection preserve the field; manual edits and reset update it', () => {
    let s = labReducer(createLabState(), { type: 'navigate', lesson: 1 });
    s = labReducer(s, { type: 'step' });
    const original = s.logistic,
      field = probabilityField(original.model, classificationScale);
    s = labReducer(s, { type: 'population', value: 'validation' });
    s = labReducer(s, { type: 'select', key: 'validation', id: 'SYN-60' });
    s = labReducer(s, { type: 'navigate', lesson: 2 });
    s = labReducer(s, { type: 'policy', value: 'threshold' });
    s = labReducer(s, { type: 'threshold', value: 0.8 });
    expect(s.logistic).toBe(original);
    expect(probabilityField(s.logistic.model, classificationScale)).toEqual(
      field,
    );
    s = labReducer(s, { type: 'navigate', lesson: 1 });
    s = labReducer(s, { type: 'toggle-running' });
    s = labReducer(s, { type: 'parameters', model: { w: [0, 0], b: 2 } });
    expect(s.running).toBe(false);
    expect(s.logistic.mode).toBe('manual');
    expect(
      new Set(
        probabilityField(s.logistic.model, classificationScale).map((c) => c.p),
      ),
    ).toEqual(new Set([probability({ w: [0, 0], b: 2 }, [0, 0])]));
    s = labReducer(s, { type: 'reset-model' });
    expect(
      new Set(
        probabilityField(s.logistic.model, classificationScale).map((c) => c.p),
      ),
    ).toEqual(new Set([0.5]));
  });
});
