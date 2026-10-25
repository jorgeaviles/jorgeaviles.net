# Learning lab implementation

The three stages share one React island at `/lab/`. Pure TypeScript in `src/lib/ml/models.ts` owns deterministic synthetic generation, fixed 54/18/18 classification partitions, training-only standardization, models, batch gradients, stable objectives, rankings and evaluation. The regression fixture contains 24 noisy synthetic task observations. No service, ML runtime or chart dependency is added.

Linear regression minimizes mean squared residuals, with gradients including the factor of two. Its displayed weight acts on standardized complexity; the inspector also gives slope and intercept in original units. Logistic regression minimizes mean `max(z,0) - yz + log1p(exp(-abs(z)))`, avoiding logarithms of saturated probabilities. Gradients use mean `(sigmoid(z)-y)x`; bias omits x. Parameter updates are bounded to ±100. Learning rates are small fixed presets, not a convergence guarantee.

One authoritative logistic model drives training, validation loss, the probability landscape, the decision boundary, the record inspector and evaluation ranking. SVG boundary geometry solves `w·standardized(x)+b=0`, corresponding to probability 0.5. At zero weights there is no unique line. The probability estimates have not been assessed for calibration. Training uses one batch update per 180ms timer (500ms with reduced motion), capped at 1,000 updates and pauses on lesson changes. No animation starts automatically. Manual edits pause training and begin a new trace including the manual baseline.

Evaluation uses only validation records. Threshold is inclusive; top-K ties use record ID. Precision and recall return null when their denominators vanish and the interface says Undefined. Policy changes never update model parameters. Final test disclosure locks training and policies until reset. Repeated reset/test inspection is explicitly described as tuning, not unbiased assessment. Models and controls remain educational; this synthetic sample establishes no real operational performance.

Controls and the full ranked set share the primary panel. Record tables and mathematics are expandable. Native buttons, labels, selectors and inputs provide keyboard alternatives to visual inspection; point shapes redundantly encode labels. The server-rendered initial lesson and noscript explanation remain useful without JavaScript. On mobile training feedback stays above the chart; Evaluation places selected count, precision, recall and missed positives between its slider and ranked cards. Detailed mathematics and confusion counts remain expandable.

Validation: finite-difference checks cover every model weight and bias, loss reduction, deterministic replay, data/partition isolation, stable BCE, saturation, confusion counts, undefined metrics, threshold equality, K boundaries and stable ties. Browser journeys cover learning, pause/reset, example selection, policies, record disclosure, final-test lock and no-JavaScript reading. Screenshots and exact final results are recorded in the implementation handoff. The original three-lesson lab is deployed at commit `15fbb509136fd9bbdc6cda804b586cbce53046be` (PR #4). These subsequent guided UX refinements require review and are not deployed from the feature branch.

## Experiment state and visual learning

`experiment.ts` owns atomic model/counter/history transitions; `useLabExperiment` supplies the local session and timer. Linear and logistic models retain independent histories, rates and parameters through lesson navigation. Training and validation retain separate inspected record IDs. Evaluation shares the validation selection. Model reset affects the current model; the complete reset after test disclosure clears both models and policies. No browser storage is used. Hash links share individual lessons without changing multipage routing.

The Help button, Try this banners, guidance visibility actions/state and Guidance component have been removed from all three lessons. Training uses a compact toolbar and one status line: current step/objective and the actual absolute change from the preceding history entry. Initial and manual states are named explicitly; a manual baseline is never compared to an invented zero-model baseline. Continuous training turns off the live-region updates; pausing restores polite announcements. The 1,000-update stop remains explicit.

Each loss history includes its baseline and all updates. Its zero-based vertical bound retains the historical high and expands only if necessary. Near-control feedback compares the actual previous and current objective, including increases. Training initially shows all 54 training examples, with an optional validation view that does not alter model state or scaling. Boundary intersection distinguishes a constant probability, a visible line and a valid boundary outside the fixed feature window. Extreme regression predictions receive exact range text beside the fixed chart.

Numerical model implementation and its nine tests remain unchanged. Additional controller and geometry tests cover state continuity, reset scope, locks, atomic traces, boundary cases and honest loss changes. Browser coverage includes the 430-pixel mobile width in addition to existing Chromium/WebKit profiles; deep links, history, population switching and nearby Evaluation metrics are exercised. Representative screenshots and HTML reports are retained by Quality as a seven-day Actions artifact. Local before/after captures are ignored under `.local/ml-ux/`.

## Fictional task-review classifier

The unchanged deterministic classifier now has a coherent fictional interpretation: task complexity and information uncertainty, each scored 0–10, estimate whether additional review is needed. Positive outcomes mean **Additional review needed**; negative outcomes mean **No additional review needed**. These are invented scores and outcomes, not extracted operational variables or a deployed prioritization system. Linear regression keeps its separate task-completion-time example. Evaluation uses the same names in its inspector, record table, ranked-record descriptions and outcome legend; precision, recall and confusion-count definitions remain unchanged.

`presentation.ts` evaluates `probabilityAt(model, trainingScaler, x, y)` through the existing `probability` and `transform` functions. A fixed 25×25 SVG grid samples this function at the center of each tile over the raw 0–10 window. Tile colors are a muted neutral-to-green scale. The background is a piecewise-constant visual approximation; inspected records are evaluated at their exact coordinates, not at the nearest tile. The grid is memoized by current model identity; selection and population changes do not recompute it. There is no independent visualization model, timer or artificial animation.

At step zero every tile is 50% and the background is uniform, with no unique boundary. As weights and bias change, the probability field varies even if the dashed 50% line remains almost stationary. The line is the same zero-score geometry as before; it appears above the field and below observation markers. Shapes and text preserve outcome meaning independently of color, and a selector remains the keyboard alternative to clicking points. SVG titles/descriptions identify the synthetic scenario, current model estimates, and selection method. The legend distinguishes estimates from real-world calibration.

A compact read-only display exposes complexity weight, uncertainty weight and bias. Weights act on training-standardized scores. Linear regression instead shows slope in minutes per raw complexity point and intercept in minutes, using the same scaler conversion as its mathematical inspector. Advanced manual controls remain expandable, pause training, and start a new history at the actual manual baseline. Reset restores both model and visualization; lesson navigation preserves independent experiments. Final-test locks and decision policies retain their existing ownership and behavior.

The selected-task inspector shows the fictional outcome, named raw feature scores, current estimated probability of additional review, weighted score and expandable mathematics. Its estimate updates during training without requiring reselection. An extra sigmoid chart was deliberately omitted: the two-dimensional landscape and exact record calculation already show the relevant model changes.

### Numerical and behavioral verification

The dataset, learning-rate presets, training-only scaler, partitions and `models.ts` are unchanged. Recalculation at the default 0.05 learning rate gives:

| Updates | p at (2,2) | p at (8,8) | Training log loss |
| ------- | ---------- | ---------- | ----------------- |
| 0       | 50.0000%   | 50.0000%   | 0.693147          |
| 1       | 49.1458%   | 50.7318%   | 0.684007          |
| 11      | 41.4047%   | 57.3894%   | 0.606937          |
| 100     | 13.1777%   | 83.4273%   | 0.378922          |

These are regression reference values, not hardcoded display values. New numerical tests compare every grid tile with the existing model probability function, compare validation-record estimates at their exact coordinates, and cover zero, first, eleventh and hundredth updates. They also demonstrate different confidence with an identical boundary and verify that policy/selection/population changes preserve the model and field while manual edits and resets update them. Browser coverage checks loss deltas, displayed parameters, record estimates, boundary states, reset, manual editing, validation observations, policy independence, removal of Help, accessibility and overflow. Obsolete guidance-only assertions were removed while their independent-history and reset coverage remains.

## Dependency and delivery follow-up

The initial audit reported three findings (two moderate, one high) along the direct dev dependency Wrangler → Miniflare → Undici 7.29.1. The actual advisories are [EventSource resource exhaustion](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [SRI algorithm handling](https://github.com/advisories/GHSA-f72v-6w45-q472) and [content-encoding denial of service](https://github.com/advisories/GHSA-xjj6-f33q-929c). These affect HTTP tooling during development/deployment; Undici is not shipped in the static browser application. Tooling still processes remote HTTP, so the findings warrant fixing.

Wrangler 4.152.0 remains the current compatible release and pins the affected Miniflare dependency. A scoped `miniflare.undici` override selects patched 7.30.1, keeping its major version and the rest of the application dependencies intact. The resulting audit reports zero vulnerabilities. Remove the override when upstream pins a patched release. Do not use the audit suggestion to downgrade Wrangler to 4.35.0 or force unrelated upgrades.

The proposed deployment smoke check verifies the expected public commit marker, Lab HTML, referenced first-party CSS/JavaScript/SVG assets with content types, and a genuine custom HTTP 404. It runs only after an actual successful upload; stale-main skips do not run it. Verified-artifact reuse, main protection, production environment, scoped credentials and serialized deployment remain intact. Its failure reports a failed release verification; it does not automatically roll back or modify DNS. This new smoke step has not yet run in production.

Limits: independently synthetic fixtures, uncalibrated probabilities, fixed plotting axes with off-window explanations, and no evidence of operational generalization. Automated accessibility checks do not establish full WCAG conformance or installed Safari coverage. The final-test lock is instructional, not a security boundary; resetting does not make repeated test inspection unbiased.

## Historical local verification of the earlier refinement

Verified on October 24, 2026 with pinned Node 24.22.1 and a clean `npm ci`:

- `npm run verify`: passed type/content checks (zero errors/warnings), lint, formatting, 17 unit tests, draft-publication regression, static build/link/privacy checks, and all 196 browser checks.
- The nine original numerical tests and `models.ts` are unchanged. Six added controller/geometry tests and two smoke-check tests extend coverage.
- Seven browser profiles cover 390×844, 430×932, 768×1024, 1024×768 and 1440×1000. Chromium and WebKit include keyboard, automated accessibility, no-JavaScript and reduced-motion coverage. No application errors or horizontal overflow were observed in these journeys.
- Screenshot review covers all three lessons at all five viewport sizes, plus initial mobile and desktop states. Before/after phone and desktop captures remain local review evidence, not published website assets.
- `npm audit`: zero vulnerabilities after the scoped Undici patch. Wrangler's assets-only dry run and workflow validation pass; nothing was uploaded or deployed.
- The smoke function also passes against the locally built Lab HTML, five referenced assets and genuine preview 404, using an explicitly simulated commit-marker response. This is local integration evidence, not live edge verification. A post-deployment result remains pending an approved merge.

## Probability landscape verification

The probability-landscape update passes the complete `npm run verify`: zero type errors/warnings, lint and formatting, 24 unit tests, draft-publication safeguards, static build/link/privacy checks, and 245 Chromium/WebKit browser checks. The original mathematical implementation, fixtures, model tests, learning-rate choices and timer remain unchanged. The seven browser profiles retain no-JavaScript, keyboard, automated accessibility and reduced-motion coverage.

Before/after capture covers linear regression at zero and 11 updates, logistic regression at zero, one, 11 and 100 updates, and Evaluation in both engines at all five requested widths: 390, 430, 768, 1024 and 1440 pixels. Both 70-capture sets report no horizontal overflow. Phone axis text is larger; the compact probability legend remains outside the SVG. Dark outcome markers have at least 4.27:1 contrast against the probability-field colors. These checks do not replace manual assistive-technology or physical-device testing.

The fixed 625-tile grid adds no independent animation and is recomputed only when the model changes. Local interaction probes confirmed responsive repeated steps and live-region behavior (`off` while running, `polite` when paused). Performance measurements and screenshot comparisons are local review evidence, not professional-work performance claims. This branch requires review and does not deploy itself.
