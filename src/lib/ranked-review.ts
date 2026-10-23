export interface RankedReviewCase {
  readonly id: string;
  readonly description: string;
  readonly relevant: boolean;
}

/** Fabricated records in a fixed teaching order; no model produced this ranking. */
export const rankedReviewCases: readonly RankedReviewCase[] = [
  {
    id: 'SYN-01',
    description: 'Repeated item in a fictional checklist',
    relevant: true,
  },
  {
    id: 'SYN-02',
    description: 'Missing step in a fictional checklist',
    relevant: true,
  },
  {
    id: 'SYN-03',
    description: 'Complete checklist with an optional note',
    relevant: false,
  },
  {
    id: 'SYN-04',
    description: 'Conflicting entries in a fictional checklist',
    relevant: true,
  },
  {
    id: 'SYN-05',
    description: 'Complete checklist in a different order',
    relevant: false,
  },
  {
    id: 'SYN-06',
    description: 'Complete checklist with an extra heading',
    relevant: false,
  },
  {
    id: 'SYN-07',
    description: 'Unfinished item in a fictional checklist',
    relevant: true,
  },
  {
    id: 'SYN-08',
    description: 'Complete checklist with a short title',
    relevant: false,
  },
  {
    id: 'SYN-09',
    description: 'Complete checklist with a longer note',
    relevant: false,
  },
  {
    id: 'SYN-10',
    description: 'Duplicate step in a fictional checklist',
    relevant: true,
  },
  {
    id: 'SYN-11',
    description: 'Complete checklist with a revised label',
    relevant: false,
  },
  {
    id: 'SYN-12',
    description: 'Unresolved item in a fictional checklist',
    relevant: true,
  },
];

export const defaultSelectionSize = 4;

/** Invalid values become zero; fractional values round down within the available bounds. */
export function normalizeSelectionSize(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0)
    return 0;
  return Math.min(Math.max(Math.floor(value), 0), Math.floor(total));
}

export interface RankedReviewMetrics {
  readonly selectionSize: number;
  readonly totalCases: number;
  readonly totalRelevant: number;
  readonly relevantSelected: number;
  readonly irrelevantSelected: number;
  readonly relevantMissed: number;
  /** Fraction from 0 to 1. Defined as zero when nothing is selected. */
  readonly precision: number;
  /** Fraction from 0 to 1. Defined as zero when there are no relevant records. */
  readonly recall: number;
}

export function calculateRankedReview(
  selectionSize: number,
  cases: readonly RankedReviewCase[] = rankedReviewCases,
): RankedReviewMetrics {
  const selected = normalizeSelectionSize(selectionSize, cases.length);
  const totalRelevant = cases.filter((record) => record.relevant).length;
  const relevantSelected = cases
    .slice(0, selected)
    .filter((record) => record.relevant).length;

  return {
    selectionSize: selected,
    totalCases: cases.length,
    totalRelevant,
    relevantSelected,
    irrelevantSelected: selected - relevantSelected,
    relevantMissed: totalRelevant - relevantSelected,
    precision: selected === 0 ? 0 : relevantSelected / selected,
    recall: totalRelevant === 0 ? 0 : relevantSelected / totalRelevant,
  };
}
