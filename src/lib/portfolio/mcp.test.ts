import { describe, it, expect, vi } from 'vitest';
import { serveMcp } from '../../../workers/portfolio-api/src/mcp';
import worker, { type Env } from '../../../workers/portfolio-api/src/index';
import { index } from '../../../workers/portfolio-api/src/content';
import {
  assertMain,
  verifyArtifact,
  digest,
  approvedBindings,
  flags,
  releaseConfig,
  uuid,
} from '../../../scripts/portfolio-api/policy.mjs';
import { readFileSync } from 'node:fs';
import { parse } from 'jsonc-parser';
const env = () =>
  ({
    MCP_ENABLED: 'true',
    ASSISTANT_ENABLED: 'false',
    MCP_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    REQUEST_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    INFERENCE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    AI: {
      run: vi.fn(async () => {
        throw new Error('AI must never run');
      }),
    },
  }) satisfies Env;
const request = (body = '{}', headers: Record<string, string> = {}) =>
  new Request('https://portfolio-api.jorgeaviles.net/mcp', {
    method: 'POST',
    body,
    headers: {
      Host: 'portfolio-api.jorgeaviles.net',
      'CF-Connecting-IP': '192.0.2.1',
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
  });

describe('public stateless MCP boundary', () => {
  it('defaults off independently of the assistant and never calls AI', async () => {
    const e = env();
    e.MCP_ENABLED = 'false';
    expect((await worker.fetch(request(), e)).status).toBe(404);
    expect(e.AI.run).not.toHaveBeenCalled();
    expect(e.MCP_LIMITER.limit).not.toHaveBeenCalled();
  });
  it('rejects wrong hosts, browser origins and absent edge IPs', async () => {
    const e = env();
    expect(
      (await serveMcp(request('{}', { Host: 'evil.example' }), e)).status,
    ).toBe(403);
    expect(
      (await serveMcp(request('{}', { Origin: 'https://evil.example' }), e))
        .status,
    ).toBe(403);
    expect(
      (await serveMcp(request('{}', { 'CF-Connecting-IP': '' }), e)).status,
    ).toBe(429);
    expect(e.AI.run).not.toHaveBeenCalled();
  });
  it('fails closed on rate-limit rejection and outage without touching AI budgets', async () => {
    const e = env();
    e.MCP_LIMITER.limit.mockResolvedValue({ success: false });
    const r = await serveMcp(request(), e);
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('60');
    e.MCP_LIMITER.limit.mockRejectedValue(new Error('private provider detail'));
    const outage = await serveMcp(request(), e);
    expect(outage.status).toBe(503);
    expect(await outage.text()).not.toContain('private provider detail');
    expect(e.INFERENCE_LIMITER.limit).not.toHaveBeenCalled();
    expect(e.AI.run).not.toHaveBeenCalled();
  });
  it('bounds bodies before either protocol path; rejects subscriptions', async () => {
    const e = env();
    expect((await serveMcp(request('x'.repeat(8193)), e)).status).toBe(413);
    expect(
      (
        await serveMcp(
          request(JSON.stringify({ method: 'subscriptions/listen' })),
          e,
        )
      ).status,
    ).toBe(405);
  });
  it('keeps the complete curated index comfortably inside one finite output', () => {
    expect(
      new TextEncoder().encode(JSON.stringify(index.documents)).byteLength,
    ).toBeLessThan(12_000);
    expect(
      index.documents.every((d) =>
        ['project', 'about', 'research'].includes(d.kind),
      ),
    ).toBe(true);
  });
});

describe('protected API release policy', () => {
  it('accepts the versions API catalog marker without accepting other binding changes', () => {
    const bindings = [
      { name: 'AI', project: '<catalog>', type: 'ai' },
      { name: 'ASSISTANT_ENABLED', text: 'true', type: 'plain_text' },
      {
        name: 'INFERENCE_LIMITER',
        namespace_id: '10002',
        simple: { limit: 20, period: 60 },
        type: 'ratelimit',
      },
      {
        name: 'REQUEST_LIMITER',
        namespace_id: '10001',
        simple: { limit: 5, period: 60 },
        type: 'ratelimit',
      },
    ];
    expect(approvedBindings(bindings)).toBe('false');
    for (const enabled of ['false', 'true'])
      expect(
        approvedBindings([
          ...bindings,
          { name: 'MCP_ENABLED', text: enabled, type: 'plain_text' },
          {
            name: 'MCP_LIMITER',
            namespace_id: '10003',
            simple: { limit: 60, period: 60 },
            type: 'ratelimit',
          },
        ]),
      ).toBe(enabled);
    for (const ai of [
      { name: 'AI', type: 'ai', project: 'other-project' },
      {
        name: 'AI',
        type: 'ai',
        project: '<catalog>',
        unexpected: 'do-not-log-this-value',
      },
      { name: 'AI', type: 'service', project: '<catalog>' },
    ]) {
      expect(() => approvedBindings([ai, ...bindings.slice(1)])).toThrow(
        'Bindings changed',
      );
      try {
        approvedBindings([ai, ...bindings.slice(1)]);
      } catch (error) {
        expect(String(error)).not.toContain('do-not-log-this-value');
      }
    }
    expect(() =>
      approvedBindings(
        bindings.map((b) =>
          b.name === 'REQUEST_LIMITER'
            ? { ...b, simple: { limit: 500, period: 60 } }
            : b,
        ),
      ),
    ).toThrow();
    expect(() =>
      approvedBindings([
        ...bindings,
        { name: 'PRIVATE_STORE', type: 'kv_namespace' },
      ]),
    ).toThrow();
  });

  it('rejects stale or altered release artifacts before upload', async () => {
    const files: Record<string, string> = {
      'index.js': 'reviewed module',
      'wrangler.json': '{}',
    };
    const commit = 'a'.repeat(40);
    const manifest = {
      commit,
      indexVersion: 'b'.repeat(64),
      files: Object.fromEntries(
        Object.entries(files).map(([name, content]) => [name, digest(content)]),
      ),
    };
    const read = async (name: string) => files[name];
    await expect(
      verifyArtifact(manifest, commit, read),
    ).resolves.toBeUndefined();
    await expect(
      verifyArtifact(manifest, 'c'.repeat(40), read),
    ).rejects.toThrow('commit mismatch');
    files['index.js'] = 'changed after tests';
    await expect(verifyArtifact(manifest, commit, read)).rejects.toThrow(
      'digest mismatch',
    );
    await expect(
      verifyArtifact(
        { ...manifest, files: { '../secret': 'abc' } },
        commit,
        read,
      ),
    ).rejects.toThrow();
  });

  it('requires dispatch of current main in the intended repository', () => {
    const sha = 'a'.repeat(40);
    const e = {
      GITHUB_SHA: sha,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REPOSITORY: 'jorgeaviles/jorgeaviles.net',
    };
    expect(() => assertMain(e, sha)).not.toThrow();
    for (const change of [
      { GITHUB_EVENT_NAME: 'push' },
      { GITHUB_REF: 'refs/heads/codex/test' },
      { GITHUB_REPOSITORY: 'other/repo' },
    ])
      expect(() => assertMain({ ...e, ...change }, sha)).toThrow();
    expect(() => assertMain(e, 'b'.repeat(40))).toThrow();
  });
  it('preserves enabled assistant and refuses unreviewed configuration expansion', () => {
    expect(
      flags([{ name: 'ASSISTANT_ENABLED', type: 'plain_text', text: 'true' }]),
    ).toBe('false');
    expect(() =>
      flags([{ name: 'ASSISTANT_ENABLED', type: 'plain_text', text: 'false' }]),
    ).toThrow();
    const config = parse(
      readFileSync('workers/portfolio-api/wrangler.jsonc', 'utf8'),
    );
    expect(releaseConfig(config).vars).toEqual({
      ASSISTANT_ENABLED: 'true',
      MCP_ENABLED: 'false',
    });
    expect(() => releaseConfig({ ...config, routes: ['*/*'] })).toThrow();
    expect(() => releaseConfig({ ...config, workers_dev: true })).toThrow();
    expect(() => uuid('--latest')).toThrow();
    const old = [
      { name: 'AI', type: 'ai' },
      { name: 'ASSISTANT_ENABLED', type: 'plain_text', text: 'true' },
      ...config.ratelimits
        .filter((b: { name: string }) => b.name !== 'MCP_LIMITER')
        .map(
          (b: {
            name: string;
            namespace_id: string;
            simple: { limit: number; period: number };
          }) => ({ ...b, type: 'ratelimit' }),
        ),
    ];
    expect(approvedBindings(old)).toBe('false');
    expect(() =>
      approvedBindings([
        ...old,
        { name: 'PRIVATE_STORE', type: 'kv_namespace' },
      ]),
    ).toThrow();
  });
});
