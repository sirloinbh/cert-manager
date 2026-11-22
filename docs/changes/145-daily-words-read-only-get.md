# Pick the daily words without writing on a GET (#145)

- Date: 2026-11-22 (Asia/Seoul)

## Purpose

`GET /api/daily-words` inserted the day's words the first time today was opened. The write was idempotent, but a GET with a side effect makes caching or prefetching unsafe to add later.

## Contents

- `backend/src/routes/daily-words.ts`: `GET /api/daily-words` only reads. A day with no saved words answers an empty list (`words: []`). New `POST /api/daily-words` chooses today's words if they are not chosen yet (same idempotent `INSERT … ON CONFLICT DO NOTHING` as before) and answers today in the same shape as GET. Both share `readDay()`.
- `backend/src/openapi.ts`, `docs/openapi.json`: the GET summary is updated and the POST entry is added (daily-words entries only; regenerated with `npm run openapi`).
- `backend/test/daily-words.test.ts`: GET of today or an earlier day issues no INSERT; POST does, with today's date and 5 words.
- `backend/test/words.integration.test.ts`: GET of an unchosen today is empty and chooses nothing; two parallel POSTs choose once; later days are chosen with POST.

- `frontend/src/word-data.ts`, `frontend/src/daily-words.tsx`: the card loads with GET; when today comes back with no words it calls `dailyWordApi.choose()` (the new POST) once and shows that answer. Earlier days are only read. (Files approved for this issue by the coordinator.)
- `frontend/src/daily-words.test.tsx`: an empty today triggers exactly one POST; already chosen words are only read.

## Verification

- No local PostgreSQL on this Mac: the integration test changes skip locally and run in CI.
- `npm run check`: see the PR.
