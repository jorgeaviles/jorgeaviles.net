import { useEffect, useRef } from 'react';
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
  const previousResult = useRef(result);
  const firstRound = useRef<HTMLButtonElement>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (result !== previousResult.current) {
      (result ? firstRound : runButton).current?.focus();
      previousResult.current = result;
    }
  }, [result]);
  return (
    <div className="ranch-evaluation">
      <p className="lesson-instruction">
        Run five checks: train the profitability classifier on four groups of
        ranches and predict the fifth.
      </p>
      <section aria-labelledby="validation-heading">
        <h3 id="validation-heading">Stage 1 · Cross-validation</h3>
        <p>72 development ranches, split into five groups.</p>
        {result ? (
          <>
            <p id="fold-inspection-help">
              Five checks complete. Scores show correct/total. Select a saved
              result to inspect it; no new model runs.
            </p>
            <div
              className="folds"
              role="group"
              aria-label="Inspect completed validation checks"
              aria-describedby="fold-inspection-help"
            >
              {result.folds.map((fold, i) => (
                <button
                  key={i}
                  ref={i === 0 ? firstRound : undefined}
                  aria-pressed={state.fold === i}
                  onClick={() => dispatch({ type: 'fold', value: i })}
                >
                  <span>Round {i + 1}</span>
                  <b data-testid="fold-score">{pct(fold.metrics.accuracy)}</b>
                  <span>
                    {fold.metrics.correct}/{fold.metrics.count}
                    <span className="sr-only"> correct</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              className="folds fold-illustration"
              role="img"
              aria-label="Example round: train on groups 1 to 4 and check group 5"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <span>Group {i + 1}</span>
                  <b>{i === 4 ? 'Check' : 'Train'}</b>
                </div>
              ))}
            </div>
            <p className="fold-caption">
              One round illustrated. The checked group changes each round.
            </p>
            <button
              ref={runButton}
              className="ranch-primary"
              onClick={() => dispatch({ type: 'validate' })}
            >
              Run five validation checks
            </button>
          </>
        )}
        <div
          className="ranch-validation-result"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {result && selected && (
            <>
              <p data-testid="validation-pooled">
                Across five validation rounds, the classifier correctly
                predicted{' '}
                <b>
                  {result.pooled.correct} of {result.pooled.count} development
                  ranches
                </b>{' '}
                when each was held out from training. That’s{' '}
                <strong>{pct(result.pooled.accuracy)} accuracy</strong>
              </p>
              <p data-testid="fold-result">
                Round {state.fold + 1}: {selected.metrics.correct} of{' '}
                {selected.metrics.count} correct ·{' '}
                {pct(selected.metrics.accuracy)}. Trained on the other{' '}
                {selected.trainingIds.length} ranches.
              </p>
              <p>
                Every ranch was predicted once while excluded from training.
                Each round checks a different group, so its score varies. This
                is the same kind of classifier as Lesson 2, fitted afresh each
                round. Your sliders and optional training do not affect these
                checks.
              </p>
            </>
          )}
        </div>
      </section>
      {result && (
        <section className="ranch-final" aria-labelledby="final-test-heading">
          <h3 id="final-test-heading">Stage 2 · Final test</h3>
          <p>
            Next, a fresh classifier learns from all 72 development ranches.
            Check it once on the 18 ranches set aside from the beginning. Unlike
            the development groups, these ranches took no part in any training
            or validation round.
          </p>
          <button
            className="ranch-primary"
            disabled={!!final}
            onClick={() => dispatch({ type: 'test' })}
          >
            Test on 18 untouched ranches
          </button>
          {final && (
            <div
              className="ranch-final-result"
              role="status"
              aria-live="polite"
            >
              <p data-testid="final-result">
                <strong>
                  {final.metrics.correct} of {final.metrics.count} correct
                </strong>{' '}
                · {pct(final.metrics.accuracy)} final-test accuracy.
              </p>
              <p>
                This is a separate check on new examples. Keep this small
                synthetic test out of repeated tuning; one result cannot
                guarantee performance on real ranches.
              </p>
              <p>
                This assessment is now saved. You can still explore training in
                Lessons 1 and 2 without changing these results.
              </p>
              <button onClick={() => dispatch({ type: 'reset-evaluation' })}>
                Reset validation exercise
              </button>
            </div>
          )}
        </section>
      )}
      <p className="lesson-takeaway">
        <b>What you learned:</b> A model must work on examples excluded from
        training. Validation checks that during development; the untouched final
        test provides a separate check afterward.
      </p>
      <details className="ranch-details">
        <summary>Explore evaluation details</summary>
        <p>
          Accuracy is correct predictions divided by all predictions. The
          headline score pools the 72 out-of-fold predictions: each ranch counts
          once. Each of the five fresh logistic models learns its feature means
          and scales from its four training groups only and uses the same fixed
          training schedule.
        </p>
        {result && (
          <p>
            The unweighted mean of the five round accuracies is{' '}
            <span data-testid="validation-mean">
              {pct(result.meanAccuracy)}
            </span>
            . This can differ from pooled accuracy because the groups have
            different sizes (14 or 15 ranches).
          </p>
        )}
        {selected ? (
          <>
            <h3>Selected validation round</h3>
            <MetricDetails metrics={selected.metrics} />
          </>
        ) : (
          <p>
            Run validation to inspect the confusion counts, precision and
            recall.
          </p>
        )}
        {final && (
          <>
            <h3>Final test</h3>
            <MetricDetails metrics={final.metrics} />
          </>
        )}
        <h3>Other ways to validate models</h3>
        <p>
          <b>Stratified folds</b> spread profitable and unprofitable ranches
          across the groups. This example uses that approach.
        </p>
        <p>
          <b>Grouped folds</b> keep related records, such as one attorney’s
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
