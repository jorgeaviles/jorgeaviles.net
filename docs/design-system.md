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
