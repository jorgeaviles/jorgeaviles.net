# Portfolio assistant retrieval and refusal evaluation

This change is for review only. It preserves extractive answers, the public
index, the model, the two-passage answer limit and one inference per deliberate
question. It adds no synthesis or conversation history. Production is unchanged.

## Baseline and investigation

Baseline source: `2f94772e59d5550db12bff37cb2ff063621986ea`. Model binding:
`@cf/meta/llama-3.2-3b-instruct`. Approved index:
`6be7485b1d3e31d724577e299130a4f80a302642eb3eb32949f5b25a16f4324a`.
There are 14 approved passages across five public documents. Questions are capped
at 500 characters, request bodies at 2,048 bytes, retrieval at six candidates,
selection/answers at two passages, answer text at 1,800 characters and the JSON
response at 8,192 bytes. Inference remains capped at 100 output tokens, temperature
zero, a 12-second deadline and no retry. Selector output is capped at 1,024
characters before parsing. All citations are resolved from retrieved sources.

The production question “What machine learning methods and evaluation limitations
are documented?” was refused despite available `ml-framework` and `ml-status`
evidence. Baseline retrieval supplies both (plus `portal-ml` and `research-credit`);
their combined approved text fits the answer and response limits. The input guard
does not reject the question. That ruled out a missing candidate and demonstrated
that a valid two-ID selection could pass, but did not identify the historical
model output because production request logging is intentionally off.

Owner-approved isolated staging subsequently reproduced the refusal twice. The
model returned valid JSON selecting three IDs:

```json
{ "passageIds": ["ml-status", "portal-ml", "ml-framework"] }
```

The baseline rejects more than two IDs before producing an answer. Thus these
staging refusals were **cardinality validation failures**, not an empty model
abstention, unknown IDs, malformed JSON or answer-length overflow. This is a
reproducible mechanism consistent with the production symptom, not retrospective
proof of the unrecorded production output.

A first prompt-only candidate still returned those three IDs twice. It did remove
an unrelated data-platform passage from the Blazor answer. The failed trial was
retained in private evidence; it is not reported as a successful ML fix.

## Narrow candidate

- Ask-only normalization maps `evaluations` to `evaluation` and expands `method`
  or `methods` to `method framework`. The approved methods passage describes a
  framework; retaining `method` also keeps research methodology discoverable.
  The original question is validated first, and expansion falls back to the
  unexpanded query at the existing length boundary. MCP keeps its original
  retrieval function and ordering; the curated index is unchanged.
- Candidate messages include their approved public project titles to distinguish
  professional ML methods, application integration and research credit. No
  private metadata or model-generated URL is introduced.
- The selector is asked for exactly two nullable fields, `first` and `second`,
  rather than a free-length ID array. Each field can hold one approved ID or null.
  The instructions distinguish complementary evidence from merely related
  vocabulary, and limitations from absent requested performance measurements.
- Parsing strictly validates that two-slot shape. The previously supported
  `passageIds` format remains compatible only within the same two-ID bound. Arrays
  in a slot, extra slot keys, unknown/unretrieved IDs, malformed/oversize outputs,
  and over-selection still fail closed. The exact string `"null"` is normalized only in a nullable slot, matching a captured model response; arbitrary unknown strings and `"null"` in legacy ID arrays are still rejected. No IDs are truncated or chosen after a
  model abstention, and no lexical-only fallback is added.
- An internal pure parser distinguishes selected evidence, abstention, malformed
  output, unknown IDs and over-limit selection. It does not log prompts, expose
  diagnostics through production responses or add a binding/feature flag.

## Evaluation dataset and reproducibility

`evals/portfolio/cases.json` contains 42 reviewed public-source cases: 26 supported
and 16 unsupported. Every case specifies the question, relevant and required approved passage
IDs, canonical source URLs, critical qualifications, multi-passage requirement and
refusal rationale. Ambiguous referents and lexical near-matches are included;
questions asking for unavailable measurements are distinguished from supported
questions about evidence limitations. An extractive caveat can be factually safe
but still fail the expected classification if it substitutes for a requested
number absent from the sources.

These are small author-reviewed annotations, not an independent benchmark. The
relevant-ID lists are deliberately strict: alternative reasonable evidence may
need annotation review. Index changes fail a version assertion and require a
human review of the labels, rather than silently updating expected results.

```sh
npm ci
npm run eval:portfolio
npm run verify
```

The standalone runner bundles the frozen baseline and current Worker and executes
both complete `/ask` paths. The baseline snapshot contains public repository code
with relocated imports, so evaluation works in a shallow CI checkout. Shared
content/model/limit dependencies are unchanged in this PR; any later changes need
baseline review as well as the index assertion. The runner makes **no network or
AI requests** and writes detailed per-case results under ignored
`.local/assistant-evaluation/`.

For deterministic tests, an explicitly idealized oracle selects annotated IDs
only if every required passage was actually supplied to `AI.run`. It refuses
annotated unsupported cases. It does not bypass the real request validation,
retrieval, selection parsing, final answer guards or server-resolved citations.
Its answers/refusals test application behavior, **not real Workers AI accuracy**.
Separate injected faults exercise malformed outputs and unknown IDs. No claim of
semantic entailment checking is made for a JSON-schema or citation allowlist.

## Deterministic baseline versus candidate

| Metric                                                     |      Baseline |    Candidate |
| ---------------------------------------------------------- | ------------: | -----------: |
| Relevant passage recall at six candidates                  | 29/30 (96.7%) | 30/30 (100%) |
| Supported cases with all annotated evidence retrieved      |         25/26 |        26/26 |
| Irrelevant retrieved passages, including unsupported cases |         65/94 |        64/94 |
| Mean reciprocal rank, supported cases                      |         0.926 |        0.952 |
| Zero-candidate questions, all cases                        |          8/42 |         8/42 |
| Supported answers, oracle mock                             |         26/26 |        26/26 |
| False refusals, oracle mock                                |          0/26 |         0/26 |
| Unsupported refusals, oracle mock                          |         16/16 |        16/16 |
| False acceptances, oracle mock                             |          0/16 |         0/16 |
| Correct returned citations, oracle mock                    |         28/28 |        28/28 |
| Required evidence represented in answers, oracle mock      |         29/29 |        29/29 |
| Unrelated selected passages, oracle mock                   |          0/29 |         0/29 |
| Qualification-bearing cases preserved, oracle mock         |         13/13 |        13/13 |
| Injected failures safely refused                           |           6/6 |          6/6 |
| Maximum inference attempts per question                    |             1 |            1 |

The normalization retrieves an additional relevant limitations passage for “Are completed model evaluations
substantiated by the saved notebooks?” The additional passage is relevant but not mandatory to answer that yes/no question: `ml-status` already states the evidence limitation. Relevant passages and required evidence are annotated separately, so an optional retrieval miss is not mislabeled as a false refusal. The original ML question already had both
required candidates in the baseline; its mocked success is not evidence that the
real selector has been fixed. The final alias moves the concrete ML framework passage ahead of application-integration and credit-only passages for the original question. Irrelevant candidate count decreases by one, mean reciprocal rank improves modestly, and zero-candidate count is unchanged. This small, hand-reviewed set does not establish broad retrieval precision.

The oracle emits valid selections, so malformed/unknown model-output counts in
that run are zero by construction. The separate six-case fault suite injects one
abstention, one unknown ID, one over-limit selection and three malformed outputs;
all six are refused in both variants. These are injected contract outcomes, not
observed model error rates. Additional unit tests cover invalid two-slot records,
the exact ML regression with both evidence facets, allowlisted-but-unretrieved
IDs, preservation of source text, quota errors, timeouts and single inference.

## Hosted evaluation and release boundary

The initial owner-approved plan allowed one password-protected, disposable test
Worker and at most 12 fixed public-fixture requests, six per variant, without
retries. Each deployment uses the same model/index and native rate-limit bindings
in unused namespaces, with MCP disabled and no production route, DNS, storage,
paid CPU override or application logging. Only the protected test wrapper returns
selector diagnostics; it accepts fixed fixture IDs rather than arbitrary visitor
questions. Credentials and raw operational evidence remain ignored and private.

The owner then approved six more fixed requests for a two-slot revision, followed
by up to twelve for titles/alias ranking and one final selection-prompt revision.
We used 30 fixed requests in total, without retries: five variants × six requests,
including two attempts of the exact ML question per variant. The injection case
was refused before inference, so there were 25 actual model calls.

The intermediate two-slot revision stopped the format refusal but chose
`ml-status` and `portal-ml`, omitting methods. Titles/alias ranking alone still
selected credit instead of methods. The final prompt explicitly requires actual
algorithms, preprocessing or procedures as methods evidence, and separate
limitations evidence when requested. It succeeded on both exact ML attempts.
These failed trials remain part of the evidence; nonempty answers are not counted
as fixes when required evidence is missing.

| Small hosted sample                                        | Baseline | Final hosted trial | Final validator replay |
| ---------------------------------------------------------- | -------: | -----------------: | ---------------------: |
| Exact ML question with both methods and limitations        |      0/2 |                2/2 |                    2/2 |
| Supported requests answered (includes the two ML attempts) |      2/4 |                3/4 |                    4/4 |
| False refusals                                             |      2/4 |                1/4 |                    0/4 |
| Unsupported requests refused                               |      1/2 |                2/2 |                    2/2 |
| False acceptances under the dataset classification         |      1/2 |                0/2 |                    0/2 |
| Blazor unrelated data-platform passage included            |        1 |                  1 |                      1 |

The final hosted remaining refusal was a valid limitations ID accompanied by the
literal string `"null"` in the other slot. The final parser normalizes that exact
absence sentinel. Sanitized [recorded selectors](../evals/portfolio/selector-recordings.json)
are replayed through the entire final Worker path in CI, with current retrieval,
input guards, parsing, length limits and citations. This verifies the narrow
format correction **without another live inference**. The replay column is not
an additional hosted run or a new model accuracy measurement.

The absent-AUC request is now refused rather than answered with an extractive
caveat that does not supply the requested number. Neither variant invented an
AUC figure. The Blazor answer still includes an unnecessary but approved
public data-platform passage; this relevance limitation is not claimed fixed.
Research/credit/privacy cases outside these five unique questions are covered by
offline tests only. Five unique hosted questions, repeats, temperature zero and
same-provider serving do not establish a general real-model accuracy rate.
The configured model alias is unchanged; captured provider metadata reports
`@cf/meta/llama-3.2-3b-instruct-v2`, not an owner-selected new model.

### Free-plan observations

Each variant's six fixed requests used five inferences. Provider-reported neuron
usage was 9.668 baseline, 12.143 first prompt-only trial, 12.944 two-slot trial,
13.876 titles/alias trial and 14.672 final prompt trial: approximately 63.30 neurons
total. The final prompt is longer; no inference-cost reduction is claimed.
Baseline versus final input/output token totals were 1,682/62 and 2,797/57.
Median client wall times were approximately 225 ms and 224 ms; these are not CPU
measurements or controlled cold-isolate tests.

Native dashboard measurements (Last 24 hours, the corresponding version's
traffic):

| Observation                            | Baseline | Final hosted trial |
| -------------------------------------- | -------: | -----------------: |
| Native invocations                     |        6 |                  7 |
| AI subrequests                         |        5 |                  5 |
| CPU chart p50                          |  2.75 ms |            1.96 ms |
| CPU chart p90                          |  6.53 ms |            4.74 ms |
| CPU chart p99                          |  6.53 ms |            4.74 ms |
| CPU-limit errors / uncaught exceptions |    0 / 0 |              0 / 0 |

The final native count includes one request beyond the six authenticated fixture
requests; no extra inference is shown. It is not attributed to a visitor or a
particular probe. CPU values are native chart series, not raw recomputed
percentiles. The samples are too small to establish a performance improvement,
control cold isolates or certify production Free-plan headroom. They include the
protected staging wrapper's diagnostic serialization. No paid CPU override,
model retry, verifier inference, application log, persistent storage or production
configuration change was introduced. The final nullable-sentinel correction was
validated offline; no further hosted requests were made for that parser-only fix.

Temporary resource and login cleanup, unchanged production version and unchanged
release-gate checks are retained in private review evidence.

The existing [model API](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/)
is used unchanged. The two-slot contract is an application prompt/parser format,
not a claim of provider-enforced [JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
support. Outputs remain untrusted and fail closed.

## Next phase

Do not begin conversational synthesis until this selection contract has been
reviewed and its remaining supported/unsupported cases evaluated. A separate v2
proposal can use one bounded synthesis call over the same approved passages,
server-resolved sentence citations and the current extractive fallback. It should
retain independent MCP behavior, no persistent history and no verifier-model or
retry loop. A successful unit mock or small hosted sample is not authorization
for production activation or a guarantee of Workers Free headroom.
