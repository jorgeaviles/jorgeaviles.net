import { rank, evaluate } from '../../lib/ml/models';
import {
  samples,
  fixtures,
  classificationScale,
} from '../../lib/ml/experiment';
import { displayRows, pct, fmt } from '../../lib/ml/presentation';
import type { LabController } from './useLabExperiment';
import { Guidance } from './Guidance';
import { RecordInspector } from './RecordInspector';
export function EvaluationLesson(controller: LabController) {
  const { state, dispatch, navigate } = controller,
    predictions = rank(samples.validation, state.logistic.model),
    metrics = evaluate(
      predictions,
      state.policy,
      state.policy === 'budget' ? state.budget : state.threshold,
    ),
    rows = displayRows(
      fixtures.validation,
      state.logistic.model,
      classificationScale,
    ),
    selected = rows.find((r) => r.id === state.selected.validation) ?? rows[0];
  return (
    <>
      <div className="ml-workspace">
        <div className="ml-primary">
          <Guidance {...controller} />
          {state.logistic.mode !== 'trained' ? (
            <p className="ranking-note">
              {state.logistic.mode === 'initial'
                ? 'Untrained model: every score is 50%. Record-ID tie breaking is not a learned ranking.'
                : 'Manual parameters: these scores are not a learned ranking.'}{' '}
              <a
                href="#logistic-regression"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(1);
                }}
              >
                Train the classifier
              </a>
              .
            </p>
          ) : (
            <p className="ranking-note">
              Ranking from {state.logistic.steps} classifier updates · 18
              validation records.
            </p>
          )}
          <fieldset disabled={!!state.finished}>
            <legend>Decision policy</legend>
            <label>
              <input
                type="radio"
                name="policy"
                checked={state.policy === 'budget'}
                onChange={() => dispatch({ type: 'policy', value: 'budget' })}
              />{' '}
              Top-K review budget
            </label>
            <label>
              <input
                type="radio"
                name="policy"
                checked={state.policy === 'threshold'}
                onChange={() =>
                  dispatch({ type: 'policy', value: 'threshold' })
                }
              />{' '}
              Probability threshold
            </label>
            <label className="policy-slider">
              {state.policy === 'budget'
                ? 'Review budget'
                : 'Probability cutoff'}{' '}
              <output>
                {state.policy === 'budget'
                  ? `${state.budget} of 18`
                  : pct(state.threshold)}
              </output>
              <input
                aria-label={
                  state.policy === 'budget'
                    ? 'Review budget'
                    : 'Probability cutoff'
                }
                type="range"
                min="0"
                max={state.policy === 'budget' ? 18 : 1}
                step={state.policy === 'budget' ? 1 : 0.01}
                value={
                  state.policy === 'budget' ? state.budget : state.threshold
                }
                onChange={(e) =>
                  dispatch({
                    type: state.policy === 'budget' ? 'budget' : 'threshold',
                    value: +e.target.value,
                  })
                }
              />
            </label>
          </fieldset>
          <dl className="essential-metrics" aria-label="Review outcomes">
            {[
              ['Selected', `${metrics.count} / 18`],
              ['Precision', pct(metrics.precision)],
              ['Recall', pct(metrics.recall)],
              ['Missed positives', metrics.fn],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="ranked-strip" aria-label="Ranked validation records">
            {predictions.map((r, i) => (
              <button
                key={r.id}
                aria-description={`Rank ${i + 1}, ${r.id}, estimated probability ${pct(r.p)}, actual ${r.y ? 'positive' : 'negative'}, ${metrics.ids.has(r.id) ? 'selected for review' : 'not selected for review'}`}
                aria-pressed={selected.id === r.id}
                className={metrics.ids.has(r.id) ? 'chosen' : ''}
                onClick={() =>
                  dispatch({ type: 'select', key: 'validation', id: r.id })
                }
              >
                <span>{i + 1}</span>
                <strong>{r.y ? '●' : '△'}</strong>
                <span>{pct(r.p)}</span>
                <small>{metrics.ids.has(r.id) ? 'Review' : 'Leave'}</small>
              </button>
            ))}
          </div>
          <p className="plot-key">
            ● actual positive · △ actual negative. Green fill + Review =
            selected for review. Outer outline = inspected record. Scores
            descend; ties use record ID.
          </p>
          <details>
            <summary>Understand the outcomes</summary>
            <dl className="confusion-metrics">
              {[
                ['True positives', metrics.tp],
                ['False positives', metrics.fp],
                ['True negatives', metrics.tn],
                ['Missed positives (FN)', metrics.fn],
                ['Accuracy', pct(metrics.accuracy)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p>
              Precision = TP / (TP + FP); recall = TP / (TP + FN). Precision is
              undefined when nothing is selected. More reviews may improve
              recall; precision can rise or fall.
            </p>
            <p>
              Threshold selects scores at or above the cutoff. Top-K selects
              exactly K records, including ties by ID. Neither changes model
              weights.
            </p>
          </details>
        </div>
        <aside className="ml-controls">
          <RecordInspector
            rows={rows}
            selected={selected}
            kind="logistic"
            experiment={state.logistic}
            selectionKey="validation"
            dispatch={dispatch}
          />
        </aside>
      </div>
      <details>
        <summary>Inspect records</summary>
        <div
          className="ml-table"
          tabIndex={0}
          role="region"
          aria-label="Validation records, scroll horizontally"
          onKeyDown={(e) => {
            if (
              e.target === e.currentTarget &&
              (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
            ) {
              e.preventDefault();
              e.currentTarget.scrollLeft += e.key === 'ArrowRight' ? 60 : -60;
            }
          }}
        >
          <table>
            <caption>
              All validation predictions from the current logistic model
            </caption>
            <thead>
              <tr>
                {[
                  'Rank',
                  'Record',
                  'Feature 1',
                  'Feature 2',
                  'Score',
                  'Actual',
                  'Selected',
                ].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {predictions.map((r, i) => {
                const raw = rows.find((v) => v.id === r.id)!;
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.id}</td>
                    <td>{fmt(raw.x[0])}</td>
                    <td>{fmt(raw.x[1])}</td>
                    <td>{pct(r.p)}</td>
                    <td>{r.y ? 'Positive' : 'Negative'}</td>
                    <td>{metrics.ids.has(r.id) ? 'Yes' : 'No'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Final test assessment</summary>
        <p>
          54 training records fit weights and scaling. Validation supports
          policy exploration. The 18 held-out test records are excluded from
          both. Revealing test results locks training and policies until a
          complete reset. Repeated test inspection still constitutes tuning;
          this synthetic example cannot establish unbiased operational
          performance.
        </p>
        <button
          disabled={!!state.finished}
          onClick={() => dispatch({ type: 'test' })}
        >
          Lock experiment and evaluate test
        </button>
        {state.finished && (
          <p>
            Held-out test: precision {pct(state.finished.precision)}, recall{' '}
            {pct(state.finished.recall)}, accuracy{' '}
            {pct(state.finished.accuracy)}. Experiment locked.
          </p>
        )}
      </details>
    </>
  );
}
