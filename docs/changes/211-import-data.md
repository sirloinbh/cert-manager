# Restore personal data from an export file (#211)

I can restore data from a file made by "Export data (JSON)" on the Settings page. The import adds what is missing and never touches what exists.

## User decision (2026-11-27)

Restore mode is **merge, keep existing**: rows from the file are added, rows that already exist are skipped, nothing is overwritten. The import is one transaction and a bad file changes nothing. Rows match on natural keys, not ids; references between imported rows are remapped to the new ids.

## Natural keys

| Table          | Key                         |
| -------------- | --------------------------- |
| certifications | name + category + issuer    |
| examAttempts   | certification + exam date   |
| studyStages    | certification + title       |
| studyTasks     | stage + title               |
| userActions    | title + reminder start date |

A child row follows its parent's match: when a certification already exists, the file's stages are matched against the stages of that existing certification. A stage or task keeps its file position when it is free under its parent and takes the next free position otherwise. The keys live in one place, `backend/src/data-transfer-import.ts`.

## Changes

| File                                                                 | Change                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/data-transfer-file.ts`                                  | Zod schema of the file: version, every row with the rules of the matching API input, references, duplicate ids and positions |
| `backend/src/data-transfer-import.ts`                                | The merge, in the caller's transaction, answering added and skipped rows per table                                           |
| `backend/src/routes/data-transfer.ts`                                | `POST /api/data-transfer/import` (limit 16 MB; the other routes keep 256 kb)                                                 |
| `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json`  | The shared body parser skips the import path; contract                                                                       |
| `frontend/src/data-transfer.tsx`, `data-transfer-data.ts`, `app.tsx` | "Import data" card: choose a file, confirm what will change, then send                                                       |

## Verification

- Backend unit tests (fake pool): wrong version, missing tables, a broken row, dangling references and duplicates answer 400 without opening a connection; a valid file runs in one transaction with parents first and remapped ids; a database error rolls back; a large file passes the body limit.
- DB integration tests (skipped locally without `TEST_DATABASE_URL`, run in CI): export, delete, import returns the same content; importing again skips every row and keeps a later edit; a bad file leaves the database unchanged.
- Frontend tests: the confirmation appears before any request, cancelling sends nothing, a non-JSON file is refused, the server's reason is shown.
- `npm run check` passes (backend + frontend 411 passed, 3 skipped, build).
