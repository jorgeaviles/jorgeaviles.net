# Public MCP page

The static `/mcp/` page documents the existing public service; it adds no client
island, inference, endpoint calls, or Worker deployment. Writing lives in
`src/content/mcp.mdx`. The footer and Ask sidebar provide discovery without
changing primary navigation or professional case studies. The Colophon describes
MCP separately from the Workers AI assistant.

## Accuracy review (2026-10-30)

- Checked tool names, strict input constraints, output projections and errors
  against `workers/portfolio-api/src/mcp-server.ts` and `content.ts`.
- Checked the default six-result limit against `src/lib/portfolio/types.ts`.
- Reviewed the deterministic index, experimental/evaluation qualifications,
  research assistance attribution, and synthetic Lab boundary.
- Reviewed `docs/portfolio-mcp-plan.md` and `portfolio-mcp-cpu.md`. The latter is
  a historical profiling procedure, not a current activation instruction or a
  service-level guarantee. No public Free-plan performance guarantee is added.
- Confirmed the production activation record includes official SDK, Inspector
  2.13.0, and native Codex calls to all four tools. Private operational records,
  account exports, screenshots, version identifiers and credentials are excluded
  from this documentation change.
- Checked the installed Codex CLI `mcp add --help` URL syntax and the official
  [OpenAI connection example](https://developers.openai.com/learn/docs-mcp).
- Checked [Inspector CLI documentation](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md)
  and the previously tested pinned discovery/case-study commands.
- Checked [Cloudflare stateless handler documentation](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
  against the fresh server factory and Streamable HTTP implementation.

The page documents verified clients only. ChatGPT and Claude connection flows
have not been tested for this endpoint. Other clients must support native
Streamable HTTP and satisfy the server’s Origin policy. Client authentication,
model access and data practices remain the client provider’s responsibility.

## Verification

`npm run verify` includes types, lint, formatting, unit/Worker/runtime/SDK tests,
publication boundaries, build-time internal links and privacy scan, and Chromium
and WebKit browser checks. `/mcp/` participates in the common route, metadata,
sitemap, responsive and axe accessibility checks. Focused browser tests verify
endpoint and tool presentation, copyable commands, internal fragments, footer and
Ask discovery, keyboard skip navigation, and absence of page-load API calls.
Screenshots are retained as local/CI browser artifacts, not public source files.

No protected workflow, production API configuration, DNS, credentials, analytics
instrumentation or dependency is changed. Owner review and merge remain required.
