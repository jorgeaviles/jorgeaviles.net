import {
  initial,
  loss,
  scaled,
  step,
  fitScaler,
  type Model,
  type Scaler,
} from './models';
import {
  partitionRanches,
  toRows,
  fitRanches,
  crossValidate,
  assess,
  LEARNING_RATE,
  TRAINING_STEPS,
  type Kind,
  type Validation,
  type Ranch,
} from './ranches';
export { type Kind } from './ranches';
export const fixtures = partitionRanches();
export type Lesson = 0 | 1 | 2;
export type Experiment = {
  model: Model;
  scaler: Scaler;
  steps: number;
  history: { step: number; loss: number }[];
};
export const MAX_UPDATES = 1500;
export function createExperiment(kind: Kind, fitted = true): Experiment {
  const raw = toRows(fixtures.development, kind),
    scaler = fitScaler(raw);
  const rows = scaled(raw, scaler);
  let model = initial(kind === 'linear' ? 1 : 2);
  const history = [{ step: 0, loss: loss(rows, model, kind === 'logistic') }];
  const steps = fitted ? TRAINING_STEPS[kind] : 0;
  for (let i = 1; i <= steps; i++) {
    model = step(rows, model, kind === 'logistic', LEARNING_RATE);
    history.push({ step: i, loss: loss(rows, model, kind === 'logistic') });
  }
  return { model, scaler, steps, history };
}
export type FinalResult = ReturnType<typeof assess> & {
  model: Model;
  scaler: Scaler;
};
export type LabState = {
  lesson: Lesson;
  linear: Experiment;
  logistic: Experiment;
  running: boolean;
  cattle: number;
  feed: number;
  inspected: string | null;
  validation: Validation | null;
  fold: number;
  finished: FinalResult | null;
};
export function createLabState(): LabState {
  return {
    lesson: 0,
    linear: createExperiment('linear'),
    logistic: createExperiment('logistic'),
    running: false,
    cattle: 250,
    feed: 800,
    inspected: null,
    validation: null,
    fold: 0,
    finished: null,
  };
}
export type LabAction =
  | { type: 'navigate'; lesson: Lesson }
  | {
      type:
        | 'step'
        | 'toggle-running'
        | 'reset-model'
        | 'reset-all'
        | 'validate'
        | 'test'
        | 'pause';
    }
  | { type: 'input'; feature: 'cattle' | 'feed'; value: number }
  | { type: 'inspect'; id: string }
  | { type: 'fold'; value: number };
export function labReducer(state: LabState, action: LabAction): LabState {
  if (action.type === 'navigate')
    return { ...state, lesson: action.lesson, running: false };
  if (action.type === 'reset-all')
    return { ...createLabState(), lesson: state.lesson };
  if (action.type === 'input') {
    if (!Number.isFinite(action.value)) return state;
    const [min, max] = action.feature === 'cattle' ? [50, 500] : [400, 1400];
    return {
      ...state,
      [action.feature]: Math.max(min, Math.min(max, Math.round(action.value))),
      inspected: null,
    };
  }
  if (action.type === 'inspect') {
    const ranch = fixtures.development.find((r) => r.id === action.id);
    return ranch
      ? {
          ...state,
          cattle: ranch.cattle,
          feed: ranch.feed,
          inspected: ranch.id,
        }
      : state;
  }
  if (action.type === 'fold')
    return Number.isInteger(action.value) &&
      action.value >= 0 &&
      action.value < 5
      ? { ...state, fold: action.value }
      : state;
  if (action.type === 'pause') return { ...state, running: false };
  if (state.finished) return state;
  const kind: Kind = state.lesson === 0 ? 'linear' : 'logistic';
  if (action.type === 'validate')
    return {
      ...state,
      running: false,
      validation: crossValidate(fixtures.development),
    };
  if (action.type === 'test') {
    if (!state.validation) return state;
    const fit = fitRanches(fixtures.development, 'logistic');
    return {
      ...state,
      running: false,
      finished: { ...fit, ...assess(fit, fixtures.test) },
    };
  }
  if (state.lesson === 2) return state;
  const experiment = state[kind];
  if (action.type === 'reset-model')
    return { ...state, [kind]: createExperiment(kind, false), running: false };
  if (action.type === 'toggle-running')
    return experiment.steps < MAX_UPDATES
      ? { ...state, running: !state.running }
      : state;
  if (action.type === 'step') {
    if (experiment.steps >= MAX_UPDATES) return { ...state, running: false };
    const rows = scaled(toRows(fixtures.development, kind), experiment.scaler);
    const model = step(
      rows,
      experiment.model,
      kind === 'logistic',
      LEARNING_RATE,
    );
    const steps = experiment.steps + 1;
    return {
      ...state,
      running: state.running && steps < MAX_UPDATES,
      [kind]: {
        ...experiment,
        model,
        steps,
        history: [
          ...experiment.history,
          { step: steps, loss: loss(rows, model, kind === 'logistic') },
        ],
      },
    };
  }
  return state;
}
export const lessonHashes = [
  'linear-regression',
  'logistic-regression',
  'evaluation',
] as const;
export function lessonFromHash(hash: string): Lesson {
  const index = lessonHashes.indexOf(
    hash.replace(/^#/, '') as (typeof lessonHashes)[number],
  );
  return (index < 0 ? 0 : index) as Lesson;
}
export const developmentRanch = (id: string): Ranch | undefined =>
  fixtures.development.find((r) => r.id === id);
