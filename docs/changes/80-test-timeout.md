# #80 Fix test timeouts and intermittent failures

Issue: [#80](https://github.com/sirloinbh/cert-manager/issues/80)

## Purpose

`npm run check` sometimes failed regardless of the code. I handled two things separately: the frontend timeout and the backend intermittent failure. I could not determine the cause of the frontend one, and for the backend I confirmed one, `bad port`.

## Frontend: the 5 second limit

I did not measure the load at the time of the first failure, so I could not determine the cause. But when I add load, the same timeout reproduces in several files, so splitting tests as in [#54](54-study-plan-test-timeout.md) does not solve it.

I ran only the frontend tests with 24 busy processes on a PC with 12 CPU cores.

| Limit | Runs |     Failures |          Slowest test |
| ----- | ---: | -----------: | --------------------: |
| 5 s   |    3 | 9-18 per run |               10-13 s |
| 15 s  |    3 |            0 | at most about 14.45 s |

On 2026-11-01 the user set it to 15 seconds. It changes the "do not raise the limit" of #54. `frontend/vitest.config.ts` is a centrally managed file, so I fixed the central template in [project-standards#390](https://github.com/sirloinbh/project-standards/issues/390), and it came into this repository with sync PR #83.

## Backend: ports that fetch refuses

When I ran `npm run check` 10 times as the done criterion, on the 7th run one test in `songs.test.ts` failed with `fetch failed`, cause `bad port`.

- By the standard, `fetch` refuses requests to some ports (6000, 6666, and others).
- This PC's ephemeral port range is 13,977 ports starting at 1024 (`netsh int ipv4 show dynamicport tcp`). The port a test server gets with `listen(0)` can land on the refused list.
- When I did `listen(0)` 5,000 times, I got a refused port 15 times, and each time `fetch` failed with `bad port`. It hands out ports in order, so this count depends on the starting position and is not a fixed rate.

I made the five places that start a test server use `listenLocally` in `backend/test/helpers.ts`. If it gets a refused port, it closes and gets another. This PC hands out ports in order, so I could not use the method of waiting for a "port above 10080".

I added `backend/test/helpers.test.ts`. It makes it look as if a refused port was received and checks that it gets another, and checks that `fetch` still refuses port 6000.

For the 1 failure at `word-list.test.ts:118` written in the issue and the 3 others, there was no log at the time, so I could not confirm that it was the same cause. That file also got ports the same way, so it may be the same cause.

## Docs cleanup

I fixed the PR #15 and zod description left in the next steps document to the current state and wrote the `npm audit` result. I added the missing November 1 and 2 to the `docs/daily/README.md` list.

## Verification

I ran `npm run check` 10 times in a row, the done criterion. I did not add load on purpose, and the CPU usage at the start was 11-100%.

| Code                  |     Runs | Failures                | Result                                             |
| --------------------- | -------: | ----------------------- | -------------------------------------------------- |
| 15 s limit only       | 10 times | 1 `bad port` on the 7th | The other 9 runs passed                            |
| 15 s limit + port fix | 10 times | None                    | Backend 118, frontend 239 with 2 skipped, skills 4 |

- `npm run knip`, `node .standards/check.mjs`, `node .standards/secret-scan.mjs`: pass.
- Only test code changed, so app behavior and screens stay the same. I did not do a browser check.

## Applied the 1st review

I applied the findings of the independent read-only review.

- I was about to close the issue without running the done criterion (10 runs in a row). I ran it and found the `bad port` above.
- The backend failure was missing from the record. I wrote it in the section above.
- The 15 second measurement result was not in the issue. I left a summary as a #80 comment. I did not keep the raw output of each run.
- Changed the sentence that asserted the cause to "could not determine".
- Changed the `npm audit` description to "there is no safe automatic fix".
- Filled in the `docs/daily/README.md` list.

## Applied the 2nd review

There were no blocking defects. I fixed 2 low-level wording findings (the sentence that asserted the cause, and the expression "raw data"). I did not fix two notes.

- A missing value in `refusedPorts` is not caught by a test. The Node version is pinned and the current list is exact.
- A test file that uses `listenLocally` also imports `src/app.ts`, so the date parser setting of pg applies to that process. There is no effect now.

The last commit fixed only docs, so I did not repeat the 10 runs. The review is up to the 2nd round, so after this it goes to CI.

## Limits and follow-up

- During the 15 second measurement, the load was bigger than 24 because of processes the measuring script did not clean up, and the time record of the first run was odd. So the 15 second row in the table above is not a comparison with the load matched exactly.
- Under that load the slowest test was close to 15 seconds. It may fail again under a bigger load.
- Before the fix, `bad port` happened in 1 of 10 runs, so passing 10 runs alone does not show that it is gone. The basis is that I found the cause and removed it.
- I did not measure other apps. Only the time limit value of the central template goes in, and the `bad port` fix is only in this repository.
