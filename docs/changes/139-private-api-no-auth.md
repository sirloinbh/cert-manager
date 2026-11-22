# #139: keep the API private and running when sign-in is off

## Purpose

Harden startup and route order. The `127.0.0.1` bind without sign-in and the warning log already exist
(`listenHost()` and `sharedAuth()`, project-standards#898, #667); this issue adds the rest.

## Changes

| File                           | Change                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `backend/src/server.ts`        | Fail fast without `DATABASE_URL`; log idle pool errors with `pool.on('error')` |
| `backend/src/app.ts`           | Register `GET /api/health` before the auth guard                               |
| `backend/test/sign-in.test.ts` | `/api/health` is 200 with an auth middleware that rejects everything           |

## Verification

- `npm run check`: pass (format, lint, contract, typecheck, tests, skills tests, build).
- No local PostgreSQL on this Mac: DB integration tests skip locally and run in CI.

## Limits

- The `netstat` check of the dev bind was not run; the bind logic is `listenHost()`, covered by the managed standard tests.
