# #157: make frontend test fakes fail on unexpected requests

## Purpose

The screen test fakes answered any request they did not know with a valid reply, so a misspelled path or a request a screen should not send still passed. `certifications.test.tsx` also re-implemented the server's sort, and two tests slept 100 ms of real time to prove that something did not happen.

## Changes

| File                                                                                                                                                             | Change                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/test/fake-routes.ts` (new)                                                                                                                         | `fakeRoutes([method, path, handler], …)` replaces `fetch` with a route table. A request no route matches is rejected and the test fails in `afterEach` ("Unexpected requests"). Also `reply`, `takeUnexpected`, `emptyDailyWords` |
| `frontend/src/test/fake-routes.test.ts` (new)                                                                                                                    | Proves a matching route answers and a wrong method or longer path is reported                                                                                                                                                     |
| `certifications.test.tsx`, `exam-attempts.test.tsx`, `grade-scales.test.tsx`, `songs.test.tsx`, `study-plan.test.tsx`, `user-actions.test.tsx`, `words.test.tsx` | Fakes rebuilt on the route table with exact methods and paths                                                                                                                                                                     |
| `certifications.test.tsx`                                                                                                                                        | The fake serves the list in the order the test gives it (the server's order) instead of sorting, so "nearest exam first" is tested on the screen                                                                                  |
| `songs.test.tsx`, `user-actions.test.tsx`                                                                                                                        | The 100 ms real-time `settle()` is replaced by `flush()` (`act(async () => {})`)                                                                                                                                                  |

## Verification

- `npm run check`: pass (53 test files, 365 passed, 3 skipped). DB integration tests skip locally (no PostgreSQL on this Mac) and run in CI.
- The strict fakes already found requests the old ones hid: the overview's `/api/daily-words` (GET and POST), and that completing a manual task is a `PUT`.

## Limits

- Other test files with their own `fetch` stubs (for example `daily-words.test.tsx`) are not in the issue and are unchanged.
- `settle()` no longer waits for the clock, so a toast drawn by sonner on a timer is not covered by the "no announcement" negatives; they check state, not elapsed time.
