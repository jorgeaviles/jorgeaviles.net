# Jorge Aviles · Professional website

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
| `npm test`                 | Pure lab calculation tests                                      |
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
- Synthetic fixtures and tested calculations: `src/lib/ranked-review.ts`.

Content entries require a title, description, category, and numeric order. Optional fields include `featured`, `draft`, `methods`, `sources` (label and URL), and `href`. Work filenames become `/work/<filename>/`. Sources and optional links render only when provided. `getPublishedEntries()` excludes drafts from all public routes, lists, related content, and the sitemap. Draft files are still public source when committed; never use drafts for sensitive information.

## Architecture and delivery

Astro generates HTML; React hydrates only the lab island when visible. MDX content has a Zod schema. Tailwind uses its supported Vite plugin. System fonts and a small original monogram keep assets light. There are no databases, accounts, telemetry, or server-side forms.

Cloudflare Workers Static Assets serves `dist/` with a real 404 page, without SSR or a Worker handler. GitHub Actions is the single production deployment authority: Quality must pass for the exact commit before Production can use its verified build artifact. Production is disabled until the repository gate, environment secrets, account ownership, and publication authorization are established.

See [architecture](docs/architecture.md), [deployment](docs/deployment.md), [verification](docs/verification.md), and the [content backlog](docs/content-backlog.md). Local preview does not establish live Cloudflare or custom-domain behavior. Email DNS and unrelated infrastructure are outside local implementation.

## Attribution and licensing

Professional copy draws on the [public GitHub profile](https://github.com/jorgeaviles/jorgeaviles). Research attribution links directly to primary sources. Demonstration data is independently fabricated. The monogram and social image are original site assets; no third-party icon set is used. Licensing remains undecided: no blanket license is granted over the writing, identity, source, or referenced third-party material.
