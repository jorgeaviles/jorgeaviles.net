import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../evals/portfolio/cases.json';
import {
  evaluate,
  type EvaluationCase,
} from '../../../evals/portfolio/evaluate';
import baseline from '../../../evals/portfolio/baseline-worker';
import worker, { type Env } from '../../../workers/portfolio-api/src/index';
import {
  index,
  searchPortfolio,
} from '../../../workers/portfolio-api/src/content';
import { searchAssistant } from '../../../workers/portfolio-api/src/assistant-retrieval';
import { parseSelection } from '../../../workers/portfolio-api/src/selection';

const cases: EvaluationCase[] = fixture.cases;
const request = (question: string) =>
  new Request('https://portfolio-api.example/ask', {
    method: 'POST',
    headers: {
      Origin: 'https://jorgeaviles.net',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.1',
    },
    body: JSON.stringify({ question }),
  });
function environment(output: unknown) {
  return {
    ASSISTANT_ENABLED: 'true',
    MCP_LIMITER: { limit: async () => ({ success: true }) },
    REQUEST_LIMITER: { limit: async () => ({ success: true }) },
    INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
    AI: { run: vi.fn(async () => output) },
  } satisfies Env;
}
describe('public-source evaluation annotations', () => {
  it('pins the approved index and validates every passage, source and qualification', () => {
    expect(fixture.indexVersion).toBe(index.version);
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(cases.length).toBeLessThanOrEqual(50);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      const docs = index.documents.filter((d) =>
        d.passages.some((p) => c.relevantPassageIds.includes(p.id)),
      );
      const passages = docs
        .flatMap((d) => d.passages)
        .filter((p) => c.relevantPassageIds.includes(p.id));
      expect(passages).toHaveLength(c.relevantPassageIds.length);
      expect(
        [
          ...new Set(docs.map((d) => 'https://jorgeaviles.net' + d.path)),
        ].sort(),
      ).toEqual(c.sourceUrls);
      expect(
        c.requiredPassageIds.every((id) => c.relevantPassageIds.includes(id)),
      ).toBe(true);
      expect(c.multiplePassagesRequired).toBe(c.requiredPassageIds.length > 1);
      if (c.supported) {
        expect(c.relevantPassageIds.length).toBeGreaterThan(0);
        expect(c.refusalReason).toBeNull();
        for (const q of c.qualifications)
          expect(passages.map((p) => p.text).join('\n')).toContain(q);
      } else {
        expect(c.relevantPassageIds).toEqual([]);
        expect(c.refusalReason).toBeTruthy();
      }
    }
  });
  it('reports baseline/candidate retrieval separately from oracle-mocked selection', async () => {
    const before = await evaluate(
        baseline,
        searchPortfolio,
        cases,
        index,
        'legacy',
      ),
      after = await evaluate(worker, searchAssistant, cases, index);
    expect(after.totals.relevantRetrieved).toBeGreaterThanOrEqual(
      before.totals.relevantRetrieved,
    );
    expect(after.totals.falseRefusals).toBeLessThanOrEqual(
      before.totals.falseRefusals,
    );
    expect(after.totals.falseAcceptances).toBe(0);
    expect(after.totals.citationsCorrect).toBe(after.totals.citations);
    expect(after.totals.unrelatedSelected).toBe(0);
    expect(after.totals.qualificationsPreserved).toBe(
      after.totals.qualificationCases,
    );
    expect(after.totals.maxInferenceCalls).toBeLessThanOrEqual(1);
  });
});
describe('selection failure diagnosis without logging or inference retries', () => {
  it.each([
    [{ response: '{"passageIds":[]}' }, 'abstained'],
    [{ response: 'not JSON' }, 'malformed'],
    [{ response: '```json\n{"passageIds":["ml-status"]}\n```' }, 'malformed'],
    [{ response: { passageIds: ['unknown'] } }, 'invalid-ids'],
    [{ response: { passageIds: ['ml-status', 7] } }, 'malformed'],
    [
      { response: { passageIds: ['ml-status', 'ml-framework', 'ml-ranking'] } },
      'over-limit',
    ],
    [
      { choices: [{ message: { content: '{"passageIds":["ml-status"]}' } }] },
      'malformed',
    ],
  ] as const)('classifies %j and fails closed', async (output, kind) => {
    expect(parseSelection(output, ['ml-status', 'ml-framework']).kind).toBe(
      kind,
    );
    const env = environment(output);
    const body = await (
      await worker.fetch(
        request(
          'What machine learning methods and evaluation limitations are documented?',
        ),
        env,
      )
    ).json();
    expect(body.status).toBe('unsupported');
    expect(body.references).toEqual([]);
    expect(env.AI.run).toHaveBeenCalledTimes(1);
  });
  it('exercises the full ML regression path and requires methods AND limitations', async () => {
    const env = environment({
      response: { first: 'ml-framework', second: 'ml-status' },
    });
    const body = await (
      await worker.fetch(
        request(
          'What machine learning methods and evaluation limitations are documented?',
        ),
        env,
      )
    ).json();
    const call = env.AI.run.mock.calls[0] as unknown as [
      string,
      { messages: { content: string }[] },
    ];
    const supplied = JSON.parse(call[1].messages[1].content).passages as {
      id: string;
    }[];
    expect(supplied.map((p) => p.id)).toEqual(
      expect.arrayContaining(['ml-framework', 'ml-status']),
    );
    expect(body.status).toBe('answered');
    expect(body.answer).toContain('Spark pipelines');
    expect(body.answer).toContain('execution records are needed');
    expect(body.answer).toContain('experimental');
    expect(body.references.map((r: { url: string }) => r.url)).toEqual([
      'https://jorgeaviles.net/work/machine-learning-audit-prioritization/',
    ]);
    expect(env.AI.run).toHaveBeenCalledTimes(1);
  });
  it.each([
    { first: ['ml-status'], second: null },
    { first: 'ml-status' },
    { first: 'ml-status', second: null, third: 'ml-framework' },
    { first: 'ml-status', second: 'unknown' },
  ])('fails safely for invalid two-slot records %j', async (response) => {
    const env = environment({ response });
    const body = await (
      await worker.fetch(request('machine learning'), env)
    ).json();
    expect(body.status).toBe('unsupported');
    expect(body.references).toEqual([]);
    expect(env.AI.run).toHaveBeenCalledTimes(1);
  });
  it('does not turn model abstention into an answer based on lexical matches', async () => {
    const env = environment({ response: { passageIds: [] } });
    const body = await (
      await worker.fetch(
        request(
          'What machine learning methods and evaluation limitations are documented?',
        ),
        env,
      )
    ).json();
    expect(body.status).toBe('unsupported');
    expect(env.AI.run).toHaveBeenCalledTimes(1);
  });
  it('rejects an approved ID that was not supplied to the selector', async () => {
    const env = environment({ response: { passageIds: ['research-methods'] } });
    const body = await (
      await worker.fetch(request('Blazor Audit Portal'), env)
    ).json();
    expect(body.status).toBe('unsupported');
    expect(body.references).toEqual([]);
  });
});

describe('strict empty-slot compatibility', () => {
  it.each([
    [{ first: 'null', second: 'ml-status' }, 'selected', ['ml-status']],
    [{ first: null, second: 'null' }, 'abstained', []],
    [{ first: 'NULL', second: 'ml-status' }, 'invalid-ids', []],
    [{ first: 'null', second: 'unknown' }, 'invalid-ids', []],
    [{ passageIds: ['null', 'ml-status'] }, 'invalid-ids', []],
  ] as const)(
    'normalizes only the observed nullable-slot sentinel %j',
    (response, kind, ids) => {
      expect(parseSelection({ response }, ['ml-status'])).toEqual({
        kind,
        ids,
      });
    },
  );
});
