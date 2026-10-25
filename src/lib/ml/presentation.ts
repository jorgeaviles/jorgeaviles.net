import {
  probability,
  score,
  sigmoid,
  transform,
  type Model,
  type Row,
  type Scaler,
} from './models';
export const pct = (n: number | null) =>
  n === null ? 'Undefined' : `${(n * 100).toFixed(1)}%`;
export const fmt = (n: number) =>
  Math.abs(n) > 0 && Math.abs(n) < 0.001 ? n.toExponential(2) : n.toFixed(3);
export type DisplayRow = Row & { normalized: number[]; z: number; p: number };
export function displayRows(
  rows: Row[],
  model: Model,
  scale: Scaler,
): DisplayRow[] {
  return rows.map((row) => {
    const normalized = transform(row.x, scale),
      z = score(model, normalized);
    return { ...row, normalized, z, p: sigmoid(z) };
  });
}
export type Boundary =
  | { kind: 'constant'; probability: number }
  | { kind: 'outside' }
  | { kind: 'visible'; points: [[number, number], [number, number]] };
/** Intersect the raw-coordinate hyperplane with the 0–10 feature window. */
export function boundary(model: Model, scale: Scaler): Boundary {
  const a = model.w[0] / scale.scale[0],
    b = model.w[1] / scale.scale[1],
    c = model.b - a * scale.mean[0] - b * scale.mean[1];
  if (Math.hypot(a, b) < 1e-10)
    return { kind: 'constant', probability: sigmoid(c) };
  const points: [number, number][] = [];
  const add = (x: number, y: number) => {
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= -1e-8 &&
      x <= 10 + 1e-8 &&
      y >= -1e-8 &&
      y <= 10 + 1e-8 &&
      !points.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-8)
    )
      points.push([x, y]);
  };
  if (Math.abs(b) > 1e-10) {
    add(0, -c / b);
    add(10, (-c - 10 * a) / b);
  }
  if (Math.abs(a) > 1e-10) {
    add(-c / a, 0);
    add((-c - 10 * b) / a, 10);
  }
  return points.length >= 2
    ? { kind: 'visible', points: [points[0], points[1]] }
    : { kind: 'outside' };
}
export function lossChange(previous: number, current: number) {
  const delta = current - previous;
  return {
    direction: delta < 0 ? 'decreased' : delta > 0 ? 'increased' : 'unchanged',
    percent: previous === 0 ? null : Math.abs(delta / previous) * 100,
  };
}

/** Fictional task outcomes, shared by the plot, inspector and evaluation. */
export const reviewOutcome = (outcome: number) =>
  outcome ? 'Additional review needed' : 'No additional review needed';
export const probabilityAt = (
  model: Model,
  scale: Scaler,
  x: number,
  y: number,
) => probability(model, transform([x, y], scale));
export type ProbabilityCell = { x: number; y: number; size: number; p: number };
/** A fixed 25×25 grid: each tile estimates probability at its raw-coordinate center. */
export function probabilityField(
  model: Model,
  scale: Scaler,
): ProbabilityCell[] {
  const size = 10 / 25;
  return Array.from({ length: 625 }, (_, i) => {
    const x = (i % 25) * size,
      y = Math.floor(i / 25) * size;
    return {
      x,
      y,
      size,
      p: probabilityAt(model, scale, x + size / 2, y + size / 2),
    };
  });
}
/** Muted neutral-to-green scale; the observation symbols remain independently readable. */
export function probabilityColor(p: number): string {
  const low = [247, 246, 242],
    high = [151, 184, 161];
  return `rgb(${low.map((v, i) => Math.round(v + (high[i] - v) * p)).join(', ')})`;
}
