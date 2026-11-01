# Conversational assistant completion and release review

This follow-up resolves the source-grounded answer-generation blocker from PR #42
and rewrites the public MCP page for a general portfolio audience. The candidate
is ready for owner review and a controlled protected release. It is **not yet the
live API**: production remains the verified PR #41 version until separately
approved deployment. Do not confuse successful static-site deployment with API
activation.

## What changed

The earlier 3B model could select passages but did not reliably synthesize answers.
A lower-cost 8B trial with structured output produced valid JSON but refused all
four supported pilot questions. The selected candidate uses
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` through the same Workers AI binding.
Cloudflare lists it as supporting [JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/).
No provider, infrastructure, account plan or production limiter is added.

A disjoint schema describes either a supported answer with two nonempty sentence
records, or an abstention with no selected evidence and no prose. The server
still treats provider output as untrusted: IDs must be retrieved and selected,
extra fields and markup fail validation, and URLs are always resolved server-side.
At most two passages, one inference, 420 output tokens, a 12-second deadline,
1,800 answer characters and 8,192 response bytes remain enforced. There are no
model retries or automatic switches to a second model for visitor requests.

When otherwise valid prose cites `ml-status` but omits an important qualification,
the server can append the reviewed experimental-status or execution-record clause
from that selected source. It first checks that the exact clause still exists in
the approved passage. Only sentence-initial capitalization is normalized. This
does not select new evidence or invent a caveat. Final answers contain two to
four cited sentence records and remain bounded. Contradictory/unsafe prose is
rejected rather than repaired. Other failures retain the extractive fallback.

A further conservative check rejects an author name not present in its cited
passage. In the recorded comparison case, the model named Asthana while citing
only the methods excerpt. Although the original page supports the name, the
final validator uses source text instead because the cited excerpt does not.
These checks address known risks; they are **not a general semantic entailment
verifier**. Independent source-by-source review remains necessary.

Historical baseline snapshots now pin their original 3B model. Changing the
candidate model must not silently change what a baseline represents. Historical
recordings and their observed outcomes remain preserved; replay through a newer
validator is explicitly distinguished from another hosted model run.

## Evaluation and limits of the evidence

The existing 42-case dataset remains unchanged. The complete deterministic oracle
evaluation exercises 26 supported and 16 unsupported questions; mocks verify the
request/retrieval/citation contract, not real-model accuracy.

The owner authorized one password-protected, disposable test Worker, at most
48 fixed requests and 4,000 neurons, with production unchanged. Exactly 48 fixture
requests were used across two models and four controlled configurations:

| Trial                       | Requests | Inferences | Neurons | Observation                                                     |
| --------------------------- | -------: | ---------: | ------: | --------------------------------------------------------------- |
| 8B structured pilot         |        6 |          6 |  17.618 | Four supported questions falsely refused                        |
| 70B initial pilot           |        6 |          6 | 140.533 | Evidence selection improved; prose cardinality unreliable       |
| 70B fixed-cardinality pilot |        6 |          6 | 188.886 | Empty records/omitted qualifications still caused fallbacks     |
| Final candidate             |       30 |         20 | 544.773 | All supported questions answered; all unsupported cases refused |

Total provider-reported use was **891.810 neurons**, below the approved cap.
No fixture request was retried automatically. The native account counter showed
963.22 of 10,000 daily neurons at cleanup. Account counters are recorded separately
from per-response usage because aggregation and other traffic can differ.

The final hosted sample includes 14 supported questions covering every indexed
topic, plus all 16 unsupported/ambiguous/privacy/injection cases. Twelve redundant
supported paraphrases from the full 42-case dataset were not run on the hosted
candidate; they remain covered by deterministic tests. Thirty hosted cases are
not a general accuracy guarantee or an independent benchmark.

| Final sample outcome                                                                 |              Result |
| ------------------------------------------------------------------------------------ | ------------------: |
| Supported questions answered                                                         |               14/14 |
| Unsupported/sensitive questions refused                                              |               16/16 |
| False refusals / false acceptances                                                   |               0 / 0 |
| Hosted supported answers passing prose validation                                    |               12/14 |
| Final-validator replay summaries / source-text fallbacks                             |        11/14 / 3/14 |
| ML methods and limitations, Blazor, evaluation evidence, research-credit regressions | 4/4 cited summaries |
| Maximum inference attempts per submission                                            |                   1 |

The three final source-text fallbacks are calibration, proposed Portal integration,
and the research/framework comparison. The first two model outputs cited a
retrieved ID that had not been selected; the comparison receives the stricter
author-name check in offline replay. None is counted as a successful generated
summary. Calibration and Portal-integration fallbacks retain the original
implementation and operational-approval qualifications.

### Semantic and citation review

Each emitted factual sentence was compared with its cited approved source, apart
from schema checks. The sample contains no invented performance measurement,
operational-ML claim, paper authorship for Jorge, or private-record disclosure.
Label explanations preserve that the target is not fraud. Research answers retain
Asthana's authorship and Jorge's acknowledged assistance. Unsupported answers have
no fabricated source links.

The data-platform developer question selected the approved `portal-role` excerpt
instead of the fixture's `data-role`; the former explicitly covers sole hands-on
work across the platform and Portal. This is source-equivalent evidence, not an
exact annotated-ID match. Some answers cite an extra supporting page for the same
fact. The Blazor regression no longer adds an unrelated data-platform paragraph.
Answers are intentionally concise and do not promise exhaustive evidence coverage.

Sanitized model outputs, usage and final-validator responses are preserved in
`evals/portfolio/completion-recordings.json`. CI replays them through the complete
Worker path without network inference. The final author-name rejection and source
qualification restoration are separately tested. The real hosted and replay
columns must not be combined into a larger model-success sample.

## Resource tradeoff and Free-plan observations

The final sample used 11,604 input tokens and 1,149 output tokens across 20
inferences: about **27.24 neurons per inference** and 18.16 per fixture request
including pre-inference refusals. Median client response time across all 30
requests was about **1.19 seconds**. These timings exclude the client's pacing
between requests but include network and service response time; they are not CPU.

For context, the earlier eight-question production-v1 staging sample used about
2.87 neurons per inference. The new model is approximately **9.5 times more
expensive per inference in these different small samples**, in exchange for
useful synthesis. This is not resource-neutral. Cloudflare's account-wide
[Free allowance](https://developers.cloudflare.com/workers-ai/platform/pricing/)
remains 10,000 neurons per day; do not promise a fixed questions-per-day capacity,
enable paid billing, or bypass quota exhaustion. The existing busy/quota/timeout
responses remain the only failure behavior. The owner should review this tradeoff
before production activation.

Native final-version dashboard observation: 27 invocations, 20 AI subrequests,
CPU p50 **2.75 ms**, p90 **3.88 ms**, p99 **10.44 ms**, with zero CPU-limit failures
and zero uncaught exceptions. The controlled client completed 30 fixture requests;
these are separate observations and native aggregation is not assumed to match
one-for-one. Upload startup was **43 ms**. The eager MCP SDK import remains intact.
The test wrapper's diagnostic serialization adds work absent from the public
response. The final author-name check was validated by replay after hosted tests.

The p99 is slightly above the nominal Workers Free 10 ms allowance. This small
sample does not certify sustained CPU headroom, isolate cold requests, or prove a
performance improvement over production. It supports a controlled release with
rollback and bounded production verification, not unconditional availability.
No paid CPU override, application request logging, database or persistent history
was introduced. The existing MCP code and tools are unchanged; actual-workerd and
official-SDK protocol checks cover all four tools with the current dependencies.

## Public MCP page

The page now starts with direct links to projects, background/education and
research, plus suggested hiring and academic-review questions. Connection
instructions are application-neutral. Vendor-specific CLI instructions are
removed, and technical transport/schema details are secondary, collapsible
content. It remains static and makes no MCP or AI requests merely by loading.
The curated content index and public tools are unchanged.

## Verification and cleanup

`npm run verify` passes: 222 unit tests, the full 42-case deterministic evaluation,
actual workerd synthesis/fallback/quota checks, all four official-SDK MCP tool
checks, publication/build checks, 380 site browser checks (five existing skips),
and 24 assistant browser checks. Desktop and mobile screenshots were reviewed.
Browser replay tests use captured responses and make no additional AI requests.
All five canonical source URLs returned HTTP 200 in bounded read-only checks.

The temporary Worker was deleted; a subsequent Cloudflare read returned
“Worker does not exist” (code 10007). As in the earlier trial, Wrangler's
post-deletion KV inventory check lacked permission; no KV was created and access
was not broadened. The CLI login was removed. Production deployment history and
release-gate values match preflight. No production API deployment, DNS/email,
credential, billing, application logging or persistent-storage changes occurred.

## Protected release and rollback

1. Review this implementation, the semantic findings and higher-neuron tradeoff.
   Merge only after Quality passes. Publish the revised static content through
   the normal site workflow; the already published privacy copy supports both
   generated summaries and source-text fallback.
2. Inspect live configuration for drift. The verified pre-change API is
   `c49d2f4e-06bf-409f-a325-41f5e4eef821` with assistant and MCP enabled. No API
   release gate was enabled by this implementation task.
3. After explicit owner approval, temporarily enable the existing API release
   gate and dispatch the protected workflow from reviewed main with
   `action=deploy`, `mcp_enabled=true`, `expected_current_mcp=true`, and empty
   `rollback_version`. Use the normal owner environment approval and verified
   artifact; never deploy production directly through Wrangler.
4. Check representative cited answers, unavailable measurements, refusal,
   attribution, browser errors, current CPU/usage and all four live MCP tools.
   Restore the release gate to false. Do not retry inference automatically.
5. If verification fails, stop and use the existing protected rollback procedure
   with `action=rollback`, both MCP inputs `true`, and
   `rollback_version=c49d2f4e-06bf-409f-a325-41f5e4eef821`, after confirming live
   state. Obtain normal owner approval and reverify both services. This task did
   not execute rollback or a production deployment.
