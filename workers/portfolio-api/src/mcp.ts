import { createMcpHandler } from 'agents/mcp/server';
import { createPortfolioServer } from './mcp-server';
import type { Env } from './index';

const origin = 'https://jorgeaviles.net';
const hostname = 'portfolio-api.jorgeaviles.net';
const handler = createMcpHandler(createPortfolioServer, {
  route: '/mcp',
  legacy: 'stateless',
  responseMode: 'json',
  maxRequestBodySize: 8192,
  allowedHostnames: [hostname],
  allowedOriginHostnames: ['jorgeaviles.net'],
  corsOptions: false,
});
function response(body: string, status: number) {
  return new Response(body, { status });
}
async function boundedBody(request: Request | Response, maximum = 8192) {
  if (Number(request.headers.get('Content-Length')) > maximum) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function serveMcp(request: Request, env: Env) {
  const browserOrigin = request.headers.get('Origin');
  let reply: Response;
  try {
    // Exact origin (including scheme/port); native clients omit Origin.
    if (browserOrigin !== null && browserOrigin !== origin)
      reply = response('Forbidden', 403);
    else if (request.headers.get('Host')?.split(':')[0] !== hostname)
      reply = response('Forbidden', 403);
    else if (request.method === 'OPTIONS')
      reply = new Response(null, { status: 204 });
    else if (request.method !== 'POST')
      reply = response(
        'Use Streamable HTTP POST; no sessions or subscriptions.',
        405,
      );
    else {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip || !(await env.MCP_LIMITER.limit({ key: ip })).success)
        reply = response('Too many requests', 429);
      else {
        const bytes = await boundedBody(request);
        if (bytes === null) reply = response('Request exceeds 8192 bytes', 413);
        else {
          // No streaming subscriptions or task/session operations: only these
          // finite retrieval exchanges. SDK validates envelopes and schemas.
          let method: unknown;
          try {
            method = JSON.parse(new TextDecoder().decode(bytes)).method;
          } catch {
            /* SDK reports malformed JSON */
          }
          if (
            typeof method === 'string' &&
            ![
              'initialize',
              'notifications/initialized',
              'ping',
              'tools/list',
              'tools/call',
            ].includes(method)
          ) {
            reply = response(
              'Method not supported by this read-only service',
              405,
            );
          } else {
            reply = await handler.fetch(new Request(request, { body: bytes }));
          }
        }
      }
    }
  } catch {
    reply = response('Public retrieval temporarily unavailable', 503);
  }
  const output = await boundedBody(reply, 65_536);
  if (output === null) reply = response('Public response exceeds limit', 500);
  const headers = new Headers(reply.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex');
  headers.set('Vary', 'Origin');
  if ([429, 503].includes(reply.status)) headers.set('Retry-After', '60');
  if (reply.status === 405) headers.set('Allow', 'POST, OPTIONS');
  if (browserOrigin === origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, MCP-Protocol-Version, MCP-Session-Id',
    );
    headers.set('Access-Control-Expose-Headers', 'MCP-Protocol-Version');
    headers.set('Access-Control-Max-Age', '600');
  }
  return new Response(
    reply.status === 204 || reply.status === 202
      ? null
      : (output ?? 'Public response exceeds limit'),
    { status: reply.status, headers },
  );
}
