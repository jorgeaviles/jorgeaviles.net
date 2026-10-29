# Future stateless portfolio MCP endpoint

This is a plan, not an implemented or deployed MCP server. Keep inference in
`POST /ask`; MCP tools should reuse the pure public-content service without AI
calls, private connections, or broad URL/file access.

## Implementation plan

Follow Cloudflare's current
[stateless MCP guidance](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
and [MCP SDK migration documentation](https://developers.cloudflare.com/agents/model-context-protocol/guides/migrate-to-mcp-sdk-v2/).
At implementation time verify and pin the then-supported Agents SDK, official
MCP SDK, and compatible schema package. Use `createMcpHandler` and a fresh
`McpServer` factory per request over Streamable HTTP at `/mcp`. Do not introduce
deprecated `McpAgent`, SSE legacy transport, Durable Objects, sessions, OAuth,
persistent memory, or agent orchestration.

Expose four read-only tools, with schema validation, output limits, and indexVersion:

| Tool               | Input                         | Shared service                  | Bound                                              |
| ------------------ | ----------------------------- | ------------------------------- | -------------------------------------------------- |
| `list_projects`    | empty object                  | `listProjects()`                | approved projects only                             |
| `get_case_study`   | exact allowlisted ID          | `getCaseStudy(id)`              | one curated document; unknown ID returns not found |
| `search_portfolio` | query, optional integer limit | `searchPortfolio(query, limit)` | query ≤500 chars; limit 1–6                        |
| `get_research`     | empty object                  | `getResearch()`                 | approved research entries only                     |

Every tool must return canonical source URLs. Public output should avoid internal
file names and unnecessary keyword metadata. Treat queries as data, never as a
fetch path or command. Retain explicit bounds and throttling for MCP too, with
transport-sized body/output caps. Do not reuse the browser-only Origin gate
unchanged for native MCP clients; define a separate public read-only policy that
supports the required protocol negotiation, Origin validation, and Streamable HTTP
headers. No inference allowance is consumed by retrieval tools.

Test protocol initialization, tool listing/calls, unsupported protocol versions,
malformed schema, arbitrary IDs, oversized bodies, draft removal, concurrency and
statelessness. Test with the official Inspector and at least one native client.
Add a separately reviewed release configuration; no `/mcp` endpoint exists today.

## Future client connection examples

These are illustrative future URLs, not working connections. Replace the hostname
with the actually reviewed deployed API domain after implementation.

With MCP Inspector, choose Streamable HTTP and enter:

```text
https://portfolio-api.jorgeaviles.net/mcp
```

For a client supporting a native HTTP server configuration:

```json
{
  "mcpServers": {
    "jorge-portfolio": {
      "type": "http",
      "url": "https://portfolio-api.jorgeaviles.net/mcp"
    }
  }
}
```

Exact configuration keys vary by client; check that client's current official
documentation. In Claude Code, Cloudflare documents this native HTTP command:

```sh
claude mcp add --transport http jorge-portfolio https://portfolio-api.jorgeaviles.net/mcp
```

Do not use a shell proxy, request private account access, or advertise these
connections as available until the endpoint and client checks are complete.
