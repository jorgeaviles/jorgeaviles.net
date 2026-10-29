import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredEndpoint, PUBLIC_API, requestAnswer } from './client';
const answer = {
  status: 'answered',
  answer: 'Approved source text.',
  references: [{ title: 'About', url: 'https://jorgeaviles.net/about/' }],
  indexVersion: 'a'.repeat(64),
};
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());
describe('public assistant client boundary', () => {
  it('is disabled by default and allows only the dedicated HTTPS endpoint', () => {
    expect(configuredEndpoint(undefined)).toBeNull();
    expect(configuredEndpoint(PUBLIC_API)).toBe(PUBLIC_API);
    for (const url of [
      'http://localhost/ask',
      'https://evil.example/ask',
      '/ask',
      `${PUBLIC_API}?token=x`,
    ])
      expect(() => configuredEndpoint(url)).toThrow();
  });
  it('sends one stateless request without credentials, history or automatic retries', async () => {
    const fetcher = vi.fn(async () => Response.json(answer));
    vi.stubGlobal('fetch', fetcher);
    expect(
      await requestAnswer(PUBLIC_API, '  Describe the background  ', signal()),
    ).toEqual(answer);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toMatchObject([
      PUBLIC_API,
      {
        credentials: 'omit',
        redirect: 'error',
        body: '{"question":"Describe the background"}',
      },
    ]);
  });
  it.each([400, 429, 503, 403])('does not retry HTTP %s', async (status) => {
    const fetcher = vi.fn(async () => new Response('', { status }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      requestAnswer(PUBLIC_API, 'A question', signal()),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...answer, references: [] },
    {
      ...answer,
      references: [
        { title: 'Private', url: 'https://jorgeaviles.net/private/' },
      ],
    },
    {
      ...answer,
      references: [{ title: 'Unsafe', url: 'javascript:alert(1)' }],
    },
    {
      ...answer,
      references: [{ title: 'External', url: 'https://evil.example/about/' }],
    },
    { ...answer, answer: 'x'.repeat(1801) },
    { ...answer, indexVersion: 'bad' },
    { ...answer, status: 'unexpected' },
  ])('rejects an unsafe or malformed response', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    );
    await expect(
      requestAnswer(PUBLIC_API, 'A question', signal()),
    ).rejects.toThrow();
  });
  it('bounds actual streamed bytes regardless of declared length', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(' '.repeat(8193), {
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': '1',
            },
          }),
      ),
    );
    await expect(
      requestAnswer(PUBLIC_API, 'A question', signal()),
    ).rejects.toThrow();
  });
  it.each(['', 'x'.repeat(501), '\u0000'])(
    'rejects invalid input before fetching',
    async (question) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      await expect(
        requestAnswer(PUBLIC_API, question, signal()),
      ).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
