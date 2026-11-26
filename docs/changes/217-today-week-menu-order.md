# 217 Open on the day view and use the shared menu order

## Purpose

User requirement (2026-11-26, central rule sirloinbh/project-standards#1128). cert-manager has no day log, so the user chose option A on the issue: Today, Week, 12 weeks, the other pages, Dashboard, Settings.

## Changes

- **Today** (`/`, the start page): today's study tasks and the words of the day (the old Dashboard cards for those two).
- **Week** (`/week`): the exams and study tasks of each day, Sunday to Saturday; earlier and later weeks can be opened.
- **12 weeks** (`/weeks`): the next 12 weeks starting with this one: tasks done and in all, exams, and a bar per week.
- **Dashboard** (`/dashboard`, just above Settings): upcoming exams, expiring certifications, and a new card with the progress of each study plan.
- Menu order: Today, Week, 12 weeks, Certifications, Song lyrics, Vocabulary, Dashboard, Settings (desktop menu and mobile sheet share one list). Unknown addresses still redirect to Today.
- Backend, two read endpoints in `routes/study-plans.ts`, listed in `openapi.ts` and `docs/openapi.json`:
  - `GET /api/study-tasks?from=&to=`: tasks due from one day to another, both included, done or not (at most 366 days).
  - `GET /api/study-tasks/progress`: for each goal that has tasks, the tasks done and in all.
- Tests: `week-range.test.ts`, `plan-weeks.test.tsx`, `app.test.tsx`, the dashboard tests now open `/dashboard`, and an integration test for both endpoints (it needs `TEST_DATABASE_URL`, so it runs in CI).

## Limits

- The 12 weeks page looks forward (this week and the next 11), because study plans and exams are plans.
- Week and 12 weeks read only; tasks are still checked off in the study plan of a goal.
