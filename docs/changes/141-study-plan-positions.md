# Append study stages and tasks without position conflicts (#141)

- Date: 2026-11-22 (Asia/Seoul)

## Purpose

Two quick adds (a double-submit) to the same goal or stage both read the same `MAX(position)`, so the second hit the unique `(…, position)` constraint and failed with a 500 instead of saving.

## Contents

- `backend/src/routes/study-plans.ts`: `POST /api/certifications/:id/stages` and `POST /api/study-stages/:id/tasks` now run in one transaction. They lock the parent goal or stage row with `SELECT … FOR NO KEY UPDATE` first, then insert in a separate statement, so the position is read after the lock is held (a single `INSERT … SELECT … FOR UPDATE` would still read `MAX` from the older snapshot). A missing parent is still a 404 with the same message.
- `backend/test/study-plans.test.ts`: the fake pool supports `connect()`; the add test checks the lock runs before the insert.
- `backend/test/study-plans.integration.test.ts`: two parallel stage POSTs and two parallel task POSTs both answer 201 with positions 1 and 2.

## Verification

- No local PostgreSQL on this Mac: the new integration test skips locally and runs in CI.
- `npm run check`: see the PR.
