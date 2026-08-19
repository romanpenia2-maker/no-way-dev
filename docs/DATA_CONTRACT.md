# DATA CONTRACT — how to work with data/ correctly

The dataset is git-tracked JSON under `data/`, validated by zod schemas in `data/schemas/` via `npm run validate-data` (`scripts/validate-data.ts`). Components never read JSON directly — they go through loaders in `src/lib/data/`.

**The one rule that matters: no number without a source.** Every price, arena rating, and benchmark score carries `sourceUrl` + a date (`updatedAt` / `testedAt` / `snapshotAt`). Never invent or "round" data. If a figure can't be sourced, leave it out and flag it in the PR for manual verification.

## Adding a model

1. Create `data/models/{slug}.json` matching `data/schemas/model.schema.ts`:
   - `slug` (kebab-case, dots allowed), `name`, `provider` (must exist in `data/providers/`), `releasedAt`, `status` (`ga|preview|beta|deprecated`).
   - `context.tokens` (+ optional `maxOutput`).
   - `pricing[]` — at least one entry: `provider`, `inputPer1M`, `outputPer1M` (USD per 1M tokens), optional `cachedInputPer1M` and `note`, plus **required** `updatedAt` (YYYY-MM-DD) and `sourceUrl`.
   - `capabilities[]` (subset of text/vision/audio/tools/json-mode/reasoning), `openWeights`, `lastVerifiedAt`.
   - Optional: `arena` (per-category entries with elo/rank/ci/votes/boardName — include a category only if the model is in that board's top-20), `benchmarks[]` (name, score, testedAt, sourceUrl), `benchmarksNote` (one-line rollup of non-comparable scores).
2. Run `npm run validate-data` — fix every error before committing.
3. Where it appears automatically: `/pricing` (all pricing entries), `/models/[slug]` (detail page), `/benchmarks` (if `arena` or `benchmarks` present), `/compare`, and `sitemap.xml`. No manual page wiring needed.

## Adding a provider

1. Create `data/providers/{slug}.json` matching `data/schemas/provider.schema.ts`: `slug`, `name`, `websiteUrl`, `pricingUrl`, `apiDocsUrl` (all valid URLs).
2. Only then may model pricing entries reference the new provider slug — the validator cross-checks `model.provider` and pricing providers against this directory.
3. Run `npm run validate-data`.

## Updating the arena snapshot

Arena ratings live in two places and must be updated together:

1. **Per-model ratings** — the `arena` object inside each `data/models/{slug}.json`, keyed by category (`text`, `webdev`, `vision`, `coding`, `hard-prompts`, `math`).
2. **Snapshot metadata** — `data/meta/benchmarks.json` (schema: `data/schemas/benchmarks-meta.schema.ts`):
   - `categories.{category}` — `label`, `snapshotAt`, total `votes`, `totalModels`, `sourceUrl` of the board.
   - `caveats[]` — per-model measurement warnings shown as "Caveats †" on `/benchmarks`.
   - `offTheBoards[]` — `{slug, text}` items for notable models absent from the top-20 boards.
   - `emptyBenchmarkNotes` — what to show instead of an empty benchmark list, keyed by model slug.

When refreshing: take one dated snapshot per board, update every affected model file and the matching `categories` entry in the same commit, and keep `snapshotAt` honest (the date you captured the board, in YYYY-MM-DD). Run `npm run validate-data`; note the snapshot date in the PR description.
