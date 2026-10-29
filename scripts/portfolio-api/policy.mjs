import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
export const workerName = 'jorge-aviles-portfolio-api';
export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export function uuid(value) {
  assert.match(value ?? '', /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  return value;
}
export function flags(bindings) {
  assert.ok(Array.isArray(bindings), 'Version bindings must be an array');
  const value = (name) =>
    bindings.find((b) => b.name === name && b.type === 'plain_text')?.text;
  assert.ok(
    value('ASSISTANT_ENABLED') === 'true',
    'Release must preserve the enabled assistant',
  );
  const mcp = value('MCP_ENABLED');
  assert.ok(
    mcp === undefined || mcp === 'true' || mcp === 'false',
    'Unexpected MCP flag',
  );
  return mcp ?? 'false'; // The pre-MCP version has no MCP flag.
}
export function releaseConfig(config) {
  assert.equal(config.name, workerName);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.observability.enabled, false);
  assert.equal(config.ai.binding, 'AI');
  assert.deepEqual(
    Object.keys(config).sort(),
    [
      '$schema',
      'ai',
      'compatibility_date',
      'main',
      'name',
      'observability',
      'preview_urls',
      'ratelimits',
      'vars',
      'workers_dev',
    ].sort(),
  );
  assert.deepEqual(config.vars, {
    ASSISTANT_ENABLED: 'false',
    MCP_ENABLED: 'false',
  });
  assert.deepEqual(
    config.ratelimits
      .map((b) => [b.name, b.namespace_id, b.simple.limit, b.simple.period])
      .sort(),
    [
      ['INFERENCE_LIMITER', '10002', 20, 60],
      ['MCP_LIMITER', '10003', 60, 60],
      ['REQUEST_LIMITER', '10001', 5, 60],
    ],
  );
  const { $schema: schema, ...production } = config;
  void schema;
  return {
    ...production,
    main: './index.js',
    no_bundle: true,
    vars: { ASSISTANT_ENABLED: 'true', MCP_ENABLED: 'false' },
  };
}
export function assertMain(env, currentMain) {
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.equal(env.GITHUB_REPOSITORY, 'jorgeaviles/jorgeaviles.net');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.equal(
    env.GITHUB_SHA,
    currentMain,
    'Main advanced; dispatch a fresh run',
  );
}

export function approvedBindings(bindings) {
  const mcp = flags(bindings);
  const expected = [
    { name: 'AI', type: 'ai' },
    { name: 'ASSISTANT_ENABLED', type: 'plain_text', text: 'true' },
    {
      name: 'INFERENCE_LIMITER',
      type: 'ratelimit',
      namespace_id: '10002',
      simple: { limit: 20, period: 60 },
    },
    {
      name: 'REQUEST_LIMITER',
      type: 'ratelimit',
      namespace_id: '10001',
      simple: { limit: 5, period: 60 },
    },
  ];
  if (bindings.some((b) => b.name === 'MCP_ENABLED'))
    expected.push(
      { name: 'MCP_ENABLED', type: 'plain_text', text: mcp },
      {
        name: 'MCP_LIMITER',
        type: 'ratelimit',
        namespace_id: '10003',
        simple: { limit: 60, period: 60 },
      },
    );
  // The versions API adds this catalog marker to the ordinary AI binding.
  // Accept only that exact metadata; retain every other field for strict comparison.
  const normalized = bindings.map((binding) => {
    if (
      binding.name === 'AI' &&
      binding.type === 'ai' &&
      binding.project === '<catalog>'
    ) {
      const { project, ...configuration } = binding;
      void project;
      return configuration;
    }
    return binding;
  });
  const byName = (a, b) => a.name.localeCompare(b.name, 'en');
  // Do not print binding values in public CI logs when rejecting unexpected state.
  assert.ok(
    isDeepStrictEqual(normalized.sort(byName), expected.sort(byName)),
    'Bindings changed; review approved API configuration',
  );
  return mcp;
}

export async function verifyArtifact(manifest, commit, read) {
  assert.equal(manifest.commit, commit, 'Artifact commit mismatch');
  assert.match(manifest.indexVersion, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(manifest.files).sort(), [
    'index.js',
    'wrangler.json',
  ]);
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.equal(digest(await read(file)), hash, 'Artifact digest mismatch');
  }
}
