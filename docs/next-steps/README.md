# Next steps

Last updated: **2026-11-03 (Asia/Seoul)**.

Study plans are in [`docs/plans/`](../plans/README.md). When the 2027 exam schedule is announced, fix the tentative dates in the docs and the app. The deadline for the Engineer Information Processing practical exam is the 3rd session of 2027, so do not miss its registration period. The target grade in the app is the grade you aim for next.

## Priority

Priority rule (std-backlog chapter 5): among issues whose prerequisites are done, take the one with the smaller priority number first, and for a tie the smaller issue number.

When a new requirement comes in, register it as an issue. All the remaining work is for the user to do or decide.

| Order | Task                    | Who          | Next action                                                                                                                                                                                                                                      |
| ----- | ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Resume lyrics import    | User         | Run `npm run lyrics:import -w backend` again. The first run on 11-03 fetched 9 of 198 songs and stopped on an LRCLIB 503; [#89](../changes/89-lrclib-503.md) fixed the 503 handling                                                              |
| 2     | Check word content      | User         | The meanings and examples were written by AI, and quality was approved on the first 50 words. The etymology parts of the last 759 words were not read. Fix wrong values when you find them in the app ([#70 record](../changes/70-word-fill.md)) |
| 3     | `npm audit` 16 moderate | User decides | They are in ESLint-family dev tools and `minimatch`, and there are 0 production dependencies. There is no safe automatic fix, so decide whether to leave them or change the version in the central settings                                      |

Done on 2026-11-03: merged PR #86 (#85), left a comment on [project-standards#390](https://github.com/sirloinbh/project-standards/issues/390) correcting the 15-second measurement condition, and confirmed that all 8 apps that use vitest have `testTimeout: 15_000` on main.

## Also see

- zod is 4.6.7 (PR #75). This app's code was moved to `zod/v4` syntax in [#73](https://github.com/sirloinbh/cert-manager/issues/73). The zod version in `backend/package.json` is a centrally managed value. New code uses `{ error }` from `zod/v4`, and new array schemas get `.max()`.
- `npm audit` (2026-11-02): 16 moderate in total, none high or above. `--omit=dev` shows 0, so none are in production dependencies. They are in ESLint-family dev tools and `minimatch`, and there is no safe automatic fix. The one open Dependabot alert is for `minimatch`. Do not use `npm audit fix --force`.
- Rate limiting has two layers: `limit_req` in `frontend/nginx.conf` and `backend/src/rate-limit.ts` (`express-rate-limit`) behind it (#49). The central decision project-standards#291 is to use nginx only; this app differs by the user's decision. CodeQL is not a required check (required: `ci / verify`, `ci / docker-build`).
- This PC has no Docker, so it uses the installed PostgreSQL 17 (port 5432) with the `cert` and `cert_test` DBs. Apply a new migration to both DBs. The user environment variable `TEST_DATABASE_URL` is for study-log, so do not change it; in another terminal, set it to the `cert_test` address for that session only.
- Browser checks were done with a temporary Postgres container + `node node_modules/tsx/dist/cli.mjs src/server.ts` (backend) + `npm run dev -w frontend`. The project hook blocks `npx`.
- `npm run knip`: no findings (#30 started using `backend/src/standard/http.ts`). CI uses `knip-strict` as the failing step.
- The Volta default Node on this PC (24.22.1) differs from the project's pinned version (24.21.0), so `npm install` and `npm ci` are blocked by the engine check. When installing, use `volta run --node 24.21.0 --npm 11.19.0 npm ...`.

## Execution boundary

Deploy, syncing the sub-repositories, and creating AWS resources are done only on separate request. Add the ECR repository for the shared infrastructure to the list in `shared-aws-infrastructure` at the first deploy.
