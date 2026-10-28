import { fixtures } from '../../lib/ml/experiment';
import {
  predictProfit,
  type Fit,
  type Kind,
  type Ranch,
} from '../../lib/ml/ranches';
import {
  probabilityField,
  probabilityColor,
  decisionBoundary,
} from '../../lib/ml/presentation';
export function ModelPlot({
  kind,
  fit,
  cattle,
  feed,
  inspected,
}: {
  kind: Kind;
  fit: Fit;
  cattle: number;
  feed: number;
  inspected?: Ranch;
}) {
  const logistic = kind === 'logistic',
    x = (v: number) => 100 + ((v - 50) / 450) * 510;
  const ends = logistic
    ? [0, 0]
    : [predictProfit(fit, 50), predictProfit(fit, 500)];
  const low = logistic
    ? 400
    : Math.floor(
        Math.min(
          -20000,
          ...fixtures.development.map((r) => r.profit),
          ...ends,
        ) / 50000,
      ) * 50000;
  const high = logistic
    ? 1400
    : Math.ceil(
        Math.max(20000, ...fixtures.development.map((r) => r.profit), ...ends) /
          50000,
      ) * 50000;
  const y = (v: number) => 310 - ((v - low) / (high - low)) * 290;
  const selectedY = logistic ? feed : predictProfit(fit, cattle),
    boundary = logistic ? decisionBoundary(fit) : [];
  return (
    <figure className="ranch-plot">
      <figcaption>
        {logistic
          ? 'Probability of profitability'
          : 'Observed profit and the fitted line'}
      </figcaption>
      <p className="ranch-axis">
        {logistic
          ? 'Feed cost per animal ($)'
          : 'Annual profit / loss ($; k = thousands)'}
      </p>
      <svg
        viewBox="0 0 640 355"
        role="img"
        aria-labelledby="ranch-chart-title"
        aria-describedby="ranch-chart-description"
      >
        <title id="ranch-chart-title">
          {logistic
            ? 'Ranch profitability probability landscape'
            : 'Ranch profit regression'}
        </title>
        <desc id="ranch-chart-description">
          72 development ranches.{' '}
          {logistic
            ? 'Circles are profitable; triangles are not profitable. Shading shows the fitted probability; a dashed line marks 50%.'
            : 'Dots show observed annual profit, the green line shows predicted profit, and a horizontal reference marks zero profit.'}{' '}
          The dark cross marks your slider inputs. Numerical predictions are
          shown above the chart; an HTML selector in the model details inspects
          individual ranches.
        </desc>
        {logistic && (
          <g data-testid="probability-field">
            {probabilityField(fit).map((cell, i) => (
              <rect
                key={i}
                x={x(cell.cattle)}
                y={y(cell.feed + 40)}
                width={510 / 25}
                height={290 / 25}
                fill={probabilityColor(cell.p)}
                data-probability={cell.p}
              />
            ))}
          </g>
        )}
        <path d="M100 20V310H610" fill="none" stroke="currentColor" />
        {[50, 200, 350, 500].map((v) => (
          <text key={v} x={x(v)} y="340" textAnchor="middle">
            {v}
          </text>
        ))}
        {(logistic
          ? Array.from({ length: 5 }, (_, i) => low + ((high - low) * i) / 4)
          : Array.from(
              {
                length:
                  Math.floor(
                    (high - Math.ceil(low / 100000) * 100000) / 100000,
                  ) + 1,
              },
              (_, i) => Math.ceil(low / 100000) * 100000 + i * 100000,
            )
        ).map((v) => (
          <text key={v} x="86" y={y(v) + 5} textAnchor="end">
            {logistic ? Math.round(v) : `${Math.round(v / 1000)}k`}
          </text>
        ))}
        {!logistic && (
          <line
            data-testid="zero-profit"
            x1="100"
            x2="610"
            y1={y(0)}
            y2={y(0)}
            stroke="currentColor"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        )}
        {fixtures.development.map((r) => (
          <g key={r.id} data-ranch-id={r.id}>
            {!logistic || r.profitable ? (
              <circle
                cx={x(r.cattle)}
                cy={y(logistic ? r.feed : r.profit)}
                r="4"
                fill="#254f3e"
                opacity="0.65"
              />
            ) : (
              <path
                d={`M${x(r.cattle)} ${y(r.feed) - 5}l5 10h-10z`}
                fill="#f7f6f2"
                stroke="#254f3e"
              />
            )}
          </g>
        ))}
        {!logistic && (
          <line
            data-testid="prediction-line"
            x1={x(50)}
            x2={x(500)}
            y1={y(ends[0])}
            y2={y(ends[1])}
            stroke="#254f3e"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {boundary.length === 2 && (
          <line
            data-testid="decision-boundary"
            x1={x(boundary[0][0])}
            x2={x(boundary[1][0])}
            y1={y(boundary[0][1])}
            y2={y(boundary[1][1])}
            stroke="#254f3e"
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {!logistic && inspected && (
          <line
            x1={x(inspected.cattle)}
            x2={x(inspected.cattle)}
            y1={y(inspected.profit)}
            y2={y(predictProfit(fit, inspected.cattle))}
            stroke="#272d29"
            strokeDasharray="3 3"
          />
        )}
        <g
          data-testid="prediction-marker"
          data-cattle={cattle}
          data-feed={logistic ? feed : undefined}
          data-profit={logistic ? undefined : selectedY}
        >
          <circle
            cx={x(cattle)}
            cy={y(selectedY)}
            r="10"
            fill="#f7f6f2"
            stroke="#272d29"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M${x(cattle) - 5} ${y(selectedY)}h10M${x(cattle)} ${y(selectedY) - 5}v10`}
            stroke="#272d29"
            strokeWidth="2"
          />
        </g>
      </svg>
      <p className="ranch-axis">Cattle sold annually</p>
      <p className="ranch-key">
        {logistic
          ? '● Profitable · △ Not profitable · dark cross = your inputs. Pale-to-green shading means lower-to-higher probability; dashed line = 50%.'
          : 'Dots = observed profit · green line = predicted profit · dashed horizontal = zero profit · dark cross = your prediction.'}
      </p>
    </figure>
  );
}
