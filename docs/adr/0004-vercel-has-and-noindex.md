# ADR 0004: noindex via vercel.json `has` host conditions + live check

## Context

Staging (`rc.no-way.dev`) and previews (`*.vercel.app`) must never be indexed by search engines — duplicate/placeholder content indexed by Google is a real SEO incident. Vercel header rules support `has` conditions matched against the request.

## Decision

`vercel.json` sets `X-Robots-Tag: noindex, nofollow` for all paths, gated by two separate header blocks: one with a `has` host condition for `.*\.vercel\.app`, one for `rc\.no-way\.dev`. Production (no-way.dev) gets no such header. Additionally, `deploy-rc.yml` curls the live staging URL after aliasing and **fails the deploy** if the header is missing.

## Consequences

- **Vercel `has` conditions combine with AND.** Stacking multiple conditions in one block silently stops the header from matching — this caused a real incident. Keep one host condition per block; add a new block instead of extending `has`.
- `vercel.json` edits are full-file rewrites only; verify after any change: `curl -sI https://rc.no-way.dev/ | grep -i x-robots-tag`.
- Never weaken or delete the live-check step to make a deploy green.
