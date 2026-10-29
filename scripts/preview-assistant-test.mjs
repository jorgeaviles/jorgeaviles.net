import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
// An isolated local build exercises the activated UI with mocked HTTP responses.
// It never changes dist/, deploys, or contacts the configured API itself.
const pkg = JSON.parse(
  await readFile('node_modules/astro/package.json', 'utf8'),
);
const executable = path.resolve(
  'node_modules/astro',
  typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.astro,
);
const out = path.resolve('.local/assistant-test-dist');
const env = {
  ...process.env,
  PUBLIC_PORTFOLIO_API_URL: 'https://portfolio-api.jorgeaviles.net/ask',
  ASTRO_TELEMETRY_DISABLED: '1',
};
const build = spawnSync(
  process.execPath,
  [executable, 'build', '--outDir', out],
  { env, stdio: 'inherit' },
);
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn(
  process.execPath,
  [
    executable,
    'preview',
    '--outDir',
    out,
    '--port',
    '4322',
    '--host',
    '127.0.0.1',
    '--ignore-lock',
  ],
  { env, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
