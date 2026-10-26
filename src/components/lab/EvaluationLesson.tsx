import { rank, evaluate } from '../../lib/ml/models';
import {
  samples,
  fixtures,
  classificationScale,
} from '../../lib/ml/experiment';
import {
  displayRows,
  pct,
  fmt,
  reviewOutcome,
} from '../../lib/ml/presentation';
import type { LabController } from './useLabExperiment';
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
        <div className="ml-primary evaluation-primary">
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
          <p className="ranking-guide">
            Choose a record to inspect its calculation. The policy controls
            Review or Leave.
          </p>
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
          <div
            className="ranked-strip"
            role="group"
            aria-label="Ranked validation records"
          >
            {predictions.map((r, i) => (
              <button
                key={r.id}
                aria-description={`Rank ${i + 1}, ${r.id}, estimated probability ${pct(r.p)}, actual ${reviewOutcome(r.y)}, ${metrics.ids.has(r.id) ? 'selected for review' : 'not selected for review'}, ${selected.id === r.id ? 'inspecting this record' : 'activate to inspect'}`}
                aria-pressed={selected.id === r.id}
                className={metrics.ids.has(r.id) ? 'chosen' : ''}
                onClick={() =>
                  dispatch({ type: 'select', key: 'validation', id: r.id })
                }
              >
                <span className="record-heading">
                  <span className="record-rank">
                    #{String(i + 1).padStart(2, '0')}
                  </span>
                  <strong className="record-id">{r.id}</strong>
                </span>
                <span className="record-score">
                  <strong>{pct(r.p)}</strong>
                  <span>probability</span>
                </span>
                <span className="record-outcome">
                  <span aria-hidden="true">{r.y ? '●' : '△'}</span>
                  <span>{r.y ? 'Review needed' : 'No review needed'}</span>
                </span>
                <span className="record-policy">
                  <span aria-hidden="true">
                    {metrics.ids.has(r.id) ? '✓ ' : '– '}
                  </span>
                  {metrics.ids.has(r.id) ? 'Review' : 'Leave'}
                </span>
                <span className="inspection-flag" aria-hidden="true">
                  {selected.id === r.id ? 'Inspecting' : '\u00a0'}
                </span>
              </button>
            ))}
          </div>
          <p className="plot-key">
            ● additional review needed · △ no additional review needed
            (synthetic outcomes). Green Review flag = selected for review. Dark
            marker + Inspecting = inspected record. Scores descend; ties use
            record ID.
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
          <p className="table-context">
            Inspecting {selected.id}. “Selected for review” follows the decision
            policy.
          </p>
          <table>
            <caption>
              All validation predictions from the current logistic model
            </caption>
            <thead>
              <tr>
                {[
                  'Rank',
                  'Record',
                  'Task complexity',
                  'Information uncertainty',
                  'Score',
                  'Actual',
                  'Selected for review',
                ].map((v) => (
                  <th key={v} scope="col">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {predictions.map((r, i) => {
                const raw = rows.find((v) => v.id === r.id)!;
                return (
                  <tr
                    key={r.id}
                    aria-current={selected.id === r.id ? 'true' : undefined}
                  >
                    <td>{i + 1}</td>
                    <td>{r.id}</td>
                    <td>{fmt(raw.x[0])}</td>
                    <td>{fmt(raw.x[1])}</td>
                    <td>{pct(r.p)}</td>
                    <td>{reviewOutcome(r.y)}</td>
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
          <div className="final-test-results" role="status">
            <h3>Held-out test results</h3>
            <dl className="test-metrics">
              {[
                ['Precision', pct(state.finished.precision)],
                ['Recall', pct(state.finished.recall)],
                ['Accuracy', pct(state.finished.accuracy)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>Experiment locked.</p>
          </div>
        )}
      </details>
    </>
  );
}
