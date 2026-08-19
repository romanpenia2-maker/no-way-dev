# ADR 0003: Node 24 + latest npm on CI runners

## Context

GitHub-hosted runners ship an npm version with a known bug that intermittently breaks `npm ci` / lockfile handling in our workflows, producing flaky, hard-to-diagnose failures. The project also tracks current Node (Next.js 15 + toolchain), while `package.json` keeps a permissive `engines: >=20` for local development.

## Decision

Every Actions workflow pins `node-version: 24` via `actions/setup-node` and immediately runs `npm install --global npm@latest` before any `npm ci` or other npm command. This step is mandatory in every job — do not remove it when editing workflows.

## Consequences

- CI behavior is deterministic and independent of the runner image's bundled npm.
- Workflow files carry a small boilerplate step; it must survive any workflow edit (workflows are full-file rewrites only — see `AGENTS.md`).
- Local dev may use Node ≥20; CI is the arbiter, so test with Node 24 before assuming a failure is environmental.
