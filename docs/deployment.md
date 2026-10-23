# Deployment

## Current state

As of 2026-10-23, the owner has directly authorized publication and free-tier Cloudflare setup. The public repository has been created; initial push, hosted checks, and provider setup are in progress. Cloudflare account ownership, Worker, domains, production release, and live DNS comparison are not yet verified. Local preview and a Wrangler dry run do not establish a live deployment. See [verification.md](verification.md) for current evidence.

| Setting                        | Intended value                                               | Status                                                 |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------ |
| GitHub repository              | `jorgeaviles/jorgeaviles.net`                                | Created; initial push pending                          |
| Canonical site                 | `https://jorgeaviles.net`                                    | Live website configuration unverified                  |
| Worker                         | `jorge-aviles-site`                                          | Configuration present; remote existence unverified     |
| Assets                         | `./dist`, static only, real 404 page                         | Configured locally                                     |
| workers.dev                    | Enabled for initial smoke test                               | Assigned URL unverified                                |
| Version preview URLs           | Disabled                                                     | Configured locally                                     |
| Production gate                | Repository variable `ENABLE_PRODUCTION_DEPLOY` equals `true` | Keep unset until setup is authorized and complete      |
| Custom domain and www redirect | Not bound in this configuration                              | Pending                                                |
| Email DNS                      | No changes performed                                         | Preservation comparison pending any future domain work |

The attachment supplies the project brief, and the owner subsequently authorized publication and Cloudflare setup directly. No credentials belong in chat, committed files, build output, or public logs.

## One deployment authority

`.github/workflows/site.yml` runs on pull requests, pushes to `main`, and manual workflow dispatch. `Quality` installs the lockfile with `npm ci` using `.nvmrc`, then runs checks, unit tests, build, and Playwright accessibility/browser tests. It records the commit in `dist/deployment.json` before browser verification and uploads `verified-site-<commit>-<run-attempt>` only after all gates pass. Separate attempt names allow safe reruns without overwriting an artifact.

`Production` has `needs: quality` and runs only for a push or dispatch on `main` when the repository variable `ENABLE_PRODUCTION_DEPLOY` is exactly `true`. It uses the `production` environment, checks out that same commit, installs locked Wrangler tooling, downloads the exact artifact ID returned by Quality in the same run, and checks its commit marker. The build is not repeated. A dispatch on another branch cannot deploy.

The production concurrency group allows one deployment at a time and does not cancel an active deployment. GitHub does not guarantee queue order. Immediately before calling Wrangler inside the serialized job, the workflow fetches the current `main` SHA. A queued run whose commit has been superseded exits without deploying. Re-running an old workflow therefore cannot replace the current main release. A commit pushed during an active deployment must still pass Quality before the next serialized deployment.

The workflow invokes `npx --no-install wrangler deploy`, using the checked-in configuration and the verified asset directory. `npm run deploy` invokes `gh workflow run site.yml --repo jorgeaviles/jorgeaviles.net --ref main`, which requires a securely authenticated GitHub CLI and the published workflow. It requests fresh quality checks for the current remote main commit and never uploads or deploys local files. The command reports dispatch failure through its exit status; successful dispatch starts an asynchronous Actions run, so inspect that run for the final result. A dispatch can run checks while production remains gated off. Do not also connect Cloudflare Workers Builds, GitHub Pages, or Cloudflare Pages to deploy this site.

## Production setup still required

After direct authorization, inspect existing resources before creating anything. Confirm the GitHub owner and the Cloudflare account that owns `jorgeaviles.net`; continue an existing dedicated repository/Worker instead of duplicating it. Use the free plan and do not enable paid or metered extras.

In GitHub, establish a `production` environment restricted to `main` and enter `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as environment secrets. Keep the Cloudflare token limited to the correct account and the Workers permissions required for asset deployment. Cloudflare may scope some deployment permissions at account level rather than to one Worker; review the provider's actual available scopes. Ongoing CI deployment should not receive DNS editing permission. Keep any one-time zone/domain setup token separate and narrowly scoped. Store secret values through provider controls without printing them.

Once the workflow has run successfully, protect `main`: require pull requests and the actual `Quality` check, block force pushes and deletion, and avoid requiring a second approver in a solo-owned project. Verify the account supports and enforces the selected rules. Branch protection is not established by merely committing this file.

Set `ENABLE_PRODUCTION_DEPLOY=true` only when the environment, secrets, permissions, and publication review are complete. A reviewed main change then triggers deployment; `npm run deploy` can request a fresh gated run for the existing remote main commit. Initial deployment must be smoke-tested at its assigned workers.dev URL before any custom-domain change.

## Domain setup and email preservation

Before domain work, confirm `.private/` is ignored with `git check-ignore .private/dns-before.json`. Create a private snapshot there only after the ignore check succeeds. Do not commit or print DNS exports, account credentials, or private setup evidence.

Preserve the exact values, TTLs, priorities, and proxy settings of existing iCloud MX records, apple-domain verification TXT, SPF TXT (`v=spf1 include:icloud.com ~all`), `sig1._domainkey` DKIM CNAME, and DMARC TXT (`v=DMARC1; p=none`). Do not alter nameservers, DNSSEC, iCloud settings, or enable Cloudflare Email Routing/Sending.

After the workers.dev smoke test, inspect website hostnames and use a [Worker Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) for `jorgeaviles.net`. Add that binding to `wrangler.jsonc` through review when compatible with the final token permissions; otherwise document the deliberate dashboard-managed binding and verify subsequent deploys preserve it. This version intentionally contains no domain routes.

Configure a Cloudflare redirect matching only `www.jorgeaviles.net`, with a permanent redirect to `https://jorgeaviles.net` preserving path and query. Review the existing records and rules before selecting the narrow implementation; none is established here. Check HTTPS, a nested path, a query string, assets, canonical metadata, `deployment.json`, and a nonexistent path with real HTTP requests after setup. Compare the protected email records with the private snapshot afterward. That comparison is not a fresh email delivery test, and this task does not send email.

## Rollback and release evidence

Prefer reverting the faulty change through a pull request. Merge the revert to `main`; the resulting new commit runs the full Quality job and deploys through the same gate. `npm run deploy` always dispatches the current remote main commit. Do not re-run an older SHA or use a local Wrangler deployment to bypass the pipeline. If a release must be paused, disable the repository deployment variable while preparing the reviewed fix; an already active deployment may finish.

For each live release, record its Actions run, commit, Cloudflare version ID from the deploy output, assigned URL, HTTP smoke checks, and any domain/email-DNS comparison in `docs/verification.md`. `/deployment.json` identifies the deployed commit. No live release evidence exists until these checks are actually performed.

## Action pins and references

On 2026-10-23, the following official action release tags were resolved through the GitHub API to commit objects. The workflow uses the full immutable SHAs; Dependabot proposes future updates for review.

| Action                                                                                        | Verified release | Commit                                     |
| --------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1)                   | v7.0.1           | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0)               | v7.1.0           | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)     | v7.0.2           | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| [actions/download-artifact](https://github.com/actions/download-artifact/releases/tag/v8.0.2) | v8.0.2           | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |

The configuration follows Cloudflare's [static generation and 404 routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), and [external GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) documentation. Browser tests use local production output; production infrastructure and edge behavior require separate live checks.
