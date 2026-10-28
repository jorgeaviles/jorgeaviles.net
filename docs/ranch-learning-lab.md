# Ranch Learning Lab

## Instructional revision

Follow-up baseline: merged ranch Lab, main `75903d0`. Preserve the generator,
72/18 partition, fitting schedules, fold membership and fold-local preprocessing.
The changes are instructional: each lesson presents a question, a brief action,
an adjacent result and a visible one-sentence takeaway. One optional disclosure
per lesson combines training, mathematics and record/metric inspection.

Evaluation starts with a non-interactive illustration of one training/check round.
“Run five validation checks” computes all five actual fits once. All five scores
and correct/count totals appear together. Round buttons inspect saved results;
they never run another fit. The headline pools the out-of-fold predictions, so
all 72 development ranches count once. The previous arithmetic mean remains in
technical details, explicitly distinguished from the pooled score.

Only after validation does Stage 2 appear, with a one-time test on the 18 untouched
ranches. Fresh fits remain independent of Lesson 2 sliders and exploratory training.
The final-test guard locks validation/test actions, not the prediction lessons.
“Reset validation exercise” clears only validation/final results and selection;
it preserves the exploratory models and inputs. Resetting replays the same seeded
teaching exercise, not a new independent test dataset.

Before screenshots are the merged PR #31 evidence in ignored `.local/ranch-lab/after`;
new captures and comparison are in `.local/lab-instruction/`. Manual novice usability
timing, native Safari zoom and spoken VoiceOver are not established by browser tests.

## Original architecture review (before initial implementation)

Baseline: main `0485838`. Keep static Astro and one React island. Reuse the pure
batch gradient, stable sigmoid/BCE, training-only standardization, hash navigation
and loss-history chart. Replace the audit fixtures, review-policy ranking UI and
record inspector. No charting, ML, state-management or server dependency is needed.

One seeded generator supplies 90 ranches with cattle sold, feed cost, annual dollar
profit and a binary label equal to profit > 0. Only cattle count and feed cost are
inputs; regression uses cattle alone. Dollars are converted to fixed $100,000
units for stable optimization and converted back for every displayed prediction.

A deterministic stratified split supplies 72 development and 18 final-test ranches.
Five stratified folds cover development only. Each fold gets a fresh zero-initialized
logistic model and a scaler fitted exclusively on its other four folds. All folds
use the same fixed batch-gradient schedule. The final action fits a fresh model on
all development records and evaluates the test partition once. Lock validation
and final testing afterward; an evaluation reset restores its pre-test state. Hypothetical
input inspection remains available without changing fitted models.

Keep three hash-linked lessons: predict profit, predict profitability, test
predictions. Both prediction lessons start fitted. Sliders and a plain-language
result lead; optional training and mathematical disclosures follow. Evaluation has
one run button, five inspectable fold blocks, accuracy, and a separate held-out-test
action. Details hold the confusion counts/precision/recall and alternative validation
concepts. There are no algorithm, dataset, metric, threshold or review-budget choices.

On phones, keep a brief introduction and three compact, wrapping links with ≥44px
targets. Controls precede the plot in reading order; desktop may place them beside
it. Numeric HTML predictions, record selection, named SVGs, keyboard focus, quiet
live announcements and reduced-motion behavior remain required. All model/data
calculations stay in pure TypeScript. Before/after evidence stays ignored locally.

## Synthetic assumptions and features

The generator uses the existing seeded linear-congruential PRNG (seed 42). Cattle
sold are integers 50–500; feed cost per animal is an invented $400–$1,400. Annual
profit is rounded to dollars:

`cattle × (1850 − feed − 500 + priceVariation) − 90000 + operatingVariation`

Price variation is uniform ±$150 per animal; operating variation is uniform
±$40,000 per ranch. The $1,850 sale amount, $500 other variable cost and $90,000
fixed cost are invented teaching assumptions, not economic benchmarks. Features
omit prices, operating variation and costs beyond feed, so neither ranch size nor
the visible feature pair perfectly determines profit. Classification is exactly
`profit > 0`. No profit, sign, profitability label or target-derived statistic is
included in inputs. Regression uses only cattle count; classification uses cattle
count and feed cost. Dollars are converted to fixed $100,000 units for MSE training
and back to dollars for predictions. This is a unit conversion, not a learned
transformation fitted on target observations.

The fixed split shuffles each class with independent seeds and sets aside 18
ranches in approximately the source class proportions. No fit, exploratory plot,
loss trace or validation score uses those test records. As with any client-side
synthetic demonstration, records are downloadable source material, not a security
secret. "Untouched" describes their exclusion from fitting and model selection.

Stratified folds have sizes 15, 15, 14, 14 and 14. Each gets a new zero-initialized
model and an input scaler fitted only to its other four folds. Linear regression
uses 200 batch steps and logistic regression 600, both at learning rate 0.08 on
standardized inputs. The reused stable sigmoid, softplus BCE and analytical
MSE/BCE gradients perform actual learning. Automatic exploration stops at 1,500
updates, on lesson changes, or when the disclosure closes.
No training or animation starts automatically. The default fitted history includes
the actual optimization steps from zero; it is not a decorative curve.

Validation/final fitting follows a fixed schedule independently of the optional
exploration controls. The headline validation accuracy pools all 72 held-out
predictions; technical details retain the unweighted mean of fold accuracies
(fold sizes differ, so these are not interchangeable). Accuracy,
confusion counts, precision and recall are computed at a fixed 50% cutoff; a
zero denominator yields an explicitly undefined precision/recall. No metric value
is stored in UI copy. The final action fits a fresh full-development model and
assesses the 18 test ranches once. An evaluation reset clears validation and
final results without resetting exploratory models. Navigation, input changes
and exploratory training do not modify saved results or repeat the final test.

## Intentional removals and preservation

Removed audit-review fixtures, separate 54/18/18 populations, review-budget and
threshold policies, ranked records, manual coefficient editing, learning-rate
choices and the old record inspector. The low-level numerical engine, React
reducer/effect lifecycle, hash anchors and loss-history SVG remain reusable.
The primary UI contains one plot and prediction controls, or five folds and one
validation action. Technical details use disclosures rather than extra lessons.

Research receives only a contextual Lab link. Home, About, Work, credentials,
professional claims, global design tokens, navigation and footer are outside this
change. The production smoke check's expected Lab heading changes with the new
heading; its exact commit, asset, MIME, 404, retry and deployment gates stay intact.

## Verification and evidence

Unit tests cover deterministic targets/splits, feature leakage, finite predictions,
finite-difference gradients, real loss reduction, independent fits, fold coverage,
fold-local preprocessing under held-out feature perturbation, manual confusion
counts, averaged fold scores, seeded reference predictions, untouched final-test
partition, controller updates, lock/reset behavior and preserved anchors.

Browser tests cross-check displayed predictions and validation scores against the
pure numerical implementation; they exercise keyboard/range input, fold selection,
record inspection, automatic training/pause, disabled states, no-JS explanation,
seven-width layouts and 200% HTML text resizing. The all-route audit script captures
new Lab states; a baseline checkout captures the legacy UI separately. Rebuild and
serve baseline/candidate with independent dependencies/caches for reliable evidence.
Expected changes include fitted initial models, earlier controls on phones, a
shared ranch example and a much shorter evaluation lesson. Screenshot hashes should
change for this intentional redesign. Large galleries remain in ignored `.local/`.

Native Safari zoom and spoken VoiceOver announcements require separate manual
verification; automated WebKit and text enlargement do not establish those results.

The fixed-cost assumption was chosen so that cattle volume and feed expense both
have a visible role in the classification lesson. It was not chosen to maximize
a validation score, and is not an industry estimate.

## Initial ranch-redesign review (PR #31)

- `npm run verify` passed: 24 unit tests, draft-publication regression,
  build/link/privacy checks and 338 browser tests; five duplicate About screenshot
  configurations intentionally skipped. Audit-specific model-state tests were
  replaced with ranch-specific invariants and deterministic reference checks.
- Chromium and WebKit passed the seven requested widths, keyboard inputs, fold
  inspection, automatic-training pause, final-test lock/reset and 200% HTML text
  enlargement at 320px and 640px. Axe checks passed in default and expanded states.
  The no-JavaScript fallback is visible and inactive sliders remain disabled.
- The before checkout captured 154 legacy states. The after audit captured 350
  views (210 Lab states plus the other content routes), with zero page overflow,
  one main H1, hidden unfocused skip links and no legacy-class usage. The ignored
  comparison gallery pairs new views with the nearest legacy state; new validation
  functionality is explicitly identified as a replacement, not a pixel-equivalence
  comparison. Representative complete phone and desktop screenshots were reviewed.
- At 390px the first input appears about 486px from the top of an ordinary-height
  viewport. Default lesson navigation occupies one compact row. Labels and tap
  targets remain readable; fold blocks and navigation wrap at enlarged text sizes.
- The non-Lab CSS sections compare byte-for-byte with baseline. Home, About, Work,
  Education/credential content, identity, dependency lockfile, redirects and the
  deployment workflow have no changes. The Research edit is one contextual link.
- Changed-file secret/private-path review and `git diff --check` passed. There is
  no internal agency data/code, published-study dataset or new professional claim.
- Native Safari zoom and spoken VoiceOver have not been verified for the redesign.
  Before release, a manual check should operate all sliders/folds and disclosures,
  confirm useful announcements and focus order, and inspect native 200%/400% zoom.
  Automated WebKit/text enlargement are reported separately from those checks.

## Instructional revision verification

- `npm run verify`: 24 unit tests and 338 browser tests; five duplicate About
  screenshot configurations intentionally skipped. Math/leakage tests remain;
  added assertions distinguish pooled accuracy from the fold mean, round
  inspection from computation, and saved evaluation from exploratory training.
  Focus moves to the first completed score after running and back to Run after
  resetting, without stealing focus when navigating to saved results.
- Browser checks verify all five scores without a disclosure, hidden final-test
  stage until validation, preserved results after training both prediction models,
  evaluation-only reset, keyboard/focus, one disclosure per lesson, readable charts,
  seven widths and 200% HTML text reflow at 320px and 640px.
- The visual audit captures 350 route/state views in Chromium and WebKit,
  including 210 Lab states. No page overflow; non-Lab screenshot hashes match
  the merged ranch baseline. Representative complete phone/desktop states reviewed.
- No new data assumptions, training schedule, feature, partition, dependency,
  route, professional claim, credential or deployment change. The only numerical
  addition aggregates existing out-of-fold predictions into pooled metrics.
- Changed-file privacy/secret review and `git diff --check` passed. Native Safari
  zoom, spoken VoiceOver and timing with actual first-time visitors remain manual
  checks; automated tests do not demonstrate the five-/ten-second usability goal.
