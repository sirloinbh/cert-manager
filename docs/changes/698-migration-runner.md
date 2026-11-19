# Adopt the managed migration runner (project-standards#698)

## Change

- Root and backend `db:migrate` scripts, and the one-line `backend/src/migrate.ts` entry that imports the managed `standard/migrate.ts`. `deploy/remote-deploy.sh` runs `node dist/migrate.js`, which did not exist before, so a deploy stopped at the migrate step.
- `compose.yaml`: the database no longer mounts `database/migrations` into `/docker-entrypoint-initdb.d`. The runner creates the schema, so an empty volume is set up with `docker compose up -d --wait db` and `npm run db:migrate`.
- `database/README.md` describes the runner instead of the initdb mount and the `psql -f` command.

## Reason

The app had no runner, so the schema had no history table and the deploy script could not migrate. The runner records each file in `schema_migrations`, applies it in one transaction, and takes an advisory lock.

## Before the first production deploy

- The first run on an existing database applies every file again and records it (all files are written to be safe to run again). The deploy script makes a backup first. The first run on production happens in the deploy; this change does not touch any database.
