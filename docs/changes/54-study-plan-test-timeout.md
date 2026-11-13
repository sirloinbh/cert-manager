# #54 Fix the timeout of the study plan screen tests

Issue: [#54](https://github.com/sirloinbh/cert-manager/issues/54)

## Purpose

`frontend/src/study-plan.test.tsx` sometimes failed by hitting the 5 second limit when the PC was busy. The required check `ci / verify` runs the same test, so it can fail regardless of the code.

## Measuring the cause

With no load, the slowest test in the file was `what was saved shows even if reloading the plan fails` at 1,169 ms, and the next was 647 ms. Most of the others were under 300 ms.

I attached temporary timing code to that one test and measured the following (1,442 ms in total).

| Action                                             | Calls |  Time | Share |
| -------------------------------------------------- | ----: | ----: | ----: |
| `findByRole`                                       |     6 | 608ms |   42% |
| `getByRole`                                        |     8 | 505ms |   35% |
| `fireEvent.click` (including drawing the dialog)   |     8 | 203ms |   14% |
| `getByLabelText`, `fireEvent.change`, `findByText` |     9 |  29ms |    2% |

Queries by role are 77%. Dialog input events and animations were not a big cause. One test saves four times and calls role queries 14 times, so it hit the limit first.

## Changes

- Split that test into three: a new stage and the first task, editing a task, and editing a stage. Each test checks that the saved content shows even if the reload fails.
- I did not raise the time limit.
- The edit tests start from the plan loaded at first and do not carry on from the earlier step. The case of adding a task to a new stage stays in one test so that saving after a failed reload carries on.

## Verification

I started 12 processes that keep all 12 cores busy and ran this file repeatedly. The measuring script was a temporary file, so I did not commit it.

| When          |        Runs | Timeouts or failures | Slowest test  |
| ------------- | ----------: | -------------------: | ------------- |
| Before change |     3 times |                    0 | 2,796-3,001ms |
| After change  | 10 in a row |                    0 | 1,712-2,255ms |

The margin against the 5 second limit grew. The tests went from 19 to 21, so the time of the whole file went from 12.5-13.1 seconds to 14.9-19.2 seconds.

- `npm run check`: pass. Backend 108 passed, frontend 236 passed and 2 skipped (`DARK_ONLY`), skills 4 passed, build succeeded.
- `npm run knip`: no findings.
- `node .standards/check.mjs`: pass.
- `node .standards/secret-scan.mjs`: no suspicious items.
- I did not change app code or screens, so I did not do a browser check.

## Applied the 1st review

I fixed 2 findings (low) of the independent read-only review.

- The split tests did not check the edited value again after waiting for the reload to fail. They now check once more after seeing the failure message.
- The fake API returned the tasks too for a stage edit, which differed from the real server (it answers without tasks). I changed it to the same shape as the server so that the check "keeps the tasks" has meaning.

The load measurement in the table above was done with the code before this fix.

## Applied the 2nd review

I fixed 2 findings (low) of the independent read-only review.

- The test for a new stage and the first task also checks the task again after waiting for the second reload failure.
- Deleted the sentence in this record that wrote the number of role queries wrongly.

I ran it 10 times in a row again with the same load on the final code. There were 0 timeouts or failures, and the slowest test is 1,307-2,025 ms. What else the PC was doing differed at each measurement, so it cannot be compared precisely with the values in the table.

The review is up to the 2nd round, so after this it goes to CI.

## Limits and follow-up

- The original failure in the issue was the case where the whole file took 80 seconds when it ran together with a review agent. This load is lighter than that, so it does not mean it passes when it gets that slow.
- I did not measure the cost of role queries in other test files.
