# Export personal data to JSON and CSV (#210)

I can download my personal data from Settings. The JSON file is the backup (and the format #211 will restore); a CSV file per table is for reading in a spreadsheet.

## User decision (2026-11-27)

JSON with a `version` plus a CSV per included table. Personal data only: certifications (with their grade scale), exam attempts, study stages and tasks, and custom tasks (`user_actions`). Words, daily words, songs and lyrics are left out.

## Changes

| File                                                                | Change                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `backend/src/data-transfer.ts`                                      | Tables and columns, one read-only snapshot read (`REPEATABLE READ READ ONLY`), CSV writer |
| `backend/src/routes/data-transfer.ts`                               | `GET /api/data-transfer/export` (JSON) and `GET /api/data-transfer/export/:table` (CSV)   |
| `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json` | Route registration and contract                                                           |
| `frontend/src/data-transfer.tsx`, `data-transfer-data.ts`           | "Export data" card on the Settings page: a JSON button and one CSV link per table         |

## File format

- JSON: `{ version: 1, exportedAt, tables: { certifications, examAttempts, studyStages, studyTasks, userActions } }`. Keys are camelCase like the API; rows keep their ids so references can be remapped on restore. Dates are `YYYY-MM-DD`, timestamps are ISO 8601.
- CSV: UTF-8 with a BOM (Excel reads Korean), CRLF line ends, one header row. Text that starts with `=`, `+`, `-`, `@` gets a leading `'` so a spreadsheet does not run it as a formula. The JSON file is not changed this way.
- Both answer with `Content-Disposition: attachment` and `Cache-Control: no-store`.

## Verification

- `npm run check` passes (404 frontend tests, 149 backend tests, build).
- Backend unit tests (fake pool) and frontend tests ran locally. The DB integration test (every row of each table is in the file) is skipped without `TEST_DATABASE_URL`; it runs in CI.
- Never commit an exported file with real data.
