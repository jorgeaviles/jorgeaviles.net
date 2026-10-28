import { useLabExperiment } from './lab/useLabExperiment';
import { TrainingLesson } from './lab/TrainingLesson';
import { EvaluationLesson } from './lab/EvaluationLesson';
import { lessonHashes, type Lesson } from '../lib/ml/experiment';
export default function LearningLab() {
  const controller = useLabExperiment(),
    { state, navigate, ready } = controller;
  return (
    <section className="learning-lab" aria-label="Machine learning workspace">
      <nav className="lesson-nav" aria-label="Lab lessons">
        {['Predict profit', 'Profitability', 'Test predictions'].map(
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
              {title}
            </a>
          ),
        )}
      </nav>
      <h2>
        {
          [
            'How much profit could a ranch earn?',
            'Will this ranch make a profit?',
            'Does the model work on new ranches?',
          ][state.lesson]
        }
      </h2>
      <fieldset className="ranch-interactive" disabled={!ready}>
        <legend className="sr-only">Interactive ranch models</legend>
        {state.lesson === 2 ? (
          <EvaluationLesson {...controller} />
        ) : (
          <TrainingLesson key={state.lesson} {...controller} />
        )}
      </fieldset>
      <p className="section-footnote">
        All ranch data is synthetic. This educational example is inspired by a{' '}
        <a href="/research/">profitability-prediction research question</a> and
        does not reproduce the published study.
      </p>
    </section>
  );
}
