# Certification manager

A personal service that manages certification information, exam dates, and study records, and also records and reviews English study separately from the certifications. There is one user (the owner), and it runs locally without a login.

## Development standards

Node.js **24.21.0**, npm **11.19.0**. Install with `npm ci --ignore-scripts` (after the user confirms), format with `npm run format`, and run the full check with `npm run check`. Follow the [development environment setup doc](docs/project-setup.md) and [AGENTS.md](AGENTS.md) for the full standards.

Changes go in this order: **GitHub issue → branch with the issue number → implementation, tests, and docs record → `npm run check` → PR → automatic code review (up to 2 rounds; follow-up commits, and a new issue for big changes) → required CI passes → the agent merges with a merge commit**.

## Run

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open http://localhost:8106 . Change the password in `.env` before you run it. Data is stored in the `cert-manager-data` volume, and `docker compose down -v` deletes the data.

Run for development:

```powershell
docker compose up -d db
npm run dev
```

Vite http://localhost:5206, API http://localhost:3106/api/health, host DB port 15406.

For an existing DB, apply the new files in `database/migrations` by hand (they are applied automatically only on an empty volume). Get the song list with `npm run songs:import -w backend`. It stores only album and song names, release dates, and lengths in the DB named by `DATABASE_URL`, does not fetch lyrics, and prints the target DB when it starts.

Fetch lyrics from LRCLIB with `npm run lyrics:import -w backend` and put them only in that DB. For translations, create files in `.local/translations/` with `npm run translations:export -w backend`, fill them in, and load them with `npm run translations:import -w backend`. Saved files are moved to `imported/`. Do not commit lyrics or translations.

Get the word list with `npm run words:import -w backend` and the etymology with `npm run words:etymology -w backend`. Export meanings and etymology parts to `.local/word-batches/` with `npm run words:export -w backend -- 50`, fill them in, and load them with `npm run words:fill -w backend`. The order of use is in the [change record](docs/changes/36-word-list.md).

## Verification

- `npm run check`: format, lint, types, tests, skill sync check, build.
- DB integration tests need `TEST_DATABASE_URL`, a dedicated test DB with the migrations applied. They are skipped without it.
- GitHub Actions runs the full check with a PostgreSQL service and builds the Docker image.

## Repository layout

This repository is an umbrella monorepo that holds all the source. `frontend`, `backend`, and `database` are synced with `git subtree split` to the private deploy repositories `cert-manager-frontend`, `cert-manager-backend`, and `cert-manager-db` (`scripts/push-repositories.ps1`, only on request). AWS infrastructure is managed in the shared repository `shared-aws-infrastructure`.

## Docs

- [AI instructions](AGENTS.md) · [Claude instructions](CLAUDE.md) · [DB](database/README.md)
- [Change records](docs/changes/README.md) · [Daily logs](docs/daily/README.md) · [Next steps](docs/next-steps/README.md)
- [Scope and data model](docs/design/scope-and-data-model.md) · [Survey of English study material sources](docs/research/english-content-sources.md)
