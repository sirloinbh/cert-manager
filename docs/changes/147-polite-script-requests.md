# #147 Make every script request wait and time out politely

- `backend/src/polite-fetch.ts`: the polite gap is slept in a `finally` around the fetch, so a thrown fetch (DNS, reset, timeout) also waits before the caller retries. Bodies of 404 and other non-OK responses are cancelled.
- `backend/src/import-song-list.ts`: the own request loop is replaced by `politeGet`, which brings the shared user agent, the 30 s timeout, 429 handling and the ceiling on `Retry-After`.
- `backend/test/polite-fetch.test.ts`: a throwing fetch still waits the gap; an unread error body is cancelled.

## Checks

- See the PR for the `npm run check` result. No DB is available locally, so DB integration tests are skipped here and run in CI.
