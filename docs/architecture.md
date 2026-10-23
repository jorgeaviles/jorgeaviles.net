# Architecture

This is a static professional website. Astro renders ordinary pages and MDX content at build time; Cloudflare Workers Static Assets serves `dist/`. There is no application server, Cloudflare SSR adapter, Worker fetch handler, database, authentication, or analytics service.

## Editing and presentation

- Site identity, canonical URL, and contact links live in `src/config/site.ts`.
- Schema-validated content collections keep work, research, and lab prose separate from layouts. Public listings and generated routes exclude drafts.
- Shared Astro layouts provide metadata, navigation, readable typography, and accessible page structure.
- Tailwind uses its Vite integration. System fonts and local assets avoid external font and image dependencies.
- React hydrates only the lab demonstration on visibility. The rest of the site and the initial lab explanation/table remain useful without JavaScript.
- The lab uses deterministic synthetic data and a pure TypeScript calculation module. It presents an educational example rather than measured model performance.

The public-source boundary applies to every committed file, including unpublished drafts and documentation. Public professional descriptions must remain modest and source-backed. Research assistance must not be presented as authorship. Licensing of writing, identity, and source code remains undecided; no blanket license is asserted.

## Hosting and verification

`wrangler.jsonc` explicitly names the asset directory and uses `404-page` routing. Missing URLs receive the built `404.html` with an HTTP 404 instead of an SPA fallback. The initial configuration has no custom-domain routes; version preview URLs are disabled.

GitHub Actions is the sole production deployment authority. Its Quality job runs type/content checks, lint, formatting, unit tests, a production build, and browser/accessibility tests. Chromium and WebKit cover desktop and narrow mobile viewports. This does not establish installed Safari coverage or full WCAG conformance.

The successful job uploads its verified `dist/` as an immutable artifact. A separate dependent Production job restores that artifact instead of rebuilding. A commit marker in `deployment.json`, the Actions run, and Wrangler's deployment message identify the source commit. Production concurrency and a fresh main-branch check prevent stale queued runs from replacing a later release. `npm run deploy` requests this workflow for `main` through GitHub CLI; it never deploys local files. Deployment remains disabled until explicit production setup is completed; see [deployment.md](deployment.md).

## Deliberate limits

Contact is a `mailto:` link. No resume control appears until an approved public file exists. PR preview deployments, a CMS, expanded research demonstrations, and telemetry are deferred. These limits keep maintenance and external permissions small while leaving room to add reviewed content.

The hosting configuration follows Cloudflare's [static generation and custom 404 guidance](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/). Domain routing will use [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) after the initial workers.dev release is verified.
