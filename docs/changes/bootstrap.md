# Initial development environment setup (before issues)

- Date: 2026-10-19 (Asia/Seoul)
- Standard: the workout-memo [development environment setup document](../project-setup.md) (workout-memo PR #57)

## Purpose

Prepare the development environment, the minimal app, verification, and repositories so the english-study project can be developed issue by issue. Detailed features go ahead after the user registers issue cards.

## Contents

- Stack: React 19 + Vite + TypeScript, Express 5 + pg + Zod, PostgreSQL 17, npm workspaces, Docker Compose, GitHub Actions. Node 24.21.0 / npm 11.19.0.
- Dependencies: used only the same packages and versions as the workout-memo lockfile (only the workspace names changed). Installed with `npm ci --ignore-scripts` with the user's approval, and added no new packages. `npm audit`: 0 vulnerabilities.
- Minimal app: `GET /api/health` (DB check, service date), Korean 404 and 500 error handling, the sidebar, page header, status display, and empty state screens, and design tokens based on CSS variables.
- DB: `database/migrations/001_initial.sql` (`app_settings`, safe to run again). For an existing DB, only the `psql -f` method is documented.
- Tests: unit (`health.test.ts`), DB integration (`db.integration.test.ts`, skipped without `TEST_DATABASE_URL`), UI (`app-ui.test.ts`, vm harness), and the skill sync check.
- AI instructions: `AGENTS.md`, `CLAUDE.md`, and 3 skills (originals in `skills/`, copies in `.claude/skills/`).
- Repositories: umbrella `sirloinbh/english-study` + the deploy sub-repositories `english-study-frontend`, `english-study-backend`, and `english-study-db` (private, subtree). AWS uses the shared `shared-aws-infrastructure`.

## Verification

- Applied the migrations as UTF-8 to the dedicated test DB `english_study_test` (the workout-memo test container) and ran `npm run check`: **exit 0**.
  - App and DB tests **8 pass / 0 fail / 0 skip** (the DB integration test really ran)
  - Skill check **4 pass / 0 fail / 0 skip**
  - Format, lint, and type checks pass, and the frontend and backend builds pass
- The real browser check was done in study-log, which was made from the same template (no horizontal scroll at mobile 390px, status and menu switching normal, PC 1440px normal). This project differs only in title and ports, and was checked with the UI test.
- The initial commit was pushed directly to `main` to create the repository. After that, every change goes issue → branch → PR.
- The Docker image build is checked by the `docker-build` job in GitHub Actions. I did not run `docker compose up` locally.
