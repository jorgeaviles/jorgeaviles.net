import { useMemo } from 'react';
import { loss, score, transform } from '../../lib/ml/models';
import {
  fixtures,
  samples,
  classificationScale,
  regressionScale,
  MAX_UPDATES,
  type Kind,
} from '../../lib/ml/experiment';
import {
  displayRows,
  boundary,
  fmt,
  probabilityField,
} from '../../lib/ml/presentation';
import type { LabController } from './useLabExperiment';
import { ModelPlot } from './ModelPlot';
import { LossHistory } from './LossHistory';
import { RecordInspector } from './RecordInspector';
export function TrainingLesson(controller: LabController) {
  const { state, dispatch } = controller,
    kind: Kind = state.lesson === 0 ? 'linear' : 'logistic',
    logistic = kind === 'logistic',
    experiment = state[kind],
    m = experiment.model,
    key = logistic ? state.population : 'linear',
    raw = logistic
      ? state.population === 'training'
        ? fixtures.train
        : fixtures.validation
      : fixtures.regression,
    rows = displayRows(
      raw,
      m,
      logistic ? classificationScale : regressionScale,
    ),
    selected = rows.find((r) => r.id === state.selected[key]) ?? rows[0],
    current = experiment.history.at(-1)!,
    previous = experiment.history.at(-2) ?? current,
    delta = current.loss - previous.loss,
    disabled = !!state.finished || experiment.steps >= MAX_UPDATES;
  const field = useMemo(
    () => (logistic ? probabilityField(m, classificationScale) : []),
    [logistic, m],
  );
  return (
    <div className="training-lesson">
      <div
        className="training-session"
        role="group"
        aria-label="Model training"
      >
        <div className="training-command">
          <p className="training-label">Model training</p>
          <div className="ml-actions">
            <button
              disabled={disabled || state.running}
              onClick={() => dispatch({ type: 'step' })}
            >
              Train one step
            </button>
            <button
              disabled={disabled}
              aria-pressed={state.running}
              onClick={() => dispatch({ type: 'toggle-running' })}
            >
              {state.running ? 'Pause' : 'Train'}
            </button>
            <button
              disabled={!!state.finished}
              onClick={() => dispatch({ type: 'reset-model' })}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="training-state">
          <p className="training-label">Current model</p>
          <p
            className="training-feedback"
            role="status"
            aria-live={state.running ? 'off' : 'polite'}
          >
            Step {experiment.steps} · {logistic ? 'Log loss' : 'MSE'}{' '}
            {fmt(current.loss)} ·{' '}
            {experiment.steps
              ? `${delta < 0 ? '↓' : delta > 0 ? '↑' : 'Unchanged'} ${fmt(Math.abs(delta))} since previous step`
              : experiment.mode === 'manual'
                ? 'Manual parameters · new baseline'
                : 'Model not trained'}
          </p>
          {experiment.steps >= MAX_UPDATES && (
            <p>Paused at 1,000 updates. Reset to start again.</p>
          )}
          <dl
            className="learned-parameters"
            aria-label="Current model parameters"
          >
            {(logistic
              ? [
                  ['Complexity weight', m.w[0]],
                  ['Uncertainty weight', m.w[1]],
                  ['Bias', m.b],
                ]
              : [
                  ['Slope (min/point)', m.w[0] / regressionScale.scale[0]],
                  [
                    'Intercept (min)',
                    m.b -
                      (m.w[0] * regressionScale.mean[0]) /
                        regressionScale.scale[0],
                  ],
                ]
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{fmt(Number(value))}</dd>
              </div>
            ))}
          </dl>
          {logistic && (
            <p className="parameter-note">
              Weights act on training-standardized scores.
            </p>
          )}
        </div>
      </div>
      <div className="ml-workspace training-workspace">
        <div className="ml-primary">
          {logistic && (
            <label className="population-control">
              Show{' '}
              <select
                aria-label="Show"
                value={state.population}
                onChange={(e) =>
                  dispatch({
                    type: 'population',
                    value: e.target.value as 'training' | 'validation',
                  })
                }
              >
                <option value="training">Training · 54 examples</option>
                <option value="validation">Validation · 18 examples</option>
              </select>
            </label>
          )}
          <ModelPlot
            kind={kind}
            points={rows}
            selected={selected.id}
            onSelect={(id) => dispatch({ type: 'select', key, id })}
            initial={experiment.mode === 'initial'}
            ends={
              logistic
                ? [0, 0]
                : [
                    score(m, transform([0], regressionScale)),
                    score(m, transform([10], regressionScale)),
                  ]
            }
            boundary={
              logistic ? boundary(m, classificationScale) : { kind: 'outside' }
            }
            population={state.population}
            field={field}
          />
        </div>
        <aside
          className="ml-controls"
          aria-label="Model controls and inspected example"
        >
          <label>
            Learning rate
            <select
              disabled={!!state.finished || state.running}
              value={experiment.rate}
              onChange={(e) =>
                dispatch({ type: 'rate', value: +e.target.value })
              }
            >
              <option value="0.01">Careful · 0.01</option>
              <option value="0.05">Steady · 0.05</option>
              <option value="0.1">Faster · 0.1</option>
            </select>
          </label>
          <LossHistory experiment={experiment} logistic={logistic} />
          <RecordInspector
            rows={rows}
            selected={selected}
            kind={kind}
            experiment={experiment}
            selectionKey={key}
            dispatch={dispatch}
          />
        </aside>
      </div>
      <details className="parameter-explorer">
        <summary>Explore parameters manually</summary>
        <p>
          Manual edits pause training and begin a new trace at step zero. They
          are not learned updates.
        </p>
        {logistic && (
          <p>Validation log loss: {fmt(loss(samples.validation, m, true))}</p>
        )}
        <div className="parameter-fields">
          {[...m.w, m.b].map((value, i) => (
            <label key={i}>
              {i === m.w.length
                ? 'Bias'
                : logistic
                  ? ['Complexity weight', 'Uncertainty weight'][i]
                  : `Weight ${i + 1}`}
              <input
                type="number"
                min="-100"
                max="100"
                step="0.1"
                value={value}
                disabled={!!state.finished}
                onChange={(e) => {
                  const model = { w: [...m.w], b: m.b };
                  if (i === m.w.length) model.b = +e.target.value;
                  else model.w[i] = +e.target.value;
                  dispatch({ type: 'parameters', model });
                }}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
