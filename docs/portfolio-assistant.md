# Public portfolio assistant

## Scope and architecture

The Astro site remains static. A separate Worker serves
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

## Visitor interface and activation gate

`/ask/` is an isolated React island with an unobtrusive footer link. This activation
release sets the reviewed `https://portfolio-api.jorgeaviles.net/ask` endpoint as
the public default. An explicitly empty `PUBLIC_PORTFOLIO_API_URL` disables the
form for a rollback build; any other configured URL must exactly match the
reviewed endpoint. This public URL is not a secret. The API's independent
`ASSISTANT_ENABLED` kill switch remains false in the checked-in deployment config:
a public activation is a deliberate account-side change after testing, not a
side effect of deploying code. Publishing this static release still goes through
the existing protected Actions workflow.

The interface makes no request on load or when choosing a suggestion. Submit sends
only the current question. In-flight submissions are locked; failure/rate-limit
responses impose a one-minute manual cooldown that Clear cannot reset. Successful
responses impose a short cooldown. The HTTP wait ends after 20 seconds, without a
retry. Reloading a tab can reset this local cooldown; server-side throttling remains
necessary. The client caps actual response bytes, validates cited source URLs, and
renders plain text without HTML or Markdown injection.

`npm run test:assistant` builds into ignored `.local/assistant-test-dist`, on a
separate loopback port, with the activation URL supplied only for that fixture.
Its tests intercept every API request; no Cloudflare inference is performed.
Chromium desktop/mobile and WebKit mobile cover keyboard submission, live feedback,
source links, unsupported answers, timeout/rate/quota failures, duplicate submission
protection, storage absence, automated accessibility, and mobile overflow.
`npm run test:browser` includes both the static-site suite and this fixture.
Neither fixture output nor test credentials enter the verified production artifact.

## Activation verification and runtime corrections

The real Workers AI binding returned `response` as a structured object. The
adapter accepts both that form and the older JSON string, applies the same size
and ID bounds, and ignores provider-written prose. The model constant lives in
its own module: a primitive named export from a Worker entry point is not a
valid runtime entry point. Custom CPU limits are omitted because Cloudflare
rejects even an explicit 10 ms setting on Workers Free; its platform cap applies
automatically. The API compatibility date is 2026-10-26, supported by
the repository's pinned workerd binary.

`npm run test:worker` now starts that actual runtime with `--local` and inference
disabled, checking boot, CORS, the disabled response, methods, and unknown routes.
It is included in `npm test` and therefore in local verification and hosted Quality.
It does not need account credentials or call Workers AI. Live model checks instead
use ordinary local Worker execution with the real remote AI binding; `--local`
disables remote bindings and cannot prove model behavior.

The private activation acceptance set covers six source-backed answers and five
unsupported/adversarial requests. Eleven real-response cases passed, including
research attribution and the boundary between implemented and completed ML
evaluations. This is a bounded acceptance sample, not a general accuracy estimate.
Provider quota failures remain fault-injected tests; deliberately exhausting the
account's shared Free allocation is not a verification requirement.
