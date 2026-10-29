# Architecture

This is a static professional website. Astro renders ordinary pages and MDX content at build time; Cloudflare Workers Static Assets serves `dist/`. There is no application server, Cloudflare SSR adapter, Worker fetch handler, database, or authentication. Optional Cloudflare Web Analytics is an edge-managed browser beacon, not a backend or an analytics dependency in the build. Activation follows the disclosure-first procedure in [deployment.md](deployment.md#web-analytics-activation).

## Editing and presentation

- Site identity, canonical URL, and contact links live in `src/config/site.ts`.
- Schema-validated content collections keep work, research, and lab prose separate from layouts. Public listings and generated routes exclude drafts.
- Shared Astro layouts provide metadata, navigation, readable typography, and accessible page structure.
- Tailwind uses its Vite integration. System fonts and local assets avoid external font and image dependencies.
- React hydrates only the lab demonstration on page load. The rest of the site and the initial lab explanation and regression plot remain useful without JavaScript.
- The lab uses deterministic synthetic data and pure TypeScript numerical modules. It presents an educational example with actual browser-local training rather than measured operational performance.

The public-source boundary applies to every committed file, including unpublished drafts and documentation. Public professional descriptions must remain modest and source-backed. Research assistance must not be presented as authorship. Licensing of writing, identity, and source code remains undecided; no blanket license is asserted.

## Hosting and verification

`wrangler.jsonc` explicitly names the asset directory and uses `404-page` routing. Missing URLs receive the built `404.html` with an HTTP 404 instead of an SPA fallback. Version preview URLs are disabled.

Domain setup is separate from code delivery: the apex Worker Custom Domain is dashboard-managed, and Wrangler intentionally defines no domain routes. This keeps DNS editing out of ongoing CI permissions. An Individual Workers Editor token has been scoped to `jorge-aviles-site`; a production deployment with that narrowed token succeeded, and the temporary bootstrap token was revoked. The dashboard also holds the canonical redirect and a hostname-scoped Disable RUM rule to prevent Cloudflare's automatic browser-analytics injection. Domain and permission checks are recorded in [verification.md](verification.md).

The owner authorized preparing free Web Analytics on 2026-10-28. The existing
Disable RUM rule remains in place until the updated Colophon is published.
Activation should permit only the public apex hostname and exclude EU visitors
using Cloudflare's supported automatic setup. The verification hostname, local
preview and build output remain beacon-free. Do not add a second manual snippet,
custom events, session replay, or Lab-input reporting. Local no-third-party-request
tests remain strict; they do not prove the live edge analytics configuration.

GitHub Actions is the sole production deployment authority. Its Quality job runs type/content checks, lint, formatting, unit tests, a production build, and browser/accessibility tests. Chromium and WebKit cover desktop and narrow mobile viewports. This does not establish installed Safari coverage or full WCAG conformance.

The successful job uploads its verified `dist/` as an immutable artifact. A separate dependent Production job restores that artifact instead of rebuilding. A commit marker in `deployment.json`, the Actions run, and Wrangler's deployment message identify the source commit. After an upload, a read-only smoke check verifies commit provenance, Lab HTML/assets and the custom HTTP 404. Browser reports and representative screenshots are saved separately for review. Production concurrency and a fresh main-branch check prevent stale queued runs from replacing a later release. The production gate is enabled, and its GitHub environment is restricted to `main`. Branch protection requires a pull request and the successful Quality check. `npm run deploy` requests this workflow for remote `main` through GitHub CLI; it never deploys local files. Rollbacks follow the same checks through a revert pull request; see [deployment.md](deployment.md).

## Deliberate limits

Contact is a `mailto:` link. No resume control appears until an approved public file exists. PR preview deployments, a CMS, feedback storage, custom event telemetry, and external AI features are deferred. These limits keep maintenance and external permissions small while leaving room to add reviewed content.

The hosting configuration follows Cloudflare's [static generation and custom 404 guidance](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) and [Worker Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) architecture. Local preview, hosted checks, and live edge verification remain distinct evidence.

## Portfolio assistant foundation (inactive)

The separate `workers/portfolio-api/` Worker is the reviewed boundary for a future
public-content assistant. It is disabled and unrouted by default; it does not change
the static asset Worker or its release workflow. See [the assistant design](portfolio-assistant.md),
[separate setup instructions](portfolio-assistant-operations.md), and
[future stateless MCP plan](portfolio-mcp-plan.md).
