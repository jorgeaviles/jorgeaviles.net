import type { Env } from '../../workers/portfolio-api/src/index';
import type {
  AskResponse,
  PortfolioIndex,
} from '../../src/lib/portfolio/types';
export interface EvaluationCase {
  id: string;
  category: string;
  question: string;
  supported: boolean;
  relevantPassageIds: string[];
  requiredPassageIds: string[];
  sourceUrls: string[];
  qualifications: string[];
  multiplePassagesRequired: boolean;
  refusalReason: string | null;
}
interface Candidate {
  id: string;
  text: string;
  url: string;
}
interface Worker {
  fetch(request: Request, env: Env): Promise<Response>;
}
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
export async function evaluate(
  worker: Worker,
  search: (question: string) => Candidate[],
  cases: EvaluationCase[],
  index: PortfolioIndex,
  format: 'legacy' | 'slots' = 'slots',
) {
  const totals = {
    supported: 0,
    unsupported: 0,
    relevantRetrieved: 0,
    relevantExpected: 0,
    requiredExpected: 0,
    candidates: 0,
    irrelevantCandidates: 0,
    reciprocalRankSum: 0,
    fullRetrievalCoverage: 0,
    zeroCandidates: 0,
    answeredSupported: 0,
    falseRefusals: 0,
    refusedUnsupported: 0,
    falseAcceptances: 0,
    invalidIds: 0,
    malformedOutputs: 0,
    citationsCorrect: 0,
    citations: 0,
    selectedRelevant: 0,
    selected: 0,
    unrelatedSelected: 0,
    qualificationCases: 0,
    qualificationsPreserved: 0,
    inferenceCalls: 0,
    maxInferenceCalls: 0,
  };
  const rows = [];
  for (const item of cases) {
    const candidates = search(item.question),
      ids = candidates.map((p) => p.id);
    const hits = ids.filter((id) => item.relevantPassageIds.includes(id));
    totals.candidates += ids.length;
    totals.irrelevantCandidates += ids.length - hits.length;
    if (!ids.length) totals.zeroCandidates++;
    if (item.supported) {
      totals.supported++;
      totals.relevantExpected += item.relevantPassageIds.length;
      totals.requiredExpected += item.requiredPassageIds.length;
      totals.relevantRetrieved += hits.length;
      const first = ids.findIndex((id) => item.relevantPassageIds.includes(id));
      totals.reciprocalRankSum += first < 0 ? 0 : 1 / (first + 1);
      if (hits.length === item.relevantPassageIds.length)
        totals.fullRetrievalCoverage++;
    } else totals.unsupported++;
    let calls = 0;
    let selectedIds: string[] = [];
    const env: Env = {
      ASSISTANT_ENABLED: 'true',
      MCP_LIMITER: { limit: async () => ({ success: true }) },
      REQUEST_LIMITER: { limit: async () => ({ success: true }) },
      INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
      AI: {
        run: async (_model, input) => {
          calls++;
          const payload = JSON.parse(input.messages[1].content) as {
            question: string;
            passages: Candidate[];
          };
          if (payload.question !== item.question)
            throw new Error('Evaluation question mismatch');
          // Explicitly an oracle/mock, NOT a simulation of real model accuracy.
          // It selects only when every annotated evidence passage was actually supplied.
          selectedIds =
            item.supported &&
            item.requiredPassageIds.every((id) =>
              payload.passages.some((p) => p.id === id),
            )
              ? item.requiredPassageIds
              : [];
          return {
            response: JSON.stringify(
              format === 'legacy'
                ? { passageIds: selectedIds }
                : {
                    first: selectedIds[0] ?? null,
                    second: selectedIds[1] ?? null,
                  },
            ),
          };
        },
      },
    };
    const response = await worker.fetch(request(item.question), env);
    const body = (await response.json()) as AskResponse;
    totals.inferenceCalls += calls;
    totals.maxInferenceCalls = Math.max(totals.maxInferenceCalls, calls);
    if (response.status !== 200 || calls > 1)
      throw new Error(`Worker contract failed: ${item.id}`);
    const answered = body.status === 'answered';
    if (item.supported) {
      if (answered) totals.answeredSupported++;
      else totals.falseRefusals++;
    } else if (answered) totals.falseAcceptances++;
    else totals.refusedUnsupported++;
    if (answered) {
      const selected = selectedIds.map((id) =>
        candidates.find((p) => p.id === id)!,
      );
      if (body.answer !== selected.map((p) => p.text).join('\n\n'))
        throw new Error('Non-extractive answer');
      totals.selected += selected.length;
      totals.selectedRelevant += selected.filter((p) =>
        item.relevantPassageIds.includes(p.id),
      ).length;
      totals.unrelatedSelected += selected.filter(
        (p) => !item.relevantPassageIds.includes(p.id),
      ).length;
      for (const ref of body.references) {
        totals.citations++;
        if (
          selected.some((p) => p.url === ref.url) &&
          index.documents.some(
            (d) => 'https://jorgeaviles.net' + d.path === ref.url,
          )
        )
          totals.citationsCorrect++;
      }
    }
    if (item.qualifications.length) {
      totals.qualificationCases++;
      if (answered && item.qualifications.every((q) => body.answer.includes(q)))
        totals.qualificationsPreserved++;
    }
    rows.push({
      id: item.id,
      supported: item.supported,
      candidates: ids,
      relevantRetrieved: hits,
      selected: selectedIds,
      status: body.status,
      calls,
      requiredSources: item.sourceUrls,
      returnedSources: body.references.map((r) => r.url),
    });
  }
  return {
    mode: 'deterministic oracle-selection contract test; not Workers AI accuracy',
    totals,
    rows,
  };
}

export async function evaluateFaults(worker: Worker) {
  const cases: { name: string; output: unknown }[] = [
    { name: 'abstention', output: { response: { passageIds: [] } } },
    {
      name: 'unknown-id',
      output: { response: { passageIds: ['not-a-source'] } },
    },
    {
      name: 'non-JSON',
      output: { response: 'An unsupported model explanation' },
    },
    { name: 'wrong-schema', output: { response: { passageIds: [42] } } },
    {
      name: 'too-many-IDs',
      output: {
        response: { passageIds: ['ml-status', 'ml-framework', 'ml-ranking'] },
      },
    },
    { name: 'oversize-output', output: { response: 'x'.repeat(1025) } },
  ];
  const rows = [];
  for (const c of cases) {
    let calls = 0;
    const env: Env = {
      ASSISTANT_ENABLED: 'true',
      MCP_LIMITER: { limit: async () => ({ success: true }) },
      REQUEST_LIMITER: { limit: async () => ({ success: true }) },
      INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
      AI: {
        run: async () => {
          calls++;
          return c.output;
        },
      },
    };
    const body = (await (
      await worker.fetch(
        request(
          'What machine learning methods and evaluation limitations are documented?',
        ),
        env,
      )
    ).json()) as AskResponse;
    if (body.status !== 'unsupported' || body.references.length || calls !== 1)
      throw new Error('Fault injection failed closed contract: ' + c.name);
    rows.push({ case: c.name, status: body.status, calls });
  }
  return {
    mode: 'injected output faults; not observed model error rates',
    abstentions: 1,
    unknownIds: 1,
    malformedOutputs: 3,
    overLimitOutputs: 1,
    refused: rows.length,
    total: cases.length,
    rows,
  };
}
