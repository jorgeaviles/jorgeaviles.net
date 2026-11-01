import { describe, expect, it, vi } from 'vitest';
import {
  parseGeneration,
  GENERATION,
} from '../../../workers/portfolio-api/src/generation';
import { index } from '../../../workers/portfolio-api/src/content';
import worker, { type Env } from '../../../workers/portfolio-api/src/index';
import fixtures from '../../../evals/portfolio/synthesis-fixtures.json';
const evidence = index.documents.flatMap((d) => d.passages);
const make = (ids: string[]) => ({
  first: ids[0] ?? null,
  second: ids[1] ?? null,
  sentences: ids.flatMap((id) =>
    fixtures[id as keyof typeof fixtures].map((text) => ({
      text,
      passageIds: [id],
    })),
  ),
});
const parse = (value: unknown) =>
  parseGeneration({ response: value }, evidence);
describe('bounded sentence synthesis and evidence fallback', () => {
  it.each(Object.keys(fixtures))(
    'accepts independently reviewed public-source fixture %s',
    (id) => {
      expect(parse(make([id])).sentences).toHaveLength(2);
    },
  );
  it('requires each selected passage to be represented, including ML methods AND limitations', () => {
    expect(parse(make(['ml-framework', 'ml-status'])).sentences).toHaveLength(
      4,
    );
    const v = make(['ml-framework', 'ml-status']);
    v.sentences = v.sentences.slice(0, 2);
    expect(parse(v)).toEqual({
      ids: ['ml-framework', 'ml-status'],
      sentences: null,
    });
  });
  it.each([
    { first: 'unknown', second: null, sentences: [] },
    {
      first: 'ml-status',
      second: null,
      sentences: [],
      url: 'https://evil.example',
    },
    { first: ['ml-status'], second: null, sentences: [] },
    { first: null, second: null, sentences: make(['ml-status']).sentences },
    { passageIds: ['ml-status'], answer: 'unsafe' },
  ])(
    'does not fabricate selection from invalid structure or abstention: %j',
    (v) => {
      expect(parse(v)).toEqual({ ids: [], sentences: null });
    },
  );
  it.each([
    '<script>alert(1)</script>.',
    'See https://evil.example.',
    'The AUC is 99%.',
    'The model is deployed in production.',
    'Jorge authored the cattle-ranch study.',
    'The program is successful.',
    'x'.repeat(401) + '.',
  ])(
    'falls back for invalid or unsafe prose with valid selection: %s',
    (text) => {
      const v = make(['ml-status']);
      v.sentences[0].text = text;
      expect(parse(v)).toEqual({ ids: ['ml-status'], sentences: null });
    },
  );
  it('rejects invented sentence citations without discarding valid selected evidence', () => {
    const v = make(['ml-status']);
    v.sentences[0].passageIds = ['research-credit'];
    expect(parse(v).sentences).toBeNull();
  });
  it('bounds bytes before parsing and refuses truncated JSON', () => {
    expect(
      parseGeneration({ response: 'x'.repeat(GENERATION.output + 1) }, evidence)
        .ids,
    ).toEqual([]);
    expect(
      parseGeneration({ response: '{"first":"ml-status"' }, evidence).ids,
    ).toEqual([]);
  });
  it('resolves sentence links server-side with exactly one inference and no retry', async () => {
    const env: Env = {
      ASSISTANT_ENABLED: 'true',
      REQUEST_LIMITER: { limit: async () => ({ success: true }) },
      INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
      MCP_LIMITER: { limit: async () => ({ success: true }) },
      AI: {
        run: vi.fn(async () => ({
          response: make(['ml-framework', 'ml-status']),
        })),
      },
    };
    const r = await worker.fetch(
      new Request('https://portfolio-api.example/ask', {
        method: 'POST',
        headers: {
          Origin: 'https://jorgeaviles.net',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '192.0.2.1',
        },
        body: JSON.stringify({
          question:
            'What machine learning methods and evaluation limitations are documented?',
        }),
      }),
      env,
    );
    const body = await r.json();
    expect(body.status).toBe('answered');
    expect(body.sentences).toHaveLength(4);
    expect(
      body.sentences.every(
        (s: { sourceIndexes: number[] }) => s.sourceIndexes.join() === '0',
      ),
    ).toBe(true);
    expect(body.references).toHaveLength(1);
    expect(env.AI.run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.AI.run).mock.calls[0][1]).toMatchObject({
      max_tokens: 420,
      stream: false,
      temperature: 0,
    });
  });
});
