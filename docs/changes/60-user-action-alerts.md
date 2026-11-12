# #60 Show things the user must do as notifications at the top of the app

- Issue: [#60](https://github.com/sirloinbh/cert-manager/issues/60)
- Branch: `feat/60-user-action-alerts`
- Design: section 5 (`user_actions`) of [Service scope and data model](../design/scope-and-data-model.md)

## Purpose

Keep you from missing things the app cannot do for you, such as registration and checking documents, while you use the app. The deadline for the Engineer Information Processing practical exam is the 3rd session of 2027, and the registration period is only a few days.

## Judgments

| Item              | Judgment                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meaning of alerts | They are in-app notifications: a bell icon in the top bar with a count, a list panel, and a toast shown once when the app opens. I did not build push or email, which are out of the design scope |
| When visible      | From the notification start date (`remind_from`) until it is completed. Next year's registration alerts do not pile up now                                                                        |
| Sorting           | Nearest deadline first, with tasks that have no deadline last. A past deadline stays visible until it is completed and is red                                                                     |
| Where stored      | A new table `user_actions`. Study tasks (`study_tasks`) belong to a stage and count in the progress, so I did not mix them                                                                        |
| Top bar           | Put it in the `actions` slot without changing the centrally managed file `app-shell.tsx`                                                                                                          |
| Link              | Accepts only `http` and `https` addresses. It becomes the `href` on the screen, so values like `javascript:` are blocked in the API and the table                                                 |
| Screen scope      | Built only viewing and marking complete, because the requirement is display. Register, undo complete, and delete are only in the API                                                              |
| Personal data     | I did not put the real tasks in a migration seed and put them into the app on this PC through the API                                                                                             |

## Changes: 2026-10-31

- DB: `database/migrations/006_user_actions.sql`.
- API: `backend/src/routes/user-actions.ts`. `GET /api/user-actions`, `POST`, `PUT /:id/completion`, `DELETE /:id`.
- Screens: `frontend/src/user-actions.tsx`, `frontend/src/user-action-data.ts`, `frontend/src/app.tsx`.
- Docs: section 5 of the design and the estimated numbers of later migrations, `docs/plans/README.md`, and the daily log.
- Put 6 things to do by hand into this PC's app DB `cert`. 2 are visible today, and the rest appear on their notification start dates.

## Tests

| File                                            | Behavior verified                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/user-actions.test.ts`             | The list conditions and numeric IDs, defaults, Korean 400 for 10 kinds of wrong input (including a `javascript:` link), completion input, 404 for a missing item, 400 for a bad ID, delete 204                                                                                                                                                                   |
| `backend/test/user-actions.integration.test.ts` | On a real DB: before and after the notification start date, sorting by deadline, complete, complete again, undo, and delete, allowing an uppercase link, and 3 table constraints                                                                                                                                                                                 |
| `frontend/src/user-actions.test.tsx`            | The count and panel content, a past deadline, the toast and no showing again, when there are no alerts, the count and focus after completing, the last item, preventing duplicate completion, a failed completion and reload, a failed reload, a first load failure and retry, reloading when the panel or tab comes back, waiting on another row, the 99+ badge |

Added `/api/user-actions` to the fake API of the other screen tests.

## Verification

- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 46 passed (0 skipped), frontend 183 passed, skills 4 passed, build succeeded.
- `npm run knip`: no findings.
- Migration: applied `006` twice each to `cert` and `cert_test` on this PC's PostgreSQL 17, and there were no errors.
- Browser: checked with headless Edge on Vite 5206 + backend 3106 + `cert_test`. I deleted the temporary alerts after the check, and I looked at the screenshots only locally.
  - Same result for mobile 390×844 and PC 1440×900: the bell icon "3건" ("3 items"), the toast once, the past deadline at the top in red, items before their start date hidden, the shortcut link, completing reduces it to "2건" ("2 items") with focus on the panel title, and closing with Esc puts focus on the bell icon.
  - No console errors or warnings and no horizontal overflow.
  - After the 1st review fixes: on both mobile and PC the toast does not cover the bell, and the close button stays visible even when you scroll a list of 14 items. The first load failure and reload, and the 2nd review fixes, were checked only by tests.

## Automatic code review: 2026-10-31

1st (read-only review agent): 0 high, 3 medium, 6 low, 3 uncertain. I fixed all except 1 uncertain one (the timing of the "no alerts" assertion).

| Finding                                                           | Handling                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A link with an uppercase scheme gives a 500                       | Matched the table rule to the API. I re-applied the same constraint to both DBs on this PC |
| A first load failure is not told apart from "no alerts"           | Put a different label on the bell and made a reload button                                 |
| If the date changes while the app stays on, the count is stale    | Read again when the panel opens and when the tab becomes visible                           |
| The in-progress display is only one row                           | Block all rows while a completion request is running                                       |
| The row stays after a failed completion (including 404)           | Read the list again if it fails                                                            |
| Keyboard focus can be lost after a failed completion              | Use `aria-disabled` instead of `disabled`                                                  |
| On mobile the toast covers the bell (confirmed with a screenshot) | Show only this toast at the bottom of the screen                                           |
| In a long list the close button scrolls away                      | The list scrolls, not the panel                                                            |
| The shortcut link name is the same on every row                   | Added the title and a new tab notice                                                       |
| No test protects "once" and the big count display                 | Added tests                                                                                |

The timing of the toast assertion in the "no alerts" test was left in the 1st round and fixed after a 2nd finding.

2nd (review agent that looked at the diff again): 0 high, 1 medium, 5 low. All were fixed, and the review ended after 2 rounds.

| Finding                                                                 | Handling                                                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| After the 1st `aria-disabled`, the button while requesting looks normal | Dimmed it and made it unclickable                                                                                               |
| The failure display disappears while reloading                          | Keep the last error until the next success                                                                                      |
| Pressing reload loses focus                                             | Keep the button during the retry too                                                                                            |
| The error and the "none" message show together                          | If there is an error, "none" is not shown                                                                                       |
| The tests do not verify as much as the name or the record               | Changed to retry recovery, an alert that disappears by 404, leaving the tab, and the total count assertion after the toast wait |
| The basis in the change record is wrong                                 | Fixed it with the sentence above                                                                                                |

## Limits

- It is visible only when you open the app. If the app is off, it cannot notify you.
- You cannot add alerts or edit dates on the screen. When the 2027 announcement comes out and you fix the dates, you need the API or new work.
- The registration deadlines of the alerts are tentative values carried over from the 2026 schedule.
