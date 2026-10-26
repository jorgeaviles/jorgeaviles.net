# Visual responsibilities

Preserve the paper background, serif headings, sans-serif body, muted green,
restrained rules, static page routing, and meaningful diagrams. Shared rules
express a common purpose; they do not require identical layouts.

`src/styles/global.css` owns foundational palette, focus, spacing, reading/page
measures, typography roles, and editorial layout tokens. Tailwind palette names
alias the root palette rather than duplicating its values. Component-specific
values remain local until a repeated purpose justifies sharing them. The initial
foundation maps roles to the existing appearance; later readability changes are
reviewed separately. The compact spacing scale is a vocabulary, not a mandate to
round every value.

Intentional differences:

- Home display typography and composition remain distinct from prose.
- Major page sections differ from article subsections and metadata.
- Education entries remain borderless. Provider marks retain their proportions;
  credentials use underlined titles without arrows. DataCamp columns depend on
  their container exceeding 520px, not a viewport breakpoint.
- Navigation/action links can use arrows; inline links and credentials need not.
- Editorial tables need readable relationships; Lab tables keep their workspace
  density and numeric alignment.
- Lab charts, controls, probability colors, and diagram geometry stay scoped.

Baseline and broad review captures belong in ignored local evidence or CI
artifacts, not a second committed image gallery. Record the source revision,
browser, viewport, and limitations. WebKit automation is not native Safari
verification. Check neighboring widths when changing a breakpoint; a passing
no-overflow assertion alone does not establish readable composition.

## Responsive reading contracts

Page gutters vary continuously from 20px to 56px. Editorial prose has a 690px
maximum measure. The 220px sidebar appears above 1100px, with a 48px gap; below
that width it follows the reading column. At the transition the capped reading
column already fits beside it, so it does not suddenly shrink. Education and
Lab keep their independent layout thresholds.

About's major-section headings use the section role; case-study subsections
retain the article role. Prose uses 16px body text, sidebar supporting text 14px,
and the research attribution marker 12px. These are scoped roles, not a global
resizing of every label or chart.

`ArticleTable.astro` renders native table headers and row headers from one set of
content-owned rows. Below 761px each candidate becomes a vertical record with
visible field labels; explicit table roles preserve its relationships when CSS
changes the display. This avoids the hidden status text and inconsistent native
keyboard scrolling found when comparing a horizontal-scroller prototype. The
pattern does not target Lab tables. Work listing headings use H2 on the index
and H3 under Home's Selected work section, with the same visual title class.

## Stabilization reference

See [the D3 findings and repeatable audit](site-stabilization.md) before changing
shared roles or removing selectors. The visual audit supplements `npm run verify`
with all-route, seven-width, two-engine captures. Preserve intentional differences
and inspect source plus built JavaScript and interactive states before treating
CSS as unused. Native zoom and spoken screen-reader checks have separate evidence
requirements.
