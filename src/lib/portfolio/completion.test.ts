import { describe, expect, it, vi } from 'vitest';
import recordings from '../../../evals/portfolio/completion-recordings.json';
import dataset from '../../../evals/portfolio/cases.json';
import worker, { type Env } from '../../../workers/portfolio-api/src/index';
import { index } from '../../../workers/portfolio-api/src/content';

describe('hosted completion sample replay with final citation policy (no AI requests)', () => {
  it('keeps sample size, source version and real-model observations explicit', () => {
    expect(recordings.indexVersion).toBe(index.version);
    expect(recordings.records).toHaveLength(30);
    expect(
      recordings.records.filter(
        (r) => dataset.cases.find((c) => c.id === r.caseId)?.supported,
      ),
    ).toHaveLength(14);
    expect(recordings.stats.ready.requests).toBe(30);
  });
  it.each(recordings.records)('$caseId', async (record) => {
    const fixture = dataset.cases.find((c) => c.id === record.caseId)!;
    const limit = { limit: async () => ({ success: true }) };
    const env: Env = {
      ASSISTANT_ENABLED: 'true',
      MCP_LIMITER: limit,
      REQUEST_LIMITER: limit,
      INFERENCE_LIMITER: limit,
      AI: { run: vi.fn(async () => ({ response: record.modelResponse })) },
    };
    const response = await worker.fetch(
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
    expect(body).toEqual(record.currentResponse);
    expect(body.status).toBe(fixture.supported ? 'answered' : 'unsupported');
    expect(env.AI.run).toHaveBeenCalledTimes(record.modelCalls);
    expect(
      body.references.every((r: { url: string }) =>
        index.documents.some(
          (d) => 'https://jorgeaviles.net' + d.path === r.url,
        ),
      ),
    ).toBe(true);
    if (body.sentences)
      for (const sentence of body.sentences) {
        expect(sentence.sourceIndexes.length).toBeGreaterThan(0);
        expect(
          sentence.sourceIndexes.every((n: number) => !!body.references[n]),
        ).toBe(true);
      }
    if (record.caseId === 'ml-09' || record.caseId === 'ml-14') {
      expect(body.answer).toContain('experimental');
      expect(body.answer).toMatch(/execution records/i);
    }
    if (record.caseId === 'research-24') {
      expect(body.answer).toContain('Asthana');
      expect(body.answer).toMatch(/research assist/);
      expect(body.answer).toMatch(/acknowledg/);
    }
    if (record.caseId === 'ml-17')
      expect(body.answer).toMatch(/not a fraud label/);
  });
});
