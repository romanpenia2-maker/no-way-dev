# no-way.dev

Reference hub for AI API pricing: prices per 1M tokens across providers, an interactive cost calculator, and practical guides. Next.js 15 (App Router) + TypeScript strict + Tailwind CSS, data as git-tracked JSON validated with zod.

> ⚠️ **SAMPLE DATA** — the numbers in `data/` are realistic-looking placeholders for development.
> **Verify every price against official provider pages before public launch.** Do not trust the
> bundled values in production.

**Working with AI agents on this repo? Read [`AGENTS.md`](./AGENTS.md) first** (rules), then [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) (product context, roadmap).

## Stack

- Next.js 15, React 19, TypeScript (strict)
- Tailwind CSS with hand-written UI primitives in `src/components/ui/` (no shadcn CLI)
- Data: JSON in `data/`, zod schemas in `data/schemas/`
- Guides: MDX in `src/content/guides/` (next-mdx-remote/rsc + gray-matter + remark-gfm)
- recharts (charts), next-themes (dark mode)

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
| `npm run update-prices` | Price-update bot (stub — see `scripts/bots/update-prices.ts`) |

## Environment variables

Copy `.env.example` → `.env.local`. Everything is optional for the current phase:

- `NEXT_PUBLIC_SITE_URL` — canonical URL for metadata/sitemap (defaults to `https://no-way.dev`)
- `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` — **phase 3**, email-capture form is currently a stub
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — optional bot notifications
- `GITHUB_TOKEN` — local runs of data bots (CI uses the built-in token)

## Data

- `data/models/{slug}.json` — one file per model: pricing entries (with `sourceUrl` + `updatedAt`), context window, capabilities. Schema: `data/schemas/model.schema.ts`.
- `data/providers/{slug}.json` — one file per provider: website, pricing page, docs.
- Always run `npm run validate-data` before committing data changes. Rules: one entity = one file, every number needs a source.

## Automation

- `.github/workflows/ci.yml` — lint + typecheck + validate-data + build on every PR/push.
- `.github/workflows/update-prices.yml` — weekly (Mondays 06:00 UTC) price bot; opens a PR via `peter-evans/create-pull-request` when data changes.

## Deploy

Optimized for **Vercel**: import the repo, no extra config needed (`vercel.json` already adds `X-Robots-Tag: noindex` to `*.vercel.app` preview deployments). `main` → production (no-way.dev), every PR → preview.

## Contributing

Open an issue (templates provided) or a draft PR using the template in `.github/PULL_REQUEST_TEMPLATE.md`. Commit style: conventional commits (`feat:`, `fix:`, `chore(data):`, `content:`).

## License

Code: MIT. Dataset (`data/`): CC BY-SA — cite with a backlink.
