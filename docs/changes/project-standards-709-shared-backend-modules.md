# Adopt the shared db and rate-limit modules (project-standards#709, part 1)

- `inTransaction` (lyrics-store.ts) and `saveSongList` use the managed `withTransaction`; no hand-written BEGIN/COMMIT/ROLLBACK is left. A failed ROLLBACK now destroys the connection instead of returning it to the pool.
- `src/pool.ts` (`connectPool`): the managed `createPool` plus a per-connection `error` listener (pg stops listening on a checked-out client). The server had no error listener before, so a lost idle connection could end the process.
- `src/rate-limit.ts` is removed; `app.ts` uses the managed `apiRateLimit(app)`: 600 per minute per client IP (the last X-Forwarded-For entry, which nginx appends), health not counted. The old default was 1200 and counted every request as one client. The `rateLimit` option is now `requestsPerMinute`.
- Not in this PR: the OpenAPI builder (needs typed path params in the managed builder).
- Verification: typecheck, eslint, prettier, non-DB tests. DB tests run in CI.
