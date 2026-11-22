# #147 Make every script request wait and time out politely

- `backend/src/polite-fetch.ts`: the polite gap is slept in a `finally` around the fetch, so a thrown fetch (DNS, reset, timeout) also waits before the caller retries. Bodies of 404 and other non-OK responses are cancelled.
- `backend/src/import-song-list.ts`: the own request loop is replaced by `politeGet`, which brings the shared user agent, the 30 s timeout, 429 handling and the ceiling on `Retry-After`.
- `backend/test/polite-fetch.test.ts`: a throwing fetch still waits the gap; an unread error body is cancelled.

## Checks

- `npm run check` passed: format, lint, contract, type check, build; backend 126 passed and 13 skipped, skills 4 passed.
- The 13 DB integration tests were skipped (no local PostgreSQL, `TEST_DATABASE_URL` unset); CI runs them. This change does not touch the DB.
