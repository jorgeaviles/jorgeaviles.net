import {
  fixtures,
  MAX_UPDATES,
  developmentRanch,
} from '../../lib/ml/experiment';
import { predictProfit, predictProfitability } from '../../lib/ml/ranches';
import { dollars, fmt, pct } from '../../lib/ml/presentation';
import type { LabController } from './useLabExperiment';
import { ModelPlot } from './ModelPlot';
import { LossHistory } from './LossHistory';
export function TrainingLesson({ state, dispatch }: LabController) {
  const logistic = state.lesson === 1,
    kind = logistic ? 'logistic' : 'linear',
    experiment = state[kind];
  const profit = predictProfit(state.linear, state.cattle),
    chance = predictProfitability(state.logistic, state.cattle, state.feed);
  const inspected = state.inspected
    ? developmentRanch(state.inspected)
    : undefined;
  const disabled = !!state.finished || experiment.steps >= MAX_UPDATES;
  return (
    <div className="ranch-training">
      <div className="ranch-workspace">
        <div className="ranch-controls">
          <label htmlFor="ranch-cattle">
            Cattle sold annually{' '}
            <output aria-hidden="true">{state.cattle}</output>
          </label>
          <input
            id="ranch-cattle"
            type="range"
            min="50"
            max="500"
            step="1"
            value={state.cattle}
            aria-valuetext={`${state.cattle} cattle`}
            onChange={(e) =>
              dispatch({
                type: 'input',
                feature: 'cattle',
                value: +e.target.value,
              })
            }
          />
          {logistic && (
            <>
              <label htmlFor="ranch-feed">
                Feed cost per animal{' '}
                <output aria-hidden="true">{dollars(state.feed)}</output>
              </label>
              <input
                id="ranch-feed"
                type="range"
                min="400"
                max="1400"
                step="1"
                value={state.feed}
                aria-valuetext={dollars(state.feed)}
                onChange={(e) =>
                  dispatch({
                    type: 'input',
                    feature: 'feed',
                    value: +e.target.value,
                  })
                }
              />
            </>
          )}
          <div
            className="ranch-result"
            role="status"
            aria-live={state.running ? 'off' : 'polite'}
            aria-atomic="true"
          >
            {logistic ? (
              <>
                <p>Estimated chance of profitability</p>
                <strong data-testid="profitability-prediction">
                  {pct(chance)}
                </strong>
                <p>
                  Predicted class:{' '}
                  <b>{chance >= 0.5 ? 'Profitable' : 'Not profitable'}</b>
                </p>
              </>
            ) : (
              <>
                <p>Predicted annual {profit < 0 ? 'loss' : 'profit'}</p>
                <strong data-testid="profit-prediction">
                  {dollars(Math.abs(profit))}
                </strong>
                <p>
                  Based on cattle sold, the fitted model predicts{' '}
                  {profit < 0 ? 'a loss' : 'a profit'} of{' '}
                  {dollars(Math.abs(profit))}.
                </p>
              </>
            )}
          </div>
        </div>
        <ModelPlot
          kind={kind}
          fit={experiment}
          cattle={state.cattle}
          feed={state.feed}
          inspected={inspected}
        />
      </div>
      <details
        className="ranch-details"
        onToggle={(e) => {
          if (!e.currentTarget.open) dispatch({ type: 'pause' });
        }}
      >
        <summary>Explore model training</summary>
        <p>
          The model starts fitted to 72 development ranches. Reset training to
          start from zero, then watch actual gradient updates change its
          predictions.
        </p>
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
            {state.running ? 'Pause training' : 'Train automatically'}
          </button>
          <button
            disabled={!!state.finished}
            onClick={() => dispatch({ type: 'reset-model' })}
          >
            Reset training
          </button>
        </div>
        <p
          className="training-feedback"
          role="status"
          aria-live={state.running ? 'off' : 'polite'}
        >
          Step {experiment.steps} ·{' '}
          {logistic ? 'Log loss' : 'MSE (scaled profit)'}{' '}
          {fmt(experiment.history.at(-1)!.loss)}
          {experiment.steps >= MAX_UPDATES ? ' · Training limit reached' : ''}
        </p>
        <LossHistory experiment={experiment} logistic={logistic} />
      </details>
      <details className="ranch-details">
        <summary>
          {logistic
            ? 'How probabilities are learned'
            : 'How the line is learned'}
        </summary>
        {logistic ? (
          <p>
            Unlike linear regression, this model estimates a probability between
            0% and 100%. A weighted combination of standardized cattle sales and
            feed costs passes through a sigmoid function. Gradient descent
            reduces binary cross-entropy (log loss). A probability of at least
            50% predicts profitable.
          </p>
        ) : (
          <p>
            A residual is observed profit minus predicted profit. Gradient
            descent adjusts the slope and intercept to reduce mean squared
            error, the average squared residual. This line uses cattle sold
            alone; feed costs and other variation explain why similar-sized
            ranches have different profits. Training uses profit in $100,000
            units and displays predictions in dollars.
          </p>
        )}
        <dl
          className="ranch-parameters"
          aria-label="Standardized model parameters"
        >
          {[...experiment.model.w, experiment.model.b].map((v, i) => (
            <div key={i}>
              <dt>
                {i === experiment.model.w.length
                  ? 'Intercept'
                  : i === 0
                    ? 'Cattle weight'
                    : 'Feed-cost weight'}
              </dt>
              <dd>{fmt(v)}</dd>
            </div>
          ))}
        </dl>
        <label htmlFor="ranch-inspect">Inspect a development ranch</label>
        <select
          id="ranch-inspect"
          value={state.inspected ?? ''}
          onChange={(e) => dispatch({ type: 'inspect', id: e.target.value })}
        >
          <option value="" disabled>
            Choose a ranch
          </option>
          {fixtures.development.map((r) => (
            <option value={r.id} key={r.id}>
              {r.id}
            </option>
          ))}
        </select>
        {inspected && (
          <p className="ranch-observation">
            {inspected.id}: {inspected.cattle} cattle, feed{' '}
            {dollars(inspected.feed)} per animal; observed annual{' '}
            {inspected.profit < 0 ? 'loss' : 'profit'}{' '}
            {dollars(Math.abs(inspected.profit))}. Outcome:{' '}
            {inspected.profitable ? 'Profitable' : 'Not profitable'}.
          </p>
        )}
      </details>
    </div>
  );
}
