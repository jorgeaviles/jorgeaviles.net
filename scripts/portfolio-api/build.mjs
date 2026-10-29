import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parse } from 'jsonc-parser';
import { digest, releaseConfig } from './policy.mjs';

const output = path.resolve('.local/portfolio-api-release');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const config = releaseConfig(
  parse(await readFile('workers/portfolio-api/wrangler.jsonc', 'utf8')),
);
const built = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'deploy',
    '--config',
    'workers/portfolio-api/wrangler.jsonc',
    '--dry-run',
    '--outdir',
    output,
  ],
  { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
);
assert.equal(built.status, 0, 'Bundle failed');
// Keep one reviewed module and its configuration, not source maps or local files.
const bundle = await readFile(path.join(output, 'index.js'));
await rm(path.join(output, 'index.js.map'), { force: true });
await rm(path.join(output, 'README.md'), { force: true });
const compressedBytes = gzipSync(bundle).byteLength;
assert.ok(
  compressedBytes < 3 * 1024 * 1024,
  'Worker exceeds the Free-plan compressed bundle limit',
);
const configText = JSON.stringify(config, null, 2) + '\n';
await writeFile(path.join(output, 'wrangler.json'), configText);
const index = JSON.parse(
  await readFile('workers/portfolio-api/index.json', 'utf8'),
);
const commit =
  process.env.GITHUB_SHA ??
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
assert.match(commit, /^[a-f0-9]{40}$/);
await writeFile(
  path.join(output, 'manifest.json'),
  JSON.stringify(
    {
      commit,
      indexVersion: index.version,
      compressedBytes,
      files: {
        'index.js': digest(bundle),
        'wrangler.json': digest(configText),
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `API artifact: ${compressedBytes} compressed bytes; MCP disabled; assistant release flag preserved.`,
);
