# #89 The lyrics fetch stops entirely on a single LRCLIB 503

- Issue: [#89](https://github.com/sirloinbh/cert-manager/issues/89)
- Branch: `fix/89-lrclib-503`
- Earlier work: [#64 change record](64-lyrics-scripts.md)

## Problem

The user ran `npm run lyrics:import -w backend` for the first time. Both times the whole run stopped after a few songs.

| Run | Saved   | Song it stopped on         | Output                                                           |
| --- | ------- | -------------------------- | ---------------------------------------------------------------- |
| 1   | 6 songs | Tied Together With a Smile | `LRCLIB 503, 대기 1초 요청` (LRCLIB 503, asked to wait 1 second) |
| 2   | 3 songs | Mary’s Song (Oh My My My)  | `LRCLIB 503, 대기 1초 요청` (LRCLIB 503, asked to wait 1 second) |

Both songs had no matching result in the exact lookup and moved on to search (`api/search`). When I sent the same search 6 times by hand at 3 second intervals, 3 of them were `503` with `Retry-After: 1`. It happens because the server is busy, not because of the song. The old code rested 1 second each time and tried only 3 times on a 503, and if it was still 503 it treated it as a rate limit and stopped everything.

## Changes: 2026-11-03

I changed only the 503 handling in `backend/src/polite-fetch.ts`.

| Item                      | Before                           | After                                                                                            |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Number of attempts        | 3                                | 5                                                                                                |
| Wait before retrying      | The requested time (1 second)    | The longer of the requested time (0 if none) and 5, 10, 20, 40 seconds                           |
| Still 503 after all tries | Stops everything as a rate limit | Leaves only that song as failed (`LRCLIB 503, 5번 시도`, "5 attempts") and goes to the next song |

Not changed: the 429 handling (stops everything after 3 attempts), stopping everything on a response that asks to wait over 300 seconds, and stopping after 5 failed songs in a row. If the service is really down, the consecutive failure rule stops everything.

It applies the same way to the word etymology fetch (`words:etymology`, kaikki.org), which uses the same function. The list fetch (`words:import`) also tries more times on a 503 (the wait time is in the 2nd review section below). It has only one request, so if it finally fails, it ends with an error as it does now.

If one request stays busy, it spends about 75 more seconds (5+10+20+40 seconds).

## Tests

| File                                | Test added                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/lyrics-fetch.test.ts` | If 503 with `Retry-After: 1` continues, it waits 5, 10, 20, and 40 seconds and tries 5 times, and ends as a failure that is not a rate limit |
| `backend/test/lyrics-fetch.test.ts` | A song that keeps getting 503 fails only that song, and the next songs keep being fetched                                                    |

I confirmed that the two tests fail on the code before the fix (20 passed, 2 failed) and pass after the fix. The existing 503 test (waits 5 seconds for `Retry-After: 5`) and the test that stops on the 3600 second 503 from kaikki.org still pass as they are.

## Verification

- `node ../node_modules/tsx/dist/cli.mjs --test test/lyrics-fetch.test.ts test/word-list.test.ts` (backend): 32 passed.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Backend 120 passed, frontend 240 passed and 2 skipped, skills 4 passed, build succeeded.
- `npm run knip`: no findings. `node .standards/check.mjs`, `node .standards/secret-scan.mjs`: pass.
- No screen changes.

## Applied the 1st code review: 2026-11-03

I checked 1 high, 1 medium, and 2 low findings of the independent review.

| Finding                                                                                                                                                                                       | Handling                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| It does not end when 503 and 429 are mixed (high). One attempt counter was shared, so both `=== 3` and `=== 5` were missed. If 429 followed three 503s, it would request every second forever | Count 429 and 503 separately and compare with `>=`. 429 ends at the 3rd and 503 at the 5th, so however they are mixed, one request ends within at most 7 tries                                                         |
| A 503 without `Retry-After` waited 60 seconds 4 times (240 seconds) and did not even stop (medium). About 20 minutes until 5 songs fail in a row                                              | A 503 without `Retry-After` waits only 5, 10, 20, and 40 seconds (75 seconds). The wait does not exceed 300 seconds                                                                                                    |
| The existing 503 test could not tell before from after and its name did not fit, and there were no tests for the mixed case and the no-header case (low)                                      | Changed the existing test to `Retry-After: 30` to check that it waits that long when the requested time is longer. Added a 503 with no header, stopping everything on a 3600 second 503 from LRCLIB, and 2 mixed cases |
| The `5번 시도` ("5 attempts") text after a mixed response differs from the real number of 503s (low)                                                                                          | Fixed by counting them separately                                                                                                                                                                                      |

"Wait before retrying" in the change table is now "the longer of the requested time (0 if none) and 5, 10, 20, 40 seconds". If `Retry-After` is large but at most 300 seconds, it waits that long, so one song can use up to about 20 minutes (300 seconds × 4).

The review reproduced with a temporary script that it does not end when 429 follows 503×3. After the fix, I confirmed in the mixed-case test that the number of requests ends at 6 and 7.

- `node ../node_modules/tsx/dist/cli.mjs --test test/lyrics-fetch.test.ts test/word-list.test.ts` (backend): 35 passed.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Backend 123 passed, frontend 240 passed and 2 skipped, skills 4 passed. `npm run knip`, `node .standards/check.mjs`, `node .standards/secret-scan.mjs`: pass.

## Applied the 2nd code review: 2026-11-03

The independent review confirmed that all 4 findings of the 1st were fixed correctly, and raised 5 low findings.

| Finding                                                                                                                           | Handling                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| The mixed-case test does not fail on the old code and just stops. node:test has no default time limit                             | Put a 10 second time limit on the test        |
| No test for a 503 after a 429, or for them alternating                                                                            | Added both cases to check 4 mixed cases       |
| The sentence that `words:import` waits "longer" is only partly right after the 1st fixes                                          | Fixed it in "Wait times" below                |
| 75 seconds and 20 minutes are values for one request, not one song. One song can make 2 requests, the exact lookup and the search | Fixed it in "Wait times" below                |
| The test and verification sections from before the review have the old values (32, `Retry-After: 5`)                              | They are records of that time, so I left them |

### Wait times

- If 503 continues, one request waits 75 seconds (5+10+20+40 seconds) and then leaves that song as failed. One song does an exact lookup and a search, so at most double.
- If `Retry-After` is large but at most 300 seconds, it waits that long. It is at most 20 minutes per request (300 seconds × 4), and the 429 wait is added separately. If the server asks for 300 seconds every time, it can take over 1 hour before it stops after 5 failed songs in a row.
- `words:import`: it used to wait 120 seconds (60 seconds × 2) on a 503 without a header, and now waits 75 seconds. With `Retry-After: 1` it used to be 2 seconds and is now 75 seconds.

- `node ../node_modules/tsx/dist/cli.mjs --test test/lyrics-fetch.test.ts test/word-list.test.ts` (backend): 35 passed. `npm run check` passed (backend 123, frontend 240 passed and 2 skipped, skills 4), and knip, the standards check, and the secret check passed.

## Limits

- Getting them again from the real LRCLIB is done by the user. How much the 503s decreased while fetching the remaining 189 songs will show up in that run.
