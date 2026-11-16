# Require the shared sign-in (#116)

Issue: [#116](https://github.com/sirloinbh/cert-manager/issues/116). Central work: project-standards#551 (ADR-0015, #550). The workout-memo pilot is #303.

## Purpose

The app had no login and relied only on the IP allow list. The shared sign-in is live, so every `/api` route now needs a session from `sirloinbh/shared-auth`.

## Changes

- `backend/src/app.ts`: `createApp` takes an `auth` middleware and mounts it on `/api` after the rate limit and the body parser, before any route; `/api/health` stays open (the middleware's `publicPaths`). New `GET /api/me` returns the signed-in user.
- `backend/src/server.ts`: passes `sharedAuth()` (managed file `backend/src/standard/auth.ts`), which builds the middleware when `AUTH_INTERNAL_URL` is set and refuses to start in production without it.
- `compose.yaml`: the API joins the external `shared-auth` network and checks sessions at `http://shared-auth-api:3110`.
- `frontend/src/app.tsx`: the app is wrapped in `SignInGate`, and the top bar shows `AccountActions` next to the user-action alerts. On localhost and IP addresses nothing changes.
- `README.md`: the sign-in rule for `/api`.
- `.env.example`: a note on `AUTH_INTERNAL_URL`.
- `backend/test/sign-in.test.ts`: 401 without or with a bad session, `/api/health` stays public, `/api/me` returns the user.
- This repo has no `docs/api.md` or OpenAPI contract, so there is no `/api/me` row to add.

## Verification

- Local: format, lint and typecheck pass; backend `sign-in` and `health` tests (6 pass); frontend `app` and `auth-origin` tests (9 pass); `node .standards/check.mjs` passes. The tests that need PostgreSQL and the rest of the frontend run in CI.
- `npm install --ignore-scripts` (user step) and `node .standards/lockfiles.mjs --write` updated the lockfiles for `@sirloinbh/auth-client` 1.0.0.
