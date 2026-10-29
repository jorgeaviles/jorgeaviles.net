import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import path from 'node:path';

// Boot the actual pinned workerd runtime, without authentication or AI requests.
// A bundle-only dry run cannot catch invalid entry-point exports or dates.
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(
  process.execPath,
  [
    path.resolve('node_modules/wrangler/bin/wrangler.js'),
    'dev',
    '--config',
    'workers/portfolio-api/wrangler.jsonc',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--persist-to',
    path.resolve('.local/portfolio-runtime-test'),
  ],
  {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);
let output = '',
  exited = false;
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (chunk) => {
    output = (output + chunk.toString()).slice(-6000);
  });
child.on('exit', () => {
  exited = true;
});
const base = `http://127.0.0.1:${port}`;
const headers = {
  Origin: 'https://jorgeaviles.net',
  'Content-Type': 'application/json',
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (exited)
      throw new Error(`Worker runtime exited before startup.\n${output}`);
    try {
      ready =
        (
          await fetch(`${base}/ask`, {
            method: 'OPTIONS',
            headers,
            signal: AbortSignal.timeout(300),
          })
        ).status === 204;
    } catch {
      /* startup only; no AI invocation */
    }
    if (ready) break;
    await pause(100);
  }
  assert.ok(ready, `Worker did not start.\n${output}`);
  const disabled = await fetch(`${base}/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question: 'Describe the public portfolio.' }),
  });
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).status, 'unavailable');
  assert.equal((await fetch(`${base}/ask`)).status, 403);
  assert.equal((await fetch(`${base}/ask`, { headers })).status, 405);
  assert.equal((await fetch(`${base}/mcp`, { headers })).status, 404);
  console.log(
    'Worker runtime passed: actual workerd startup, disabled inference, CORS, method and route isolation.',
  );
} finally {
  if (!exited) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already stopped */
    }
  }
}
