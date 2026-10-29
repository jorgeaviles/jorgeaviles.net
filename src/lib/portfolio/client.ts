import { LIMITS, type AskResponse, type Reference } from './types';

export const PUBLIC_API = 'https://portfolio-api.jorgeaviles.net/ask';
const sourcePaths = new Set([
  '/about/',
  '/research/',
  '/work/analytical-applications/',
  '/work/analytical-data-platforms/',
  '/work/machine-learning-audit-prioritization/',
]);
export function configuredEndpoint(value: string | undefined): string | null {
  if (!value) return null;
  if (value !== PUBLIC_API)
    throw new Error(
      'Portfolio API must use its reviewed dedicated HTTPS endpoint.',
    );
  return value;
}
function isReference(value: unknown): value is Reference {
  if (
    !value ||
    typeof value !== 'object' ||
    !('title' in value) ||
    !('url' in value) ||
    typeof value.title !== 'string' ||
    value.title.length > 200 ||
    typeof value.url !== 'string'
  )
    return false;
  try {
    const url = new URL(value.url);
    return (
      url.origin === 'https://jorgeaviles.net' &&
      sourcePaths.has(url.pathname) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export async function requestAnswer(
  endpoint: string,
  question: string,
  signal: AbortSignal,
): Promise<AskResponse> {
  if (!configuredEndpoint(endpoint)) throw new Error('unavailable');
  question = question.replace(/[\r\n\t]/g, ' ').trim();
  if (
    !question ||
    question.length > LIMITS.question ||
    [...question].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error('invalid');
  // Deliberately one fetch: no SDK retry loop, credentials, history or local storage.
  const response = await fetch(endpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: question.trim() }),
    signal,
  });
  if (response.status === 429) throw new Error('rate_limited');
  if (response.status === 400) throw new Error('invalid');
  if (!response.ok) throw new Error('unavailable');
  if (
    !response.body ||
    !response.headers.get('content-type')?.includes('application/json')
  )
    throw new Error('unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '',
    bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMITS.responseBytes) {
        await reader.cancel();
        throw new Error('unavailable');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const result: unknown = JSON.parse(text);
  if (
    !result ||
    typeof result !== 'object' ||
    !('status' in result) ||
    !('answer' in result) ||
    !('references' in result) ||
    !('indexVersion' in result) ||
    !['answered', 'unsupported'].includes(String(result.status)) ||
    typeof result.answer !== 'string' ||
    !result.answer ||
    result.answer.length > LIMITS.answer ||
    !Array.isArray(result.references) ||
    result.references.length > LIMITS.passages ||
    !result.references.every(isReference) ||
    (result.status === 'answered' && !result.references.length) ||
    typeof result.indexVersion !== 'string' ||
    !/^[a-f0-9]{64}$/.test(result.indexVersion)
  )
    throw new Error('unavailable');
  return result as AskResponse;
}
