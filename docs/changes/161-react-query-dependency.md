# #161 (step 1): install @tanstack/react-query and provide a query client

## Purpose

#161 moves data loading onto the shared query layer on `@tanstack/react-query` (ADR-0027). The shared `frontend/src/lib/query.ts` only syncs into this repo after the package is installed and the central `query` feature is on, so the package lands first. This PR is step 1 only; the screen migration is step 2.

## Changes

| File                                         | Change                                                                                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/package.json`, `package-lock.json` | Add `@tanstack/react-query` 5.104.1 (exact) and its one dependency `@tanstack/query-core` 5.104.1. npm also re-sorted `@vitejs/plugin-react` alphabetically (same version).                                                                    |
| `frontend/src/app.tsx`                       | `App` wraps the routed app (now `AppRoutes`) in `QueryClientProvider`, with one `QueryClient` kept in state. CI runs knip in strict mode, which fails a dependency nothing imports. Coordinator approved this one edit to a file no lane owns. |

## Package review

| Check                          | @tanstack/react-query 5.104.1                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install command                | `npm install --ignore-scripts --save-exact @tanstack/react-query@5.104.1 -w frontend` (user confirmed in the lane-5 terminal on 2026-11-22; earlier reconfirmed in the coordinator session) |
| `node .standards/ioc-scan.mjs` | `ioc-scan: no suspicious items` (notes only the existing esbuild and fsevents install scripts, which do not run with `--ignore-scripts`)                                                    |
| `npm audit` (from the install) | `found 0 vulnerabilities`                                                                                                                                                                   |
| `npm run lockfiles:sync`       | No such script in this repo; the workspaces share one root lockfile, which the install updated                                                                                              |
| License, install scripts       | MIT, none                                                                                                                                                                                   |
| Released, publisher            | 2026-10-02, TanStack (github.com/TanStack/query), SLSA provenance published (from the issue's package review)                                                                               |
| Dependencies                   | One: `@tanstack/query-core` 5.104.1                                                                                                                                                         |

## Verification

- `npm run check`: pass (54 test files, 372 passed, 3 skipped). DB integration tests skip locally (no PostgreSQL on this Mac) and run in CI.
- Local `knip`: no finding for the new package (it lists `e2e/smoke.spec.ts` and `@axe-core/playwright`, which this PR does not touch).
- `npm audit` on the full tree reports 16 findings, none in `@tanstack/*` (eslint, lhci and basic-ftp tooling, already on main).
- No browser check: no screen renders differently (nothing calls a query hook yet).

## Limits

- The client uses React Query's defaults. Step 2 switches it to the synced `createQueryClient()` and migrates the words list to `useApiQuery`.
