# #26 Rename the GitHub repositories and match the DB name

- Issue: [#26](https://github.com/sirloinbh/cert-manager/issues/26)
- Decision: [#25](https://github.com/sirloinbh/cert-manager/issues/25), central change [sirloinbh/project-standards#347](https://github.com/sirloinbh/project-standards/issues/347)

## Purpose

When the repository name changed from `english-study` to `cert-manager`, the DB name in the central registry also changed from `english` to `cert`. Match the DB name in the settings files this repository manages to the registry value.

## Changes: 2026-10-30

- The user renamed the 4 GitHub repositories (`cert-manager`, `-frontend`, `-backend`, `-db`).
- Merged central PR [project-standards#349](https://github.com/sirloinbh/project-standards/pull/349), and sync PR #29 was opened.
- `standards-check` of sync PR #29 failed because the DB name `english` in `.env.example` differs from the registry value `cert`. `.env.example` is a file this repository manages, so it is not changed by the sync.
- `.env.example`: changed `POSTGRES_DB`, `POSTGRES_USER`, and `DATABASE_URL` to `cert`.
- `compose.yaml`: set the defaults of `POSTGRES_DB` and `POSTGRES_USER` to `cert`.

Not fixed: if the Docker volume name `english-study-data` in `compose.yaml` is changed, the local DB data splits off into a new empty volume. Decide it together with moving the local DB (the user step of #26). The package names, the `service` value of `/api/health`, and the image names in the sub-repository CI are changed in [#27](https://github.com/sirloinbh/cert-manager/issues/27).

## Notes on the local environment

A local `.env` that was already created still uses `english` and works as it is now. The existing Docker volume was initialized with the `english` user and DB, so changing only `.env` to `cert` makes the connection fail. Change it together when you move the DB.

## Verification

- `node .standards/check.mjs`: the result is recorded in the PR comment
