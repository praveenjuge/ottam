# Ottam

Ottam is an iPhone-first, offline entertainment experience whose story branches respond to listener movement. This repository is the canonical product monorepo.

## Architecture

- `apps/admin`: admin-only Next.js production studio and Convex application backend
- `apps/ios`: native iOS 18+ SwiftUI listener app
- `packages/story-contract`: versioned content and playback contracts
- `packages/story-compiler`: deterministic 15–60 minute plan compiler
- `packages/story-fixtures`: validated test and preview content

The web workspace uses Bun and Turborepo. Each workspace owns its tasks; the root scripts only orchestrate them.

## Local verification

```sh
bun install --frozen-lockfile
bun run verify
```

Production secrets belong only in the package or service that consumes them. Never create a repository-root `.env` file.
