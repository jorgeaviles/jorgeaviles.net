# Portfolio API setup and release checklist

This documents future owner-reviewed setup. The initial PRs create no Cloudflare
resources, change no DNS, install no credentials, and deploy nothing. The API is
disabled and has no public route; the existing asset workflow remains the sole
static production deployment authority.

## Private setup record and credentials

Keep account ID, token references, local test responses, selected namespace IDs,
release commit/hash, dry-run output, and dashboard evidence in ignored
`.private/portfolio-assistant/`. Never put secrets in `PUBLIC_*` variables, source,
Wrangler JSON, PR text, screenshots, or browser bundles. Do not reuse the existing
static site's narrowly scoped deployment token or broaden it.

When a separate API release is authorized, use Cloudflare's documented Workers
deployment permissions and account-scoped Workers AI binding access. Store a
separate least-privilege token in the chosen protected release environment, not
in this repository. Use Wrangler login locally only for deliberate account work.
No API key for a third-party model provider is needed. No credentials are needed
to run local mocked tests or the dry-run bundle check.

## Dashboard and staged activation

1. Confirm Workers and Workers AI remain on Free, with no prepaid AI Gateway credits
   or paid fallback. Check current model availability in the account. Revisit
   model terms before use; this project grants no blanket third-party license.
2. Review and publish the Colophon's assistant privacy disclosure through the
   existing static-site release workflow. Confirm the live page, not just a merge.
3. Create a separate Worker named `jorge-aviles-portfolio-api` from the API config.
   Keep `ASSISTANT_ENABLED=false`, no workers.dev or preview URL, and no routes.
   Bind `AI` to Workers AI; no AI Gateway, caching, prompt logging, or storage.
4. Reserve unused rate-limit namespace IDs in the account, adjusting the two sample
   numeric IDs in the API configuration before release if they conflict. Bind
   `REQUEST_LIMITER` (5/60s) and `INFERENCE_LIMITER` (20/60s). These bindings are
   configured through Wrangler, not the analytics dashboard. Keep observability off.
5. Run the documented live acceptance set privately before public activation,
   with a temporary test setup that is removed afterward. Do not weaken production
   CORS for local testing. Record model relevance and failures; tests are not proof
   of live behavior. Do not submit actual agency/private data to test privacy.
6. Before any domain work, inspect current state, save an ignored private DNS
   snapshot, and identify protected MX/TXT/DKIM/DMARC records. Future API Custom
   Domain proposal: `portfolio-api.jorgeaviles.net`, targeting only the API Worker.
   Never attach it to the static asset Worker or configure a zone-wide route.
   Compare protected mail records afterward. Domain work is a separate release action.
7. With disclosure live and checks satisfactory, enable the API variable and then
   publish the static site's explicitly configured API URL. Do not set up automatic
   API deploys from arbitrary branches, bypass static provenance gates, or run the
   static `npm run deploy` command expecting it to deploy the separate API.
8. Verify one submission → at most one inference, cited answers, 400/403/429/503
   handling, disabled retry behavior, and no prompts in logs/analytics. Check static
   `/deployment.json`, unrelated routes, verification hostname, and Lab still work.

Rollback: set `ASSISTANT_ENABLED=false` first, then remove the UI endpoint in a
normal static release. Visitors retain links to Work, About, and Research. Do not
modify email, analytics, existing static asset config, or other Workers.

## Future API release automation

There is deliberately no deployment workflow for the API in these PRs. A future
owner-approved release task should add a manual, protected, main-only workflow
that reruns verification, checks that the Worker index matches the tested source,
saves a bundle and index hash, checks remote main immediately before upload, and
uses a dedicated credential and environment. Capture the deployed API version and
run bounded smoke tests. Do not add the API to the existing static artifact job
or allow a PR event to deploy it.
