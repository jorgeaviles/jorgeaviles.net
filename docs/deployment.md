# Deployment

## Current state

The public source is [jorgeaviles/jorgeaviles.net](https://github.com/jorgeaviles/jorgeaviles.net). The owner directly authorized publication and free-tier Cloudflare setup. Hosted Quality checks and the initial Workers Static Assets release have passed. Current release, domain, credential-cleanup, and DNS-comparison evidence is recorded in [verification.md](verification.md).

| Setting                | Configured value                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical site         | `https://jorgeaviles.net`                                                                                                                                             |
| Dedicated Worker       | `jorge-aviles-site`; static assets from `./dist`, real 404 page                                                                                                       |
| Verification host      | `https://jorge-aviles-site.sax-hefts-5e.workers.dev`; serves host-specific `X-Robots-Tag: noindex`                                                                    |
| Version preview URLs   | Disabled                                                                                                                                                              |
| Deployment gate        | Repository variable `ENABLE_PRODUCTION_DEPLOY=true`                                                                                                                   |
| Production environment | Custom deployment-branch policy allows only `main`; no second approver required                                                                                       |
| Main protection        | Pull requests and successful `Quality` from GitHub Actions; up-to-date branch, administrators included, conversation resolution required, no force pushes or deletion |
| Deployment credential  | Account-owned token with Individual Workers Editor scoped only to `jorge-aviles-site`; no DNS or email permissions                                                    |
| Domain configuration   | Dashboard-managed apex Worker Custom Domain; website-only canonical redirect; HTTPS and redirect behavior live-verified; see verification                             |

Test jobs have read-only repository permissions. Workflow token defaults are read-only, with pull-request approval disabled. No Workers Builds, Cloudflare Pages, or GitHub Pages deployment is configured. Static assets use the free service; no paid plan or metered extras were activated for this project. Credentials belong only in provider controls, never in chat, source, build output, or public logs.

## One deployment authority

`.github/workflows/site.yml` runs on pull requests, pushes to `main`, and manual workflow dispatch. `Quality` installs the lockfile with `npm ci` using `.nvmrc`, then runs checks, unit tests, build, and Playwright accessibility/browser tests. It records the commit in `dist/deployment.json` before browser verification and uploads `verified-site-<commit>-<run-attempt>` only after all gates pass. Separate attempt names allow safe reruns without overwriting an artifact.

Quality runs in the official Microsoft Playwright Noble container, pinned by version and digest to match the locked `@playwright/test` version. Update the image alongside Playwright upgrades. Chromium, WebKit, and their Linux dependencies are preinstalled, avoiding runtime Ubuntu mirror downloads. `actions/setup-node` still selects `.nvmrc` rather than the image’s bundled Node; `npm ci` installs the project packages. The static build, reports, and verified artifact are generated in the same job workspace. Production remains a separate Ubuntu job with its existing artifact and commit checks. The Quality timeout remains 20 minutes.

`Production` has `needs: quality` and runs only for a push or dispatch on `main` when the repository variable `ENABLE_PRODUCTION_DEPLOY` is exactly `true`. It uses the `production` environment, checks out that same commit, installs locked Wrangler tooling, downloads the exact artifact ID returned by Quality in the same run, and checks its commit marker. The build is not repeated. A dispatch on another branch cannot deploy.

The production concurrency group allows one deployment at a time and does not cancel an active deployment. GitHub does not guarantee queue order. Immediately before calling Wrangler inside the serialized job, the workflow fetches the current `main` SHA. A queued run whose commit has been superseded exits without deploying. Re-running an old workflow therefore cannot replace the current main release. A commit pushed during an active deployment must still pass Quality before the next serialized deployment.

The workflow invokes `npx --no-install wrangler deploy`, using the checked-in configuration and the verified asset directory. `npm run deploy` invokes `gh workflow run site.yml --repo jorgeaviles/jorgeaviles.net --ref main`, which requires a securely authenticated GitHub CLI and the published workflow. It requests fresh quality checks for the current remote main commit and never uploads or deploys local files. The command reports dispatch failure through its exit status; successful dispatch starts an asynchronous Actions run, so inspect that run for the final result. A dispatch can run checks while production remains gated off. Do not also connect Cloudflare Workers Builds, GitHub Pages, or Cloudflare Pages to deploy this site.

## Credentials and release controls

The GitHub `production` environment holds `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The ongoing token uses Cloudflare's resource-specific Individual Workers Editor role for this Worker only. Do not replace it with an account-wide administrator token or grant DNS editing to CI. A temporary seven-day bootstrap administrator token was used for initial provisioning. The site-only token successfully deployed the corrected release, then the bootstrap token was revoked and its API verification returned HTTP 401. Both local credential files were removed. The ongoing token has no expiration; to rotate it, create a replacement with the same single-Worker role, replace the environment secret securely, verify a gated deployment, and revoke the old token. Do not put values in source files or logs.

The environment allows only `main`, and repository protection requires a pull request plus the actual `Quality` check from the GitHub Actions app. Zero required approvals permits solo maintenance without disabling the pull-request/check requirements. Repository-local commit metadata uses GitHub's noreply address; global git identity is unchanged. The owner also explicitly authorized enabling GitHub's email-privacy setting for future web commits.

A reviewed merge to `main` triggers Quality followed by Production. `npm run deploy` requests the same gated process for the existing remote main commit. To pause future releases, set `ENABLE_PRODUCTION_DEPLOY=false`; an already active deployment may finish. Keep the gate enabled for normal operation and inspect the final Actions result rather than treating dispatch success as deployment success.

## Domain setup and email preservation

Before domain work, confirm `.private/` is ignored with `git check-ignore .private/dns-before.json`. Create a private snapshot there only after the ignore check succeeds. Do not commit or print DNS exports, account credentials, or private setup evidence.

Preserve the exact values, TTLs, priorities, and proxy settings of existing iCloud MX records, apple-domain verification TXT, SPF TXT (`v=spf1 include:icloud.com ~all`), `sig1._domainkey` DKIM CNAME, and DMARC TXT (`v=DMARC1; p=none`). Do not alter nameservers, DNSSEC, iCloud settings, or enable Cloudflare Email Routing/Sending.

The apex uses Cloudflare's [Worker Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) mechanism. Its binding is deliberately dashboard-managed. `wrangler.jsonc` omits domain routes so the site-only deployment token does not need DNS access; do not add an empty routes array or enable another deployment integration. Verify that a subsequent pipeline deployment preserves the binding.

The canonical redirect is restricted to `www.jorgeaviles.net` and HTTP requests for the apex. Its dynamic destination is `concat("https://jorgeaviles.net", http.request.uri.path)`, status 301, with query-string preservation enabled. The match expression is `(http.host eq "www.jorgeaviles.net") or (http.request.full_uri wildcard "http://jorgeaviles.net/*")`. A proxied `www` A record uses the documentation-only address `192.0.2.1` to reach the edge redirect; it is not an origin server. These settings were applied through the provider UI and verified with live requests. Do not change unrelated rules or hostnames.

The assigned workers.dev release passed live smoke checks before the apex was connected. Production checks verified HTTPS, nested paths and query preservation, seven assets and their MIME/cache headers, canonical metadata, `/deployment.json`, and a genuine HTTP 404. All six protected email records matched the ignored private baseline exactly after domain setup. This is not a fresh email delivery test; no email was sent and no iCloud setting was changed.

Cloudflare automatically injected its free-plan RUM beacon after the apex was proxied. The active Configuration Rule `Professional website: no browser telemetry` sets only Disable RUM, matching `(http.host eq "jorgeaviles.net") or (http.host eq "www.jorgeaviles.net")`. It prevents analytics injection for these website hosts without changing security settings or unrelated hostnames. Keep this dashboard-managed rule with the domain and redirect settings; CI has no zone-edit permission.

## Rollback and release evidence

Prefer reverting the faulty change through a pull request. Merge the revert to `main`; the resulting new commit runs the full Quality job and deploys through the same gate. `npm run deploy` always dispatches the current remote main commit. Do not re-run an older SHA or use a local Wrangler deployment to bypass the pipeline. If a release must be paused, disable the repository deployment variable while preparing the reviewed fix; an already active deployment may finish.

For each live release, record its Actions run, commit, Cloudflare version ID from the deploy output, assigned URL, HTTP smoke checks, and any domain/email-DNS comparison in `docs/verification.md`. `/deployment.json` identifies the deployed commit. Record only executed checks. `/deployment.json` remains authoritative for the current release after this document's reference release changes.

## Action pins and references

On 2026-10-23, the following official action release tags were resolved through the GitHub API to commit objects. The workflow uses the full immutable SHAs; Dependabot proposes future updates for review.

| Action                                                                                        | Verified release | Commit                                     |
| --------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1)                   | v7.0.1           | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0)               | v7.1.0           | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)     | v7.0.2           | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| [actions/download-artifact](https://github.com/actions/download-artifact/releases/tag/v8.0.2) | v8.0.2           | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |

The configuration follows Cloudflare's [static generation and 404 routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), and [external GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) documentation. Browser tests use local production output; production infrastructure and edge behavior require separate live checks.

### Public-release readiness checks

The read-only smoke check requires the exact expected commit, complete Lab HTML,
valid JavaScript/CSS/SVG assets and a real custom 404. It retries up to 12 times,
with five seconds between attempts (55 seconds of waits plus request time).
Every failed attempt logs its error; commit mismatches include the expected and
observed commit, HTTP status and cache status. A persistent mismatch still fails
the workflow. This allows a short rollout interval without weakening provenance
or changing deployment permissions, artifact verification or the current-main gate.
