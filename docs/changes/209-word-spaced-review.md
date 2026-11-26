# #209: spaced review for words

## Purpose

Mark each word as Know / Unsure / Don't know; the app schedules the next review and the dashboard shows the words due today.

## Rule (user decision, 2026-11-27)

Intervals 1 → 3 → 7 → 14 → 30 days (step 0..4). Know = one step up (top step stays), Unsure = keep the step, Don't know = back to step 0 (1 day). Words never answered have no row and are never due. A first answer counts from step 0, so a first Know gives 3 days. The next review date is answer day (Asia/Seoul) + interval.

## Changes

| File                                                                                      | Change                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `database/migrations/012_word_reviews.sql`                                                | New `word_reviews` table (step, next review date, last answer, last reviewed at)               |
| `backend/src/routes/word-reviews.ts`                                                      | `PUT /api/words/:id/review` and `GET /api/word-reviews/due?day=` with Zod validation           |
| `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json`                       | Register the routes and the contract                                                           |
| `frontend/src/word-review.tsx`, `word-data.ts`, `words.tsx`, `daily-words.tsx`, `app.tsx` | Answer buttons on the word detail and Today word cards; "Words to review today" dashboard card |
| tests                                                                                     | `backend/test/word-reviews*.test.ts`, `frontend/src/word-review.test.tsx`                      |

## Verification

See the PR for the `npm run check` result. The DB integration test is skipped on this Mac (no PostgreSQL) and runs in CI.

## Limits

- The due list is the review list; there is no separate review page.
