import type { Boundary, DisplayRow } from '../../lib/ml/presentation';
import { fmt, pct } from '../../lib/ml/presentation';
import type { Kind } from '../../lib/ml/experiment';
type Props = {
  kind: Kind;
  points: DisplayRow[];
  selected: string;
  onSelect: (id: string) => void;
  initial: boolean;
  ends: [number, number];
  boundary: Boundary;
  population: string;
};
export function ModelPlot({
  kind,
  points,
  selected,
  onSelect,
  initial,
  ends,
  boundary,
  population,
}: Props) {
  const logistic = kind === 'logistic';
  const x = (v: number) => 55 + v * 50,
    y = (v: number) => 335 - v * (logistic ? 30 : 5);
  const outside =
    !logistic &&
    (Math.min(...points.map((p) => p.z)) < 0 ||
      Math.max(...points.map((p) => p.z)) > 60);
  return (
    <figure className="model-figure">
      <figcaption>
        {logistic
          ? `${points.length} ${population} examples · 50% estimated-probability boundary`
          : '24 synthetic task observations · Green line = predicted time'}
      </figcaption>
      <svg
        className="ml-plot"
        viewBox="0 0 600 390"
        role="img"
        aria-labelledby="model-chart-title"
        aria-describedby="model-chart-description"
      >
        <title id="model-chart-title">
          {logistic
            ? 'Classification points and decision boundary'
            : 'Observed completion times, prediction line and residuals'}
        </title>
        <desc id="model-chart-description">
          {logistic
            ? 'Circles mark positive outcomes; triangles mark negative outcomes. Use Inspect example to select any point with a keyboard.'
            : 'Dots are observations. Dashed vertical segments are prediction errors. The inspected observation is emphasized. The untrained prediction is zero minutes.'}
        </desc>
        <defs>
          <clipPath id="lab-plot-window">
            <rect x="47" y="17" width="516" height="326" />
          </clipPath>
        </defs>
        <path d="M55 25V335H570" stroke="#62675f" fill="none" />
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <text x={x(v)} y="357" textAnchor="middle">
              {v}
            </text>
            <text x="44" y={y(logistic ? v : v * 6) + 5} textAnchor="end">
              {logistic ? v : v * 6}
            </text>
          </g>
        ))}
        <text x="315" y="385" textAnchor="middle">
          {logistic
            ? 'Feature 1 (synthetic units)'
            : 'Task complexity (points)'}
        </text>
        <text transform="translate(16 180) rotate(-90)" textAnchor="middle">
          {logistic
            ? 'Feature 2 (synthetic units)'
            : 'Completion time (minutes)'}
        </text>
        <g clipPath="url(#lab-plot-window)">
          {points.map((p) => (
            <g key={p.id} className="plot-point" onClick={() => onSelect(p.id)}>
              {!logistic && (
                <line
                  x1={x(p.x[0])}
                  x2={x(p.x[0])}
                  y1={y(p.y)}
                  y2={y(p.z)}
                  stroke={p.id === selected ? '#254f3e' : '#62675f'}
                  strokeWidth={p.id === selected ? 2.5 : 1}
                  strokeDasharray="3 3"
                />
              )}
              {!logistic || p.y ? (
                <circle
                  cx={x(p.x[0])}
                  cy={y(logistic ? p.x[1] : p.y)}
                  r={p.id === selected ? 8 : 5}
                  fill="#254f3e"
                />
              ) : (
                <path
                  d={`M${x(p.x[0])} ${y(p.x[1]) - 6}l6 12h-12z`}
                  fill="#f7f6f2"
                  stroke="#254f3e"
                  strokeWidth="2"
                />
              )}
              {logistic && p.id === selected && (
                <circle
                  cx={x(p.x[0])}
                  cy={y(p.x[1])}
                  r="11"
                  fill="none"
                  stroke="#254f3e"
                  strokeWidth="2"
                />
              )}
            </g>
          ))}
          {!logistic && (
            <line
              data-testid="prediction-line"
              x1={x(0)}
              x2={x(10)}
              y1={y(ends[0])}
              y2={y(ends[1])}
              stroke="#254f3e"
              strokeWidth="3"
              strokeDasharray={initial ? '7 4' : undefined}
            />
          )}
          {logistic && boundary.kind === 'visible' && (
            <line
              data-testid="decision-boundary"
              x1={x(boundary.points[0][0])}
              y1={y(boundary.points[0][1])}
              x2={x(boundary.points[1][0])}
              y2={y(boundary.points[1][1])}
              stroke="#254f3e"
              strokeWidth="2.5"
            />
          )}
        </g>
        {!logistic && initial && (
          <text
            className="zero-prediction-label"
            x="310"
            y="319"
            textAnchor="middle"
          >
            Initial prediction: 0 minutes
          </text>
        )}
      </svg>
      <p className="plot-key">
        {logistic
          ? '● positive outcome · △ negative outcome · outlined point = inspected example.'
          : `Dots = observations · dashed verticals = residuals (prediction errors). ${initial ? 'The initial dashed green prediction is zero and overlaps the bottom axis.' : 'Solid green line = current predicted time.'}`}
      </p>
      {logistic && boundary.kind === 'constant' && (
        <p className="boundary-state">
          No unique 50% boundary: every example has an estimated probability of{' '}
          {pct(boundary.probability)}.
        </p>
      )}
      {logistic && boundary.kind === 'outside' && (
        <p className="boundary-state">
          The valid 50% boundary does not cross this 0–10 feature window. The
          model still makes predictions; this is not a training failure.
        </p>
      )}
      {outside && (
        <p className="boundary-state">
          Predictions span {fmt(Math.min(...points.map((p) => p.z)))}–
          {fmt(Math.max(...points.map((p) => p.z)))} minutes. Values outside the
          fixed 0–60 minute axis are not shown; inspect the example calculation
          for exact values.
        </p>
      )}
    </figure>
  );
}
