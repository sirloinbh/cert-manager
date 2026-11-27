# #212 Study pace on the goal detail page

Issue: https://github.com/sirloinbh/cert-manager/issues/212 (epic #207)

## Purpose

Show how many study tasks to finish each day to be ready for the exam, and say when the user is behind plan.

## Changes

- `frontend/src/study-pace-data.ts`: `studyPace(stages, daysUntilExam, examDate)`.
  - Tasks per day = open tasks ÷ days left, rounded up (user decision, 2026-11-27).
  - Behind plan when an open task has a due date before today, or more tasks are open than the plan expected by today. The plan expects tasks to be spread evenly from the earliest stage start date to the exam date, so expected open = ceil(all tasks × days left ÷ plan days). Without a stage start date only the overdue rule applies.
  - No pace when there is no exam date, the exam is today or past, or no task is open.
- `frontend/src/study-pace.tsx`: `StudyPaceMessage`, built from the plan the plan section already loaded (no new API or request), shown next to the exam countdown on the goal detail page only (the list would otherwise load one plan per goal). It follows every change of the plan.
- `frontend/src/certifications.tsx`: keeps the plan the plan section reports and shows the message under the "Target exam date" field.
- `frontend/src/study-plan.tsx` (outside the lane list, a small additive edit): optional `onPlanChange` prop that reports the plan as shown.

- `frontend/src/grade-scales.test.tsx`: the Information Processing test waited with `findAllByText`, which returns at the first match, so it only passed when the attempts happened to load first. It now waits for both matches.

## Verification

- `vitest run src/study-pace src/certifications.test.tsx`: 25 passed.
- `npm run check`: passed (415 tests passed, 3 skipped; DB tests skip locally and run in CI).
- 390x844 and 1440x900 browser check: not done. This Mac has no PostgreSQL, so the API cannot serve a real goal; the message is one text line in the existing detail field, covered by component tests.

## Limits

- Ticking a task updates the message only once the server answers (the plan section's optimistic ticks are not reported).
