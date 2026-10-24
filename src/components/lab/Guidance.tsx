import type { ReactNode } from 'react';
import type { LabController } from './useLabExperiment';
const prompts = [
  'Train one step to see the prediction line move toward the observations.',
  'Train the classifier to see a 50% estimated-probability boundary emerge.',
  'Move the review-budget slider, or change policy, to see which positives you capture.',
];
export function Guidance({
  state,
  dispatch,
  children,
}: Pick<LabController, 'state' | 'dispatch'> & { children?: ReactNode }) {
  const visible = state.guidance[state.lesson];
  return (
    <div className="lab-guidance-row">
      <div className="lab-guidance-content">
        <div
          id="lab-guidance"
          className="lab-guidance"
          role="note"
          aria-label="Lesson guidance"
          hidden={!visible}
        >
          <strong>Try this</strong> {prompts[state.lesson]}
        </div>
        {children}
      </div>
      <button
        className="lab-help"
        aria-expanded={visible}
        aria-controls="lab-guidance"
        onClick={() => dispatch({ type: 'guidance', visible: !visible })}
      >
        Help
      </button>
    </div>
  );
}
