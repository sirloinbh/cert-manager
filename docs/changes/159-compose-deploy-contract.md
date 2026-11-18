# #159 Make compose.yaml roll-back capable (image tags and web port)

- Issue: [#159](https://github.com/sirloinbh/cert-manager/issues/159)
- Branch: `chore/159-compose-deploy-contract`
- Parent: sirloinbh/project-standards#710

## Changes — 2026-11-19

Tag the images `<db>-backend/frontend:${IMAGE_TAG}` and publish the web port as `${WEB_BIND}:${WEB_PORT}`, so `deploy/remote-deploy.sh` can roll back to the previous image.

## Why

`deploy/remote-deploy.sh` requires these tags and variables, and this repo has neither, so rollback cannot work (project-standards#710). The initdb mount and the root `db:migrate` script are not changed here: the app has no migration runner yet, so removing the mount would leave no way to create the schema (project-standards#698).

## Not changed

The initdb mount stays, and there is still no root `db:migrate`, until the migration runner is adopted (project-standards#698). `standards-check` keeps reporting those two items until then.

## Verification

- `node scripts/standards-check.mjs --root <this repo>` from project-standards: no `deploy contract` problem except the two items above.
- `prettier --check` on the changed files.
- The full `npm run check` runs in CI.
