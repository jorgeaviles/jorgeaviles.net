import assert from 'node:assert/strict';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
const base = 'https://portfolio-api.jorgeaviles.net';
const preflight = await fetch(`${base}/ask`, {
  method: 'OPTIONS',
  headers: { Origin: 'https://jorgeaviles.net' },
  signal: AbortSignal.timeout(15_000),
});
assert.equal(preflight.status, 204);
assert.equal(
  (await fetch(`${base}/ask`, { signal: AbortSignal.timeout(15_000) })).status,
  403,
);
if (process.env.MCP_ENABLED === 'true') {
  const client = new Client({
    name: 'portfolio-release-smoke',
    version: '1.0.0',
  });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        reconnectionOptions: { maxRetries: 0 },
      }),
    );
    assert.equal((await client.listTools()).tools.length, 4);
    assert.equal(
      (await client.callTool({ name: 'list_projects', arguments: {} }))
        .structuredContent.projects.length,
      3,
    );
  } finally {
    await client.close();
  }
} else {
  assert.equal(
    (await fetch(`${base}/mcp`, { signal: AbortSignal.timeout(15_000) }))
      .status,
    404,
  );
}
console.log('Live API route isolation passed; no AI inference requested.');
