import { evaluate, type EvaluationCase } from './evaluate';
import type { Env } from '../../workers/portfolio-api/src/index';
import type {
  AskResponse,
  PortfolioIndex,
} from '../../src/lib/portfolio/types';
import fixtures from './synthesis-fixtures.json';
interface Worker {
  fetch(request: Request, env: Env): Promise<Response>;
}
interface Candidate {
  id: string;
  text: string;
  url: string;
}
export async function evaluateSynthesis(
  worker: Worker,
  search: (q: string) => Candidate[],
  cases: EvaluationCase[],
  index: PortfolioIndex,
) {
  // Keep the full 42-case selection contract evaluation, then independently
  // exercise sentence assembly with reviewed paraphrases. Neither is live AI.
  const selection = await evaluate(worker, search, cases, index);
  const rows = [];
  for (const c of cases) {
    let calls = 0;
    const ids = c.supported ? c.requiredPassageIds : [];
    const sentences = ids.flatMap((id) =>
      fixtures[id as keyof typeof fixtures].map((text) => ({
        text,
        passageIds: [id],
      })),
    );
    const env: Env = {
      ASSISTANT_ENABLED: 'true',
      REQUEST_LIMITER: { limit: async () => ({ success: true }) },
      INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
      MCP_LIMITER: { limit: async () => ({ success: true }) },
      AI: {
        run: async (_model, input) => {
          calls++;
          const supplied = JSON.parse(input.messages[1].content)
            .passages as Candidate[];
          if (ids.some((id) => !supplied.some((p) => p.id === id)))
            throw Error('Missing evidence');
          return {
            response: {
              first: ids[0] ?? null,
              second: ids[1] ?? null,
              sentences,
            },
          };
        },
      },
    };
    const response = await worker.fetch(
      new Request('https://portfolio-api.example/ask', {
        method: 'POST',
        headers: {
          Origin: 'https://jorgeaviles.net',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '192.0.2.1',
        },
        body: JSON.stringify({ question: c.question }),
      }),
      env,
    );
    const body = (await response.json()) as AskResponse;
    const synthesized = !!body.sentences;
    const citationsValid = body.references.every((r) =>
      c.sourceUrls.includes(r.url),
    );
    const allSentencesCited =
      !synthesized ||
      body.sentences!.every(
        (s) =>
          s.sourceIndexes.length &&
          s.sourceIndexes.every((i) => !!body.references[i]),
      );
    // Fixture equality establishes expected assembly, not model entailment.
    const fixturePreserved =
      !c.supported || body.answer === sentences.map((s) => s.text).join(' ');
    if (
      response.status !== 200 ||
      calls > 1 ||
      (body.status === 'answered') !== c.supported ||
      !citationsValid ||
      !allSentencesCited ||
      !fixturePreserved ||
      (c.supported && !synthesized)
    )
      throw Error('Synthesis fixture regression: ' + c.id);
    rows.push({
      id: c.id,
      status: body.status,
      calls,
      synthesized,
      citationsValid,
      allSentencesCited,
      fixturePreserved,
      requiredEvidence: ids,
      answer: body.answer,
    });
  }
  return {
    mode: 'reviewed paraphrase oracle mocks; NOT real model accuracy or an automated entailment proof',
    selection,
    totals: {
      cases: rows.length,
      supported: rows.filter((r) => r.synthesized).length,
      refused: rows.filter((r) => r.status === 'unsupported').length,
      citationFailures: rows.filter(
        (r) => !r.citationsValid || !r.allSentencesCited,
      ).length,
      maxInferenceCalls: Math.max(...rows.map((r) => r.calls)),
    },
    rows,
  };
}
