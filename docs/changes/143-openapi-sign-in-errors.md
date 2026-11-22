# #143: list sign-in errors on every guarded OpenAPI operation

## Purpose

`docs/openapi.json` listed 503 only on `GET /api/me`, and the case-insensitive link rule was documented as
case-sensitive. The shared builder already adds 401, 413 and 429 to guarded operations.

## Changes

| File                                 | Change                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `backend/src/openapi.ts`             | Every non-public operation also lists 503                                               |
| `backend/src/routes/user-actions.ts` | The link rule uses `[hH][tT]...` classes instead of the `i` flag (same accepted values) |
| `backend/test/openapi.test.ts`       | Every guarded operation lists 401 and 503; `/api/health` lists neither                  |
| `docs/openapi.json`                  | Regenerated                                                                             |

## Verification

- `npm run check`: pass.

## Limits

- The `i` flag cannot be emitted by the managed builder (`backend/src/standard/openapi.ts`); the explicit classes keep the document correct without editing it.
