# #33 Build the study plan feature per certification

- Issue: [#33](https://github.com/sirloinbh/cert-manager/issues/33)
- Branch: `feat/33-study-plans`
- Design: section 4 (order column) and section 5 (`study_stages`, `study_tasks`) of [Service scope and data model](../design/scope-and-data-model.md)

## Purpose

Registering only goals does not tell you when to study what. Write stages and tasks for each goal, and make it possible to see the progress, the days left until the exam, and today's tasks. The real plan content is written in [#34](https://github.com/sirloinbh/cert-manager/issues/34).

## Changes: 2026-10-30

- DB: created `study_stages` and `study_tasks` with `database/migrations/004_study_plans.sql`. The columns are exactly as in section 5 of the design. The order UNIQUE is a table constraint that is `DEFERRABLE INITIALLY DEFERRED`, as in section 4 of the design.
- API: `backend/src/routes/study-plans.ts`
  - `GET /api/certifications/:id/plan`: returns the stages in order, with the tasks of each stage grouped in order. 404 for a missing goal.
  - `POST /api/certifications/:id/stages`, `PUT` and `DELETE /api/study-stages/:id`. Deleting a stage deletes its tasks.
  - `POST /api/study-stages/:id/tasks`, `PUT`·`DELETE /api/study-tasks/:id`.
  - `PATCH /api/study-tasks/:id/completion`: `{ completed }`. Even if you finish an already finished task again, the first completion time is kept.
  - `GET /api/study-tasks/today`: tasks that are not finished and whose deadline is today or past, earliest deadline first, with the goal name.
  - New stages and tasks are added at the end (`MAX(position) + 1`). Every response includes `daysUntilDue` (days from today to the deadline, negative if past).
- Screens
  - Added a "Study plan" section to the goal detail. It shows the overall progress, the days left until the target exam date, the period and progress of each stage, task checkboxes, and deadlines with days left. A task that is not finished and past its deadline is shown in red. A stage with no tasks does not show progress.
  - Add and edit dialogs for stages and tasks, and a delete confirmation. When deleting a stage, it says how many tasks are deleted with it.
  - Dashboard "today's tasks" card. Pressing a task goes to the detail of that goal.
- Code moved to be shared: moved "keep the list while reloading" from the attempt record screen to `useReloading` (`frontend/src/use-load.ts`), the focus restore to `useSectionFocus` (`frontend/src/use-section-focus.ts`), and the days-left text to `deadlineCountdown` (`frontend/src/certification-data.ts`), so both screens share them.

Not fixed: I did not build a screen for reordering stages and tasks. It is not in the issue tasks, and for now they are shown in the order added. The deferred UNIQUE is in as designed, and an integration test confirmed that a transaction that swaps two rows passes.

If you add at the same moment in two tabs, the order numbers can collide and give a 409 "이미 등록된 항목입니다" ("This item is already registered"). There is one user, the lock during saving blocks it within the same tab, and saving again succeeds, so I added no lock or retry.

## Tests

| File                                           | Behavior verified                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/study-plans.test.ts`             | Plan grouping and numeric IDs, passing today's date, trimming titles and date defaults, 9 kinds of wrong input that give a Korean 400 and do not reach the DB, 7 kinds of 404 for a missing item, 400 for a bad ID, delete 204                                                                                                                  |
| `backend/test/study-plans.integration.test.ts` | On a real DB: order numbers, grouping, today's tasks (including past and today, excluding tomorrow and no date), complete and undo, keeping the first completion time, keeping order and completion after an edit, swapping the order, deleting together, and the table constraints                                                             |
| `frontend/src/study-plan-data.test.ts`         | Progress, a stage with no tasks, the past-due judgment (excluding finished tasks), period text                                                                                                                                                                                                                                                  |
| `frontend/src/study-plan.test.tsx`             | Adding the first stage and task, checking changes the stage and overall progress before the response, a rapid second click is sent once, a failed check and the revert, showing the saved content after a failed reload, showing the exam date, showing past due, edit, clearing a date, delete and focus, closing while saving, dashboard card |

The fake API of `frontend/src/app.test.tsx`, `frontend/src/certifications.test.tsx`, and `frontend/src/exam-attempts.test.tsx` was changed to return an empty list for plan requests.

## Verification

- Migration: applied it automatically to an empty test DB (Docker `postgres:17-alpine`) and then ran `004` again. Only `already exists, skipping` notices appeared and there were no errors.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 28 passed (0 skipped), frontend 139 passed, skills 4 passed, build succeeded.
- `npm run knip`: no findings. `node .standards/check.mjs`: pass. `node .standards/secret-scan.mjs`: no suspicious items.
- Browser (Playwright, Vite 5206 + backend 3106 + temporary DB). No console errors or warnings and no horizontal overflow.
  - Mobile 390×844: added a stage, added 4 tasks, checking changed the overall and stage progress from 0% to 25%, 2 days past due in red, "목표 시험일까지: 44일 남음" ("Until the target exam date: 44 days left"). The dashboard "today's tasks" showed only past and today tasks.
  - PC 1440×900: moved to the detail from the dashboard task link, added a second stage, edited a task, checking gave 50%, after deleting a stage the focus went to the "Study plan" title, and the finished task disappeared from the dashboard.

## Automatic code review: 2026-10-30

1st (read-only review agent): no blocking defects. 2 medium and 3 low.

| Finding                                                                           | Handling                                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Checking and progress wait for the server response and do not change "right away" | Reflect it the moment it is pressed and revert if it fails. Dim the checkbox while saving. Added a test that holds the response |
| If the reload after saving fails, the saved content is not shown                  | Put the save response on the screen right away. Fixed the attempt record screen too, since it is the same code                  |
| If the reload fails after deleting the last stage, there is no add button         | Show the empty message based on the data. Fixed the attempt record screen too                                                   |
| A long title with no spaces can overflow                                          | Added `wrap-anywhere` to the title, the progress text, and the dialog description                                               |
| Adding at the same time in two tabs shows a conflict message                      | Not fixed. The reason is in "Not fixed" above                                                                                   |

2nd (review agent that looked at the diff again): 0 high or medium, 3 low. All were fixed, and the review ended after 2 rounds.

- The text of a past-due task on the dashboard is bigger than today's task. The tailwind-merge in the central `cn()` treats `text-body-sm` as a color and removes it → stopped using `cn()` at the call site. The root fix was split into [project-standards#357](https://github.com/sirloinbh/project-standards/issues/357).
- When a task title wraps, the line spacing is 1 and the checkbox position is off → set the line spacing.
- Assistive technology cannot tell that a click during saving is ignored → added `aria-disabled`.

## Merge main: 2026-10-31

- The 9 CodeQL js/missing-rate-limiting warnings were not closed but fixed with `express-rate-limit` in [#49](49-api-rate-limit.md) by user decision. After #49 was merged, I merged `origin/main` into this branch. The conflict was one place in the `docs/next-steps/README.md` table, and I chose the table from the side where #33 is done.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Backend 33 passed (0 skipped), frontend 139 passed, skills 4 passed, build succeeded. `npm run knip`: no findings.
- On this PC's PostgreSQL 17, applied `004` twice each to `cert` and `cert_test`, and there were no errors.
