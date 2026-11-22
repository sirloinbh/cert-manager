# #152 Mark a goal passed without overwriting other changes

Issue: https://github.com/sirloinbh/cert-manager/issues/152

## Purpose

"Mark as passed" rebuilt the whole goal from the shown copy and sent a full `PUT`, so edits made in another tab were lost. The goal form also said "Loading the grade list." forever when the list was empty.

## Changes

- New `PATCH /api/certifications/:id/status` (`backend/src/routes/certifications.ts`) with body `{ status }`. It updates only `status` and `updated_at` and answers the stored goal. Listed in `backend/src/openapi.ts`; `docs/openapi.json` regenerated.
- `certificationApi.setStatus` (`frontend/src/certification-data.ts`) calls it, and `markPassed` in `certifications.tsx` uses it instead of `update`.
- `useGradeScales` also returns `loaded`; the form hint now says "No grade scales are available." for a loaded but empty list and keeps "Loading the grade list." only while loading.
- Ownership: the route, openapi and backend test edits are in lane-1 files, approved by the coordinator as an ownership exception (diff limited to the new handler).

## Verification

- Route tests (fake pool): only `status` and `updated_at` are written; bad status, missing goal and malformed id are rejected.
- DB integration test: a memo edited elsewhere survives the status change (skipped locally, no PostgreSQL; runs in CI).
- Screen tests: "Mark as passed" sends `PATCH {status}` and no `PUT`; an empty grade list shows the new hint.
- `npm run check`: see the PR.
