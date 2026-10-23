# Verification

Verified locally on 2026-10-23, on macOS arm64 with an Apple M3 Pro and 18 GB memory. These results describe static production output served by Astro preview. They do not establish a public deployment, installed Safari behavior, full WCAG conformance, or field performance.

## Delivery state

| Stage                                  | Actual status                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Local implementation                   | Complete; publication authorized, initial push pending                       |
| Proposed public repository             | Public repository created; initial push pending                              |
| CI/CD source                           | Implemented and actionlint-validated; no hosted run yet                      |
| Cloudflare CLI authentication          | No authenticated session                                                     |
| Cloudflare account / domain ownership  | Unverified                                                                   |
| workers.dev preview                    | Not deployed                                                                 |
| Production `https://jorgeaviles.net`   | Not deployed or live-verified by this task                                   |
| www redirect / HTTPS / deployed commit | Pending live setup                                                           |
| DNS / email                            | No changes made; no before/after comparison or email-delivery test performed |

The owner directly authorized public publication and free-tier Cloudflare setup on 2026-10-23. No unrelated profiles, repositories, infrastructure, or iCloud settings were modified. Repository-local commit metadata uses the GitHub-provided noreply address to avoid disclosing a personal or professional email; global git identity is unchanged. Initial hosted checks and live deployment evidence will be recorded as setup progresses.

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
| `npm run test:browser`      | Passed; 104 tests in 33.4 seconds; no retries needed                                                                                        |
| Actionlint 1.7.12           | Passed for the workflow; downloaded official binary verified with its published SHA256                                                      |
| `wrangler deploy --dry-run` | Passed; assets-only configuration, no bindings; no upload or deployment                                                                     |
| Source/build privacy review | No matched credential/private-key/local-path patterns or observed private content; ignored setup files excluded from publication candidates |

The browser matrix covers Chromium 156.0.8078.4 (Playwright revision 1248) and WebKit 27.2 (revision 2370), each at 1440 × 1000 desktop and 390 × 844 mobile viewports. The suite checks all ten public content routes, case-study navigation, contact URLs, first-party links, unknown-path HTTP 404, horizontal overflow, keyboard skip/focus, lab hydration/default/zero/all selections, console errors on tested application routes, and readable content with JavaScript disabled. Axe scans cover WCAG A/AA 2.0 and 2.1 rules on all public pages and the 404 experience.

Fixed during verification: numbered-label contrast, the decorative monogram’s accessible-name interaction, generated test-report exclusions from source checking, and explicit no-JavaScript fallback assertions. WebKit on macOS uses Option-Tab to include links according to its platform keyboard preference; Linux CI uses Tab. Automated scans supplement visual and keyboard review and do not establish complete accessibility conformance.

The actual static Cloudflare routing, headers, cache behavior, custom domains, TLS, redirect preservation, and deployment provenance still need live requests after publication. Local Astro preview and Wrangler dry-run results are not substitutes for those checks.

## Screenshots and reports

Local verification artifacts are ignored and are not included in the public repository:

- `.local/screenshots/home-desktop.png`, `home-desktop-top.png`, and `home-mobile.png`.
- `.local/screenshots/about-desktop.png`, `about-mobile.png`, `research-desktop.png`, and `research-mobile.png`.
- `.local/screenshots/lab-desktop.png`, `lab-mobile.png`, and `lab-nojs.png`.
- `playwright-report/index.html` and browser-test attachments under `test-results/`.
- `.local/final-verify.log` and `.local/lighthouse/summary.json`.

Desktop/mobile home, about, research, and lab images were inspected. Home screenshots were refreshed after the accessible monogram correction; secondary screenshots reflect the same layout before that correction. No substantive clipping or page overflow was observed. The mobile lab table is readable but tall because descriptions wrap; compacting it is an optional refinement.

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
