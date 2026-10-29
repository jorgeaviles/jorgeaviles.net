/* global Headers */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import path from 'node:path';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

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
    process.env.MCP_ARTIFACT_CONFIG ?? 'workers/portfolio-api/wrangler.jsonc',
    '--local',
    '--local-upstream',
    'portfolio-api.jorgeaviles.net',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--var',
    'MCP_ENABLED:true',
    '--persist-to',
    path.resolve('.local/mcp-runtime-test'),
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
const url = new URL(`http://127.0.0.1:${port}/mcp`);
const headers = {
  Host: 'portfolio-api.jorgeaviles.net',
  'CF-Connecting-IP': '192.0.2.99',
};
const localFetch = (input, init = {}) =>
  fetch(input, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers)), ...headers },
  });
const clients = [];
async function client() {
  const c = new Client({ name: 'portfolio-verification', version: '1.0.0' });
  clients.push(c);
  await c.connect(
    new StreamableHTTPClientTransport(url, {
      fetch: localFetch,
      reconnectionOptions: { maxRetries: 0 },
    }),
  );
  return c;
}
try {
  let ready = false;
  for (let n = 0; n < 200; n++) {
    if (exited) throw new Error(output);
    try {
      ready =
        (await fetch(url, { headers, signal: AbortSignal.timeout(300) }))
          .status === 405;
    } catch {
      /* startup */
    }
    if (ready) break;
    await pause(100);
  }
  assert.ok(ready, output);
  const c = await client();
  const tools = await c.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), [
    'get_case_study',
    'get_research',
    'list_projects',
    'search_portfolio',
  ]);
  assert.ok(
    tools.tools.every(
      (t) => t.annotations.readOnlyHint && !t.annotations.openWorldHint,
    ),
  );
  const projects = (await c.callTool({ name: 'list_projects', arguments: {} }))
    .structuredContent;
  assert.equal(projects.projects.length, 3);
  assert.match(projects.indexVersion, /^[a-f0-9]{64}$/);
  for (const item of projects.projects) {
    const r = await c.callTool({
      name: 'get_case_study',
      arguments: { id: item.id },
    });
    assert.equal(r.structuredContent.caseStudy.url, item.url);
    assert.ok(!JSON.stringify(r).includes('keywords'));
  }
  const research = await c.callTool({ name: 'get_research', arguments: {} });
  assert.match(JSON.stringify(research), /assistan/i);
  const ml = await c.callTool({
    name: 'search_portfolio',
    arguments: { query: 'machine learning experimental', limit: 2 },
  });
  assert.ok(ml.structuredContent.passages.length <= 2);
  assert.match(JSON.stringify(ml), /experimental/);
  const unsupported = await c.callTool({
    name: 'search_portfolio',
    arguments: { query: 'quantum penguin xyz' },
  });
  assert.deepEqual(unsupported.structuredContent.passages, []);
  for (const args of [
    { id: '../../.env' },
    { id: 'https://example.org' },
    { id: 'unknown' },
    { id: projects.projects[0].id, file: '.env' },
  ]) {
    assert.equal(
      (await c.callTool({ name: 'get_case_study', arguments: args })).isError,
      true,
    );
  }
  for (const args of [
    { query: '' },
    { query: 'x'.repeat(501) },
    { query: 'test', limit: 7 },
    { query: 'test', limit: 1.5 },
  ]) {
    assert.equal(
      (await c.callTool({ name: 'search_portfolio', arguments: args })).isError,
      true,
    );
  }
  const second = await client();
  const concurrent = await Promise.all(
    [c, second].map((cli) =>
      cli.callTool({ name: 'list_projects', arguments: {} }),
    ),
  );
  assert.deepEqual(
    concurrent[0].structuredContent,
    concurrent[1].structuredContent,
  );
  for (const method of ['GET', 'DELETE', 'PUT'])
    assert.equal((await fetch(url, { method, headers })).status, 405);
  for (const Origin of [
    'https://evil.example',
    'null',
    'http://jorgeaviles.net',
    'https://jorgeaviles.net:444',
  ])
    assert.equal(
      (await fetch(url, { method: 'POST', headers: { ...headers, Origin } }))
        .status,
      403,
    );
  const preflight = await fetch(url, {
    method: 'OPTIONS',
    headers: { ...headers, Origin: 'https://jorgeaviles.net' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get('Access-Control-Allow-Origin'),
    'https://jorgeaviles.net',
  );
  const huge = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search_portfolio',
        arguments: { query: 'x'.repeat(9000) },
      },
    }),
  });
  assert.equal(huge.status, 413);
  const rpcHeaders = {
    ...headers,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const malformed = await fetch(url, {
    method: 'POST',
    headers: rpcHeaders,
    body: '{broken',
  });
  assert.equal(malformed.status, 400);
  const protocol = await fetch(url, {
    method: 'POST',
    headers: { ...rpcHeaders, 'MCP-Protocol-Version': '1900-01-01' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  assert.ok(protocol.status >= 400);
  let throttled = false;
  for (let n = 0; n < 65; n++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: n, method: 'tools/list' }),
    });
    if (r.status === 429) {
      assert.equal(r.headers.get('Retry-After'), '60');
      throttled = true;
      break;
    }
    assert.ok((await r.text()).length < 65_536);
  }
  assert.ok(
    throttled,
    'Actual local rate-limit binding must reject repeated calls',
  );
  console.log(
    'MCP workerd + official client passed: discovery, all tools, citations, invalid inputs, concurrency, CORS/Host, body bounds and session-free methods; no AI inference requested.',
  );
} finally {
  await Promise.allSettled(clients.map((c) => c.close()));
  if (!exited) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* stopped */
    }
  }
}
