# #154: fix English UI copy and the lyrics storage promise

## Purpose

Screens showed wrong plurals ("1 days left", "1 manual tasks"), claimed lyrics are "stored only in the app on this PC" although the deployed app keeps them in the server database behind the shared sign-in, and used inconsistent or invented wording.

## Changes

| File                                                | Change                                                                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/plural.ts`                            | New `quantity(n, singular, plural?)` helper: "1 day", "2 days"                                                                                                                                                  |
| `frontend/src/certification-data.ts`                | Day and month counts use `quantity`; a months validity with no number reads "Unknown"                                                                                                                           |
| `frontend/src/user-actions.tsx`                     | Toast and bell label use `quantity` ("1 manual task", "1 manual task alert")                                                                                                                                    |
| `frontend/src/study-plan.tsx`, `study-plan-data.ts` | "its 1 task" plural; the date range uses an en dash instead of `~`                                                                                                                                              |
| `frontend/src/songs.tsx`                            | Song and line counts use `quantity`; the lyrics storage text now says they are saved on the server and readable only after signing in                                                                           |
| `frontend/src/words.tsx`                            | Word counts use `quantity`; a source without a license shows "license not recorded" instead of "CC BY-SA 4.0"; the word detail error says "Could not load the word"                                             |
| `frontend/src/exam-attempts.tsx`                    | The "Result" label is now "Outcome", as the server calls it (one line, lane-4 file)                                                                                                                             |
| Tests                                               | `plural.test.ts` (new); singular cases in `certification-data.test.ts`; `user-actions.test.tsx`, `words.test.tsx`, `songs.test.tsx`, `exam-attempts.test.tsx`, `study-plan*.test.*` updated for the new strings |

## Verification

- `rg "on this PC" frontend/src` finds nothing.
- `npm run check`: pass (53 test files, 368 passed, 3 skipped). DB integration tests skip locally (no PostgreSQL on this Mac) and run in CI.
- Browser check at 390×844 and 1440×900: pending (see the PR).

## Limits

- The server's own error text ("The translation has 1 lines…") is backend copy and is not changed here.
