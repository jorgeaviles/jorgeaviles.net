import { useEffect, useState } from 'react';
import {
  datasets,
  fitScaler,
  scaled,
  transform,
  initial,
  score,
  sigmoid,
  loss,
  step,
  rank,
  evaluate,
  type Model,
} from '../lib/ml/models';
const data = datasets();
const cs = fitScaler(data.train),
  rs = fitScaler(data.regression);
const train = scaled(data.train, cs),
  validation = scaled(data.validation, cs),
  test = scaled(data.test, cs),
  regression = scaled(data.regression, rs);
const pct = (n: number | null) =>
  n === null ? 'Undefined' : `${(n * 100).toFixed(1)}%`;
const fmt = (n: number) => n.toFixed(3);
export default function LearningLab() {
  const [lesson, setLesson] = useState(0),
    [linear, setLinear] = useState<Model>(() => initial(1)),
    [model, setModel] = useState<Model>(() => initial(2)),
    [running, setRunning] = useState(false),
    [rate, setRate] = useState(0.05),
    [history, setHistory] = useState<number[]>([]),
    [iterations, setIterations] = useState([0, 0]),
    [policy, setPolicy] = useState<'threshold' | 'budget'>('budget'),
    [budget, setBudget] = useState(6),
    [threshold, setThreshold] = useState(0.5),
    [selected, setSelected] = useState('0'),
    [finalResult, setFinalResult] = useState<ReturnType<
      typeof evaluate
    > | null>(null);
  const logistic = lesson !== 0,
    m = logistic ? model : linear,
    rows = logistic ? train : regression;
  function advance() {
    if (finalResult) return;
    if (logistic) setModel((v) => step(train, v, true, rate));
    else setLinear((v) => step(regression, v, false, rate));
    setHistory((h) => [
      ...h.slice(-99),
      loss(rows, step(rows, m, logistic, rate), logistic),
    ]);
    setIterations((v) =>
      v.map((n, i) => (i === (logistic ? 1 : 0) ? n + 1 : n)),
    );
  }
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(advance, 100);
    return () => window.clearTimeout(timer);
  });
  const predictions = rank(validation, model),
    metrics = evaluate(
      predictions,
      policy,
      policy === 'budget' ? budget : threshold,
    ),
    record = predictions.find((r) => r.id === selected) ?? predictions[0];
  function reset() {
    setRunning(false);
    setLinear(initial(1));
    setModel(initial(2));
    setHistory([]);
    setIterations([0, 0]);
    setFinalResult(null);
    setPolicy('budget');
    setBudget(6);
    setThreshold(0.5);
  }
  const frozen = !!finalResult;
  const chosen = logistic
    ? record
    : (regression[Number(selected) || 0] ?? regression[0]);
  return (
    <section className="learning-lab" aria-label="Machine learning workspace">
      <nav className="lesson-nav" aria-label="Lab lessons">
        {[
          '1 · Linear regression',
          '2 · Logistic regression',
          '3 · Evaluation',
        ].map((title, i) => (
          <button
            key={title}
            aria-current={lesson === i ? 'step' : undefined}
            onClick={() => {
              setLesson(i);
              setRunning(false);
              setHistory([]);
              setSelected(i === 0 ? '0' : 'SYN-55');
            }}
          >
            {title}
          </button>
        ))}
      </nav>
      <h2>
        {
          [
            'How a model learns',
            'How a model classifies',
            'From predictions to decisions',
          ][lesson]
        }
      </h2>
      <p>
        {
          [
            'Fit completion time from task complexity. The line and loss change through actual gradient updates.',
            'Two standardized features form a linear score. Sigmoid transforms that score into an estimated probability.',
            'Validation records are ranked by the current logistic model. Decision policies change selections, never weights.',
          ][lesson]
        }
      </p>
      <div className="ml-workspace">
        <div className="ml-primary">
          {lesson !== 2 && (
            <>
              <div className="ml-actions">
                <button disabled={frozen} onClick={advance}>
                  Train one step
                </button>
                <button
                  disabled={frozen}
                  aria-pressed={running}
                  onClick={() => setRunning(!running)}
                >
                  {running ? 'Pause' : 'Train'}
                </button>
                <button onClick={reset}>Reset</button>
              </div>
              <p>
                <strong>
                  {logistic ? 'Training log loss' : 'Training MSE'}:{' '}
                  {fmt(loss(rows, m, logistic))}
                </strong>{' '}
                · {iterations[logistic ? 1 : 0]} gradient updates
              </p>
            </>
          )}
          {lesson === 2 ? (
            <>
              <fieldset disabled={frozen}>
                <legend>Decision policy</legend>
                <p>
                  Logistic model: {iterations[1]} training updates.{' '}
                  {iterations[1] === 0 &&
                    'No training updates yet; scores reflect initial or manually explored weights. Train in lesson 2 to learn a ranking.'}
                </p>
                <label>
                  <input
                    type="radio"
                    name="policy"
                    checked={policy === 'budget'}
                    onChange={() => setPolicy('budget')}
                  />{' '}
                  Top-K review budget
                </label>
                <label>
                  <input
                    type="radio"
                    name="policy"
                    checked={policy === 'threshold'}
                    onChange={() => setPolicy('threshold')}
                  />{' '}
                  Probability threshold
                </label>
                <label>
                  {policy === 'budget' ? 'Review budget' : 'Probability cutoff'}
                  <input
                    aria-label={
                      policy === 'budget'
                        ? 'Review budget'
                        : 'Probability cutoff'
                    }
                    type="range"
                    min="0"
                    max={policy === 'budget' ? 18 : 1}
                    step={policy === 'budget' ? 1 : 0.01}
                    value={policy === 'budget' ? budget : threshold}
                    onChange={(e) =>
                      policy === 'budget'
                        ? setBudget(+e.target.value)
                        : setThreshold(+e.target.value)
                    }
                  />
                  <output aria-live="off">
                    {policy === 'budget' ? budget : pct(threshold)}
                  </output>
                </label>
              </fieldset>
              <div
                className="ranked-strip"
                aria-label="Ranked validation records"
              >
                {predictions.map((r, i) => (
                  <button
                    key={r.id}
                    aria-description={`Rank ${i + 1}, ${r.id}, score ${pct(r.p)}, actual ${r.y ? 'positive' : 'negative'}, ${metrics.ids.has(r.id) ? 'selected' : 'not selected'}`}
                    aria-pressed={selected === r.id}
                    className={metrics.ids.has(r.id) ? 'chosen' : ''}
                    onClick={() => setSelected(r.id)}
                  >
                    <span>{i + 1}</span>
                    <strong>{r.y ? '●' : '△'}</strong>
                    <span>{pct(r.p)}</span>
                    <small>{metrics.ids.has(r.id) ? 'Review' : 'Leave'}</small>
                  </button>
                ))}
              </div>
              <p>
                ● actual positive · △ actual negative. Filled cards are
                selected. Scores descend left to right; ties use record ID.
              </p>
            </>
          ) : (
            <>
              <svg
                className="model-chart"
                viewBox="0 0 600 390"
                role="img"
                aria-labelledby="chart-title chart-description"
              >
                <title id="chart-title">
                  {logistic
                    ? 'Logistic decision boundary'
                    : 'Regression predictions and residuals'}
                </title>
                <desc id="chart-description">
                  {logistic
                    ? 'Circles are positive labels and triangles are negative labels. The line marks probability 50 percent. Select a record below to inspect its calculation.'
                    : 'Dots show synthetic observed completion times. Vertical segments show residuals between observations and the current fitted line.'}
                </desc>
                <defs>
                  <clipPath id="plot-area">
                    <rect x="55" y="25" width="515" height="310" />
                  </clipPath>
                </defs>
                <path d="M55 25V335H570" fill="none" stroke="currentColor" />
                {[0, 2, 4, 6, 8, 10].map((x) => (
                  <g key={x}>
                    <text x={55 + x * 50} y="355" textAnchor="middle">
                      {x}
                    </text>
                    <text x="45" y={335 - x * 30} textAnchor="end">
                      {logistic ? x : x * 6}
                    </text>
                  </g>
                ))}
                <text x="310" y="382" textAnchor="middle">
                  {logistic
                    ? 'Feature 1 (fictional units)'
                    : 'Task complexity (points)'}
                </text>
                <text
                  transform="translate(15 180) rotate(-90)"
                  textAnchor="middle"
                >
                  {logistic
                    ? 'Feature 2 (fictional units)'
                    : 'Completion time (minutes)'}
                </text>
                {!logistic && (
                  <g clipPath="url(#plot-area)">
                    {data.regression.map((r, i) => {
                      const prediction = score(linear, regression[i].x);
                      return (
                        <g key={r.id}>
                          <line
                            x1={55 + r.x[0] * 50}
                            x2={55 + r.x[0] * 50}
                            y1={335 - r.y * 5}
                            y2={335 - prediction * 5}
                            stroke={r.id === chosen.id ? '#254f3e' : '#62675f'}
                            strokeWidth={r.id === chosen.id ? 3 : 1}
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={55 + r.x[0] * 50}
                            cy={335 - r.y * 5}
                            r={r.id === chosen.id ? 8 : 5}
                            fill="#254f3e"
                          />
                        </g>
                      );
                    })}
                    <line
                      x1="55"
                      x2="555"
                      y1={335 - score(linear, transform([0], rs)) * 5}
                      y2={335 - score(linear, transform([10], rs)) * 5}
                      stroke="#254f3e"
                      strokeWidth="3"
                    />
                  </g>
                )}
                {logistic && (
                  <g clipPath="url(#plot-area)">
                    {data.validation.map((r) => {
                      const x = 55 + r.x[0] * 50,
                        y = 335 - r.x[1] * 30;
                      return (
                        <g
                          key={r.id}
                          opacity={r.id === selected ? 1 : 0.75}
                          onClick={() => setSelected(r.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {r.y ? (
                            <circle
                              cx={x}
                              cy={y}
                              r={r.id === selected ? 9 : 6}
                              fill="#254f3e"
                            />
                          ) : (
                            <path
                              d={`M${x} ${y - 7}l7 13h-14z`}
                              fill="#f7f6f2"
                              stroke="#254f3e"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      );
                    })}
                    {Math.abs(model.w[1]) > 1e-8 ? (
                      <line
                        x1="55"
                        x2="555"
                        y1={
                          335 -
                          (cs.mean[1] +
                            (cs.scale[1] *
                              (-model.b -
                                (model.w[0] * (0 - cs.mean[0])) /
                                  cs.scale[0])) /
                              model.w[1]) *
                            30
                        }
                        y2={
                          335 -
                          (cs.mean[1] +
                            (cs.scale[1] *
                              (-model.b -
                                (model.w[0] * (10 - cs.mean[0])) /
                                  cs.scale[0])) /
                              model.w[1]) *
                            30
                        }
                        stroke="#254f3e"
                        strokeWidth="2"
                      />
                    ) : Math.abs(model.w[0]) > 1e-8 ? (
                      <line
                        x1={
                          55 +
                          (cs.mean[0] - (model.b * cs.scale[0]) / model.w[0]) *
                            50
                        }
                        x2={
                          55 +
                          (cs.mean[0] - (model.b * cs.scale[0]) / model.w[0]) *
                            50
                        }
                        y1="25"
                        y2="335"
                        stroke="#254f3e"
                      />
                    ) : null}
                  </g>
                )}
              </svg>
              <p>
                {logistic
                  ? '18 validation records: ● positive · △ negative. The line marks 50% probability. Training uses 54 separate records; 18 test records remain held out. Initially zero weights and bias give 50% everywhere without a unique boundary. Near 50%, small policy changes can change the decision.'
                  : '24 synthetic task observations, the predicted line, and vertical residuals use the same model state. The chart uses fixed axes; extreme manual predictions may lie outside the plot.'}
              </p>
            </>
          )}
        </div>
        <aside className="ml-controls">
          {lesson !== 2 && (
            <>
              <label>
                Learning rate
                <select
                  disabled={frozen || running}
                  value={rate}
                  onChange={(e) => setRate(+e.target.value)}
                >
                  <option value="0.01">Careful · 0.01</option>
                  <option value="0.05">Steady · 0.05</option>
                  <option value="0.1">Faster · 0.1</option>
                </select>
              </label>
              <p>
                Updates:{' '}
                <output aria-live="off">{iterations[logistic ? 1 : 0]}</output>
              </p>
              <dl>
                <dt>
                  {logistic ? 'Training log loss' : 'Training MSE (minutes²)'}
                </dt>
                <dd>{fmt(loss(rows, m, logistic))}</dd>
                {logistic && (
                  <>
                    <dt>Validation log loss</dt>
                    <dd>{fmt(loss(validation, model, true))}</dd>
                  </>
                )}
                <dt>Weights / bias</dt>
                <dd>
                  {m.w.map(fmt).join(', ')} / {fmt(m.b)}
                </dd>
              </dl>
              <svg
                viewBox="0 0 240 65"
                role="img"
                aria-label="Recent training loss history"
              >
                <polyline
                  fill="none"
                  stroke="#254f3e"
                  strokeWidth="2"
                  points={history
                    .map(
                      (v, i) =>
                        `${(i * 240) / Math.max(1, history.length - 1)},${60 - (v / Math.max(1, ...history)) * 55}`,
                    )
                    .join(' ')}
                />
              </svg>
              <small>
                Recent {history.length} updates; vertical scale adapts to loss.
              </small>
              <details>
                <summary>Explore parameters manually</summary>
                <p>
                  Manual changes pause training; these are not learned updates.
                </p>
                {[...m.w, m.b].map((v, i) => (
                  <label key={i}>
                    {i === m.w.length ? 'Bias' : `Weight ${i + 1}`}
                    <input
                      disabled={frozen}
                      type="number"
                      min="-100"
                      max="100"
                      step="0.1"
                      value={v}
                      onChange={(e) => {
                        const n = +e.target.value;
                        if (!Number.isFinite(n)) return;
                        setRunning(false);
                        setHistory([]);
                        const next = { w: [...m.w], b: m.b };
                        if (i === m.w.length)
                          next.b = Math.max(-100, Math.min(100, n));
                        else next.w[i] = Math.max(-100, Math.min(100, n));
                        if (logistic) setModel(next);
                        else setLinear(next);
                      }}
                    />
                  </label>
                ))}
              </details>
            </>
          )}
          {lesson === 2 && (
            <>
              <dl>
                {[
                  [
                    'Selected',
                    `${metrics.count} / 18 (${pct(metrics.selectionRate)})`,
                  ],
                  ['Precision', pct(metrics.precision)],
                  ['Recall', pct(metrics.recall)],
                  ['Accuracy', pct(metrics.accuracy)],
                  ['True positives', metrics.tp],
                  ['False positives', metrics.fp],
                  ['True negatives', metrics.tn],
                  ['Missed positives (FN)', metrics.fn],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Precision = TP / (TP + FP); recall = TP / (TP + FN). Selecting a
                positive adds a true positive; selecting a negative adds a false
                positive. Precision is undefined when nothing is selected. More
                reviews may improve recall; precision can rise or fall.
              </p>
              <p>
                Threshold selects scores at or above the cutoff. Top-K selects
                exactly K records, including ties by ID.
              </p>
            </>
          )}
          <label>
            Inspect example
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {(logistic ? predictions : regression).map((r, i) => (
                <option key={r.id} value={logistic ? r.id : String(i)}>
                  {r.id}
                </option>
              ))}
            </select>
          </label>
          <p>
            {chosen.id}: observed {chosen.y}.{' '}
            {logistic
              ? `Estimated positive probability ${pct(sigmoid(score(m, chosen.x)))}`
              : `Predicted time ${fmt(score(m, chosen.x))} minutes`}
            . Score z = {fmt(score(m, chosen.x))}.
          </p>
          <details>
            <summary>Inspect the mathematics</summary>
            <p>
              Features are standardized using{' '}
              {logistic
                ? 'training records only'
                : 'the synthetic regression sample'}
              . z = w · x + b.
            </p>
            <p>
              Raw features:{' '}
              {(logistic
                ? data.validation.find((r) => r.id === chosen.id)?.x
                : data.regression.find((r) => r.id === chosen.id)?.x
              )
                ?.map(fmt)
                .join(', ')}
              . Standardized x: {chosen.x.map(fmt).join(', ')}. Score z ={' '}
              {fmt(score(m, chosen.x))}.
            </p>
            {logistic ? (
              <p>
                σ(z) = 1 / (1 + exp(−z)) = {pct(sigmoid(score(m, chosen.x)))}.
                Actual class: {chosen.y}. Predicted class at{' '}
                {pct(lesson === 2 && policy === 'threshold' ? threshold : 0.5)}:{' '}
                {sigmoid(score(m, chosen.x)) >=
                (lesson === 2 && policy === 'threshold' ? threshold : 0.5)
                  ? 'positive'
                  : 'negative'}
                . These estimates have not been assessed for calibration. Top-K
                membership is a separate budget policy.
              </p>
            ) : (
              <p>
                Observed time: {fmt(chosen.y)} minutes. Residual:{' '}
                {fmt(chosen.y - score(m, chosen.x))} minutes. Raw slope ={' '}
                {fmt(m.w[0] / rs.scale[0])}; raw intercept ={' '}
                {fmt(m.b - (m.w[0] * rs.mean[0]) / rs.scale[0])}.
              </p>
            )}
            <p>
              {logistic
                ? 'BCE = mean(softplus(z) − y z); ∂L/∂w = mean((σ(z) − y)x).'
                : 'MSE = mean((ŷ − y)²); ∂L/∂w = 2 mean((ŷ − y)x).'}{' '}
              Bias gradient omits x. Each update subtracts learning rate ×
              gradient. Parameters are bounded to ±100.
            </p>
          </details>
        </aside>
      </div>
      {lesson === 2 && (
        <>
          <details>
            <summary>Inspect records</summary>
            <div
              className="ml-table"
              tabIndex={0}
              role="region"
              aria-label="Validation records, scroll horizontally"
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  event.currentTarget.scrollLeft +=
                    event.key === 'ArrowRight' ? 60 : -60;
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
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>{r.id}</td>
                      <td>
                        {data.validation
                          .find((raw) => raw.id === r.id)
                          ?.x[0].toFixed(3)}
                      </td>
                      <td>
                        {data.validation
                          .find((raw) => raw.id === r.id)
                          ?.x[1].toFixed(3)}
                      </td>
                      <td>{pct(r.p)}</td>
                      <td>{r.y ? 'Positive' : 'Negative'}</td>
                      <td>{metrics.ids.has(r.id) ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>Final test assessment</summary>
            <p>
              54 training records fit weights and scaling. These 18 validation
              records support exploration. The 18 held-out test records are
              excluded from training and policy selection. Revealing test
              results locks model training and policy controls until Reset
              starts a new experiment. Repeated resets and test inspection still
              constitute tuning; this small synthetic example cannot establish
              unbiased operational performance.
            </p>
            <button
              disabled={frozen}
              onClick={() => {
                setRunning(false);
                setFinalResult(
                  evaluate(
                    rank(test, model),
                    policy,
                    policy === 'budget' ? budget : threshold,
                  ),
                );
              }}
            >
              Lock experiment and evaluate test
            </button>
            {finalResult && (
              <p>
                Held-out test: precision {pct(finalResult.precision)}, recall{' '}
                {pct(finalResult.recall)}, accuracy {pct(finalResult.accuracy)}.
                Experiment locked.{' '}
                <button onClick={reset}>Reset experiment</button>
              </p>
            )}
          </details>
        </>
      )}
      <p className="section-footnote">
        All records are independently synthetic. Training runs locally in your
        browser. These small educational models use no confidential agency data.
        Lower training loss does not establish generalization or real-world
        performance. Automatic training stops when paused or switching lessons;
        no motion starts automatically.
      </p>
    </section>
  );
}
