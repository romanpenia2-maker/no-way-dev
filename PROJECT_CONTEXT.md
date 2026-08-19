# PROJECT_CONTEXT.md — product context for no-way.dev

Extended context for AI agents and contributors. Hard rules: `AGENTS.md`. Incident ops: `docs/RUNBOOK.md`. Data how-to: `docs/DATA_CONTRACT.md`.

## Mission

no-way.dev is a developer-facing reference for LLM APIs: current prices per 1M tokens across providers, LMArena-style arena ratings, benchmark scores, a cost calculator, model comparison, and practical guides. The promise: an answer to "which API for my task and budget" in 30 seconds, with every number traceable to a source.

## Audience

Indie developers, ML engineers, startup CTOs comparing LLM APIs. Language: English. Tone: technical, concrete — numbers over adjectives. The repo is worked on by AI agents; the owner reviews PRs in Russian.

## Domain model (as it exists in the code today)

| Entity | File | Key fields | Pages |
|---|---|---|---|
| Model (13) | `data/models/{slug}.json` | pricing[] (input/output/cached per 1M), context, capabilities, arena per category, benchmarks[], status, openWeights | `/models/[slug]`, `/pricing`, `/compare` |
| Provider (10) | `data/providers/{slug}.json` | websiteUrl, pricingUrl, apiDocsUrl | linked from pricing tables |
| Arena snapshot | `data/meta/benchmarks.json` | 6 categories (text, webdev, vision, coding, hard-prompts, math) with snapshotAt/votes/totalModels/sourceUrl; caveats; offTheBoards | `/benchmarks` |
| Benchmark | inside model JSON `benchmarks[]` | name, score, testedAt, sourceUrl (+ `benchmarksNote` rollup) | `/benchmarks`, `/models/[slug]` |
| Guide | `src/content/guides/{slug}.mdx` | frontmatter: title, description, publishedAt | `/guides`, `/guides/[slug]` |

Schemas live in `data/schemas/` (zod) and are the source of truth. Loaders in `src/lib/data/` parse and cache JSON; pages never read `data/` directly.

Recent refactor worth knowing: shared `ui/data-table.tsx`, `lib/use-sortable.ts`, `lib/search-params.ts`, `lib/benchmark-keys.ts`, and `WeightsBadge`/`StatsStrip`/`OffPeakFootnote`/`ValueFootnote` components deduplicate table/sort/URL-state logic. `recharts` was removed; `groq`/`openrouter` providers were removed.

## SEO approach

- All reference pages are SSG (static params generated from `data/`); no client-side fetching of critical content.
- `generateMetadata` per page; numbers in titles/descriptions come from data, not hardcoded.
- JSON-LD via `src/lib/seo/jsonld.tsx`; canonical URL from `NEXT_PUBLIC_SITE_URL` (`src/lib/site.ts`).
- `src/app/sitemap.ts` builds the sitemap from data (static pages + models + guides); `robots.ts` standard.
- Previews and staging must stay `noindex` — enforced by `vercel.json` headers (`has` host conditions for `*.vercel.app` and `rc.no-way.dev`) plus a live-check step in `deploy-rc.yml`.

## Design principles

E-ink monochrome. Tokens only: `--paper` (background), `--px` / `--px2` (ink), `--line`, `--backdrop`. Fonts: Archivo (display), Inter (body), JetBrains Mono (data). NO dark theme, NO `next-themes`, NO colors beyond tokens. Hover = ink inversion. Numbers use `tabular-nums`. Data tables are the core UI pattern (shared `data-table` + `use-sortable`).

## Roadmap — existing vs planned

**Exists now:** 13-model / 10-provider registry, `/pricing` (sortable table, URL state, CSV export, filters), `/benchmarks` (arena category tabs + benchmark table), `/compare` (value score), `/calculators/cost`, guides (MDX, not in header nav), email-capture UI (stub), weekly `update-prices.yml` workflow, Telegram→issue bot, Vercel CLI deploys (rc/preview/prod).

**Planned, NOT built (phase 3):**
- Supabase user data (auth, watchlist, submissions). No Supabase code in the repo yet.
- Email digest via Resend (`RESEND_*` env vars exist in `.env.example`; `email-capture.tsx` is a stub).
- Price-update bots: `scripts/bots/update-prices.ts` is a STUB — it parses models, logs entries, and exits without modifying data. Real provider adapters are future work.

Do not present planned items as existing, and don't build phase-3 features unprompted.

## Infrastructure

- **GitHub:** repo, PR flow, Actions (CI gates, deploys, price bot, Telegram bot).
- **Vercel:** hosting, deployed via CLI from Actions (Git integration intentionally off — see `docs/adr/0001`). `main` → no-way.dev, `rc` → rc.no-way.dev, PRs → previews.
- **Telegram:** owner notifications on every deploy.

Questions on unclear tasks → comment on the issue and wait for the owner; don't code blind.
