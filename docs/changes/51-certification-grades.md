# #51 Build the grade system per certification and the target grade

- Issue: [#51](https://github.com/sirloinbh/cert-manager/issues/51)
- Branch: `feat/51-certification-grades`
- Survey: [Grade systems by certification](../research/certification-grades.md)

## Purpose

For each certification, choose a grade based on official sources and set a target grade. Make it possible to compare the grade of an attempt record with the goal.

## User decisions: 2026-10-31

- "Grade" is a level inside a certification (for example TOEIC B2, TOEIC Speaking AL).
- It is linked to both the goal and the attempt records.

## Implementation judgments

| Item                              | Judgment                                                                                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the grade table lives       | One place, `backend/src/grade-scales.ts`. It is used for input validation and served with `GET /api/grade-scales`. It is not copied into the frontend                                                                                                            |
| Grade table put on a goal         | Not guessed from the name; the user chooses it. The certification name is free input                                                                                                                                                                             |
| Grade column of an attempt record | Keep it free text and do not check it against a list on the server. It must be able to keep real scores such as `Level 7` from before the revision                                                                                                               |
| Filling the grade from a score    | Fill it only when exactly one grade matches. If there are several, as with IM1 to IM3, make the user choose. Do not overwrite a value the user chose or a saved grade. For a saved record with an empty grade, fill it from the score when the edit window opens |
| Goal achieved                     | When every goal that is set (score, grade) is met. For the grade, compare only `passed` and `scored` results. For Specialty and the driver's license, only when the value is the same                                                                            |
| Latest result                     | The grade of the same reference record as the expiry display (the latest `passed` or `scored`)                                                                                                                                                                   |

## Changes: 2026-10-31

- DB: `database/migrations/005_certification_grades.sql`. Added `grade_scale` and `target_grade` to `certifications`. A target grade cannot be set without a system.
- API: `GET /api/grade-scales`. Goal register and edit accept `gradeScale` and `targetGrade`, and a grade that is not in the system gives a Korean 400.
- Screens
  - Goal form: choose the grade system and the target grade. Changing the system clears the target grade. If the list cannot be read, the saved value is kept.
  - Attempt record form: if there is a system, choose the grade from a list and fill it from the score. If there is no system, enter it directly as now.
  - Goal detail: the grade table (highest grade first), the goal, the latest result, the source link, and the target grade line.
  - Goal list: the target grade in the summary.
- Fixed section 5 of `docs/design/scope-and-data-model.md`.

## Verification

- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 40 passed (0 skipped), frontend 163 passed, skills 4 passed, build succeeded.
- `npm run knip`: no findings. `node .standards/check.mjs`: pass. `node .standards/secret-scan.mjs`: no suspicious items.
- Migration: applied `005` twice each to `cert` and `cert_test` on this PC's PostgreSQL 17, and there were no errors.
- Browser: checked with headless Edge (the developer tools protocol) on Vite 5206 + backend 3106 + `cert_test`. The Chrome extension was not connected, so I used this method, and I ran it with a temporary script that is not in the repository. I looked at the screenshots only locally. I deleted the temporary goals after the check. I confirmed the fixes of the 1st review with tests and did not look at them again in the browser.
  - Same result for mobile 390×844 and PC 1440×900: in the goal form, changing the system clears the target grade, the TOEIC Speaking grade table has 10 rows, 120 points clears the grade and shows the IM1 to IM3 note, 170 points fills AL, after saving "목표 달성" ("Goal achieved") and "최근 결과" ("Latest result") show, and the list shows "목표 등급 AL" ("Target grade AL").
  - No console errors or warnings and no horizontal overflow.

## Automatic code review: 2026-10-31

1st (read-only review agent): 0 high, 3 medium, 10 low. I fixed 12 in this PR.

| Finding                                                                                                                                   | Handling                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| The note that the IM1 to IM3 ranges are "not public" is stronger than the evidence (even the review could not confirm whether it is true) | Changed it to "could not confirm with official sources". Wrote the values and reliability of unofficial sources in the survey document |
| "Goal achieved" is attached to a failed record                                                                                            | For the grade, compare only `passed` and `scored`                                                                                      |
| It shows as achieved if only one of the target score and the target grade is met                                                          | Every goal that is set must be met to be achieved. Wrote it in the design document too                                                 |
| If the list arrives late, a grade entered by hand disappears                                                                              | Also record it as edited by hand in the input field                                                                                    |
| For a saved record with an empty grade, the guide and the selected value differ                                                           | Fix it only when there is a saved grade                                                                                                |
| A grade that was not chosen is saved as `''`                                                                                              | I treated it as the same as "None" in the choice field and wrote it as an exception in the design document                             |
| The detail screen does not report a failure to load the grade list                                                                        | Added a message                                                                                                                        |
| The grade system guide is not connected to screen readers and there is no loading text                                                    | Added `aria-describedby` and text                                                                                                      |
| Screen readers cannot tell that the grade changes by score                                                                                | Added `aria-live` to the guide                                                                                                         |
| The wording for AWS Professional and the description of the Professional Engineer exam are more definite than the sources                 | Fixed the wording                                                                                                                      |
| The list of grade systems is in two places, the code and the migration                                                                    | Added an integration test that puts every system in the code into the real DB                                                          |
| No tests for `markPassed`, the result entry flow, and the real grade table values                                                         | Added tests                                                                                                                            |

Not fixed: if a level is removed from a grade table in the future, saving a goal that has that value will give a 400. It does not happen with the current data, so it will be handled in the issue that changes the grade table.

2nd (review agent that looked at the diff again): 0 high or medium, 3 low. All were handled, and the review ended after 2 rounds.

- A record saved with the grade set to "None" is also filled with the grade of the score when the edit window opens → for a goal that has a system, "no grade" is not told apart, so I kept the behavior and wrote it in the judgment table above. The filled value is shown on the screen before saving.
- If the grade list cannot be read, the achieved display for a higher grade disappears and the guide does not say so → added it to the guide text.
- The test table below was missing the tests of the fix commit → fixed the table.

## Tests

| File                                            | Behavior verified                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/grade-scales.test.ts`             | The grade table API, saved values, allowing a system without a goal, Korean 400 for a wrong system, a wrong grade, and a goal without a system, score ranges not overlapping (except IM1 to IM3), real grade table scores (800 points B2, 945 points C1, 120 points IM1 to IM3, 170 points AL)                                                                                                                          |
| `backend/test/grade-scales.integration.test.ts` | Real DB save, lookup, and clearing, 2 table constraints, and the table accepts every system in the code                                                                                                                                                                                                                                                                                                                 |
| `frontend/src/grade-scale-data.test.ts`         | Range boundaries, shared ranges, comparing higher and lower, values that cannot be compared, Specialty and the driver's license, combinations of target score and grade, and failed records                                                                                                                                                                                                                             |
| `frontend/src/grade-scales.test.tsx`            | Grade table display, 800 points → B2 and goal achieved, goal not met, choosing 120 points by hand, keeping a value chosen by hand, keeping the old format, a goal without a system, the goal form, list failure, list display, a failed record, both goals needed, entering a result from before the result, keeping the saved grade and filling an empty value, a late list, and keeping the grade when marking passed |
