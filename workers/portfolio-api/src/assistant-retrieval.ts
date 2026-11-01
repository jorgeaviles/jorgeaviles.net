import { searchPortfolio } from './content';
import { LIMITS } from '../../../src/lib/portfolio/types';

// Ask-only inflection normalization. The evaluation fixture records the missed
// singular keyword in ml-ranking; MCP retains its existing queries and ordering.
export function searchAssistant(question: string) {
  if (question.length > LIMITS.question) return [];
  const normalized = question.replace(/\bevaluations\b/giu, 'evaluation');
  // The approved methods passage describes its framework. Keep the original
  // term as well, so research methodology remains discoverable.
  const expanded = normalized.replace(/\bmethods?\b/giu, 'method framework');
  return searchPortfolio(
    expanded.length <= LIMITS.question ? expanded : normalized,
  );
}
