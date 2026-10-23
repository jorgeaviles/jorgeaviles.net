import { getCollection, type CollectionEntry } from 'astro:content';

export type PortfolioCollection = 'work' | 'research' | 'lab';

/** Use this boundary for public indexes, routes, and related content. */
export async function getPublishedEntries<K extends PortfolioCollection>(
  collection: K,
): Promise<CollectionEntry<K>[]> {
  const entries = await getCollection(collection);

  return entries
    .filter((entry) => !entry.data.draft)
    .sort(
      (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id, 'en'),
    );
}
