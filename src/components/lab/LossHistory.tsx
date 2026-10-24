import type { Experiment } from '../../lib/ml/experiment';
import { fmt } from '../../lib/ml/presentation';
export function LossHistory({
  experiment,
  logistic,
}: {
  experiment: Experiment;
  logistic: boolean;
}) {
  const { history } = experiment,
    first = history[0],
    last = history[history.length - 1];
  const top = Math.max(...history.map((p) => p.loss), Number.EPSILON) * 1.05;
  const x = (step: number) => 48 + (step / Math.max(1, last.step)) * 220;
  const y = (loss: number) => 90 - (loss / top) * 68;
  return (
    <figure className="loss-history">
      <figcaption>
        {logistic ? 'Log loss' : 'MSE'} versus training step
      </figcaption>
      <svg
        viewBox="0 0 290 123"
        role="img"
        aria-label={`Loss history: initial ${fmt(first.loss)}, current ${fmt(last.loss)}, ${last.step} updates. Vertical scale zero to ${fmt(top)}.`}
      >
        <path d="M48 18V90H270" stroke="currentColor" fill="none" />
        {[0, top / 2, top].map((v) => (
          <text key={v} x="42" y={y(v) + 4} textAnchor="end">
            {v >= 100 ? v.toFixed(0) : v.toFixed(v < 0.01 ? 4 : 2)}
          </text>
        ))}
        <polyline
          fill="none"
          stroke="#254f3e"
          strokeWidth="2"
          points={history.map((p) => `${x(p.step)},${y(p.loss)}`).join(' ')}
        />
        <circle cx={x(first.step)} cy={y(first.loss)} r="3" fill="#254f3e" />
        <circle cx={x(last.step)} cy={y(last.loss)} r="3" fill="#254f3e" />
        <text x="48" y="110">
          0
        </text>
        <text x="270" y="110" textAnchor="end">
          {last.step} steps
        </text>
      </svg>
      <p>
        Initial {fmt(first.loss)} · Current {fmt(last.loss)}. Zero-based scale
        expands only if loss exceeds the previous high; a falling curve alone
        does not establish convergence.
      </p>
    </figure>
  );
}
