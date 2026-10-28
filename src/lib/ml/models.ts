/** Small batch models. MSE uses mean squared residuals; BCE uses stable softplus. */
export type Row = { id: string; x: number[]; y: number };
export type Model = { w: number[]; b: number };
export const initial = (dimensions: number): Model => ({
  w: Array(dimensions).fill(0),
  b: 0,
});
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function fitScaler(rows: Row[]) {
  const mean = rows[0].x.map(
    (_, j) => rows.reduce((s, r) => s + r.x[j], 0) / rows.length,
  );
  const scale = mean.map(
    (m, j) =>
      Math.sqrt(
        rows.reduce((s, r) => s + (r.x[j] - m) ** 2, 0) / rows.length,
      ) || 1,
  );
  return { mean, scale };
}
export type Scaler = ReturnType<typeof fitScaler>;
export const transform = (x: number[], s: Scaler) =>
  x.map((v, j) => (v - s.mean[j]) / s.scale[j]);
export const scaled = (rows: Row[], s: Scaler) =>
  rows.map((r) => ({ ...r, x: transform(r.x, s) }));
export const score = (m: Model, x: number[]) =>
  m.b + m.w.reduce((s, w, j) => s + w * x[j], 0);
export function sigmoid(z: number) {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}
export const probability = (m: Model, x: number[]) => sigmoid(score(m, x));
export function loss(rows: Row[], m: Model, logistic: boolean) {
  return (
    rows.reduce((s, r) => {
      const z = score(m, r.x);
      return (
        s +
        (logistic
          ? Math.max(z, 0) - r.y * z + Math.log1p(Math.exp(-Math.abs(z)))
          : (z - r.y) ** 2)
      );
    }, 0) / rows.length
  );
}
export function gradient(rows: Row[], m: Model, logistic: boolean): Model {
  const g = initial(m.w.length);
  for (const r of rows) {
    const e =
      (logistic ? sigmoid(score(m, r.x)) - r.y : 2 * (score(m, r.x) - r.y)) /
      rows.length;
    g.b += e;
    g.w = g.w.map((w, j) => w + e * r.x[j]);
  }
  return g;
}
export function step(
  rows: Row[],
  m: Model,
  logistic: boolean,
  rate: number,
): Model {
  const g = gradient(rows, m, logistic);
  const bound = (n: number) => Math.max(-100, Math.min(100, n));
  return {
    w: m.w.map((w, j) => bound(w - rate * g.w[j])),
    b: bound(m.b - rate * g.b),
  };
}
