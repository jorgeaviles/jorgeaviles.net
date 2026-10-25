import { useLabExperiment } from './lab/useLabExperiment';
import { TrainingLesson } from './lab/TrainingLesson';
import { EvaluationLesson } from './lab/EvaluationLesson';
import { lessonHashes, type Lesson } from '../lib/ml/experiment';
export default function LearningLab() {
  const controller = useLabExperiment(),
    { state, dispatch, navigate } = controller;
  return (
    <section className="learning-lab" aria-label="Machine learning workspace">
      <nav className="lesson-nav" aria-label="Lab lessons">
        {['Linear regression', 'Logistic regression', 'Evaluation'].map(
          (title, i) => (
            <a
              key={title}
              href={`#${lessonHashes[i]}`}
              aria-current={state.lesson === i ? 'step' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(i as Lesson);
              }}
            >
              <span>{i + 1}</span> {title}
            </a>
          ),
        )}
      </nav>
      <h2>
        {
          [
            'How a model learns',
            'How a model classifies',
            'From predictions to decisions',
          ][state.lesson]
        }
      </h2>
      <p className="lesson-description">
        {
          [
            'Fit completion time from task complexity through actual gradient updates.',
            'Estimate additional review needs from fictional task complexity and information uncertainty.',
            'Choose which fictional tasks to review using validation estimates from the same classifier.',
          ][state.lesson]
        }
      </p>
      {state.finished && (
        <p className="experiment-lock">
          Experiment locked after test assessment.{' '}
          <button onClick={() => dispatch({ type: 'reset-all' })}>
            Reset experiment
          </button>
        </p>
      )}
      {state.lesson === 2 ? (
        <EvaluationLesson {...controller} />
      ) : (
        <TrainingLesson {...controller} />
      )}
      <p className="section-footnote">
        Independently synthetic records; training runs locally in your browser.
        No confidential agency data. Lower training loss does not establish
        generalization or real-world performance. Training pauses on lesson
        changes; no motion starts automatically.
      </p>
    </section>
  );
}
