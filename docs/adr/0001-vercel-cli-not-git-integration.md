# ADR 0001: Deploy via Vercel CLI, not Git integration

## Context

Vercel's Git integration auto-deploys whatever lands on a connected branch. Our git flow requires that `main` changes only after explicit owner approval, that staging (`rc`) deploys separately from production, and that every deploy is verified (e.g. the noindex live-check) and reported (Telegram) — control the Git integration doesn't give us.

## Decision

Vercel Git integration is disabled for this project. All deploys run from GitHub Actions using the Vercel CLI: `vercel pull` → `vercel build` → `vercel deploy --prebuilt` (`--prod` for production), then `vercel alias set` for rc.no-way.dev. Workflows: `deploy-rc.yml`, `deploy-prod.yml`, `deploy-preview.yml`.

## Consequences

- Deploys are gated by Actions secrets (`VERCEL_TOKEN`) and workflow triggers, not by pushes alone.
- Rollback is an alias change, not a git revert (see `docs/RUNBOOK.md`).
- Adding a deploy step means editing workflows — full-file rewrites only, per `AGENTS.md`.
