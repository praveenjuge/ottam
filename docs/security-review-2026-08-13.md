# Security and accessibility review — 2026-08-13

## Scope and result

Reviewed the Next.js production studio, Convex API, R2 and ElevenLabs media path,
Clerk authentication boundary, and native iOS client. No open critical or high
code findings remain. Production credentials and production deployment checks
are intentionally deferred to the deployment-readiness milestone.

## Threat model

- Unauthenticated or non-admin callers trying to read or mutate editorial data.
- Prompt injection trying to expand agent permissions or cross episode boundaries.
- Replayed or stale approvals causing content or paid-audio side effects.
- Oversized, malformed, or unexpected media returned by an external provider.
- Browser injection, framing, cross-origin connection, and sensitive error leakage.
- Local guest progress loss, duplicate merges, and unauthorised progress access.

## Controls verified

- Clerk authentication is email-code-only. Google OAuth, passwords, links, and
  other first factors are disabled. Convex binds the sole administrator to the
  immutable Clerk user ID; an optional email claim must also match when present.
- Convex public functions validate arguments and returns. Authorization uses
  server identity, document-scoped checks, indexes, internal functions for
  sensitive work, structured `ConvexError` responses, and idempotency keys.
- Agent messages are strict-schema validated. Previously persisted messages are
  immutable except for the single expected approval transition. Pending approval
  blocks new turns, and agent runs are rate limited.
- Every applying tool is episode-scoped and base-revision-bound. Approval and
  invocation records prevent replay after disconnect. Publishing remains a
  human-only operation with a typed `PUBLISH` confirmation.
- ElevenLabs generation remains approval-gated with no ambiguous automatic retry,
  a daily ceiling, a 60-second timeout, a 100 MB streaming limit, MIME and size
  validation, at most three candidates, and immutable provenance. No production
  audio was generated during this review.
- R2 uses private buckets, immutable server-generated keys, short-lived signed
  URLs, checksums, declared sizes, and allow-listed media types.
- Next.js enforces a nonce-based CSP plus framing, MIME sniffing, referrer, and
  camera/geolocation/microphone restrictions. API request bodies are capped and
  server errors do not expose internal details.
- iOS retains guest data locally, validates complete offline release packages,
  clamps resume state, makes merge mutations idempotent, and keeps playback
  independent of the network after download.

## Accessibility and live evidence

- The studio has a working keyboard skip link, named form fields, live error
  regions, a labelled conversation log, reduced-motion handling, visible focus,
  and non-interactive proposal history semantics.
- Chrome verified signed-out email-only auth, sole-admin impersonation, the
  signed-in empty-library state, and a clean sign-out back to the sign-in screen.
- XCUITest verified the Home, Downloads, and Activity navigation paths and the
  guest sign-in gate on an iPhone 17 Pro simulator. Swift timeline tests cover
  stationary pause, movement variants, exact resume, completion, and release-plan
  coverage.

## Automated evidence

- `bun audit --json`: no advisories.
- Admin: 29 tests passed; lint, TypeScript, and Next.js production build passed.
- iOS: 1 UI test and 6 unit tests passed on the iOS 26.5 simulator runtime.
- Convex development deployment compiled successfully; 72-hour Insights reported
  no issues.
- Tracked-source scan found no dynamic code execution, shell execution, unsafe
  HTML injection, embedded live secrets, or unresolved TODO/FIXME markers.
