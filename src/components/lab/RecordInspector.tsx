import type { DisplayRow } from '../../lib/ml/presentation';
import { fmt, pct, reviewOutcome } from '../../lib/ml/presentation';
import type { Experiment, Kind, SelectionKey } from '../../lib/ml/experiment';
import { regressionScale } from '../../lib/ml/experiment';
import type { LabController } from './useLabExperiment';
type Props = {
  rows: DisplayRow[];
  selected: DisplayRow;
  kind: Kind;
  experiment: Experiment;
  selectionKey: SelectionKey;
  dispatch: LabController['dispatch'];
};
export function RecordInspector({
  rows,
  selected,
  kind,
  experiment,
  selectionKey,
  dispatch,
}: Props) {
  const logistic = kind === 'logistic',
    m = experiment.model;
  return (
    <section
      className="record-inspector"
      aria-label="Selected example calculation"
    >
      <label>
        Inspect example
        <select
          aria-label="Inspect example"
          value={selected.id}
          onChange={(e) =>
            dispatch({ type: 'select', key: selectionKey, id: e.target.value })
          }
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id}
            </option>
          ))}
        </select>
      </label>
      <p className="observed-value">
        {selected.id} · Observed{' '}
        {logistic
          ? `synthetic outcome: ${reviewOutcome(selected.y)}`
          : `${fmt(selected.y)} minutes`}
      </p>
      {logistic ? (
        <dl className="task-calculation" aria-label="Selected task prediction">
          <div>
            <dt>Task complexity</dt>
            <dd>{fmt(selected.x[0])} / 10</dd>
          </div>
          <div>
            <dt>Information uncertainty</dt>
            <dd>{fmt(selected.x[1])} / 10</dd>
          </div>
          <div>
            <dt>Estimated probability of additional review</dt>
            <dd data-testid="selected-probability">{pct(selected.p)}</dd>
          </div>
          <div>
            <dt>Weighted score z</dt>
            <dd>{fmt(selected.z)}</dd>
          </div>
        </dl>
      ) : (
        <ol className="calculation-flow" aria-label="Features to prediction">
          <li>
            <span>Features</span>
            <strong>{selected.x.map(fmt).join(', ')}</strong>
          </li>
          <li>
            <span>Weighted score z</span>
            <strong>{fmt(selected.z)}</strong>
          </li>
          <li>
            <span>Predicted minutes</span>
            <strong>{fmt(selected.z)}</strong>
          </li>
        </ol>
      )}
      {logistic && (
        <p className="inspector-note">
          Fictional scores; this estimate is not calibrated against real work.
        </p>
      )}
      <details>
        <summary>Inspect the mathematics</summary>
        <p>
          Standardized features: {selected.normalized.map(fmt).join(', ')}.{' '}
          {logistic
            ? 'Scaling was fitted on the 54 training records only.'
            : 'Scaling uses the 24 synthetic training observations.'}
        </p>
        <p>
          z = w · x + b; w = [{m.w.map(fmt).join(', ')}], b = {fmt(m.b)}. The
          weighted score is {fmt(selected.z)}.
        </p>
        {logistic ? (
          <p>
            σ(z) = 1 / (1 + exp(−z)) = {pct(selected.p)}. Actual class:{' '}
            {selected.y}. Predicted class at 50%:{' '}
            {reviewOutcome(selected.p >= 0.5 ? 1 : 0)}. The decision policy in
            Evaluation is separate from these model parameters.
          </p>
        ) : (
          <p>
            Residual = observed − predicted = {fmt(selected.y - selected.z)}{' '}
            minutes. Slope in original units ={' '}
            {fmt(m.w[0] / regressionScale.scale[0])}; intercept ={' '}
            {fmt(
              m.b -
                (m.w[0] * regressionScale.mean[0]) / regressionScale.scale[0],
            )}
            .
          </p>
        )}
        <p>
          {logistic
            ? 'BCE = mean(softplus(z) − yz); gradient = mean((σ(z) − y)x).'
            : 'MSE = mean((prediction − observation)²); gradient = 2 mean((prediction − observation)x).'}{' '}
          The bias gradient omits x. Each step subtracts learning rate ×
          gradient; parameter bounds remain ±100.
        </p>
      </details>
    </section>
  );
}
