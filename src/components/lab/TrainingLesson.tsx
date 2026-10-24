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
  lossChange,
} from '../../lib/ml/presentation';
import type { LabController } from './useLabExperiment';
import { Guidance } from './Guidance';
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
    change = lossChange(previous.loss, current.loss),
    disabled = !!state.finished || experiment.steps >= MAX_UPDATES;
  return (
    <div className="ml-workspace">
      <div className="ml-primary">
        <Guidance {...controller}>
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
              Reset this model
            </button>
          </div>
        </Guidance>
        <p
          className="training-feedback"
          role="status"
          aria-live={state.running ? 'off' : 'polite'}
        >
          <strong>
            Step {experiment.steps} · {logistic ? 'Log loss' : 'MSE'}{' '}
            {fmt(previous.loss)} → {fmt(current.loss)}
          </strong>
          <span>
            {experiment.steps
              ? `Error ${change.direction}${change.percent === null ? '' : ` ${change.percent.toFixed(1)}%`} since the previous step.`
              : experiment.mode === 'manual'
                ? 'Manual parameters; a new loss trace starts here.'
                : 'Zero weights and bias. Train to make the first update.'}
          </span>
        </p>
        {experiment.steps >= MAX_UPDATES && (
          <p>Paused at 1,000 updates. Reset this model to start again.</p>
        )}
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
        />
      </div>
      <aside className="ml-controls">
        <label>
          Learning rate
          <select
            disabled={!!state.finished || state.running}
            value={experiment.rate}
            onChange={(e) => dispatch({ type: 'rate', value: +e.target.value })}
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
        <details>
          <summary>Explore parameters manually</summary>
          <p>
            Manual edits pause training and begin a new trace at step zero. They
            are not learned updates.
          </p>
          {logistic && (
            <p>Validation log loss: {fmt(loss(samples.validation, m, true))}</p>
          )}
          {[...m.w, m.b].map((value, i) => (
            <label key={i}>
              {i === m.w.length ? 'Bias' : `Weight ${i + 1}`}
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
        </details>
      </aside>
    </div>
  );
}
