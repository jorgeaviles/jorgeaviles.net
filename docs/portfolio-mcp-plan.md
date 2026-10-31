# Stateless public portfolio MCP

Public MCP was activated through the protected release workflow on 2026-10-30.
The public connection guide lives at [/mcp/](https://jorgeaviles.net/mcp/).
Hosted Inspector, Codex, and official SDK checks covered all four tools. The
assistant remains independent; MCP retrieval does not invoke Workers AI.

The implementation and pre-activation validation procedure below describe the
original rollout. They are historical prerequisites, not instructions to repeat
activation. Use the [API release procedure](portfolio-api-release.md) for future
changes. Small hosted samples had no CPU-limit errors but do not establish
consistent headroom below the Workers Free CPU allowance; no availability or
cost guarantee is implied.

## Design and boundaries

`POST /mcp` shares the portfolio API Worker and deterministic curated index with
`POST /ask`. It uses `createMcpHandler` from the narrow `agents/mcp/server` entry
point and a fresh `McpServer` factory for each request. Dependencies are pinned:
Agents 0.31.0 and its supported MCP server/client 2.3.1 peers, with Zod 4.6.7.
The current [Cloudflare stateless handler](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
and [SDK v2 migration](https://developers.cloudflare.com/agents/model-context-protocol/guides/migrate-to-mcp-sdk-v2/)
documentation informed this implementation.

No stateful Agents runtime, `McpAgent`, Durable Object, database, sessions, memory,
OAuth, external fetcher, filesystem, account connector, or AI inference is exposed
by MCP. The 2025 compatibility path remains stateless Streamable HTTP, not the
old SSE endpoint. GET/DELETE and streaming subscriptions are intentionally rejected.
Native clients may omit Origin; any present Origin must be exactly
`https://jorgeaviles.net`. Host is restricted to `portfolio-api.jorgeaviles.net`.
Browser CORS is restricted to that same public website origin.

| Tool               | Input                                            | Result                                                        |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| `list_projects`    | `{}`                                             | Approved published project IDs, titles, canonical URLs        |
| `get_case_study`   | `{ "id": "analytical-data-platforms" }`          | One curated project document; unknown IDs return a tool error |
| `search_portfolio` | `{ "query": "experimental models", "limit": 2 }` | Up to 6 matching public passages, each with a source URL      |
| `get_research`     | `{}`                                             | Curated research information and source URLs                  |

Every successful result carries the deterministic `indexVersion`. Tool input
schemas reject additional properties. IDs are bounded to 80 slug characters;
queries to 500 non-control characters; limits to integers 1–6. Empty search results
mean there is no supporting passage, not permission to invent one. Public adapters
omit keyword metadata and repository paths. Original passages preserve research
assistance versus authorship, experimental versus operational ML, and implemented
evaluation code versus completed performance evidence.

Requests are capped at 8,192 bytes before either SDK protocol path; each serialized
tool payload is capped at 12,000 bytes and the complete HTTP response at 65,536
bytes. A separate `MCP_LIMITER` allows approximately 60 requests per minute per
edge-provided IP. Cloudflare rate limits are local to a data center, not a global
billing cap or DDoS guarantee. No visitor identifier, query history or conversation
is stored by application code. Worker observability stays disabled; Cloudflare
still processes network requests and operates its platform. MCP queries do not
reach Workers AI or consume its inference allowance. No automatic client retry
loop is added.

## Verification and Free-plan limits

Run with the repository's pinned Node and locked dependencies:

```sh
npm ci
npm run verify
npm run api:build
MCP_ARTIFACT_CONFIG=.local/portfolio-api-release/wrangler.json npm run test:mcp
```

The actual local workerd runtime is exercised using the official SDK HTTP client:
initialization, discovery, all tools, references, unsupported searches, invalid and
extra arguments, concurrency, finite connection behavior, malformed messages,
unsupported protocol, body limits and the actual local throttling binding. Unit
tests cover independent disablement, Host/Origin policy, limiter failure and
absence of AI calls. Existing publication tests and index synchronization retain
the draft/privacy boundary. The artifact is also booted with `no_bundle`, so
release tests run the same module that will be uploaded.

On 2026-10-29, Inspector 2.13.0 discovered the tools and invoked retrieval tools
against loopback workerd. Codex CLI, with user configuration ignored, an ephemeral
read-only session and only this MCP server configured, invoked all four tools and
compared the two public projects with correct source links and experimental-status
qualifications. These are real client checks against a **local** server, not proof
of a hosted custom-domain connection or Free-plan CPU usage. No saved client
connections were changed. Public-source-only transcripts remain in ignored local
evidence, not this repository.

The first measured bundle is approximately 229 KB gzip, below Workers Free's 3 MiB
compressed script limit. The build enforces that ceiling. Free currently allows
100,000 Worker requests/day and 10 ms CPU/request; AI and static-site traffic have
their own applicable limits. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
Do not set a paid-plan `cpu_ms` override. Local wall-clock response times are not
hosted CPU measurements. Hosted cold/warm CPU, startup, quota and request-volume
checks remain activation requirements. Do not upgrade the account to make a test
pass.

## Controlled hosted activation

Use the separate [API release procedure](portfolio-api-release.md). First deploy
with `MCP_ENABLED=false`, preserving `ASSISTANT_ENABLED=true`. The checked-in
local configuration deliberately defaults both flags to false; direct local
`wrangler deploy` is not a production release process.

Before public MCP activation, use an owner-approved isolated test Worker/custom
domain with its own explicit Host allowlist and no private content. Keep the
production endpoint disabled. Verify with Inspector and a native external AI
client against that hosted endpoint, including network/connection behavior and
Free CPU headroom. A disposable deployment requires separate owner authorization;
this PR does not create it. Remove test resources afterward. Only then approve the
protected environment's `PORTFOLIO_MCP_CLIENT_VERIFIED=true` gate and deliberately
release production with `mcp_enabled=true`.

Recheck all four tools on the production domain, static `/ask/` visitor flow, source
links, CORS, wrong Host/Origin, `/mcp` disablement, and rate-limit behavior. Confirm
no AI inference occurred for retrieval-only calls and no request bodies were
logged. Do not load test the public service. Save private operational evidence
without committing credentials or account exports.

## Client connections

MCP Inspector (Streamable HTTP; public read-only, no login):

```sh
npx @modelcontextprotocol/inspector@2.13.0 --cli \
  https://portfolio-api.jorgeaviles.net/mcp --transport http --method tools/list
npx @modelcontextprotocol/inspector@2.13.0 --cli \
  https://portfolio-api.jorgeaviles.net/mcp --transport http \
  --method tools/call --tool-name get_case_study \
  --tool-arg id=analytical-data-platforms
```

Codex CLI/IDE native HTTP configuration (public read-only; no OAuth):

```toml
[mcp_servers.jorge_portfolio]
url = "https://portfolio-api.jorgeaviles.net/mcp"
enabled_tools = ["list_projects", "get_case_study", "search_portfolio", "get_research"]
default_tools_approval_mode = "writes"
```

See the current [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
Other clients use different configuration keys; choose native Streamable HTTP,
not a shell proxy. Clients use their own models to explain or compare returned
public passages. The server itself does not generate explanations or access the
visitor's private accounts.
