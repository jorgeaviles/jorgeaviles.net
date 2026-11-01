import { describe, expect, it, vi } from 'vitest';
import recordings from '../../../evals/portfolio/selector-recordings.json';
import dataset from '../../../evals/portfolio/cases.json';
import baseline from '../../../evals/portfolio/baseline-worker';
import { type Env } from '../../../workers/portfolio-api/src/index';
import v1 from '../../../evals/portfolio/v1-worker';
import { index } from '../../../workers/portfolio-api/src/content';
import { parseSelection } from '../../../workers/portfolio-api/src/selection';

describe('recorded public-fixture selectors through the actual Worker path (no live AI)', () => {
  it.each(recordings.records)(
    '$variant / $caseId / sample $sample',
    async (record) => {
      expect(recordings.indexVersion).toBe(index.version);
      const fixture = dataset.cases.find((c) => c.id === record.caseId)!;
      const run = vi.fn<Env['AI']['run']>(async (model, input) => {
        expect(model).toBe(recordings.model);
        expect(record.inferenceCalls).toBe(1);
        const payload = JSON.parse(input.messages[1].content);
        expect(payload.question).toBe(fixture.question);
        expect(payload.passages.map((p: { id: string }) => p.id)).toEqual(
          record.candidateIds,
        );
        return { response: record.response };
      });
      const env: Env = {
        ASSISTANT_ENABLED: 'true',
        MCP_LIMITER: { limit: async () => ({ success: true }) },
        REQUEST_LIMITER: { limit: async () => ({ success: true }) },
        INFERENCE_LIMITER: { limit: async () => ({ success: true }) },
        AI: { run },
      };
      // Historical selections belong to their original request path/model.
      const current = record.variant === 'baseline' ? baseline : v1;
      const body = await (
        await current.fetch(
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
        )
      ).json();
      expect(run).toHaveBeenCalledTimes(record.inferenceCalls);
      expect(body.status).toBe(
        record.variant === 'baseline'
          ? record.hostedStatus
          : fixture.supported
            ? 'answered'
            : 'unsupported',
      );
      if (record.variant === 'final' && fixture.supported) {
        const selection = parseSelection(
          { response: record.response },
          record.candidateIds,
        );
        expect(selection.kind).toBe('selected');
        if (selection.kind !== 'selected')
          throw new Error('Recorded evidence selection failed');
        expect(selection.ids).toEqual(
          expect.arrayContaining(fixture.requiredPassageIds),
        );
        for (const text of fixture.qualifications)
          expect(body.answer).toContain(text);
        const approved = index.documents
          .flatMap((d) =>
            d.passages.map((p) => ({
              ...p,
              url: 'https://jorgeaviles.net' + d.path,
            })),
          )
          .filter((p) => selection.ids.includes(p.id));
        for (const ref of body.references)
          expect(approved.some((p) => p.url === ref.url)).toBe(true);
        const source = new Map(approved.map((p) => [p.id, p.text]));
        expect(body.answer).toBe(
          selection.ids.map((id) => source.get(id)).join('\n\n'),
        );
      }
    },
  );
});
