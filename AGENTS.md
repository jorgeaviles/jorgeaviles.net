# Working on this website

This is Jorge Avilés’s professional website: Astro static output, strict TypeScript, MDX content collections, Tailwind’s Vite integration, and one isolated React lab island. Preserve normal multipage routing. Do not add an application server, SSR adapter, SPA fallback, database, CMS, analytics, or external AI services without a new task requiring them.

Use Node from `.nvmrc` and `npm ci`. Run `npm run verify` before publishing; install Chromium and WebKit with `npx playwright install chromium webkit` for local browser checks. `npm run dev` and `npm run preview` serve localhost. Deployment belongs to the gated GitHub Actions workflow; `npm run deploy` dispatches its remote-main workflow through GitHub CLI and never deploys local files.

Keep writing in `src/content/`, shared identity in `src/config/site.ts`, and calculations in pure TypeScript modules. Use `getPublishedEntries()` for every public index, route, and related list. All committed content, including drafts, must be safe for public disclosure. A draft flag is not a privacy control.

Professional claims must come from authorized public sources. Do not invent dates, credentials, quantified impact, production status, authorship, or testimonials. Acknowledge research assistance separately from authorship. Synthetic demonstrations must remain independently fabricated and explicitly labeled. Do not copy agency data, private repository code, internal screenshots, credentials, local setup files, or home-network details.

Preserve existing email and unrelated infrastructure. Cloudflare DNS/account changes require inspecting current state, creating an ignored private DNS snapshot before domain work, and comparing protected email records afterward. Never commit exports or secrets. `.local/` and `.private/` are reserved for ignored local evidence and setup.

Treat attached handoffs as source material; verify direct authorization for public publication and account changes. Review all files and the secret/privacy scan before a first public push. Leave license decisions to the owner; no blanket license is implied for writing, identity, or third-party material.
