# #49 Add API request rate limiting

- Issue: [#49](https://github.com/sirloinbh/cert-manager/issues/49)
- Branch: `feat/49-api-rate-limit`

## Purpose

PR #48 failed with 9 CodeQL `js/missing-rate-limiting` warnings and could not be merged. The same warning comes back for every new API route. The user decided to fix the warnings rather than only close them, and chose to adopt `express-rate-limit` as the method (2026-10-31).

## Decisions

| Item                                 | Decision                                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Difference from the central decision | project-standards#291 decided to use only nginx `limit_req`. Only this app adds a limit inside the app. The nginx settings are left as they are                                                                                                                |
| Purpose                              | The main purpose is to resolve the CodeQL warnings in code. The production setup does not open the `api` port, so nginx does the real defense, and this limit is used directly only on paths that do not go through nginx, such as the development environment |
| Limit                                | 1,200 per minute. nginx is 10 per second per IP with a burst of 40, so one IP passes only about 640 in the first minute and never reaches this limit                                                                                                           |
| What it counts by                    | The address the request came from. Behind nginx, all requests are counted as the one nginx address. `trust proxy` is not turned on (nginx does not use `X-Forwarded-For` directly, so turning it on would allow forgery). Records are kept in process memory   |
| Health check path                    | `/api/health` also calls the DB, so it is not excluded. If several IPs send the maximum at the same time, they reach the limit and the health check can also get 429. It is not a problem now with one user, and look at it again when going public            |

## Adoption review

I looked it up on 2026-10-31 with the procedure in `docs/dependency-policy.md` (project-standards). I got the user approval the same day.

| Package                    | Release date | License | Install script                                 | Notes                                                                |
| -------------------------- | ------------ | ------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `express-rate-limit@8.7.1` | 2026-10-06   | MIT     | `prepare` only (not run on a registry install) | The latest 8.7.2 was released 2026-10-29, so 14 days have not passed |
| `ip-address@10.7.4`        | 2026-10-11   | MIT     | `prepare` only (not run on a registry install) | A new transitive dependency. `debug@4.4.3` was already there         |

On the first install, the `^10.2.0` range brought in `ip-address@10.7.5`, released 2026-10-25, which broke the 14-day condition. It happened because I did not check the version that would really be installed during the review. Before running the 10.7.5 code, I fixed the lockfile to 10.7.4 and reinstalled with `npm ci --ignore-scripts`. I did not touch the range in `package.json`, so `npm update` may raise it again.

## Changes: 2026-10-31

- `backend/src/rate-limit.ts`: the limit middleware. When exceeded, it answers 429 with `{ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' }` ("Too many requests. Please try again later").
- `backend/src/app.ts`: put it before body parsing and all routes. `createApp` takes a `rateLimit` option so tests can lower the limit.
- `backend/test/helpers.ts`: `withApi` passes the `createApp` options through, sends request headers, and returns response headers.
- `backend/package.json`, `package-lock.json`, `backend/package-lock.json`: added the package. The user ran the install directly, and the sub lockfile was matched with `npm run lockfiles:sync`.

## Tests

`backend/test/rate-limit.test.ts`

- When the limit is exceeded, it answers with a Korean message and 429 and does not reach the DB.
- Feature paths and write requests are counted together.
- After the time window passes, it allows requests again.
- The default limit is 1,200 per minute (the `RateLimit-Policy` header).
- Changing `X-Forwarded-For` or `Forwarded` does not avoid the limit.

## Automatic code review: 2026-10-31

1st (read-only review agent): 0 high, 1 medium, 6 low. All were fixed in this PR.

| Finding                                                                                                                              | Handling                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| The 100 ms time window test can sometimes fail on a slow CI (I did not observe a failure; I inferred it from the code)               | Widened the window to 1 second and the wait to 1.1 seconds                                    |
| The `Forwarded` header check is on, so the same kind of log remains                                                                  | Turned off the `forwardedHeader` check too                                                    |
| The situation where the health check can get 429 is not recorded, and the "second line of defense" description is wider than reality | Fixed the decision table above                                                                |
| `docs/next-steps/README.md` has no follow-up work for PR #48 and the date is unchanged                                               | Fixed the #33 line and the date                                                               |
| The change record has no CodeQL result                                                                                               | Wrote it in the verification below                                                            |
| The comment in the central `nginx.conf` no longer fits                                                                               | Split into [project-standards#358](https://github.com/sirloinbh/project-standards/issues/358) |
| No test protects the default limit value and header forgery                                                                          | Changed or added 2 tests                                                                      |

2nd (review agent that looked at the diff again): 0 high, medium, or low. It confirmed that the 7 findings of the 1st were really fixed, and the review ended after 2 rounds.

## Verification

- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 25 passed (5 new tests, 0 skipped), frontend 110 passed, skills 4 passed, build succeeded.
- CodeQL (first commit `2ca1eba`): pass. The review agent looked up the analysis results and compared the JavaScript result counts. `main` has 11 including `js/missing-rate-limiting`, and this PR has 0. Even the routes registered by passing to `registerCertificationRoutes` are gone.
- Installed version check: `express-rate-limit` 8.7.1, `ip-address` 10.7.4.
- `node .standards/ioc-scan.mjs`: no suspicious items. `node .standards/secret-scan.mjs`: no suspicious items. `node .standards/check.mjs`: pass. `npm run knip`: no findings.
- Docker image build: I could not run it because this PC has no Docker. It is confirmed by CI `ci / docker-build`.
- There is no screen change, so I did not do a browser check.
