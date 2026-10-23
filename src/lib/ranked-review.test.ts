import { describe, expect, it } from 'vitest';
import {
  calculateRankedReview,
  defaultSelectionSize,
  normalizeSelectionSize,
  rankedReviewCases,
} from './ranked-review';

describe('synthetic ranked-review fixtures', () => {
  it('keeps twelve unique records in a stable order with both reference labels', () => {
    expect(rankedReviewCases).toHaveLength(12);
    expect(new Set(rankedReviewCases.map((record) => record.id)).size).toBe(12);
    expect(rankedReviewCases.map((record) => record.id)).toEqual([
      'SYN-01',
      'SYN-02',
      'SYN-03',
      'SYN-04',
      'SYN-05',
      'SYN-06',
      'SYN-07',
      'SYN-08',
      'SYN-09',
      'SYN-10',
      'SYN-11',
      'SYN-12',
    ]);
    expect(rankedReviewCases.filter((record) => record.relevant)).toHaveLength(
      6,
    );
  });
});

describe('calculateRankedReview', () => {
  it('provides the documented useful static default', () => {
    expect(calculateRankedReview(defaultSelectionSize)).toEqual({
      selectionSize: 4,
      totalCases: 12,
      totalRelevant: 6,
      relevantSelected: 3,
      irrelevantSelected: 1,
      relevantMissed: 3,
      precision: 0.75,
      recall: 0.5,
    });
  });

  it('handles an empty selection without division by zero', () => {
    expect(calculateRankedReview(0)).toMatchObject({
      selectionSize: 0,
      relevantSelected: 0,
      irrelevantSelected: 0,
      relevantMissed: 6,
      precision: 0,
      recall: 0,
    });
  });

  it('finds every relevant record when all records are selected', () => {
    expect(calculateRankedReview(12)).toMatchObject({
      selectionSize: 12,
      relevantSelected: 6,
      irrelevantSelected: 6,
      relevantMissed: 0,
      precision: 0.5,
      recall: 1,
    });
  });

  it('uses only the leading records and their reference labels', () => {
    expect(calculateRankedReview(3)).toMatchObject({
      relevantSelected: 2,
      precision: 2 / 3,
      recall: 2 / 6,
    });
  });

  it.each([
    [-1, 0],
    [-100, 0],
    [13, 12],
    [100, 12],
    [3.9, 3],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
  ])('normalizes input %s to %s', (input, expected) => {
    expect(calculateRankedReview(input).selectionSize).toBe(expected);
  });

  it('handles a list with no relevant records', () => {
    expect(
      calculateRankedReview(1, [
        { id: 'TEST-01', description: 'Test record', relevant: false },
      ]),
    ).toMatchObject({
      precision: 0,
      recall: 0,
      totalRelevant: 0,
      relevantMissed: 0,
    });
  });

  it('handles an empty list', () => {
    expect(calculateRankedReview(4, [])).toEqual({
      selectionSize: 0,
      totalCases: 0,
      totalRelevant: 0,
      relevantSelected: 0,
      irrelevantSelected: 0,
      relevantMissed: 0,
      precision: 0,
      recall: 0,
    });
  });

  it('does not change the input list or its order', () => {
    const records = Object.freeze([
      Object.freeze({ id: 'TEST-01', description: 'First', relevant: false }),
      Object.freeze({ id: 'TEST-02', description: 'Second', relevant: true }),
    ]);
    expect(calculateRankedReview(1, records).precision).toBe(0);
    expect(records.map((record) => record.id)).toEqual(['TEST-01', 'TEST-02']);
  });
});

describe('normalizeSelectionSize', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'handles invalid or empty available size %s',
    (total) => {
      expect(normalizeSelectionSize(4, total)).toBe(0);
    },
  );
});
