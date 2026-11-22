# #161 (step 2): load the words list through the shared query layer

## Purpose

The words list (about 2,800 rows) was reloaded on every visit by the hand-written `useLoad` loop. It now loads through the shared `useApiQuery` (ADR-0027), so coming back to the list shows the cached rows at once and refreshes them in the background after 30 seconds.

## Changes

| File                                   | Change                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/app.tsx`                 | `App` creates its client with the synced `createQueryClient()` instead of React Query's defaults                                                                       |
| `frontend/src/words.tsx`               | `WordList` uses `useApiQuery(apiKey('/api/words'), …)`; the `useLoad` loop is gone for the list (the word detail page keeps `useLoad`, as it is not part of this step) |
| `frontend/src/word-data.ts`            | New `wordsPath`; the unused `wordApi.list` is removed                                                                                                                  |
| `frontend/src/words.test.tsx`          | A server error is retried once before it shows; a failed first read recovers; coming back to the list shows its rows with no new request                               |
| `docs/changes/161-words-list-query.md` | This record                                                                                                                                                            |

## Verification

- `npm run check`: pass (55 test files, 384 passed, 3 skipped). DB integration tests skip locally (no PostgreSQL on this Mac) and run in CI.
- Browser check, 2026-11-22 (Chrome via Playwright, vite on 127.0.0.1:5499, a fixture-only mock API on 3499 with 2,800 words, a 600 ms delay and a switch that fails the next requests; no database), at 390×844 and 1440×900:
  - The list loads: 100 rows, "2800 words · 1400 with meanings", "Show more (2700 words left)", no horizontal overflow (content 16–374 px at 390, 296–1384 px at 1440).
  - Open a word and come back to the list: the 100 rows and the search box are there at once, no skeleton, and the server saw no new request (7 list requests in total across the whole session, none for the revisit).
  - One server error: retried after about a second, the list appears (about 1.5 s), the error never shows. Two errors: "Word server error" shows in the notice (16–374 px at 390), no rows, no overflow.
  - The only console errors are the 500 responses the mock sends on purpose.

## Limits

- Other screens still use `useLoad` and `useReloading`; they move onto the shared layer in later steps. `use-load.ts` stays until then.
- A failed refresh in the background keeps the cached rows on screen and shows the error above them.
