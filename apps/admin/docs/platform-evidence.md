# Platform risk evidence

This file records non-secret, reproducible platform decisions. Mutable live health is verified through CI and deployment commands rather than asserted here.

## Clerk

- Application: `Ottam`
- Repository link: `github.com/praveenjuge/ottam`
- Development auth: required email, email verification code, and email-code sign-in
- Password sign-up and adding a password: disabled
- Convex integration: enabled; session token audience is `convex`

## Convex

- Team/project: `praveenjuge/ottam`
- Development reference: `dev/praveenjuge`
- Region: EU West (Ireland), selected because Convex currently offers only US East and EU West and Ottam's initial audience is in India
- Health query: `platform:health`

## Vercel

- Team/project: `praveen-juges-projects/ottam`
- Connected repository: `github.com/praveenjuge/ottam`
- Monorepo root: `apps/admin`
- Framework: Next.js

## Cloudflare R2

- Account: `Praveen Juge CF`
- Private editorial bucket: `ottam-editorial`
- Private release bucket: `ottam-releases`
- Placement hint: APAC
- Public bucket access: not enabled

## ElevenLabs

- A dedicated `Ottam account probe` key is stored in macOS Keychain.
- The key grants only the User endpoint; every generation endpoint has no access.
- A live `/v1/user` request authenticated successfully without consuming generation credits.
- The approval-gated toolchain is implemented with fake-provider tests; the production generation key remains intentionally absent until deployment configuration.

## Release publishing

- Audio assignment is a separate, revision-bound before/after proposal after human audition.
- A fresh human publish action validates exactly one approved asset per normal scene and walking/running assets per reactive scene.
- All 46 whole-minute plans are compiled and embedded in the immutable release bundle before publication.
- Editorial objects are copied into the private release bucket and verified by size, media type, and SHA-256 metadata before Convex atomically marks a release published.
- The AI production agent has no publish tool or direct release mutation.

## Apple

- App Store Connect access is authenticated for Praveen Juge.
- A valid Apple Development signing identity is installed locally.
- Xcode 26.6 and the iOS 26.5 simulator runtime are installed.
- Distribution signing and the App Store app record wait for the real iOS target and bundle identifier.

Secrets and deployment URLs remain in `apps/admin/.env.local` and the service dashboards. They are never committed.
