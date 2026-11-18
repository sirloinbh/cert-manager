# 133 Mount requestLog so every request has an ID

## Purpose

`backend/src/app.ts` imported `standard/http.ts` but never mounted `requestLog`, so project-standards#552 (request IDs and JSON request logs) was not in effect. Part of sirloinbh/project-standards#658.

## Changes

- `backend/src/app.ts`: `app.use(requestLog)` is the first middleware, before the rate limiter and every route, so a refused (429) request also gets an ID and a log line.
- `backend/test/health.test.ts`: a test that API responses (200 and 404) carry `X-Request-Id` and that a valid incoming ID is kept.

## Verification

See the PR for the commands and results.

## Limits

- `backend/src/standard/*` is a managed file and is not edited.
