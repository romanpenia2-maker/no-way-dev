# RUNBOOK — incident response for no-way.dev

Operational incidents and how to handle them. Product context: `PROJECT_CONTEXT.md`. Hard rules: `AGENTS.md`.

## Red deploy (CI deploy workflow failed)

1. **Do not touch `main`.** A failed deploy never justifies a direct commit, merge, or push to `main`. `main` moves only via an approved `rc → main` merge.
2. Read the failed job log in GitHub Actions, then the Vercel build/runtime logs (`vercel logs <url> --token=...` or the Vercel dashboard).
3. Fix on `rc` (or a branch off it), push, let the deploy workflow rerun.

## Rolling back production

Rollback = **re-point the alias to a previous Vercel deployment**, NOT `git revert`:

```bash
vercel ls no-way-dev --token=$VERCEL_TOKEN      # find the last good deployment URL
vercel alias set <previous-deployment-url> no-way.dev --token=$VERCEL_TOKEN
```

Alias rollback is instant and independent of git history. Fix forward on `rc` afterwards; the next approved `rc → main` merge redeploys normally.

## The revert trap

`git revert X` undoes commit X with a new commit. If you later merge the **same branch** (or any branch whose history still contains X's changes without a counter-commit) back in, git sees the revert as newer — **the feature does not come back; the revert wins.**

Example: `feat: /compare` lands on `main`; it breaks prod; someone runs `git revert <sha>` on `main`. Weeks later the fixed branch is merged again — files stay deleted, because ancestry says the revert is the latest word on those changes.

To actually restore a reverted feature you must either:
- `git revert <sha-of-the-revert>` (revert-of-revert), then merge, or
- open a fresh PR re-applying the changes on top of current history.

**Rule:** never revert a feature commit without escalating to the owner first. Prefer alias rollback (above) for production fires — it carries no git-history consequences.

## noindex live-check failed (deploy-rc.yml last step)

The workflow curls `https://rc.no-way.dev/` and expects an `X-Robots-Tag` header. If it fails:

1. Check `vercel.json` — the header block must exist with a `has` host condition for `rc\.no-way\.dev`. Remember: **Vercel `has` conditions combine with AND** — stacking extra conditions silently stops the header from matching (this was a real incident; see `docs/adr/0004`).
2. Verify locally: `curl -sI https://rc.no-way.dev/ | grep -i x-robots-tag`.
3. Confirm the alias actually points at the new deployment (`vercel alias ls`).
4. If `vercel.json` was edited, fix it by full-file rewrite only, and re-run the workflow.

Never disable or delete the check to make the workflow green — a staging site indexed by Google is a real SEO incident.

## Broken production (site down or wrong content live)

**Notify the owner immediately** (comment on the relevant PR/issue; Telegram notification fires automatically from the deploy workflow). Then alias-rollback if a previous deployment is healthy. Do not attempt hotfix commits to `main`.
