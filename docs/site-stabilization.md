# D3 stabilization audit

Baseline: D2 production revision `40fe88e6cb7ce22dfc199a239f6f696f343f46ae`.
The deployed provenance file and the post-merge Quality/Production jobs agreed.
D3 is one independent PR into main; merge and production deployment remain owner actions.

## Findings and decisions

| Finding                                                         | Classification / severity            | Evidence and treatment                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nine superseded Lab selector families                           | Maintenance / low                    | No exact class-token references in active Astro, TS, TSX or MDX source, or built JavaScript. None appeared in the 238 baseline runtime captures, including training, expanded disclosures, record selection, threshold and locked assessment. Removed base and mobile rules only.                                                   |
| Repeated mono font stack, muted color and structural rule width | Maintenance / low                    | Two identical font stacks now share `--font-mono`; work-number color uses existing `--muted`; line-colored 1px rules use existing `--rule-width`. Values unchanged.                                                                                                                                                                 |
| Skip link sometimes overlays screenshots                        | Intentional / informational          | Hidden above the viewport in all unfocused captures. Keyboard focus makes it visible; Enter focuses main and hides it again. Regression test now checks both hidden states. No visibility change needed.                                                                                                                            |
| Wide Lab workspace versus capped editorial prose                | Intentional / informational          | Keep 1120px page shell, 690px reading measure and independent Lab breakpoints. A numerical workspace and prose have different reading needs.                                                                                                                                                                                        |
| Large mobile Evaluation height                                  | Intentional / informational          | All 18 records remain readable; policy selection, inspected record and keyboard focus retain separate meanings. No compression.                                                                                                                                                                                                     |
| Different page lengths and footer positions                     | Intentional / informational          | Footer follows content; About and technical studies are longer than Contact/404. No forced equal heights or decorative containers.                                                                                                                                                                                                  |
| Native Safari 200% zoom                                         | Verified sample / informational      | Isolated local baseline window; Page Menu confirmed 200%. Training button operated, Step 1 feedback and parameters updated, controls/text remained readable. Restored and confirmed 100%, closed temporary window. This is a Lab sample, not a claim of all-route native zoom coverage.                                             |
| Native 400% zoom and VoiceOver announcements                    | Unverified / medium verification gap | Safari Page Menu offered 50–300%, not 400%. Automated 320px reflow supplies the 1280px/400% equivalent, not native zoom. Accessibility-tree inspection exposed headings, descriptions, numerical loss values and named controls, but does not prove VoiceOver speech or rotor behavior. Manual checklist below remains outstanding. |

No confirmed visual defect justified a redesign. C2/C3 remain deferred.

## Before/after inventory

| Category         | Baseline                                                                                                                                      | D3                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Colors           | Six foundation roles, prose/focus roles; scoped hover, selection, diagram palettes                                                            | Same semantic values; one duplicate muted literal replaced; unused Lab-only literals removed |
| Typography       | Sans/serif theme stacks; two identical long mono stacks; shared body/support/metadata/heading roles                                           | One shared mono stack; all sizes, line heights and weights preserved                         |
| Spacing          | Eight shared space tokens plus component-specific geometry                                                                                    | Unchanged; legacy Lab spacing removed with unused selectors                                  |
| Widths           | Page 1120px, prose 690px, sidebar 220px, editorial gap 48px, responsive gutters                                                               | Unchanged                                                                                    |
| Borders          | Shared 1px rule token, repeated structural 1px literals, scoped controls/chart strokes                                                        | Line-colored structural rules consume token; meaningful chart/control differences retained   |
| Responsive       | Home, editorial, education and Lab thresholds have separate ownership                                                                         | Active queries unchanged; obsolete mobile Lab overrides removed                              |
| Unused selectors | `lab-intro`, `synthetic-label`, `lab-panel`, `lab-control`, `lab-metrics`, `lab-metric`, `lab-table-wrap`, `lab-record-id`, `lab-explanation` | Removed after source, built-JS and interactive checks                                        |

Do not merge similarly numbered media queries merely because their thresholds
match: they may own different components. Diagram colors, coordinates, strokes,
small label sizes, action radii and local spacing remain local when their roles
differ. About's scoped education styles and all content/credential links are unchanged.

## Reproduce the visual baseline

Use the Node version in `.nvmrc`, `npm ci`, and
`npx playwright install chromium webkit`. Build and serve each revision separately.
Do not compare screenshots generated with different browsers, fonts or platforms.

```sh
npm run build
npm run preview -- --port 4334 --ignore-lock
# In another terminal:
node scripts/audit-visual.mjs --url http://127.0.0.1:4334 --out .local/site-d3/after
```

For an archived baseline served on 4335, pass `--dist` and `--css` pointing at its
built output and stylesheet, and `--out .local/site-d3/before`. Add
`--reference .local/site-d3/before/manifest.json` to the candidate run for exact
PNG hash comparison. The command discovers all built HTML routes, captures each
at 320/390/430/768/1024/1280/1440px in Chromium and WebKit, then captures five
additional Lab states per viewport/engine: both models at step 11 with expanded
details, review-budget selection, probability threshold, and locked assessment.
It saves 238 PNGs and a manifest with colors, tokens, queries, model values,
rankings, hashes, overflow, H1 counts, skip-link bounds and legacy-class usage.
Failures or changed screenshots return a nonzero exit status. Inspect differences;
do not automatically replace a baseline just to obtain a pass.

Full-page captures eagerly decode images and expand viewport height before
capture to avoid offscreen paint omissions. They assess width, not fixed-height
viewport usability; ordinary-height keyboard/control tests remain separate.
Evidence belongs in ignored `.local/` or CI artifacts, never in public content.
Existing browser tests cover neighboring layout widths, focused states, no-JS
content, reduced motion, enlarged text, charts, model results and final-test locks.
Run `npm run verify` before publication; this audit supplements that gate.

## Remaining manual accessibility check

- In native Safari, check Home, About, a long study and all Lab lessons at 200%;
  test actual 400% in a browser that supports it, starting at a 1280px viewport.
  Navigate, expand details, select records and lock/reset the experiment. Essential
  content should require only vertical page scrolling.
- With VoiceOver, follow headings and landmarks, use the skip link, enter/leave
  lesson navigation, and operate sliders, selectors and disclosures. Confirm
  names, current values, selected/inspected distinctions and locked-state notices
  are useful when spoken.
- Read both plots through their descriptions and numerical alternatives. Confirm
  feature values, predictions, losses, outcomes and held-out qualifiers remain
  understandable without colors or SVG graphics.
- Restore zoom and accessibility settings after checking. Record browser/OS,
  actual zoom, route/state and results; do not mark these checks passed from an
  automated WebKit run or an accessibility-tree snapshot alone.

## Recorded D3 result

The same-machine comparison produced **238 identical PNG hashes out of 238**,
with zero page-overflow findings and one main H1 per capture. All recorded
training feedback, model parameters, loss descriptions, probability-field values,
metrics and record tables matched the D2 baseline. No active Lab component,
calculation, fixture, content, credential, dependency or workflow file changed.
The stylesheet inventory moved from 1,977 to 1,821 lines; line count is evidence
of scope, not a quality target. Complete local before/after PNGs, manifests and a
side-by-side gallery are retained under ignored `.local/site-d3/`.

`npm run verify` passed: 24 unit tests, publication regression, build/link/privacy
checks and 368 browser tests; 10 duplicate-capture configurations intentionally
skipped. Changed-file secret/private-path review and `git diff --check` passed.
