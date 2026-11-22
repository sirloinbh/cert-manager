# #146 Keep the first error and drop broken clients in script transactions

- `backend/src/lyrics-store.ts`: `inTransaction` is now generic and returns the work's value. It wraps the central `withTransaction`, which already keeps the first error when `ROLLBACK` fails and releases the client with `release(true)` so pg destroys it. The scripts (`lyrics-fetch`, `translation-files`, `word-files`, `word-list`) already used it; `song-list-save.ts` already used `withTransaction`, so no hand-written `BEGIN`/`ROLLBACK` is left in these files.
- `backend/src/song-list-save.ts`: each album now saves its songs with one `unnest` upsert and its album tracks with one `unnest` insert, instead of two queries per track inside the transaction.
- `backend/test/lyrics-store.test.ts`: a failing `ROLLBACK` throws the original error and releases the client with `true`; a working one releases with `false`; the work's value is returned.

## Checks

- `npm run check` passed: format, lint, contract, type check, build; backend 130 passed and 16 skipped, frontend 344 passed and 3 skipped, skills 4 passed.
- The DB integration tests (including `song-list-save.integration.test.ts`, which covers the new batch SQL) were skipped locally: no PostgreSQL on this Mac. CI runs them.
