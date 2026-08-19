# no-way.dev

Reference hub for LLM APIs: prices per 1M tokens across providers, arena ratings and benchmarks, a cost calculator, model comparison, and practical guides. Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS; data is git-tracked JSON validated with zod.

> ⚠️ **SAMPLE DATA** — numbers in `data/` are realistic-looking placeholders for development.
> Verify every price against official provider pages before public launch.

**Working with AI agents on this repo? Read [`AGENTS.md`](./AGENTS.md) first** (rules), then [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) (product context, roadmap). Ops: [`docs/RUNBOOK.md`](./docs/RUNBOOK.md), data how-to: [`docs/DATA_CONTRACT.md`](./docs/DATA_CONTRACT.md).

## Stack

- Next.js 15, React 19, TypeScript (strict)
- Tailwind CSS with hand-written UI primitives in `src/components/ui/` (E-ink monochrome tokens; no dark theme)
- Data: JSON in `data/`, zod schemas in `data/schemas/`, loaders in `src/lib/data/`
- Guides: MDX in `src/content/guides/` (next-mdx-remote/rsc + gray-matter + remark-gfm)

## Setup

```bash
npm install
cp .env.example .env.local   # optional — no env vars required for the static build
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (all pages are SSG) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run validate-data` | Validate all `data/**/*.json` against zod schemas + cross-file checks |
| `npm run update-prices` | Price-update bot (**stub** — see `scripts/bots/update-prices.ts`) |

## Environment variables

All optional for the current static build (see `.env.example`):

- `NEXT_PUBLIC_SITE_URL` — canonical URL for metadata/sitemap (default `https://no-way.dev`)
- `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` — **phase 3**, email-capture form is currently a stub
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — deploy/notification bots (CI secrets)
- `GITHUB_TOKEN` — local runs of data bots (CI uses the built-in token)

## Data

- `data/models/{slug}.json` — one file per model: pricing entries (with `sourceUrl` + `updatedAt`), context, capabilities, arena ratings, benchmarks. Schema: `data/schemas/model.schema.ts`.
- `data/providers/{slug}.json` — one file per provider: website, pricing page, docs.
- `data/meta/benchmarks.json` — arena snapshot metadata, caveats, off-the-boards notes.
- Rules: one entity = one file, every number needs a source. Always run `npm run validate-data` before committing data changes. See `docs/DATA_CONTRACT.md`.

## Automation & deploy

- `.github/workflows/ci.yml` — lint + typecheck + validate-data + build on PRs and pushes to `main`.
- Vercel deploys run from Actions via CLI (`vercel build` + `vercel deploy --prebuilt`): `rc` → rc.no-way.dev, `main` → no-way.dev, PRs → previews. Vercel Git integration is off by design (`docs/adr/0001-vercel-cli-not-git-integration.md`).
- `update-prices.yml` — weekly price bot (currently a stub; opens a PR when data changes).
- `tg-bot.yml` — polls Telegram, turns owner messages into GitHub issues.

## Contributing

Open an issue or a draft PR using the templates in `.github/`. Commit style: conventional commits (`feat:`, `fix:`, `chore(data):`, `content:`). PR descriptions and issues are in Russian (owner-facing).

## License

Code: MIT. Dataset (`data/`): CC BY-SA — cite with a backlink.
