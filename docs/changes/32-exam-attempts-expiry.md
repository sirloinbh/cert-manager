# #32 Build certification acquisition records and expiry date management

- Issue: [#32](https://github.com/sirloinbh/cert-manager/issues/32)
- Branch: `feat/32-exam-attempts-expiry`
- Design: section 5 (`exam_attempts`) of [Service scope and data model](../design/scope-and-data-model.md)

## Purpose

If you miss the expiry of a language score or a cloud certification that has a validity period, you have to take the exam again. Keep exam attempt and acquisition records, fill in the expiry date automatically, and make certifications that are close to expiring easy to see.

## Decision: the last valid day is "the added day"

The design document left this item to be decided in #32. It is computed as valid through the day you get by adding the validity period to the exam date (confirmed 2026-10-30).

| Target           | Official guide                                                                                                                                                                                                                    | Judgment                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| TOEIC            | "성적 유효 기간은 시험 시행일로부터 2년 뒤 해당 시험 일자까지입니다." ("The score is valid for 2 years from the exam date, through the same exam date.") ([Korea TOEIC Committee TOEIC Story](https://www.toeicstory.co.kr/1041)) | Confirmed as the added day                                                       |
| TOEIC Speaking   | I saw that it is the same as TOEIC only in a summary of the official site FAQ in search results. I could not read the text of the [FAQ page](https://m.toeicswt.co.kr/customer/csFaq.php), so I did not see the original          | Same calculation as TOEIC                                                        |
| AWS              | "valid for three years from the date it was earned" ([AWS Recertification](https://aws.amazon.com/certification/policies/recertification/))                                                                                       | There is no day-level guide. Use the same calculation, and the user can fix it   |
| Driver's license | I could not confirm it with an official document. There are news reports and blogs saying that from 2026 the renewal period changed to be based on the birthday                                                                   | The default is a reference value. The user checks the real deadline and fixes it |

## Changes: 2026-10-30

- DB: created the `exam_attempts` table with `database/migrations/003_exam_attempts.sql`. The columns are exactly as in section 5 of the design, and I added an index for lookup by goal. I added a constraint that was not in the design, `exam_attempts_expires_after_exam` (the expiry date is after the exam date), and wrote it in the design document too.
- API: `backend/src/routes/exam-attempts.ts`
  - `GET /api/certifications/:id/attempts`: latest exam date first. 404 for a missing goal.
  - `POST` (201), `PUT /:attemptId` (full replace), `DELETE /:attemptId` (204). 404 for a record of another goal.
  - `GET /api/exam-attempts/latest`: for each goal, the one record with the latest exam date among the `passed` and `scored` records. The dashboard card uses it.
  - Every response includes `daysUntilExpiry` (days from today to the expiry date, negative if past).
  - Expiry date save rule: if `expiresOn` is left out, SQL computes it from the goal's validity (`date + make_interval`, with end-of-month adjustment), a date is kept as it is, and `null` means "unknown". It is always `NULL` if the result is `waiting` or `failed` or the goal is `none`.
  - Before the result (`waiting`), a score and grade are not accepted. The grade before the result is `NULL`, and a grade missing after the result is `''`.
- `backend/src/routes/certifications.ts`: when a goal is changed to `none`, the `expires_on` of its records is cleared too. It is one SQL statement (a CTE), so both succeed or both fail together.
- `backend/src/validation.ts`: moved the date and string checks and `body` and `toId` so that the goal and record routes share them. The date error message takes the field name.
- Screens
  - Added an "Exam attempt and acquisition records" section to the goal detail. Each record shows the result, the score and grade, goal achieved, and the expiry state with days left. Earlier records show "newer record exists".
  - Add and edit record dialog: before the result, the score, grade, and expiry date fields are hidden. The expiry date is pre-filled as the validity period after the exam date, and follows when the exam date changes. If the user edits or clears it, that value is kept, and a "Fill" button is shown when it differs from the computed value.
  - When a result is newly saved as "passed", it asks "Change the goal status to passed?". If answered, the goal update API is called separately.
  - Dashboard "expiring soon" card: shows goals that have expired or have 90 days or fewer left, earliest expiry first.
  - Split the display rules into `frontend/src/exam-attempt-data.ts` and the screen into `frontend/src/exam-attempts.tsx`. Moved `useLoad` to `frontend/src/use-load.ts`, the shared form values to `frontend/src/form-fields.ts`, and the `CertificationPaths` type to `frontend/src/certification-data.ts`.

Not fixed: records that are expiring soon are not shown in the goal list (`/certifications`). The issue says "a list ordered by expiry date or a dashboard card", so I made a card. Editing the exam date of a saved result does not change the expiry date by itself. Fill it again with the "Fill" button that appears on the edit screen.

## Tests

| File                                             | Behavior verified                                                                                                                                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/exam-attempts.test.ts`             | Numeric ID, telling apart an omitted expiry date, `null`, and a date, the grade before the result, 9 kinds of wrong input that give a Korean 400 and do not reach the DB, 404 for a missing goal or record, 400 for a bad ID, delete 204                                                    |
| `backend/test/exam-attempts.integration.test.ts` | On a real DB: exam date + 2 years, leap-year end-of-month adjustment (2024-02-29 → 2026-02-28), days left (136, -244, 31), sorting, filling after the result is entered, 404 for another goal, picking the latest record, switching to `none`, deleting together, and the table constraints |
| `frontend/src/exam-attempt-data.test.ts`         | Adding months (leap year, end of month, crossing a year), expiry state (90 and 91 days, today, past, unknown, none), days-left text, goal achieved, picking the reference record, card sorting                                                                                              |
| `frontend/src/exam-attempts.test.tsx`            | Pre-fill and following the exam date, editing and clearing, a goal with no expiry, expiry shown only on the latest record, the passed question (change, leave as is, not asked if already passed), server error, delete confirmation, dashboard card                                        |

After the 1st review, I added tests for closing while saving, focus restore, a failed reload, a failed status change, the Fill button, a goal with unknown validity, and an out-of-range year to `frontend/src/exam-attempts.test.tsx` and `frontend/src/exam-attempt-data.test.ts`. For the block on closing while saving and the focus restore, I briefly reverted the code and confirmed that the matching test fails.

The fake API of `frontend/src/app.test.tsx` and `frontend/src/certifications.test.tsx` was changed to return an empty list for record requests.

## Verification

- Migration: applied it automatically to an empty test DB (Docker `postgres:17-alpine`) and then ran `003` again. Only `already exists, skipping` notices appeared and there were no errors.
- `TEST_DATABASE_URL=… npm run check`: pass. Format, lint, and type checks pass, backend 20 passed (0 skipped), frontend 110 passed, skills 4 passed, build succeeded.
- `npm run knip`: no findings. `node .standards/check.mjs`: pass.
- Browser (Playwright, Vite 5206 + backend 3106 + temporary DB). No console errors or warnings and no horizontal overflow.
  - Mobile 390×844: registered a TOEIC score of 910 (filled 2026-02-28 for a leap-year exam date and 2027-03-15 for 2025-03-15, goal achieved, valid 136 days). Passed record → question → choosing change set the goal status to "passed" ("합격"), and the earlier record shows "newer record exists" ("새 기록 있음"). Engineer Information Processing (no expiry) has no expiry date field. The dashboard shows AWS CP "expiring soon · 51 days left" ("만료 임박 · 51일 남음").
  - PC 1440×900: a record before the result has no score field, entering the result in edit filled 2029-10-20, and after the delete confirmation the empty message showed. The dashboard has 2 columns.
  - Fixed in the browser check: while the edit dialog was closing, the title changed to "Add" and the form disappeared. I fixed it to keep the record while closing and confirmed that the title stays.

## Automatic code review: 2026-10-30

1st (read-only review agent): 0 high, 2 medium, 2 low. I confirmed all 4 and fixed them in this PR.

| Finding                                                                                       | Handling                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Closing the dialog with Esc or close while saving loses the error and allows a duplicate save | Made it not close while saving                                                                                                            |
| Focus is lost when the dialog closes (a Radix Dialog without a trigger)                       | Returned it with `onCloseAutoFocus` to the button that opened it, or to the section title if none. Keep the existing list while reloading |
| The guide text differs from the real behavior for a saved record with an empty expiry date    | Fixed the text, and show a "Fill" button when it differs from the computed value                                                          |
| `addMonths` throws an error for an out-of-range year and breaks the screen                    | Return an empty value past year 9999 and added `max` to the date field                                                                    |

Split out: when the question box (`ConfirmDialog`) is opened without a `trigger`, focus falls to `body` after it closes. I confirmed it in the browser, and since it is a centrally managed file I split it into [project-standards#356](https://github.com/sirloinbh/project-standards/issues/356). Behavior is fine and it is an inconvenience for keyboard users, so it does not block this PR.

2nd (review agent that looked at the diff again): 0 high or medium, 3 low. All were fixed, and the review ended after 2 rounds.

- Pressing "Fill" makes the button disappear and focus jumps to the top of the dialog → moved it to the date field that was filled.
- If the reload after a delete fails, the deleted row stays and edit and delete can be pressed. It came from "keep the existing list" in the 1st fix → remove it from the list right away when deleted.
- Focus falls to `body` after a delete → moved it to the section title.

After the fixes I checked again in the browser. After Fill the focus is on the expiry date field, and after a delete it is on the section title, the screen is not locked after the dialog closes, and there are no console errors or warnings. A failed reload after a delete was checked only by a test.

## CodeQL alerts: 2026-10-30

- CodeQL raised 5 `js/missing-rate-limiting` alerts (#8 to #12) on the 5 new API routes. There were no warnings on the SQL side. CodeQL is not a required check (required: `ci / verify`, `ci / docker-build`).
- Rate limiting is handled by `limit_req` in `frontend/nginx.conf` (central decision project-standards#291). With the user's confirmation, I closed #8 to #12 and #7 of the same kind that was open on main (`backend/src/app.ts`) as "won't fix".
