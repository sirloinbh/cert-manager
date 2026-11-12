# #30 Build the certification goal registration and list screens

- Issue: [#30](https://github.com/sirloinbh/cert-manager/issues/30)
- Branch: `feat/30-certification-goals`
- Design: sections 3 (screens) and 5 (`certifications`) of [Service scope and data model](../design/scope-and-data-model.md)

## Purpose

Register the certifications you want to earn as goals, and see the target exam date and status on one screen. Expiry date management (#32) and study plans (#33) are built on top of this goal data.

## Changes: 2026-10-30

- DB: created the `certifications` table with `database/migrations/002_certifications.sql`. The columns and `CHECK` are exactly as in section 5 of the design. The validity months have a value only when the kind is `months`, tied together with the table constraint `certifications_validity_months`. It is personal data, so no seed was added.
- API: `backend/src/routes/certifications.ts`
  - `GET /api/certifications`: `{ today, certifications }`. Sorted by category (English → development → life) and by nearest target exam date, with no exam date last.
  - `GET /api/certifications/:id`, `POST` (201), `PUT /:id` (full replace), `DELETE /:id` (204). A missing goal gives 404 `자격증 목표를 찾을 수 없습니다` ("Certification goal not found").
  - Every response includes `daysUntilExam` (days from today to the target exam date, negative if past). "Today" is the server `serviceDate()` (`Asia/Seoul`), and the days are counted with SQL `date - date`.
  - Input is checked with Zod and the error messages are in Korean. The issuer and goal description, which have no length limit in the design, are limited to 200 characters in the API (no DB constraint). The memo has no limit (body size limit 256kb).
  - The Zod error check uses only the `message` option and `code: 'custom'`, so it keeps working in the zod 4 switch (PR #15) too.
- Changed `backend/src/app.ts` to use `notFound`, `errorHandler`, and `serviceDate` from the centrally managed file `backend/src/standard/http.ts`. Deleted the app's own error handler and `serviceDate`.
- Screens
  - Changed the menu to 5 items: Dashboard · Certifications · Pop song lyrics · Word list · Settings. Pop song lyrics and Word list are still empty-state messages.
  - `/certifications`: grouped by category with the counts shown. Each card shows the status, the issuer and goal, the target exam date, and "N days left / exam today / N days past / exam date not set" (Korean UI text).
  - `/certifications/new`, `/certifications/:id/edit`: the register and edit form. The validity months field appears only when "enter number of months" is chosen. An empty number or date field is sent as "not set" (`null`).
  - `/certifications/:id`: the detail with edit and delete. Delete goes through the shared confirmation dialog, which says that the attempt records and study plan attached to it are deleted too.
  - Dashboard "nearest exam" card: shows up to 3 goals whose status is planned, studying, or registered and whose exam date is today or later, nearest first.
  - Screen addresses are kept in one place, `pages` in `frontend/src/app.tsx`, and passed to the certification screens as an address function (`CertificationPaths`).
  - API calls and display rules are in `frontend/src/certification-data.ts`, and the screens are in `frontend/src/certifications.tsx`.

## Tests

| File                                                     | Behavior verified                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/certifications.test.ts`                    | Passing today's date and numeric IDs in the list, defaults for missing optional fields, 12 kinds of wrong input that give a Korean 400 and do not reach the DB, 404 for a missing goal, 400 for a bad ID, full replace and 204 delete |
| `backend/test/db.integration.test.ts`                    | On a real DB: register → sort (category, date, none last) → days left (21, -5, null) → full replace → 404 after delete. The table constraints block a months mismatch and an empty name                                               |
| `frontend/src/certification-data.test.ts`                | Days-left text, validity text, category grouping order, choosing the nearest exams (excluding past dates, no date, and passed; including today)                                                                                       |
| `frontend/src/certifications.test.tsx`                   | List grouping, sorting, and text, empty list message, register → detail → reflected in the list, server error display, edit, delete confirm and cancel, missing goal message, dashboard card                                          |
| `frontend/src/app.test.tsx`                              | The order of the 5 menu items, empty screens for pop song lyrics and word list. Existing tests were changed to return an empty list for requests other than `/api/health`                                                             |
| `backend/test/helpers.ts`, `backend/test/health.test.ts` | The test helper now sends a method and body and reads 204. Changed where `serviceDate` is imported from to `standard/http.ts`                                                                                                         |

## Verification

- Migration: applied `database/migrations/*.sql` twice with psql to an empty test DB (Docker `postgres:17-alpine`). The second time showed only `already exists, skipping` notices and no errors.
- `TEST_DATABASE_URL=… npm run check` (Node 24.21.0 / npm 11.19.0): pass. Format, lint, and type checks pass. Backend 12 passed (including 2 DB integration, 0 skipped), frontend 66 passed, skills 4 passed, build succeeded.
- `npm run knip`: no findings. `node .standards/check.mjs`: pass.
- Browser (Playwright, local Vite + API + temporary DB):
  - Registered the first 6 goals. TOEIC, TOEIC Speaking, Engineer Information Processing, AWS CP, and AWS SAA were added through the API, and the driver's license through the mobile register screen. The exam dates (TOEIC 2026-12-13, AWS CP 2026-11-21) are example values for the screen check.
  - Mobile 390×844: the register form, the detail after registering, the list (groups by category and days left), the delete dialog, and the dashboard card.
  - PC 1440×900: the list (2 columns), the dashboard card, edit (driver's license status → studying, saved confirmed through the API), and deleting a temporary goal (404 from the API after deleting, and the list went back to 6).
  - No console errors or warnings.
  - Fixed during the check: the screen description and the delete dialog sentence broke in the middle of a word, so I added `break-keep`. The dialog component is a centrally managed file, so I wrapped the sentence passed to it instead.
- Local DB: the Compose DB on the user's PC is not running because there is no `.env`. The 6 above were put in a temporary DB for the check, and have to be registered again on the screen in the DB you really use.

## Applied the 1st automatic review: 2026-10-30

The 1st review of PR #41 (a read-only agent separate from the writing context) found 0 high, 0 medium, and 4 low items. All were fixed in this PR.

- Low: when the body was a JSON array, Zod gave an English message (`Expected object, received array`). Added `요청 본문은 JSON 객체여야 합니다` ("The request body must be a JSON object") to the object schema. A body with only a string is blocked first by `express.json()` as `요청 본문의 JSON 형식이 올바르지 않습니다` ("The request body is not valid JSON").
- Low: `0000-01-01` passes the date check, but PostgreSQL rejects year 0, which gave a 500. Set the lower limit of the target exam date to `1900-01-01`.
- Low: when delete fails with an error other than 404, the dialog stays open, but the error message appeared on the page behind the dialog and could not be seen. The error is now shown as a toast above the dialog.
- Low (tests): put the three cases above into tests. An array body, a string body, and a year-0 date in `backend/test/certifications.test.ts`, and a delete failure (dialog stays, error shown, address unchanged) in `frontend/src/certifications.test.tsx`. `daysUntilExam` is computed in SQL, so a fake-DB unit test cannot verify it, and the DB integration test run in CI checks it.
- Verification: `TEST_DATABASE_URL=… npm run check` passes. Backend 12 passed (0 skipped), frontend 67 passed, skills 4 passed, build succeeded. `npm run knip` has no findings.

## 2nd automatic review: 2026-10-30

I looked again at the 1st fix commit and the whole PR. No findings.

- Confirmed that the fixes for the 4 findings of the 1st review are correct. They are the Korean message for the array body, the 1900-01-01 lower limit, the delete failure toast, and the tests.
- The "the toast shows above the dialog" assumption the reviewer left was confirmed with the token values. `--z-toast` is 70 and `--z-modal` is 50 (`@sirloinbh/design-tokens`).
- The review is at most 2 rounds, so it ends here.

## CodeQL alerts: 2026-10-30

- On the first push, CodeQL raised 5 `js/missing-rate-limiting` (no request rate limit) alerts. All 5 new API routes are affected. CodeQL is not a required check (required: `ci / verify`, `ci / docker-build`).
- Central decision project-standards#291: request rate limiting is done not in app code but with `limit_req` in `frontend/nginx.conf` (10 per second per IP, 40 in a burst). It is already in this repository. CodeQL recognizes only limits inside Express code, so these alerts do not close, and closing app repository alerts is done after user confirmation.
- So I did not add a limit in the app code, and I ask the user whether to close the alerts.

## Limits and follow-up

- Long names on the dashboard card are shortened to one line (the full name is in the list and the detail).
- The app name (top and tab title) and the `service` value of the health check are still "영어 공부" ("English study") and `english-study`. The rename is done in [#27](https://github.com/sirloinbh/cert-manager/issues/27).
- Attempt records and expiry dates are attached to this goal in #32, and the study plans in #33.
