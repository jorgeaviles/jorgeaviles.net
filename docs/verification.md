# Verification

This document records the original deployed reference release. The feature-branch machine-learning lab replaces its fixed ranking; current implementation and validation are documented in [learning-lab.md](learning-lab.md). That feature is pending review and has not been deployed.

Local verification was performed on 2026-10-23 on macOS arm64 with an Apple M3 Pro and 18 GB memory. Hosted GitHub Actions and live Cloudflare checks are recorded separately below. WebKit checks do not establish installed Safari behavior; automated accessibility scans and Lighthouse runs do not establish full WCAG conformance or field performance.

## Delivery state

| Stage                          | Actual status                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Local implementation           | Complete; static multipage site with an isolated interactive lab                                               |
| Public source                  | [jorgeaviles/jorgeaviles.net](https://github.com/jorgeaviles/jorgeaviles.net)                                  |
| Hosted CI/CD                   | Quality and initial production pipeline passed; protected main and main-only production environment verified   |
| Cloudflare                     | Existing account/domain ownership verified; dedicated assets-only Worker created on the free service           |
| Verification host              | [Workers deployment](https://jorge-aviles-site.sax-hefts-5e.workers.dev); initial HTTP/browser smoke completed |
| Canonical domain, cleanup, DNS | HTTPS, canonical redirects, token cleanup, and exact six-record email-DNS comparison passed                    |

The owner directly authorized publication and free-tier setup on 2026-10-23. Repository-local commit metadata uses GitHub's noreply address; global git identity is unchanged. The owner separately authorized enabling GitHub's email-privacy setting, and the provider confirmed it is enabled. No private email is used in this repository's commits.

The initial release was commit `f5403446bc48db4279ed9996d0b74517b32457ed`, deployed by [Actions run 40034313792](https://github.com/jorgeaviles/jorgeaviles.net/actions/runs/40034313792), Cloudflare version `f520db5c-f2b3-41c2-98bc-c0a232a36b1b`. Ten content routes, seven assets, release provenance, security headers, and genuine custom 404 passed initial HTTP checks. Focused live Chromium/WebKit checks passed all eight desktop/mobile and JavaScript/no-JavaScript combinations, including lab calculations, no application errors, no overflow, and zero axe violations on the scanned home/lab pages.

That HTTP check found overlapping cache directives on hashed assets. [Pull request #2](https://github.com/jorgeaviles/jorgeaviles.net/pull/2) removes the redundant global cache header and adds host-specific workers.dev `noindex`, relying on Cloudflare's default mutable-file revalidation. Its hosted Quality check passed after a fresh-runner retry of a stalled Ubuntu browser-dependency download; no application change was made to address that infrastructure stall. The merge used noreply metadata and left branch protections enforced.

## Live production reference release

The corrected release is commit `6184125e90b1d9f3280b42d658d228545271d069`, [Actions run 40058165984](https://github.com/jorgeaviles/jorgeaviles.net/actions/runs/40058165984), Cloudflare version `d9e4b78b-abf4-4b5d-aeb5-4ee746222ba4`. Hosted Quality passed 104 browser checks in 55.7 seconds; Production succeeded with the Individual Workers Editor token scoped only to `jorge-aviles-site`. The earlier manual run for the superseded main commit exited without deploying, exercising the stale-release guard. The current deployed SHA is always available at [/deployment.json](https://jorgeaviles.net/deployment.json); later documentation-only releases may advance it beyond this reference.

The corrected workers.dev smoke passed before the apex was connected. Production HTTP checks then passed all ten public content routes, seven assets including the lab's JavaScript dependencies, correct HTML/SVG/PNG/CSS/JavaScript MIME types, default mutable-file revalidation, unambiguous immutable caching on hashed assets, security headers, canonical metadata, and the exact release commit. An unknown path returned the custom page with HTTP 404. The verification host serves `X-Robots-Tag: noindex`; production does not.

Four real redirect requests passed with status 301: HTTPS `www` root, HTTPS `www` nested work path with multiple query parameters, HTTP `www` lab, and HTTP apex research. Each reached `https://jorgeaviles.net` with the original path and query intact. HTTPS requests used normal certificate verification.

Cloudflare's free-plan automatic RUM injection caused the first production browser check to request a third-party beacon. No analytics code was added to the source. A Configuration Rule now sets only Disable RUM for the apex and `www`. After that change, all eight live browser combinations passed: Chromium and WebKit, desktop and mobile, JavaScript enabled and disabled. Home/lab scans found zero axe violations, controls returned the expected default/zero/all metrics, no horizontal overflow or application errors occurred, and the tested pages made no third-party requests. Unknown URLs still returned HTTP 404. This is separate from ordinary provider-side request accounting.

The protected email-DNS comparison passed for all six original records, including exact content, TTL, proxy setting, and MX priority. The only DNS additions were the managed apex Worker record and proxied `www` A record used for redirects. No nameservers, DNSSEC, iCloud configuration, Email Routing/Sending, or unrelated infrastructure were changed. This comparison does not establish fresh email delivery; no messages were sent.

The temporary bootstrap token was revoked after the site-only token successfully deployed. Its verification endpoint returned HTTP 401; the ongoing token remained active and could read this Worker's settings, which showed zero bindings. Both local credential files were removed. GitHub holds the ongoing credential only in the `production` environment. The final provider token list showed one active Individual Workers Editor token for this website; no account-wide administrator credential remains from this setup.

Live evidence remains ignored and local: `.local/workers-dev-corrected-smoke.json`, `.local/production-http-smoke.json`, `.local/production-redirect-smoke.json`, `.local/production-browser-smoke.json`, `.local/cache-fix-deploy.log`, `.local/github-final-controls.json`, and `.local/credential-cleanup.json`. Private DNS and provider-setting snapshots are under `.private/`; they must never be published.

## Installed stack

Exact direct dependency versions are pinned in `package.json` and `package-lock.json`.

| Tool                        | Installed version |
| --------------------------- | ----------------- |
| Node LTS                    | 24.22.1           |
| npm used                    | 11.3.0            |
| Astro                       | 7.4.2             |
| TypeScript                  | 6.0.3             |
| React / React DOM           | 19.3.1            |
| Astro React integration     | 7.1.1             |
| Astro MDX integration       | 8.1.1             |
| Astro sitemap               | 3.7.4             |
| Tailwind / Vite integration | 4.3.3             |
| ESLint                      | 10.13.0           |
| Prettier                    | 3.9.10            |
| Vitest                      | 5.0.5             |
| Playwright                  | 1.64.1            |
| axe Playwright              | 4.14.0            |
| Wrangler                    | 4.152.0           |
| Lighthouse                  | 13.5.0            |

Versions were resolved from current official documentation and npm metadata, then checked through installation. React’s optional transform peer was left uninstalled after its independently latest version conflicted with the integration’s supported range. No dependency override or forced resolution was used. Node was installed only into ignored local setup; system Node was not replaced.

## Executed checks

The final complete run used the pinned Node runtime and `ASTRO_TELEMETRY_DISABLED=1 CI=true npm run verify` after a successful clean `npm ci`.

| Check                       | Observed result                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                    | Passed; audited 657 packages, zero reported vulnerabilities                                                                                 |
| `npm run check`             | Passed; 29 files, zero errors, warnings, or hints                                                                                           |
| `npm run lint`              | Passed                                                                                                                                      |
| `npm run format:check`      | Passed                                                                                                                                      |
| `npm test`                  | Passed; 20 tests                                                                                                                            |
| `npm run test:publication`  | Passed; three temporary draft fixtures excluded from all 13 HTML/XML outputs; real pages and sitemap retained                               |
| `npm run build`             | Passed; 11 generated pages including `404.html`, 157 first-party link/asset references checked                                              |
| `npm run test:browser`      | Passed; 104 tests in 32.0 seconds; no retries needed                                                                                        |
| Actionlint 1.7.12           | Passed for the workflow; downloaded official binary verified with its published SHA256                                                      |
| `wrangler deploy --dry-run` | Passed; assets-only configuration, no bindings; no upload or deployment                                                                     |
| Source/build privacy review | No matched credential/private-key/local-path patterns or observed private content; ignored setup files excluded from publication candidates |

The browser matrix covers Chromium 156.0.8078.4 (Playwright revision 1248) and WebKit 27.2 (revision 2370), each at 1440 × 1000 desktop and 390 × 844 mobile viewports. The suite checks all ten public content routes, case-study navigation, contact URLs, first-party links, unknown-path HTTP 404, horizontal overflow, keyboard skip/focus, lab hydration/default/zero/all selections, console errors on tested application routes, and readable content with JavaScript disabled. Axe scans cover WCAG A/AA 2.0 and 2.1 rules on all public pages and the 404 experience.

Fixed during verification: numbered-label contrast, the decorative monogram’s accessible-name interaction, generated test-report exclusions from source checking, and explicit no-JavaScript fallback assertions. WebKit on macOS uses Option-Tab to include links according to its platform keyboard preference; Linux CI uses Tab. Automated scans supplement visual and keyboard review and do not establish complete accessibility conformance.

Local Astro preview and Wrangler dry-run results remain distinct from hosted Quality and the live edge checks above. Each live release must verify edge routing, headers, cache behavior, TLS, redirects, and deployment provenance through actual requests.

## Screenshots and reports

Local verification artifacts are ignored and are not included in the public repository:

- `.local/screenshots/home-desktop.png`, `home-desktop-top.png`, and `home-mobile.png`.
- `.local/screenshots/about-desktop.png`, `about-mobile.png`, `research-desktop.png`, and `research-mobile.png`.
- `.local/screenshots/lab-desktop.png`, `lab-mobile.png`, and `lab-nojs.png`.
- `playwright-report/index.html` and browser-test attachments under `test-results/`.
- `.local/final-verify.log` and `.local/lighthouse/summary.json`.
- `.local/screenshots/production-{chromium,webkit}-{home,lab}-{desktop,mobile}.png` from the live canonical domain.

Live production desktop/mobile home and lab screenshots were inspected. Local desktop/mobile home, about, research, and lab images were also inspected. Home screenshots were refreshed after the accessible monogram correction; secondary screenshots reflect the same layout before that correction. No substantive clipping or page overflow was observed. The mobile lab table is readable but tall because descriptions wrap; compacting it is an optional refinement.

## Lighthouse measurements

Single runs against `http://127.0.0.1:4321/`, serving the production build, with Lighthouse 13.5.0 and Playwright Chromium 156. Local verification work may share CPU. No hosted network, real Safari, repeated-run distribution, or field measurement is claimed.

| Profile                              | Performance | Accessibility | Best practices | SEO | FCP    | LCP    | TBT  | CLS |
| ------------------------------------ | ----------- | ------------- | -------------- | --- | ------ | ------ | ---- | --- |
| Mobile, default simulated throttling | 100         | 100           | 100            | 100 | 756 ms | 906 ms | 0 ms | 0   |
| Desktop preset                       | 100         | 100           | 100            | 100 | 204 ms | 244 ms | 0 ms | 0   |

Raw reports: `.local/lighthouse/mobile.report.json`, `mobile.report.html`, `desktop.report.json`, and `desktop.report.html`. `.local/lighthouse/measure.mjs` retains the local measurement command. There were no Lighthouse run warnings. Non-scoring insights include a small render-blocking stylesheet cost and dependency-tree/forced-reflow suggestions.

## Source and external-link verification

Professional content was checked against the current [public profile](https://github.com/jorgeaviles/jorgeaviles/blob/main/README.md). The [publisher PDF](<https://www.idosi.org/gv/gv13(4)14/8.pdf>) verifies the research title, sole author Anand N. Asthana, 2014 citation, DOI, and acknowledgement of J. Avilés for research assistance on page 478. The [CENTRUM PUCP record](https://centrumthink.pucp.edu.pe/articulosacademicos/profitability-prediction-in-catlle-ranches-in-latin-america-a-machine-learning-approach/) corroborates the publication; its URL misspells “cattle,” so the site uses the publisher’s title.

Automated external HEAD requests returned HTTP 200 for GitHub, the publisher PDF, and the PUCP record. LinkedIn returned HTTP 405 to HEAD; the supplied profile URL is retained and is not claimed as independently verified through an anonymous browser. Every first-party page/asset reference passed local checks.

No original article, private source code, agency records, internal schema, unrelated personal details, or third-party photograph was copied into this project. Synthetic fixtures are independently fabricated. No license was automatically applied.
