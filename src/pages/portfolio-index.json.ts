import { createHash } from 'node:crypto';
import background from '../content/background.mdx?raw';
import curated from '../content/portfolio-assistant.json';
import { getPublishedEntries } from '../lib/content';
import type { PortfolioIndex, PublicDocument } from '../lib/portfolio/types';

export const prerender = true;
const normalize = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|_/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export async function GET() {
  const work = await getPublishedEntries('work');
  const research = await getPublishedEntries('research');
  const documents: PublicDocument[] = [];
  const ids = new Set<string>();
  for (const entry of curated) {
    // Only these already-public collections and the explicit About source are allowed.
    const source =
      entry.kind === 'project'
        ? work.find((item) => item.id === entry.id)
        : entry.kind === 'research'
          ? research.find((item) => item.id === entry.id)
          : undefined;
    if (entry.kind !== 'about' && !source) continue;
    if (source && entry.title !== source.data.title)
      throw new Error('Stale approved source title');
    if (
      entry.kind === 'about' &&
      (entry.id !== 'about' || entry.file !== 'src/content/background.mdx')
    )
      throw new Error('Unapproved About source');
    const body = source?.body ?? background;
    const expectedPath =
      entry.kind === 'project'
        ? `/work/${entry.id}/`
        : entry.kind === 'research'
          ? '/research/'
          : '/about/';
    if (entry.path !== expectedPath) throw new Error('Unapproved source URL');
    for (const passage of entry.passages) {
      if (
        ids.has(passage.id) ||
        passage.text.length > 900 ||
        !normalize(body).includes(normalize(passage.text))
      )
        throw new Error(`Stale or invalid approved passage: ${passage.id}`);
      ids.add(passage.id);
    }
    documents.push({
      id: entry.id,
      kind: entry.kind as PublicDocument['kind'],
      path: entry.path,
      title: entry.title,
      passages: entry.passages,
    });
  }
  const payload = JSON.stringify(documents);
  const index: PortfolioIndex = {
    schemaVersion: 1,
    version: createHash('sha256').update(payload).digest('hex'),
    documents,
  };
  return Response.json(index);
}
