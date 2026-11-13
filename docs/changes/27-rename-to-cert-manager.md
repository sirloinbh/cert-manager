# #27 Rename the English study name inside the repository to the new name

- Issue: [#27](https://github.com/sirloinbh/cert-manager/issues/27)
- Decision: [#25](https://github.com/sirloinbh/cert-manager/issues/25) (name `cert-manager`, display name "자격증 관리" ("Certification manager"), project-specific skills `cert-manager-*`)
- Prerequisites: [#26](https://github.com/sirloinbh/cert-manager/issues/26), [sirloinbh/project-standards#347](https://github.com/sirloinbh/project-standards/issues/347)

## Purpose

The repository name changed in #26, but the code, skills, and docs this repository manages directly still had the old name `english-study` and "English study" ("영어 공부"). Match the service name to the new name. "English study" (lyrics and word list), the area separate from certifications, and the certification category value `english` are features, not names, so they stay as they are.

## Changes: 2026-10-30

- Package names: root `english-study` → `cert-manager`, workspaces `@english-study/{frontend,backend}` → `@cert-manager/{frontend,backend}`.
- Lockfile: changed the name in the root `package-lock.json` and the workspace links (`node_modules/@cert-manager/*`) by hand. Moved them to the name-sorted position npm uses (after `@cacheable`, before `@csstools`). Versions and hashes did not change. In the lockfiles of `frontend/` and `backend/`, I changed only the name line. I did not install any new packages.
- Screen: changed the top title (`appName` of `AppShell`) and the browser tab title (`frontend/index.html`) to "자격증 관리" ("Certification manager"). "English study" ("영어 공부") in the dashboard description is an area name, so I left it.
- Changed the `service` value of `/api/health` to `cert-manager`.
- Moved the 3 project-specific skills to `skills/cert-manager-{implementation,testing,foundation}`, changed the repository name in the name, description, and body, and then regenerated `.claude/skills/` with `npm run skills:sync`.
- Docs: `AGENTS.project.md`, `README.md` (title, service description, volume, sub-repository names), `frontend/README.md`, `backend/README.md`, `database/README.md` (title, `psql -U cert -d cert` in the migration example), and `docs/next-steps/README.md` (the #22 link, removed the #27 row, recorded the failure cause of PR #15, `Missing: zod@4.6.6 from lock file`).
- `compose.yaml`: Docker volume name `english-study-data` → `cert-manager-data`. The #26 record put it on hold because existing local data could split off. This time I checked with `docker volume ls` and there was no `english-study` or `cert-manager` volume at all, so changing it now loses no data.
- Image names in the sub-repository CI: changed `frontend/.github/workflows/ci.yml` and `backend/.github/workflows/ci.yml` to `cert-manager-{frontend,backend}`.
- Tests: changed the expected value in `backend/test/health.test.ts`, and added a test to `frontend/src/app.test.tsx` that checks that the top home link shows "자격증 관리" ("Certification manager").

Not fixed:

- `scripts/push-repositories.ps1` and `scripts/backup.ps1` became centrally managed files, and the central sync (#29) already removed the old name.
- The past records (`docs/changes/`, `docs/daily/`) show the state at the time, so I did not fix them.
- The file name `docs/research/english-content-sources.md` and "English study area" in the design document are feature names.

## Verification

- `node --test scripts/test/claude-skills.test.mjs`: pass 4, fail 0
- `node scripts/claude-skills.mjs`: `.claude/skills matches skills/.`
- `node .standards/lockfiles.mjs`: the `frontend/` and `backend/` lockfiles are both the same as the root
- The user installed with `volta run --node 24.21.0 --npm 11.19.0 npm ci --ignore-scripts`. It installed with the hand-edited lockfile as `added 475 packages` with no errors (confirms the lockfile rename)
- `node .standards/ioc-scan.mjs`: no suspicious items
- `node .standards/check.mjs`: pass (central `project-standards@83b6d06`). Before the install it failed with 4 shared packages not installed
- `npm run check`: pass (exit 0). Format, lint, and type checks pass, backend pass 10 and skip 2 (DB integration), frontend 22 files 68 tests pass, skills 4 pass, build succeeded
- DB integration test: applied `database/migrations` to a temporary `postgres:17-alpine` container and ran `TEST_DATABASE_URL=… npm test -w backend`: pass 12, fail 0, skip 0
- Browser (Playwright, Vite 5206 + backend 3106 + temporary DB): at mobile 390×844 and PC 1440×900, the tab title, the top title, and the bottom text show "자격증 관리" ("Certification manager"), the `service` of `/api/health` is `cert-manager`, and there is no horizontal overflow
- Skill frontmatter: `quick_validate.py` could not run because the Python `yaml` module is missing. I checked the same rules (folder name equals `name`, lowercase letters, digits, and hyphens, description at most 1024 characters with no angle brackets) with the shell, and all 3 pass
- `git grep -n -i "english" -- . ':!docs/changes' ':!docs/daily'`: the only results left are the certification category value `english` (code, tests, migrations, design document), the `docs/research/english-content-sources.md` link, and "English material" in the centrally managed skill `std-communication`.

## Automatic code review: 2026-10-30

- 1st (read-only review agent): no blocking defects. One finding was the particle notation "자격증 관리은(는)" in `frontend/public/offline.html` (a Korean grammar nit about the particle after the name). It is a centrally managed file that this PR did not change, so I did not apply it. This review read only the working tree without a shell and could not see the whole diff.
- 2nd (review agent that looked at the diff directly): no defects. It confirmed that the centrally managed files were not changed, the compose volume declaration and mount match, `psql -U cert -d cert` matches `.env.example`, the `.claude/skills` copies equal the originals, the lockfile changed only in names and links, and the next steps table changed only by removing the #27 row and the numbers.
- Fix commits applied: none. The review ended after 2 rounds.
