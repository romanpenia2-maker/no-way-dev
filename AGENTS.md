# AGENTS.md — rules for AI agents working on this repo

Read this file before any work. Product context: `PROJECT_CONTEXT.md`. Ops incidents: `docs/RUNBOOK.md`. Adding data: `docs/DATA_CONTRACT.md`. PR descriptions and issues are written in Russian (owner-facing).

## Hard rules (violating any = rejected PR)

1. **Git flow.** Work happens on `rc`. `main` updates ONLY via merge `rc → main` after EXPLICIT owner approval in chat/PR. An agent never merges or pushes to `main` on its own; direct push to `main` is forbidden.
2. **Revert trap.** `git revert X` followed by re-merging the same branch does NOT bring the feature back — the revert commit wins. Restoring needs a revert-of-revert or a fresh PR. Never revert a feature commit without owner escalation.
3. **Workflows & `vercel.json`.** Files under `.github/workflows/` and `vercel.json` are edited ONLY by full-file rewrite — never sed/line patches. Validate YAML after every edit. Any workflow change goes in its own commit with a clear message.
4. **Secrets.** Tokens/keys never appear in commits, issues, PRs, or logs — only GitHub Secrets / Vercel env. Never hand-edit `package-lock.json`; lockfile mirror URLs (non-`registry.npmjs.org`) are forbidden.
5. **Data.** Every number needs `sourceUrl` + `updatedAt`. Run `npm run validate-data` before committing data. CI gates: `lint + typecheck + validate-data + build` must all pass.
6. **Environment gotchas.** Runners need Node 24 + `npm i -g npm@latest` (runner npm bug). Vercel deploys via CLI `vercel build` + `vercel deploy --prebuilt` — Git integration is disabled by design. Vercel `has` conditions combine with AND.

## Repository map (verified against the code)

- `src/app/` — App Router pages: `/pricing`, `/benchmarks`, `/compare`, `/calculators/cost`, `/guides/[slug]`, `/models/[slug]`, `/about`, `/methodology`; `layout.tsx`, `globals.css`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`
- `src/components/` — feature components (`pricing-table`, `benchmarks-table`, `cheapest-table`, `compare-explorer`, `cost-calculator`, `export-buttons`, `email-capture`); `layout/` (header, footer); `ui/` primitives (`data-table`, `table`, `badge`, `button`, `card`, `input`, `select`, `stats-strip`, `weights-badge`, `off-peak-footnote`, `value-footnote`)
- `src/lib/` — `data/` (typed JSON loaders: models, providers, benchmarks), `arena.ts`, `benchmark-keys.ts`, `search-params.ts`, `pricing-state.ts`, `use-sortable.ts`, `export.ts`, `value.ts`, `utils.ts` (cn + price formatting), `site.ts`, `guides.ts`, `seo/jsonld.tsx`
- `src/content/guides/` — MDX guides (frontmatter: title, description, publishedAt)
- `data/models/` — one JSON per model (13 files); `data/providers/` — one per provider (10 files); `data/meta/benchmarks.json` — arena snapshot meta/caveats/offTheBoards; `data/schemas/` — zod schemas
- `scripts/validate-data.ts` — zod + cross-file validation; `scripts/bots/update-prices.ts` — STUB, changes nothing
- `.github/workflows/` — `ci.yml` (lint/typecheck/validate/build), `deploy-rc.yml`, `deploy-prod.yml`, `deploy-preview.yml` (Vercel CLI), `update-prices.yml` (weekly), `tg-bot.yml` (Telegram → issues)
- `vercel.json` — `X-Robots-Tag: noindex` headers for `*.vercel.app` and `rc.no-way.dev`

## Conventions

- TypeScript strict, no `any`. Server Components by default; `'use client'` only for interactivity.
- kebab-case files, PascalCase components, conventional commits (`feat:`, `fix:`, `chore(data):`).
- Design: E-ink monochrome tokens only (`--paper`, `--px`, `--px2`, `--line`, `--backdrop`); fonts Archivo/Inter/JetBrains Mono; NO dark theme, NO colors beyond tokens; hover = ink inversion; `tabular-nums` for numbers.
- Components read data only via `src/lib/data/*`. Prices in USD per 1M tokens, formatted via `src/lib/utils.ts`.
- No new dependencies without justification in the PR. Don't break public URLs (slug change = redirect + note in PR).

## Agent workflow

1. Read `AGENTS.md` → `PROJECT_CONTEXT.md` → the files you're changing.
2. Branch off `rc`; make the change; run `npm run lint && npm run typecheck && npm run validate-data && npm run build` — all green.
3. Open a draft PR to `rc` (template `.github/PULL_REQUEST_TEMPLATE.md`, body in Russian). Never merge yourself.
