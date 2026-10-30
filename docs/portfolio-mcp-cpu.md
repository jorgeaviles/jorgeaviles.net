# MCP CPU profiling and hosted comparison plan

The local profiles support two narrow changes: evaluate the MCP module during
isolate startup, and construct one English collator for deterministic search tie
ordering. They do **not** establish production Workers Free compatibility. Keep
production MCP disabled and require another owner-approved hosted comparison.

## Method and provenance

Baseline: `eedf0cbdbaba2016066e2fc0e5851e6a9acca4b7`. The candidate changes only
`index.ts` module loading and `content.ts` tie comparison; the MCP handler, fresh
server factory, schemas, transports, public index and release policy are unchanged.

Index version:
`6be7485b1d3e31d724577e299130a4f80a302642eb3eb32949f5b25a16f4324a`.

Local tools: Node 24.22.1, Wrangler 4.152.0, workerd 1.20261019.1, Miniflare
5.20261019.2-beta, Agents 0.31.0, MCP server/client 2.3.1, Zod 4.6.7.
No dependencies were added or upgraded.

Three fresh Wrangler processes per version each received one initial sequence:
`initialize`, `tools/list`, `list_projects`, `get_case_study`, `search_portfolio`,
`get_research`. Each operation then received six warm repetitions, for 42 requests
per process. All 252 baseline/candidate requests completed successfully. The test
used the actual entry point, assistant disabled, no AI binding, the same MCP
hostname/Origin policy, and a local rate-limit binding. Profiling used the
workerd DevTools `Profiler` domain with a 100-microsecond sampling interval.
No production resource, credential, visitor data or request logging was used.

Profiles were evaluated by self-time (bottom-up) and inclusive call trees. The
numbers below sum sampled time excluding `(idle)`, `(program)` and `(root)` leaf
samples, including garbage collection. They are approximate local profiler
measurements, **not** billed Cloudflare CPU time or elapsed HTTP latency. Native
binding/I/O frames and sampling boundaries can distort short-request totals.
They must not be compared directly to the hosted 10 ms allowance.

## Findings

The baseline first `initialize` includes roughly 31–33 ms of inclusive MCP/SDK
module evaluation in the first two profiles. Call trees enter the generated
module initializers for the stateless Agents handler, MCP core and Zod. That
work executes after the route's dynamic import, inside the first request.

The baseline first search includes roughly 8–11 ms of self-time in the sorting
comparator containing `localeCompare(..., 'en')`. Reusing a bound
`Intl.Collator('en').compare` moves locale setup to module evaluation while
preserving the established English ordering. Regression cases include tied
scores, research terms, an accented name and unsupported queries.

Fresh server construction/tool registration is present but much smaller (for
example, about 0.38 ms inclusive in the baseline first `list_projects` profile).
Schema conversion contributes to first `tools/list` (about 1.8 ms in one baseline
profile). Those costs, response buffering, serialization and content retrieval
were not changed: the evidence did not justify weakening validation or adding a
cache. Servers, transports, requests and visitor state remain request-scoped.

The profiles identify comparable local first-use costs; they do not conclusively
attribute the earlier hosted 72–98 ms CPU tail to those exact functions.

## Before and after

Median across the three local profile runs, milliseconds:

| Operation             | Baseline | Candidate |
| --------------------- | -------: | --------: |
| First initialize      |    43.35 |     11.51 |
| First search          |    13.82 |      6.27 |
| Warm initialize       |     4.20 |      4.06 |
| Warm tools/list       |     4.26 |      3.64 |
| Warm list_projects    |     3.46 |      4.10 |
| Warm get_case_study   |     4.37 |      4.04 |
| Warm search_portfolio |     4.34 |      4.09 |
| Warm get_research     |     4.31 |      4.15 |

Each warm value is the median of three six-request profile averages, not a
percentile across individual requests. Warm differences are small/noisy; no
across-the-board warm improvement is claimed. Initial initialize ranges were
43.02–46.20 ms baseline and 7.78–12.17 ms candidate. Initial search ranges were
13.60–17.37 ms and 5.73–6.80 ms respectively.

Equivalent dry-run production bundles, without source maps:

| Bundle     | Baseline bytes | Candidate bytes |
| ---------- | -------------: | --------------: |
| JavaScript |      1,385,521 |       1,285,563 |
| gzip       |        233,959 |         224,968 |

Static module evaluation also lets the existing bundler eliminate some generated
lazy-module machinery. The compressed output is 8,991 bytes smaller (about 3.8%).
No bundler configuration was changed.

### Startup tradeoff

This is mainly relocation of initialization, not removal of its CPU cost.
Wrangler's separate local startup profiler reported approximately 7.6 ms active
sampled time for baseline and 35.0 ms for the final candidate, with profile
windows of 26.7 ms and 66.5 ms. These startup observations have few samples and
must not be interpreted as hosted startup guarantees.

The SDK is now initialized even when MCP is disabled or the first request is
`/ask`. This increases isolate startup work and may affect cold assistant
latency. No server is created until an enabled MCP request reaches the handler;
no AI inference or external request is performed by startup. The hosted test
must validate assistant cold/warm behavior as well as MCP. Static site assets and
their independent deployment are unaffected.

## Reproduce and inspect

Use `.nvmrc`, `npm ci`, the pinned dependency lock, and separate clean checkouts
for baseline and candidate. Run Wrangler in local mode, on loopback, with no AI
binding and no remote resources. Keep identical compatibility dates and limiter
configuration. Do not warm `/mcp` with readiness probes before the first profile;
use inspector discovery or an unrelated route instead.

Cloudflare documents [DevTools CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/).
Start `wrangler dev`, open DevTools, record the first sequence and warm operations
separately, and save `.cpuprofile` files. Inspect both call tree and Heavy
(Bottom Up); exclude idle time. Automated local collection can use the same
DevTools `Profiler.enable`, `Profiler.setSamplingInterval`, `Profiler.start` and
`Profiler.stop` commands through Wrangler's loopback inspector endpoint. Keep
raw profiles and synthetic test configuration in ignored private evidence.

To inspect module startup separately, pass the config through `--args` (the
pinned startup command's build subprocess otherwise uses the default project):

```sh
npx --no-install wrangler check startup \
  --args="--config /absolute/path/to/local-only/wrangler.json" \
  --outfile /absolute/path/to/private/startup.cpuprofile
```

Do not treat `performance.now()` around a fetch as CPU measurement. Local raw
profiles, bottom-up summaries, build manifests, client output and wall-latency
records are retained in ignored `.private/mcp-cpu-profile/` operator evidence.
The unsuccessful passage-pretokenization experiment was discarded: the remaining
first-search spike was in the comparator, and no meaningful tokenization benefit
was established.

## Validation

Run `npm run verify` and the official client against the actual bundled workerd
artifact. Existing checks cover both enable switches, AI isolation, canonical
references, source/attribution boundaries, strict input schemas, unsupported
requests, body/output limits, Host/Origin, real local throttling and concurrency.
Run Inspector 2.13.0 over local Streamable HTTP for discovery and all four tools,
using task-local client configuration. Do not modify global MCP settings.

## Owner-approved hosted A/B plan

No new Cloudflare resources or temporary credentials are authorized by this
profiling phase. Obtain owner approval for the concrete comparison before
creation. Leave this PR unmerged and undeployed until reviewed.

1. Record exact baseline and reviewed candidate commits, index version and bundle
   digests. Confirm the production API/version, release gate, verification flag,
   Free plan and static deployment marker before starting.
2. Create two disposable read-only Workers with distinct names, exact
   workers.dev hostnames and unused rate-limit namespaces. Each version uses its
   reviewed code, identical configuration, assistant disabled, no AI/storage
   binding, no application logging, no custom paid CPU override and no DNS.
   Change only the staging hostname and namespace, never production policy.
3. Run two separated test periods with fresh deployments, alternating which
   version is exercised first. Deployments/idle gaps provide **first-observed**
   samples, not a guarantee of fresh Cloudflare isolates. Record that limitation;
   do not claim controlled cold isolates without platform evidence.
4. For each version/period, use one sequential official-client session covering
   initialize/discovery/all four tools, then two further sequential warm sessions
   and at most one pair of concurrent calls. Disable automatic retries. Keep
   traffic under the independent limiter; allow its interval to reset between
   client suites. Do not dilute the main CPU window with ping/throttle traffic.
5. Record native Cloudflare per-Worker CPU p50/p90/p99 and sample counts, invocation
   outcomes, subrequests, source/index versions and the metric time windows. Wait
   for ingestion. Keep wall latency separate and report adaptive sampling/small
   tails honestly. Do not enable logs to obtain metrics. Native CPU charts and
   [isolate overrun flexibility](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)
   govern interpretation; zero errors alone does not prove adequate headroom.
6. Run Inspector and Codex with isolated client settings, then negative/size/
   security/throttle tests in a separate measurement window. Run all four tools
   on both versions. Confirm no AI inference is possible in either staging
   Worker. An assistant regression check can use the local existing runtime
   suite; hosted assistant cold/warm comparison requires a separately approved
   isolated AI binding and a bounded inference budget. Do not add that binding
   implicitly or touch the production assistant to simulate cold starts.
7. Remove both Workers and temporary CLI credentials. Verify hostname 404s,
   namespace bindings absent, production version unchanged, `/ask` still works,
   `/mcp` still 404, static marker unchanged and release/verification gates off.
   Since this uses no DNS writes, preserve email records and compare their
   protected baseline if any domain work is separately authorized.

If either period shows sustained limit failures, or too few first-use samples to
assess headroom, leave CPU compatibility unverified. Optimization and local tests
are not authorization to activate MCP or change
`PORTFOLIO_MCP_CLIENT_VERIFIED`.
