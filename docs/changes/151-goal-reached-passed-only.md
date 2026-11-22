# #151 Show Goal reached only for passed attempts

Issue: https://github.com/sirloinbh/cert-manager/issues/151

## Purpose

A failed or pending attempt must never show "Goal reached", and the expiry prefill must not turn a half-typed year into 19xx.

## Changes

- `reachedTarget` (`frontend/src/exam-attempt-data.ts`) now returns `false` unless the outcome is passed or scored, for the score check as well as the grade check. Before, a failed attempt with `score >= targetScore` and no target grade returned `true`.
- `addMonths` builds dates with `setUTCFullYear` instead of `Date.UTC`, which maps years 0-99 to 1900-1999. `0026-01-10` plus 1 month is now `0026-02-10`.
- Unit tests cover both cases (`exam-attempt-data.test.ts`). The older assertion in `grade-scale-data.test.ts` that expected a failed attempt above the target score to reach the goal now expects `false`; it encoded the bug.

## Verification

- `npm run check` passes (51 frontend test files, 352 tests passed, 3 DB tests skipped locally because there is no local PostgreSQL; they run in CI).
- No screen layout changed, so no browser size check was needed.
