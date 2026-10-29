# Jorge Avilés · Professional website

A quiet, content-first professional site connecting business analysis, data platforms, applied research, and practical technology. Canonical URL: <https://jorgeaviles.net>.

## Local development

Use the Node LTS version pinned in `.nvmrc`, then:

```sh
npm ci
npx playwright install chromium webkit
npm run dev
```

The site runs at `http://localhost:4321`. On systems using nvm, run `nvm install` and `nvm use` first. Node is not installed globally by this project.

| Command                    | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `npm run dev`              | Astro development server                                        |
| `npm run check`            | Astro, TypeScript, and content checks                           |
| `npm run lint`             | ESLint                                                          |
| `npm run format:check`     | Prettier validation                                             |
| `npm run format`           | Apply consistent formatting                                     |
| `npm test`                 | Pure model and evaluation tests                                 |
| `npm run test:publication` | Build disposable draft fixtures and verify their exclusion      |
| `npm run assets:social`    | Regenerate the social PNG from the original SVG artwork         |
| `npm run build`            | Static production output and first-party link/privacy checks    |
| `npm run preview`          | Preview existing production output locally                      |
| `npm run test:browser`     | Chromium/WebKit, desktop/mobile, accessibility and no-JS checks |
| `npm run verify`           | All required local checks, in order                             |
| `npm run deploy`           | Dispatch the gated GitHub Actions release for remote main       |

## Editing

- Shared name, contact details, and metadata: `src/config/site.ts`.
- Work, research, and lab prose: `src/content/<collection>/*.mdx`.
- Main page layouts: `src/pages/`, `src/layouts/`, and `src/styles/global.css`.
- Synthetic fixtures and tested calculations: `src/lib/ml/models.ts`.

Content entries require a title, description, category, and numeric order. Optional fields include `featured`, `draft`, `methods`, `sources` (label and URL), and `href`. Work filenames become `/work/<filename>/`. Sources and optional links render only when provided. `getPublishedEntries()` excludes drafts from all public routes, lists, related content, and the sitemap. Draft files are still public source when committed; never use drafts for sensitive information.

## Architecture and delivery

Astro generates HTML; React hydrates the isolated Learning Lab and portfolio assistant interfaces. MDX content has a Zod schema. Tailwind uses its supported Vite plugin. System fonts and a small original monogram keep assets light. The website remains static; the assistant calls a separate Cloudflare Worker. There are no application databases or visitor accounts.

Cloudflare Workers Static Assets serves `dist/` with a real 404 page, without SSR or a Worker handler. GitHub Actions is the single production deployment authority: Quality must pass for the exact commit before Production can use its verified build artifact. Changes to protected `main` go through pull requests. `npm run deploy` requests a fresh gated release of remote `main`; it does not deploy local files.

See [architecture](docs/architecture.md), [deployment](docs/deployment.md), [verification](docs/verification.md), and the [content backlog](docs/content-backlog.md). Verification records distinguish local checks, hosted CI, Worker releases, and custom-domain behavior. Domain changes must preserve existing email DNS; a DNS comparison does not establish email delivery.

The API's read-only MCP endpoint is implemented for review and defaults off. See
[public MCP tools and verification](docs/portfolio-mcp-plan.md) and
[protected API release and rollback](docs/portfolio-api-release.md). Its manual
release workflow is separate from the static Site workflow; merging code does not
activate MCP. `npm run api:build` creates an ignored release artifact, and
`npm run test:mcp` tests the real local Worker with the official HTTP client.

## Attribution and licensing

Professional copy draws on the [public GitHub profile](https://github.com/jorgeaviles/jorgeaviles). Research attribution links directly to primary sources. Demonstration data is independently fabricated. The monogram and social image are original site assets; no third-party icon set is used. Licensing remains undecided: no blanket license is granted over the writing, identity, source, or referenced third-party material.
