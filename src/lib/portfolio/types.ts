export interface Passage {
  id: string;
  text: string;
  keywords: string;
}
export interface PublicDocument {
  id: string;
  kind: 'project' | 'about' | 'research';
  path: string;
  title: string;
  passages: Passage[];
}
export interface PortfolioIndex {
  schemaVersion: 1;
  version: string;
  documents: PublicDocument[];
}
export interface Reference {
  title: string;
  url: string;
}
export interface AskResponse {
  status:
    'answered' | 'unsupported' | 'unavailable' | 'rate_limited' | 'invalid';
  answer: string;
  references: Reference[];
  indexVersion: string;
}
export const LIMITS = {
  question: 500,
  bodyBytes: 2048,
  answer: 1800,
  responseBytes: 8192,
  candidates: 6,
  passages: 2,
  inferenceMs: 12_000,
} as const;
