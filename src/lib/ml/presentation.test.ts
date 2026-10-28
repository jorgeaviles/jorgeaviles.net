import { expect, it } from 'vitest';
import { partitionRanches, fitRanches, predictProfitability } from './ranches';
import {
  probabilityField,
  probabilityColor,
  decisionBoundary,
  dollars,
} from './presentation';
it('uses the fitted classifier for each field cell and the 50% boundary', () => {
  const fit = fitRanches(partitionRanches().development, 'logistic');
  const field = probabilityField(fit);
  expect(field).toHaveLength(625);
  for (const cell of field)
    expect(cell.p).toBe(
      predictProfitability(fit, cell.cattle + 9, cell.feed + 20),
    );
  const boundary = decisionBoundary(fit);
  expect(boundary).toHaveLength(2);
  for (const [x, y] of boundary)
    expect(predictProfitability(fit, x, y)).toBeCloseTo(0.5, 12);
  expect(probabilityColor(0)).toBe('rgb(247, 246, 242)');
  expect(probabilityColor(1)).toBe('rgb(151, 184, 161)');
  expect(dollars(-12345)).toBe('-$12,345');
});
