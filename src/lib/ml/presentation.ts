import { predictProfitability, type Fit } from './ranches';
export const pct = (n: number | null) =>
  n === null ? 'Undefined' : `${(n * 100).toFixed(1)}%`;
export const fmt = (n: number) =>
  Math.abs(n) > 0 && Math.abs(n) < 0.001 ? n.toExponential(2) : n.toFixed(3);
export const dollars = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
export function probabilityColor(p: number): string {
  const low = [247, 246, 242],
    high = [151, 184, 161];
  return `rgb(${low.map((v, i) => Math.round(v + (high[i] - v) * p)).join(', ')})`;
}
export function probabilityField(fit: Fit) {
  return Array.from({ length: 625 }, (_, i) => {
    const cattle = 50 + (i % 25) * 18,
      feed = 400 + Math.floor(i / 25) * 40;
    return {
      cattle,
      feed,
      p: predictProfitability(fit, cattle + 9, feed + 20),
    };
  });
}
/** Raw-coordinate 50% hyperplane, clipped to the same feature window as the field. */
export function decisionBoundary(fit: Fit): [number, number][] {
  const a = fit.model.w[0] / fit.scaler.scale[0],
    b = fit.model.w[1] / fit.scaler.scale[1];
  const c = fit.model.b - a * fit.scaler.mean[0] - b * fit.scaler.mean[1];
  const points: [number, number][] = [];
  const add = (x: number, y: number) => {
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 50 &&
      x <= 500 &&
      y >= 400 &&
      y <= 1400 &&
      !points.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-7)
    )
      points.push([x, y]);
  };
  if (Math.abs(b) > 1e-12) {
    add(50, -(c + a * 50) / b);
    add(500, -(c + a * 500) / b);
  }
  if (Math.abs(a) > 1e-12) {
    add(-(c + b * 400) / a, 400);
    add(-(c + b * 1400) / a, 1400);
  }
  return points.slice(0, 2);
}
