# Public portfolio assistant

## Scope and architecture

The Astro site remains static. A separate, initially disabled Worker serves
`POST /ask`; it is not an SSR adapter or part of the asset deployment. No database,
conversation history, external fetcher, agent loop, embeddings, or private account
connector is included. The API never receives Lab inputs.

The approved index lives in `src/content/portfolio-assistant.json`. It contains
14 curated passages from the three published professional case studies, About,
and Research. Passages retain limitations alongside claims. The static endpoint
`/portfolio-index.json` checks them against the current source text and uses
`getPublishedEntries()` for collection membership. Draft entries are excluded.
Whitespace/Markdown emphasis and links are normalized, but factual text must match.
New content is never included merely because it exists in the repository.

`npm run assistant:index` builds and explicitly updates the committed Worker index.
Review both the curated source and generated JSON. Normal `npm run build` fails
if the generated Worker index is stale. SHA-256 of the deterministic document
payload is the index version; schema version is separate. No timestamps or local
paths are embedded. Removing a passage or unpublishing a source requires regenerating
and subsequently releasing the separate API as well as the static site.

The service in `workers/portfolio-api/src/content.ts` exports bounded, read-only
`listProjects`, `getCaseStudy`, `searchPortfolio`, and `getResearch` functions.
No public GET retrieval routes are exposed in this phase. These functions return
only the approved excerpts, not full documents or arbitrary files.

## Grounding and model use

Workers AI selects at most two candidate passage IDs using
`@cf/meta/llama-3.2-3b-instruct`. The server returns the exact approved passages and
canonical page links, never model-written prose or model-provided URLs. This is
an extractive first version: answers may be less conversational, but an incorrect
model selection cannot invent a performance number, authorship, or production claim.
Selection can still be irrelevant; source review remains necessary. Invalid IDs,
malformed model output, and unsupported questions produce an explicit fallback.

Search is deterministic lexical retrieval with curated keywords, at most six
candidates. It is not semantic search and does not establish that every part of a
compound question is answered. Sensitive requests and URL-fetch requests are
refused before inference. These checks complement the fixed source boundary;
keyword filtering itself is not a security boundary.

The model catalog and Free eligibility must be rechecked before activation. The
[current model page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/)
documents the binding API. Workers AI's
[Free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/)
is shared across the account and fails when exhausted; do not upgrade the plan or
enable paid billing to keep the assistant running. There is no paid fallback.

## Request contract and limits

Send `POST /ask` with `Content-Type: application/json`, public-site Origin, and
`{"question":"What is the status of the modeling program?"}`. Only the `question`
field is accepted. The response has `status`, `answer`, `references` (title and URL),
and `indexVersion`. Substantive answers always have references.

- Maximum question: 500 characters; actual request body: 2,048 bytes.
- Maximum answer: 1,800 characters; selected passages: two; model output: 100 tokens.
- Inference deadline: 12 seconds; one model invocation; no automatic retry.
- Per-IP request allowance: five per minute; shared inference allowance: 20 per minute
  per Cloudflare location. Missing client IP or failed bindings deny inference.
- API CORS accepts only `https://jorgeaviles.net`; never wildcard, localhost, www,
  credentialed CORS, or preview origins.
- All answer/error responses use `no-store` and `noindex`. HTTP 429 and 503 include
  `Retry-After: 60`; the client must require a new deliberate submission.

Cloudflare's [rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
is approximate and local to each edge location. It is not a strict global spending
counter. Shared-IP visitors may share an allowance. Free-plan quota is the account
ceiling; an abuse burst can exhaust it and make this or other account AI unavailable.
CORS is a browser policy, not authentication: non-browser callers can spoof Origin.
Keep the kill switch and fail-closed throttles. Do not claim these eliminate abuse.

The inference deadline bounds the HTTP wait; it does not prove provider-side work
was canceled. The client must not automatically repeat timed-out requests. Provider
errors are replaced with a generic unavailable message without logging prompts,
IP addresses, outputs, or raw errors. Observability is disabled in the API config.
Cloudflare still processes request metadata; see the disclosure/setup checklist.

## Verification boundaries

`npm run verify` includes Worker handler/service tests, deterministic index checks,
draft exclusion, and existing site/browser checks. `wrangler deploy --dry-run` with
the API config validates bundling without uploading. Tests use a fake model and
limiter to exercise exact response text, citations, input sizes, CORS, bad outputs,
privacy requests, throttling, timeouts, and quota errors. They do not demonstrate
live model relevance, free-quota behavior, or Cloudflare's distributed rate counters.

Before enabling public inference, use a fixed acceptance set in the private setup
record: Portal architecture/role, data-platform stack, research assistance vs
Asthana authorship, ML implementation vs completed evaluation, experimental vs
operational use, invented accuracy figures, synthetic vs professional data,
unsupported topics, private CPCS records, and prompt injection. Check every selected
passage and URL. Record actual model responses without sensitive prompts. Do not
activate if it regularly selects unrelated passages; empty fallbacks are preferable.
