import { useId, useState } from 'react';
import {
  calculateRankedReview,
  defaultSelectionSize,
  normalizeSelectionSize,
  rankedReviewCases,
} from '../lib/ranked-review';

const asPercent = (value: number) => `${Math.round(value * 100)}%`;

export default function RankedReview() {
  const id = useId();
  const [selectionSize, setSelectionSize] = useState(defaultSelectionSize);
  const metrics = calculateRankedReview(selectionSize);

  function updateSelection(value: string) {
    setSelectionSize(
      normalizeSelectionSize(Number(value), rankedReviewCases.length),
    );
  }

  return (
    <section className="lab-panel" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>How much of a ranked list should we review?</h2>
      <p>
        Select the first few records from a fixed list and see the trade-off.
        Precision is the share of selected records that are relevant. Recall is
        the share of all relevant records that you selected.
      </p>
      <p id={`${id}-context`}>
        All 12 records and their reference labels are synthetic. The order was
        chosen for this educational engineering demonstration. It uses no CPCS
        records, no trained model, and no real model performance results.
      </p>

      <div className="lab-control">
        <label htmlFor={`${id}-range`}>Records to review</label>
        <input
          id={`${id}-range`}
          type="range"
          min={0}
          max={rankedReviewCases.length}
          step={1}
          value={selectionSize}
          onChange={(event) => updateSelection(event.currentTarget.value)}
          aria-describedby={`${id}-selection-help`}
        />
        <label htmlFor={`${id}-number`}>Selection size</label>
        <input
          id={`${id}-number`}
          type="number"
          min={0}
          max={rankedReviewCases.length}
          step={1}
          value={selectionSize}
          onChange={(event) => updateSelection(event.currentTarget.value)}
          aria-describedby={`${id}-selection-help`}
        />
        <p id={`${id}-selection-help`}>
          Choose 0–{rankedReviewCases.length}. Selection always starts at rank
          1. Values outside this range are limited to the nearest bound;
          fractions round down.
        </p>
      </div>

      <div className="lab-metrics" aria-live="polite" aria-atomic="true">
        <div className="lab-metric">
          <span>Precision</span>
          <strong>{asPercent(metrics.precision)}</strong>
          <span>
            {metrics.relevantSelected} relevant / {metrics.selectionSize}{' '}
            selected
          </span>
        </div>
        <div className="lab-metric">
          <span>Recall</span>
          <strong>{asPercent(metrics.recall)}</strong>
          <span>
            {metrics.relevantSelected} selected / {metrics.totalRelevant}{' '}
            relevant overall
          </span>
        </div>
      </div>
      <p>
        {metrics.relevantMissed} relevant records remain outside the selection.
        With no records selected, this demonstration displays precision and
        recall as 0%.
      </p>

      <noscript>
        <p>
          JavaScript is disabled. The example remains readable below with the
          first {metrics.selectionSize} records selected:{' '}
          {metrics.relevantSelected} are relevant, giving{' '}
          {asPercent(metrics.precision)} precision and{' '}
          {asPercent(metrics.recall)} recall. Enable JavaScript to change the
          selection.
        </p>
      </noscript>

      <div className="lab-table-wrap">
        <table>
          <caption>Synthetic ranked records and reference labels</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Fictional record</th>
              <th scope="col">Reference label</th>
              <th scope="col">Selected</th>
            </tr>
          </thead>
          <tbody>
            {rankedReviewCases.map((record, index) => (
              <tr
                key={record.id}
                data-selected={index < metrics.selectionSize ? 'true' : 'false'}
              >
                <th scope="row">{index + 1}</th>
                <td>
                  <span className="lab-record-id">{record.id}</span>{' '}
                  <span>{record.description}</span>
                </td>
                <td>{record.relevant ? 'Relevant' : 'Not relevant'}</td>
                <td>{index < metrics.selectionSize ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
