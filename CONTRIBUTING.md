# Contributing

Ottam favors one maintainable implementation over parallel or compatibility paths. Keep changes scoped, typed, validated at trust boundaries, and covered at the lowest useful level.

## Workflow

1. Install the requirements and dependencies from the root README.
2. Create a focused branch and make one coherent change.
3. Run `bun run verify` before opening a pull request.
4. Explain user-visible behavior, security implications, and verification evidence in the pull request.

Never commit credentials, production content, generated production audio, local `.env` files, Xcode derived data, or Vercel state. Do not call ElevenLabs from tests or fixtures. Changes to the story contract must keep all 46 duration plans deterministic and backwards-compatible with published releases, or explicitly introduce a new contract version.

Convex functions must validate arguments and returns, authorize from server identity, use indexes, keep sensitive operations internal, and make side effects idempotent. Studio mutations must preserve the visible proposal → explicit approval → revision-bound application flow.
