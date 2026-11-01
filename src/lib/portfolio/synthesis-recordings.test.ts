import { describe, expect, it, vi } from 'vitest';
import recordings from '../../../evals/portfolio/synthesis-recordings.json';
import dataset from '../../../evals/portfolio/cases.json';
import v1 from '../../../evals/portfolio/v1-worker';
import worker, { type Env } from '../../../workers/portfolio-api/src/index';
import { index } from '../../../workers/portfolio-api/src/content';

describe('recorded hosted synthesis outputs: regression evidence, NOT passing quality certification', () => {
  it.each(recordings.records)('$variant / $caseId', async (record) => {
    expect(recordings.indexVersion).toBe(index.version);
    const fixture = dataset.cases.find((c) => c.id === record.caseId)!;
    const env: Env = {
      ASSISTANT_ENABLED: 'true',
      MCP_LIMITER: { limit: async () => ({ success: true }) },
      REQUEST_LIMITER: { limit: async () => ({ success: true }) },
      INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
      AI: { run: vi.fn(async () => ({ response: record.output })) },
    };
    const response = await (record.variant === 'v1' ? v1 : worker).fetch(
      new Request('https://portfolio-api.example/ask', {
        method: 'POST',
        headers: {
          Origin: 'https://jorgeaviles.net',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '192.0.2.1',
        },
        body: JSON.stringify({ question: fixture.question }),
      }),
      env,
    );
    const body = await response.json();
    expect(body.status).toBe(record.expectedStatus);
    // Preserve captured outcomes; the current policy can additionally restore
    // missing approved qualifications. This replay is not a new hosted success.
    const restored =
      record.variant === 'v2-final' &&
      ['ml-09', 'ml-14'].includes(record.caseId);
    expect(!!body.sentences).toBe(restored || record.expectedSynthesis);
    if (restored)
      expect(body.answer).toContain('The program remains experimental.');
    expect(env.AI.run).toHaveBeenCalledTimes(1);
    expect(
      body.references.every((r: { url: string }) =>
        index.documents.some(
          (d) => 'https://jorgeaviles.net' + d.path === r.url,
        ),
      ),
    ).toBe(true);
  });
});
