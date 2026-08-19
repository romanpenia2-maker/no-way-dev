# ADR 0002: Reference data lives in git as JSON

## Context

The site is a reference hub: prices, arena ratings, benchmarks. The data must be auditable (every number sourced), reviewable (owner approves changes via PR), and cheap to serve (static pages, no runtime database in the current phase).

## Decision

The dataset is git-tracked JSON under `data/` — one file per model (`data/models/`) and per provider (`data/providers/`), snapshot metadata in `data/meta/`, zod schemas in `data/schemas/`. Pages are SSG built from these files through loaders in `src/lib/data/`. `npm run validate-data` gates every change in CI. Git is the source of truth; no database holds reference data.

## Consequences

- Every data change is a diff with history, reviewable in a PR; `sourceUrl`/`updatedAt` are enforced by schema.
- Builds are fully static and reproducible; sitemap and pages regenerate from data automatically.
- Data updates require a commit + deploy; bots (e.g. `update-prices.yml`, currently a stub) must open PRs, never push directly.
- Phase 3 will add Supabase for **user** data only; reference data stays in git.
