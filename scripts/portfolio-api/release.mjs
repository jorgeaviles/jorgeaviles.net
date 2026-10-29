import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  assertMain,
  verifyArtifact,
  approvedBindings,
  uuid,
  workerName,
} from './policy.mjs';

// Only this fixed account/Worker API is addressed. Never echo tokens/provider bodies.
const env = process.env;
assert.equal(env.API_RELEASE_ENABLED, 'true');
assert.ok(env.CLOUDFLARE_API_TOKEN);
assert.match(env.CLOUDFLARE_ACCOUNT_ID ?? '', /^[a-f0-9]{32}$/);
assert.ok(['deploy', 'rollback'].includes(env.RELEASE_ACTION));
assert.ok(['true', 'false'].includes(env.MCP_ENABLED));
assert.ok(['true', 'false'].includes(env.EXPECTED_CURRENT_MCP));
if (env.MCP_ENABLED === 'true')
  assert.equal(
    env.MCP_CLIENT_VERIFIED,
    'true',
    'Hosted client/Free CPU checks must be approved first',
  );
async function currentMain() {
  const r = await fetch(
    'https://api.github.com/repos/jorgeaviles/jorgeaviles.net/git/ref/heads/main',
    {
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  assert.ok(r.ok, 'Cannot verify main');
  assertMain(env, (await r.json()).object.sha);
}
async function api(suffix, method = 'GET', body) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}${suffix}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    },
  );
  assert.ok(
    r.ok,
    `Cloudflare ${method} failed (${r.status}); no retry was made`,
  );
  const data = await r.json();
  assert.equal(data.success, true, 'Cloudflare rejected the operation');
  return data.result;
}
async function activeVersion() {
  const data = await api('/deployments');
  const versions = data.deployments[0]?.versions;
  assert.equal(
    versions?.length,
    1,
    'Expected one active version, not a split rollout',
  );
  assert.equal(versions[0].percentage, 100);
  return uuid(versions[0].version_id);
}
await currentMain();
const previous = await activeVersion();
const before = await api(`/versions/${previous}`);
assert.equal(
  approvedBindings(before.resources.bindings),
  env.EXPECTED_CURRENT_MCP,
  'Live configuration changed; review before releasing',
);
let target;
if (env.RELEASE_ACTION === 'rollback') {
  target = uuid(env.ROLLBACK_VERSION);
  // Only previously deployed versions are rollback candidates, never an arbitrary upload.
  const deployments = await api('/deployments');
  assert.ok(
    deployments.deployments.some((d) =>
      d.versions.some((v) => v.version_id === target),
    ),
    'Rollback version is not in recent deployment history',
  );
} else {
  const dir = path.resolve('.local/portfolio-api-release');
  const manifest = JSON.parse(
    await readFile(path.join(dir, 'manifest.json'), 'utf8'),
  );
  await verifyArtifact(manifest, env.GITHUB_SHA, (file) =>
    readFile(path.join(dir, file)),
  );
  const config = JSON.parse(
    await readFile(path.join(dir, 'wrangler.json'), 'utf8'),
  );
  assert.equal(config.name, workerName);
  assert.deepEqual(config.vars, {
    ASSISTANT_ENABLED: 'true',
    MCP_ENABLED: 'false',
  });
  config.vars.MCP_ENABLED = env.MCP_ENABLED;
  await writeFile(path.join(dir, 'release.json'), JSON.stringify(config));
  const uploaded = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'versions',
      'upload',
      '--config',
      path.join(dir, 'release.json'),
      '--message',
      `Commit ${env.GITHUB_SHA}; MCP ${env.MCP_ENABLED}`,
    ],
    { encoding: 'utf8', env: { ...env, WRANGLER_SEND_METRICS: 'false' } },
  );
  assert.equal(
    uploaded.status,
    0,
    'Version upload failed; inspect Cloudflare privately before retrying',
  );
  target = uuid(
    uploaded.stdout.match(/Worker Version ID:\s*([a-f0-9-]+)/)?.[1],
  );
}
const candidate = await api(`/versions/${target}`);
assert.equal(
  approvedBindings(candidate.resources.bindings),
  env.MCP_ENABLED,
  'Candidate flags do not match approved release',
);
// Recheck after upload/approval delay; never race another release silently.
await currentMain();
assert.equal(
  await activeVersion(),
  previous,
  'Active version changed; aborting promotion',
);
await api('/deployments', 'POST', {
  strategy: 'percentage',
  versions: [{ version_id: target, percentage: 100 }],
  annotations: {
    'workers/message': `${env.RELEASE_ACTION} ${env.GITHUB_SHA}; previous ${previous}`,
  },
});
assert.equal(
  await activeVersion(),
  target,
  'Promotion not confirmed; inspect dashboard, do not blindly retry',
);
if (env.GITHUB_STEP_SUMMARY)
  await appendFile(
    env.GITHUB_STEP_SUMMARY,
    `API ${env.RELEASE_ACTION}: **${target}**\n\nPrevious version (rollback): **${previous}**\n\nSource: ${env.GITHUB_SHA}. Assistant=true; MCP=${env.MCP_ENABLED}.\n`,
  );
console.log(`API version ${target} active. Previous version: ${previous}.`);
