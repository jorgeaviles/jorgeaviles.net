import { useEffect, useReducer, useState } from 'react';
import {
  createLabState,
  labReducer,
  lessonFromHash,
  lessonHashes,
  type Lesson,
} from '../../lib/ml/experiment';
export function useLabExperiment() {
  const [state, dispatch] = useReducer(labReducer, undefined, createLabState);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () =>
      dispatch({
        type: 'navigate',
        lesson: lessonFromHash(window.location.hash),
      });
    sync();
    setReady(true);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(query.matches);
    motion();
    query.addEventListener('change', motion);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      query.removeEventListener('change', motion);
    };
  }, []);
  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(
      () => dispatch({ type: 'step' }),
      reduced ? 500 : 180,
    );
    return () => window.clearInterval(timer);
  }, [state.running, state.lesson, reduced]);
  function navigate(lesson: Lesson) {
    dispatch({ type: 'navigate', lesson });
    if (window.location.hash !== `#${lessonHashes[lesson]}`)
      window.history.pushState(null, '', `#${lessonHashes[lesson]}`);
  }
  return { state, dispatch, navigate, ready };
}
export type LabController = ReturnType<typeof useLabExperiment>;
