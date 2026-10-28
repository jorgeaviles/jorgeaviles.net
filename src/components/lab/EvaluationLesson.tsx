import { pct } from '../../lib/ml/presentation';
import type { Metrics } from '../../lib/ml/ranches';
import type { LabController } from './useLabExperiment';
function MetricDetails({ metrics }: { metrics: Metrics }) {
  return (
    <dl className="ranch-confusion">
      <div>
        <dt>Profitable, predicted profitable (true positives)</dt>
        <dd>{metrics.tp}</dd>
      </div>
      <div>
        <dt>Not profitable, predicted not profitable (true negatives)</dt>
        <dd>{metrics.tn}</dd>
      </div>
      <div>
        <dt>Not profitable, predicted profitable (false positives)</dt>
        <dd>{metrics.fp}</dd>
      </div>
      <div>
        <dt>Profitable, predicted not profitable (false negatives)</dt>
        <dd>{metrics.fn}</dd>
      </div>
      <div>
        <dt>
          Precision · share of predicted profitable ranches that are profitable
        </dt>
        <dd>{pct(metrics.precision)}</dd>
      </div>
      <div>
        <dt>Recall · share of profitable ranches correctly identified</dt>
        <dd>{pct(metrics.recall)}</dd>
      </div>
    </dl>
  );
}
export function EvaluationLesson({ state, dispatch }: LabController) {
  const result = state.validation,
    selected = result?.folds[state.fold],
    final = state.finished;
  return (
    <div className="ranch-evaluation">
      <p>
        Fit on four groups of development ranches and predict the fifth. Repeat
        until every ranch has been tested outside its training group.
      </p>
      <button
        className="ranch-primary"
        disabled={!!final}
        onClick={() => dispatch({ type: 'validate' })}
      >
        Run five-fold validation
      </button>
      <div className="folds" role="group" aria-label="Inspect validation folds">
        {[0, 1, 2, 3, 4].map((i) => (
          <button
            key={i}
            aria-pressed={state.fold === i}
            onClick={() => dispatch({ type: 'fold', value: i })}
          >
            <span>Fold {i + 1}</span>
            <b>{state.fold === i ? 'Validate' : 'Train'}</b>
          </button>
        ))}
      </div>
      <div
        className="ranch-validation-result"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {selected && result ? (
          <>
            <p>
              Average validation accuracy{' '}
              <strong data-testid="validation-mean">
                {pct(result.meanAccuracy)}
              </strong>
            </p>
            <p data-testid="fold-result">
              Fold {state.fold + 1}: {selected.metrics.correct} of{' '}
              {selected.metrics.count} correct ·{' '}
              {pct(selected.metrics.accuracy)}
            </p>
            <p>
              Each fold tests different ranches, so scores vary with their
              patterns and small sample sizes.
            </p>
          </>
        ) : (
          <p>
            72 development ranches form five groups. Select a group to see which
            is held out, then run validation to compare all five scores.
          </p>
        )}
      </div>
      <section className="ranch-final" aria-labelledby="final-test-heading">
        <h3 id="final-test-heading">A final check on unseen ranches</h3>
        <p>
          A fresh classifier learns from all 72 development ranches, then
          predicts 18 untouched ranches. Reveal this once, after validation.
        </p>
        <button
          disabled={!result || !!final}
          onClick={() => dispatch({ type: 'test' })}
        >
          Test on unseen ranches
        </button>
        {final && (
          <div className="ranch-final-result" role="status" aria-live="polite">
            <p data-testid="final-result">
              <strong>
                {final.metrics.correct} of {final.metrics.count} correct
              </strong>{' '}
              · {pct(final.metrics.accuracy)} final-test accuracy.
            </p>
            <p>
              This small synthetic test illustrates generalization. Keep it out
              of repeated tuning; reset the whole experiment to begin again.
            </p>
          </div>
        )}
      </section>
      <details className="ranch-details">
        <summary>Explore evaluation details</summary>
        <p>
          Accuracy is correct predictions divided by all predictions. Validation
          uses five fresh logistic models with the same training schedule. Each
          model's feature means and scales are learned from its four training
          groups only. The average is the arithmetic mean of the five fold
          accuracies.
        </p>
        {selected ? (
          <>
            <h3>Selected validation fold</h3>
            <MetricDetails metrics={selected.metrics} />
          </>
        ) : (
          <p>
            Run validation to inspect the actual confusion counts, precision and
            recall.
          </p>
        )}
        {final && (
          <>
            <h3>Final test</h3>
            <MetricDetails metrics={final.metrics} />
          </>
        )}
      </details>
      <details className="ranch-details">
        <summary>Other ways to validate models</summary>
        <p>
          <b>Stratified folds</b> spread profitable and unprofitable ranches
          across the groups. This example uses that approach.
        </p>
        <p>
          <b>Grouped folds</b> keep related records, such as one attorney's
          bills, together to examine generalization across entities.
        </p>
        <p>
          <b>Time-based validation</b> trains on earlier observations and tests
          later ones when the question concerns future outcomes. The split
          should match the prediction question.
        </p>
      </details>
    </div>
  );
}
