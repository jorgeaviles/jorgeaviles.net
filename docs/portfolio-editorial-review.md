# C2/C3 professional narrative review

Baseline: `7c338f5` on main, after the production-readiness fix. This is an
editorial change, with one intentional research-route consolidation. No visual
redesign, new dependency, account change, merge or deployment is included.

## Findings and before/after examples

| Area                          | Before                                                                                                                                                                                   | After / reason                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research contribution         | “These are the paper’s methods, not a record of my individual technical tasks. The acknowledgment establishes research assistance; it does not establish that I implemented algorithms…” | “The 2014 study by Anand N. Asthana investigates machine-learning approaches to predicting cattle-ranch profitability in Latin America. I contributed research assistance to the project and am acknowledged as J. Avilés on page 478.” Name the author and contribution directly; the citation establishes attribution without a list of excluded tasks. |
| Research structure            | Overlapping current-work and professional-ML sections, plus an “On attribution” box                                                                                                      | Research background → published study and acknowledgment → progression toward analytical systems. Current professional modeling and the synthetic teaching Lab have separate links and descriptions.                                                                                                                                                      |
| About / CENTRUM               | “My documented research assistance is described separately from the paper’s authorship.”                                                                                                 | “My research assistance is acknowledged in a published 2014 study of cattle-ranch profitability.” Keep the role, dates and evidence; lead with the contribution.                                                                                                                                                                                          |
| About / career flow           | Separate employer accounts with little introductory connection                                                                                                                           | A short opening connects economics and research, banking data/business analysis, analytical infrastructure, experimental models and applications. The employer entries retain the actual roles and dates.                                                                                                                                                 |
| About / Santander             | “These roles brought together data quality, CRM and marketing data, and business analysis for capital technology projects.”                                                              | “Across three roles, I worked with enterprise-application data quality, CRM and marketing information, and business analysis for capital technology projects.” Describe the supported scope without adding systems, metrics or leadership.                                                                                                                |
| Data platform / collaboration | “Those contributions are separate from development: I did not design every upstream source system or independently administer the organization's Azure environment.”                     | “I designed and developed the analytical preparation and SQL access layers, coordinating with IT colleagues on scheduled source extracts, infrastructure access, and application permissions.” Give development ownership and collaboration specific, positive roles.                                                                                     |
| Audit Portal / experience     | “These are qualitative observations, not formal usability or performance studies. No measured productivity, financial, or predictive-accuracy improvement is claimed…”                   | “This qualitative experience informs continued interface refinement alongside departmental feedback.” Retain the qualitative basis; introduce no quantified outcome. Source review for document-informed answers remains explicit.                                                                                                                        |
| ML / candidate results        | “I do not present a verified winning model or comparative performance figures here…”                                                                                                     | “The reviewed notebook exports contain no execution outputs, so the candidate table describes implementation and configuration rather than a measured model ranking.” Keep the evidence boundary while explaining how to read the table.                                                                                                                  |
| ML / backtesting              | Repeated explanation that implemented routines do not establish completed backtests                                                                                                      | One program-level execution-evidence statement, followed by the separate fitting/calibration/test windows and their technical purpose. No completed evaluation or stable-performance claim is added.                                                                                                                                                      |
| ML / integration              | Repeated “not an implemented decision feature” phrasing                                                                                                                                  | Predictive-score integration is proposed and requires review, validation and approval. The label-name mismatch remains an explicit prerequisite to validating an end-to-end run.                                                                                                                                                                          |
| Work / framing                | Repeated disclosure that these are high-level accounts and internal details are unpublished                                                                                              | A direct link to the separate faculty-research narrative. Privacy is enforced in the actual content and publication checks rather than repeated as professional positioning.                                                                                                                                                                              |

## Accuracy review

- The [public professional profile](https://github.com/jorgeaviles/jorgeaviles)
  supports hands-on development across notebooks, data platform, experimental
  modeling and the Audit Portal; it also identifies departmental, university and
  IT contributions. Those roles remain distinct. No sole infrastructure ownership
  or management responsibility is added.
- The publisher’s [2014 paper](<https://www.idosi.org/gv/gv13(4)14/8.pdf>) was checked
  at its title/citation and page 478. Anand N. Asthana is the author. Page 478
  acknowledges J. Avilés for research assistance and describes random assignment
  into ten validation subsamples. Vector-space modeling and kernel ridge
  regression remain attributed to the study. No individual algorithm/programming
  contribution is inferred from that acknowledgment.
- Existing professional titles, employment dates, education content and credential
  links are preserved. The Santander account adds no named systems, results,
  dates, or leadership duties. The career connection is a narrative progression,
  not a claim of shared technologies across employers.
- The professional ML account retains the published implementation statuses:
  enabled Random Forest/fallback, disabled alternatives, conditional runtimes and
  unverified completed CatBoost evaluation. The public account of reviewed source
  is the basis; this editorial phase does not re-review private notebooks or add
  execution evidence.
- Preserve the populated-reduction-field target (including recorded zero), reviewed
  sample boundary, missing outcomes, fraud exclusion, leakage/point-in-time checks,
  grouped validation, calibration windows, time-based evaluation, drift limits,
  amount-weighted heuristic and unresolved label-name mismatch. These materially
  affect interpretation and remain substantive technical content.
- No winning model, numerical performance, savings, productivity gain or approved
  operational predictor is introduced. Existing operational-scale and budget
  context remain scoped as before; they are not presented as project outcomes.
- The Lab and its synthetic-data disclosures, fixtures and calculations are
  unchanged. Professional and academic work are connected by career interests,
  not presented as the implementation behind the teaching demonstration.

## Navigation and canonical destination

The older `/work/applied-predictive-research/` account repeated the faculty
background and acknowledgment already covered on `/research/`. Its substantive
content is now consolidated there. The three primary professional projects keep
their existing Work/Home order and related-project navigation.

`public/_redirects` permanently maps the old slash, non-slash and `index.html`
paths to `/research/`. Astro emits an immediate meta-refresh fallback with a
canonical link and readable destination link. The old URL is excluded from the
sitemap; `/research/` remains the canonical indexed destination. Ordinary page
routing remains static and multipage.

The build verifier checks the redirect rules, fallback, canonical and sitemap.
The browser suite follows the fallback and checks the destination. Local Wrangler
static-assets testing returned HTTP 301 for all three path forms and preserved
`?ref=old-link` on the redirected URL. This verifies the local host implementation,
not the undeployed production rule. Check live HTTP status and Location after an
owner-approved merge/deployment; no DNS or account change is required.

## Review and verification

Before/after full-page evidence is retained in ignored `.local/editorial-c2c3/`.
Review covers Home, About, Work, Research, all three professional case studies,
and the unchanged Lab in Chromium and WebKit at 320, 390, 768 and 1440px.
Changed paragraph lengths and the consolidated Research page intentionally change
page height. Typography, gutters, figures, education and the responsive layout
remain established design elements; exact full-page equality is not an editorial
acceptance requirement.

The existing checks remain the release gate. Tests asserting superseded defensive
sentences are updated to assert the revised attribution, experimental status and
proposed integration; mathematical, accessibility and layout checks stay intact.

The visual audit helper now lists meta-refresh documents separately from page
compositions, so the redirect fallback is checked as navigation rather than
incorrectly treated as a full content page. Its redirect and canonical contracts
remain covered by the build and browser checks.

### Recorded results

- `npm run verify` passed: 27 unit tests, publication regression, build/link/privacy
  checks and 361 browser tests; 10 duplicate-capture configurations intentionally
  skipped. The retired page's content assertions are replaced by explicit
  redirect/navigation checks, rather than treated as an independent case study.
- All 224 broad visual-audit captures passed overflow, H1, hidden skip-link and
  legacy-class checks. The manifest records 11 content routes and one redirect.
- The focused gallery contains 64 before/after pairs across eight pages and four
  widths in both engines. Heading font sizes and body font families match. All
  eight Lab reference images have identical hashes. Education source and scoped
  styles are unchanged; copy changes above it naturally move its page position.
- Narrow-table clipping flags resolve to the existing visually hidden table-header
  group; row labels and accessible table relationships remain tested. No new
  clipped-content defect or design correction was identified.
- Added-line secret/private-path scanning and diff checks passed. The whole-file
  scan also matched the existing private-key detection expression in the build
  verifier; inspection confirmed that it is a scanner signature, not a key.
