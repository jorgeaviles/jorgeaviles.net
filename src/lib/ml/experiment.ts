import {
  datasets,
  fitScaler,
  scaled,
  initial,
  loss,
  step,
  evaluate,
  rank,
  type Model,
  type Row,
} from './models';
export const fixtures = datasets();
export const classificationScale = fitScaler(fixtures.train);
export const regressionScale = fitScaler(fixtures.regression);
export const samples = {
  linear: scaled(fixtures.regression, regressionScale),
  training: scaled(fixtures.train, classificationScale),
  validation: scaled(fixtures.validation, classificationScale),
  test: scaled(fixtures.test, classificationScale),
};
export type Lesson = 0 | 1 | 2;
export type Kind = 'linear' | 'logistic';
export type Population = 'training' | 'validation';
export type SelectionKey = 'linear' | Population;
export type TracePoint = { step: number; loss: number };
export type Experiment = {
  model: Model;
  rate: number;
  steps: number;
  history: TracePoint[];
  mode: 'initial' | 'trained' | 'manual';
};
export const MAX_UPDATES = 1000;
const rowsFor = (kind: Kind): Row[] =>
  kind === 'linear' ? samples.linear : samples.training;
export function createExperiment(kind: Kind): Experiment {
  const model = initial(kind === 'linear' ? 1 : 2);
  return {
    model,
    rate: 0.05,
    steps: 0,
    history: [
      { step: 0, loss: loss(rowsFor(kind), model, kind === 'logistic') },
    ],
    mode: 'initial',
  };
}
export type LabState = {
  lesson: Lesson;
  linear: Experiment;
  logistic: Experiment;
  running: boolean;
  population: Population;
  selected: Record<SelectionKey, string>;
  guidance: [boolean, boolean, boolean];
  policy: 'budget' | 'threshold';
  budget: number;
  threshold: number;
  finished: ReturnType<typeof evaluate> | null;
};
export function createLabState(): LabState {
  return {
    lesson: 0,
    linear: createExperiment('linear'),
    logistic: createExperiment('logistic'),
    running: false,
    population: 'training',
    selected: {
      linear: fixtures.regression[0].id,
      training: fixtures.train[0].id,
      validation: fixtures.validation[0].id,
    },
    guidance: [true, true, true],
    policy: 'budget',
    budget: 6,
    threshold: 0.5,
    finished: null,
  };
}
export type LabAction =
  | { type: 'navigate'; lesson: Lesson }
  | { type: 'step' }
  | { type: 'toggle-running' }
  | { type: 'rate'; value: number }
  | { type: 'parameters'; model: Model }
  | { type: 'reset-model' }
  | { type: 'reset-all' }
  | { type: 'population'; value: Population }
  | { type: 'select'; key: SelectionKey; id: string }
  | { type: 'guidance'; visible: boolean }
  | { type: 'policy'; value: 'budget' | 'threshold' }
  | { type: 'budget'; value: number }
  | { type: 'threshold'; value: number }
  | { type: 'test' };
const hideGuidance = (state: LabState) =>
  state.guidance.map((v, i) =>
    i === state.lesson ? false : v,
  ) as LabState['guidance'];
/** Model, counter and historical loss advance atomically from the same previous state. */
export function labReducer(state: LabState, action: LabAction): LabState {
  const kind: Kind = state.lesson === 0 ? 'linear' : 'logistic';
  if (action.type === 'navigate')
    return { ...state, lesson: action.lesson, running: false };
  if (action.type === 'guidance')
    return {
      ...state,
      guidance: state.guidance.map((v, i) =>
        i === state.lesson ? action.visible : v,
      ) as LabState['guidance'],
    };
  if (action.type === 'population')
    return { ...state, population: action.value };
  if (action.type === 'select')
    return {
      ...state,
      selected: { ...state.selected, [action.key]: action.id },
    };
  if (action.type === 'reset-all')
    return {
      ...createLabState(),
      lesson: state.lesson,
      guidance: state.guidance,
    };
  if (state.finished) return state;
  switch (action.type) {
    case 'step': {
      if (state.lesson === 2) return state;
      const current = state[kind];
      if (current.steps >= MAX_UPDATES) return { ...state, running: false };
      const model = step(
        rowsFor(kind),
        current.model,
        kind === 'logistic',
        current.rate,
      );
      const next = {
        ...current,
        model,
        mode: 'trained' as const,
        steps: current.steps + 1,
        history: [
          ...current.history,
          {
            step: current.steps + 1,
            loss: loss(rowsFor(kind), model, kind === 'logistic'),
          },
        ],
      };
      return {
        ...state,
        [kind]: next,
        guidance: hideGuidance(state),
        running: state.running && next.steps < MAX_UPDATES,
      };
    }
    case 'toggle-running':
      return state.lesson === 2 || state[kind].steps >= MAX_UPDATES
        ? state
        : { ...state, running: !state.running, guidance: hideGuidance(state) };
    case 'rate':
      return { ...state, [kind]: { ...state[kind], rate: action.value } };
    case 'parameters': {
      const model = {
        w: action.model.w.map((v) => Math.max(-100, Math.min(100, v))),
        b: Math.max(-100, Math.min(100, action.model.b)),
      };
      if (![...model.w, model.b].every(Number.isFinite)) return state;
      return {
        ...state,
        running: false,
        [kind]: {
          ...state[kind],
          model,
          steps: 0,
          mode: 'manual',
          history: [
            { step: 0, loss: loss(rowsFor(kind), model, kind === 'logistic') },
          ],
        },
      };
    }
    case 'reset-model':
      return { ...state, [kind]: createExperiment(kind), running: false };
    case 'policy':
      return { ...state, policy: action.value, guidance: hideGuidance(state) };
    case 'budget':
      return {
        ...state,
        budget: Math.max(
          0,
          Math.min(samples.validation.length, Math.floor(action.value)),
        ),
        guidance: hideGuidance(state),
      };
    case 'threshold':
      return {
        ...state,
        threshold: Math.max(0, Math.min(1, action.value)),
        guidance: hideGuidance(state),
      };
    case 'test':
      return {
        ...state,
        running: false,
        finished: evaluate(
          rank(samples.test, state.logistic.model),
          state.policy,
          state.policy === 'budget' ? state.budget : state.threshold,
        ),
      };
  }
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
