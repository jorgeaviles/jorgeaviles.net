# Conversational assistant v2 — release blocked

**Do not activate this candidate.** The implementation and reproducible tests are
reviewable, but the existing model did not meet the requested conversational
quality and evidence-coverage criteria in bounded hosted testing. No production
API version, release gate, MCP setting, DNS, credentials, paid plan, storage or
static deployment setting was changed. A passing mocked test suite is not a
reason to override these findings.

## Implementation under review

The candidate preserves the PR #41 curated index, six-candidate retrieval, two
selected passages, model alias, existing limiter namespaces and single-call
request path. MCP source and retrieval are unchanged. There is no model retry,
verification call, persistent history or agent framework.

One inference returns exactly `first`, `second`, `sentences`. Each sentence record
has only `text` and `passageIds`. At most two retrieved IDs may be selected; each
selected ID must appear in the sentence support lists. Prose is limited to 2–4
sentence records, 400 characters each, 1,800 answer characters, 3,600 serialized
model-output characters, 420 output tokens, and the existing 8,192-byte response
and 12-second inference bounds. Temperature remains zero.

Unrecognized top-level fields, malformed/truncated JSON, invalid selection and
abstention fail closed. When selection is valid but prose fails validation,
exact selected source text is returned instead. This never selects evidence from
lexical similarity after abstention. Server-resolved URLs are the only citations;
model-generated URLs, markup and executable content are rejected. The API adds
optional sentence-to-source indexes, and the client verifies their bounds and
exact agreement with answer text. React renders plain text and nearby source
links, with the existing accessible state, focus and cooldown behavior.

Rejection rules also catch unsupported numbers, certain attribution mistakes and
missing known experimental/execution qualifications. They are intentionally
conservative, can reject a reasonable paraphrase, and **cannot prove general
semantic support**. Approved passage IDs do not establish entailment. Known
instruction-override requests using `invent`, `pretend`, or `ignore the sources`
are now refused before inference; keyword guards are not a security boundary.

The [existing model API](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/)
is unchanged. Cloudflare's [JSON Mode supported-model list](https://developers.cloudflare.com/workers-ai/features/json-mode/#supported-models)
does not list this alias, despite its catalog exposing a `response_format`
parameter. This candidate does not assume provider-enforced schema support or
silently switch models. A different supported model or response contract needs a
separately bounded evaluation before release.

## Reproducible offline verification

```sh
npm ci
npm run eval:portfolio
npm run verify
```

The complete local `npm run verify` passed: 188 unit tests, actual-workerd
checks, official MCP SDK checks, publication/build checks, 380 site browser
checks (five existing skips), and 18 assistant browser checks. Screenshots were
reviewed on desktop and mobile; browser tests use mocked API responses, not
additional real-model calls.

The existing 42-case dataset (26 supported, 16 unsupported) is unchanged.
`v1-worker.ts` freezes production source `315683c1` with relocated imports only.
The evaluation adds independently reviewed paraphrase fixtures for all 14 public
passages. Idealized selectors and paraphrases are explicit oracle mocks, not
observed model accuracy. They verify the complete request, retrieval, assembly,
citation and refusal contracts. The mocked v2 run answers 26/26 supported cases,
refuses 16/16 unsupported cases, has zero citation failures and at most one
inference attempt per request. Required evidence and qualification review are
encoded in the source fixtures and existing annotations; exact fixture assembly
is not a semantic entailment algorithm.

Sanitized hosted outputs in `synthesis-recordings.json` and the explicit
claim/evidence/readability assessments in `synthesis-review.json` are retained
for review. Captured outputs are replayed through the
actual Worker path. Those tests deliberately preserve observed refusals and
fallbacks as regression evidence; passing replay is **not** a passing quality
gate. New actual-workerd tests exercise mocked synthesis, sentence links,
extractive fallback, quota failure and one-call behavior. Existing MCP SDK tests
still exercise discovery and all four tools. Desktop and mobile screenshots are
reviewed alongside keyboard, focus, overflow and automated accessibility checks.

## Bounded hosted comparison

The owner authorized one temporary, password-protected Worker and 16 fixed
requests (eight per version), then eight final requests after the first trial
failed. Exactly 24 fixture requests were made, without retries, using 16 actual
AI calls. No new production Worker or route was introduced. The temporary Worker
used unused limiter namespaces and no application logging, paid CPU override,
persistent storage, or DNS change. All operational credentials and account
metadata stay in ignored private evidence.

Each variant used the same eight questions: exact ML methods/limitations,
Blazor purpose, completed-evaluation limitations, research credit, absent AUC,
weather, confidential-record request and false-attribution injection.

| Hosted outcome                                    |  v1 | Initial v2 | Final prompt trial |
| ------------------------------------------------- | --: | ---------: | -----------------: |
| Supported requests answered                       | 4/4 |        3/4 |                3/4 |
| False refusals                                    | 0/4 |        1/4 |                1/4 |
| Unsupported requests refused under dataset labels | 3/4 |        4/4 |                4/4 |
| Supported outputs passing synthesis validation    | 0/4 |        1/4 |                0/4 |
| Inference calls                                   |   6 |          5 |                  5 |

The initial v2 Blazor output passed syntax/citation checks but copied the two
source sentences, so it did not demonstrate conversational readability. The
final trial selected both ML framework and status passages, but omitted the
experimental qualification in generated prose; the validator returned both
approved source passages instead. Its Blazor output had incomplete JSON and was
refused. Its limitations and research outputs also fell back to approved text.
No fallback is counted as a successful conversational answer.

The baseline included an unnecessary data-platform paragraph for Blazor and an
extra background research paragraph for attribution. Its injection response
returned truthful source text correcting the premise, but did not refuse as the
dataset requires; count it as a false acceptance under that classification, not
an invented authorship claim. New input guards account for the candidate's
injection refusal and one fewer inference, rather than evidence of improved
model reasoning.

### Semantic review

Each emitted factual statement was compared with its supporting approved
passages, separately from schema validity. Baseline and fallback answers are
exact source text and retain source qualifications, although the initial v2 ML
fallback omitted required methods evidence because that evidence was not
selected. The one accepted initial synthesis was wholly supported but verbatim.
No unsupported novel factual claim was emitted in this small sample. Invalid raw
generated prose was never treated as an endorsed professional claim. This does
not establish an unsupported-claim rate for unseen questions. Required-evidence,
refusal and readability failures independently block release.

## Resource observations

| Provider usage / client timing              |     v1 | Initial v2 | Final prompt trial |
| ------------------------------------------- | -----: | ---------: | -----------------: |
| Input tokens                                |  3,252 |      3,643 |              4,048 |
| Output tokens                               |     72 |        330 |                369 |
| Neurons                                     | 17.233 |     26.904 |             29.965 |
| Neurons per actual inference                |  2.872 |      5.381 |              5.993 |
| Median client response time, eight requests | 201 ms |     305 ms |             297 ms |

Total observed provider usage was approximately 74.103 neurons. The native
account dashboard showed 82.94 of 10,000 daily neurons at cleanup (the balance
includes earlier account use); the rolling usage display was 146.24 neurons. The final trial
uses about twice the neurons per inference as baseline; it does not meet the
resource-neutral objective. Totals include distinct questions and different
numbers of pre-inference refusals; these are not controlled per-question billing
estimates. No model request was retried, including malformed outputs.

| Native Cloudflare CPU chart              | Baseline-only traffic | Initial v2 active version | Final trial active version |
| ---------------------------------------- | --------------------: | ------------------------: | -------------------------: |
| Invocations                              |                     8 |                         9 |                          8 |
| AI subrequests                           |                     6 |                         5 |                          5 |
| CPU p50                                  |               2.28 ms |                   2.35 ms |                    1.86 ms |
| CPU p90 / p99                            |        8.35 / 8.35 ms |            7.82 / 7.82 ms |             8.05 / 8.05 ms |
| CPU-limit failures / uncaught exceptions |                 0 / 0 |                     0 / 0 |                      0 / 0 |

The baseline snapshot used all-version scope before any candidate fixture
requests; candidate snapshots used the exact active version. Native invocation
counts can include unauthenticated probes beyond controlled fixture traffic; the
extra initial-v2 request is not attributed to a visitor. CPU figures are chart
percentiles, not recomputed raw distributions. The wrapper serializes private
diagnostics and adds overhead equally to the comparison. Small samples, sequential
variants and shared-provider serving do not establish a CPU improvement or
production Free-plan headroom. Browser/client timing is not CPU or isolated model
latency. Workers Free remains the current plan with the existing 10,000-neuron
daily allowance. Do not upgrade or claim a guaranteed questions-per-day capacity.

Wrangler upload startup measurements were 48 ms for baseline, 43 ms for the
initial candidate, and 46 ms for the final trial. They are bundle startup
observations, not native first-request cold-isolate latency. The eager
MCP SDK import remains unchanged; no new cold-start guarantee is made.

## Cleanup and preservation checks

The temporary Worker is absent in the native dashboard, which lists only the two
original site/API Workers. Wrangler deleted the Worker but subsequently failed
an unnecessary KV inventory check because the deliberately narrow login lacked
KV permissions; no KV was created. Cleanup was independently verified in the
dashboard rather than broadening permissions. The temporary CLI login was removed.
Production deployment history is byte-for-byte unchanged from preflight and the
API release gate remains false. A bounded live official-SDK check passed discovery,
all four production MCP tools and canonical source links without AI inference.

## Deployment boundary and rollback plan

This is an unapproved candidate. Keep the existing production version
`c49d2f4e-06bf-409f-a325-41f5e4eef821` as the verified pre-change target and leave
both `ASSISTANT_ENABLED` and `MCP_ENABLED` true in production. Leave the repository
release gate false. Do not merge or deploy because mocks pass.

A future release requires passing real-model evidence coverage, semantic-support,
refusal, readability and resource gates; owner approval; and published revised
Colophon copy. Publish the backward-compatible UI/disclosure through the static
workflow first, then use the existing protected API release workflow from reviewed
main with `action=deploy`, `mcp_enabled=true`, `expected_current_mcp=true` and empty
rollback version. Verify the artifact and normal owner environment approval.
Never directly deploy the production API using Wrangler.

If a subsequent approved release requires rollback, inspect live state and
current main first, temporarily enable the release gate, and dispatch the protected
workflow with `action=rollback`, both MCP inputs `true`, and
`rollback_version=c49d2f4e-06bf-409f-a325-41f5e4eef821`. Obtain the existing owner
environment approval, verify both services, sources and active version, then
restore the gate to false. Rollback was not executed in this task.

Next work should investigate a simpler supported response contract or a model
with demonstrated schema/synthesis capability, with explicit resource limits and
fresh owner approval for any additional hosted inference. No further test calls
are authorized by this report.
