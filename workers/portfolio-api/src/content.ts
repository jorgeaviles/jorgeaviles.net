import data from '../index.json';
import type { PortfolioIndex } from '../../../src/lib/portfolio/types';
import { LIMITS } from '../../../src/lib/portfolio/types';

export const index = data as PortfolioIndex;
const stop = new Set(
  'what which how does did is are was the a an and or of for in to with me about jorge aviles avilés his he you your tell on at from by can could would should have has had it its this that do please'.split(
    ' ',
  ),
);
const tokens = (text: string) =>
  [
    ...new Set(
      text
        .toLowerCase()
        .replace(/machine[ -]learning/g, 'machinelearning ml')
        .match(/[\p{L}\p{N}+#.]+/gu) ?? [],
    ),
  ].filter((word) => word.length > 1 && !stop.has(word));
export function listProjects() {
  return index.documents
    .filter((doc) => doc.kind === 'project')
    .map(({ id, title, path }) => ({
      id,
      title,
      url: `https://jorgeaviles.net${path}`,
    }));
}
export function getCaseStudy(id: string) {
  return (
    index.documents.find((doc) => doc.kind === 'project' && doc.id === id) ??
    null
  );
}
export function getResearch() {
  return index.documents.filter((doc) => doc.kind === 'research');
}
// Reuse only locale configuration, never query or result state. Constructing
// the collator during isolate startup avoids first-search ICU setup.
const comparePassageIds = new Intl.Collator('en').compare;
export function searchPortfolio(
  query: string,
  limit: number = LIMITS.candidates,
) {
  if (!query.trim() || query.length > LIMITS.question) return [];
  const terms = tokens(query);
  return index.documents
    .flatMap((doc) =>
      doc.passages.map((passage) => {
        const words = new Set(tokens(`${passage.text} ${passage.keywords}`));
        const matches = terms.filter((term) => words.has(term));
        return {
          ...passage,
          title: doc.title,
          url: `https://jorgeaviles.net${doc.path}`,
          score: matches.length / Math.max(terms.length, 1),
        };
      }),
    )
    .filter((item) => item.score >= 0.25)
    .sort((a, b) => b.score - a.score || comparePassageIds(a.id, b.id))
    .slice(0, Math.max(0, Math.min(LIMITS.candidates, Math.floor(limit) || 0)));
}
