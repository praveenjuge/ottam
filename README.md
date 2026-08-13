# Ottam

**Stories you can only experience by moving.**

Ottam is an iPhone-first audio-drama app. Choose a 15–60 minute session and authored scenes unfold between your own music while walking, running, and stopping gently influence the story. The listener is always the protagonist.

This monorepo contains the whole product:

- `apps/ios` — native SwiftUI listener app for iOS 18+
- `apps/admin` — private Next.js production studio and Convex backend
- `packages/story-*` — story contract, deterministic compiler, and fixtures

## Develop

- Bun 1.3.14 or newer
- Xcode 26+ with an iOS simulator
- XcodeGen and SwiftFormat (`brew install xcodegen swiftformat`)

```sh
bun install --frozen-lockfile
bun run verify
```

```sh
bun run dev                       # admin and packages
bun --cwd apps/admin convex:dev  # development backend
bun --cwd apps/ios project       # regenerate Xcode project
bun --cwd apps/ios test          # iOS tests
```

Copy `apps/admin/.env.example` to `apps/admin/.env.local` for local services. Never put server credentials in the iOS app or a root `.env`.

## Principles

- Every whole-minute plan from 15–60 is deterministic and keeps the core plot.
- Playback is offline-first, resumable, and never punishes slower movement.
- Content, audio generation, assignment, restore, and publishing require explicit human approval.
- Published releases are immutable. Tests use fake audio; production audio is never generated automatically.

`main` deploys Convex and the private [production studio](https://ottam.praveenjuge.com). Updating the root package version uploads a signed build to TestFlight without submitting it for App Review.

MIT licensed. See [Contributing](CONTRIBUTING.md), [Privacy](PRIVACY.md), and [Security](SECURITY.md).
