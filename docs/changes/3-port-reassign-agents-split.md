# #3 Change the ports to the central standard (slot 06) and split the AGENTS project-specific rules

- Issue: https://github.com/sirloinbh/english-study/issues/3
- Central tracking issue: https://github.com/sirloinbh/project-standards/issues/99

## Purpose

- Apply the ports that the central registry reassigned so the ports of the 8 apps do not overlap (project-standards ADR-0006).
- Before the first central standards sync turns AGENTS.md into the common instructions, move this project's PR review and merge rules to AGENTS.project.md to keep them.

## Changes

| Kind                       | Before | After     |
| -------------------------- | ------ | --------- |
| Web                        | 8096   | 8106      |
| API                        | 3016   | 3106      |
| Vite                       | 5176   | 5206      |
| Host DB                    | 55446  | 15406     |
| e2e API and web (reserved) | None   | 3206·5306 |

- Files whose ports changed: `.env.example`, `README.md`, `backend/Dockerfile`, `backend/src/server.ts`, `compose.yaml`, `frontend/nginx.conf`, `frontend/vite.config.ts`, `AGENTS.md`
- Moved step 5 of `AGENTS.md` (the automatic code review and merge rules) word for word to the "Work procedure" of `AGENTS.project.md`, and made `AGENTS.md` require reading that file.
- Did not change the past records in `docs/changes/`, `docs/daily/`, and `docs/next-steps/`, because they show the state at the time.

## What the user does

- Change the port in `DATABASE_URL` in the local `.env` from `55446` to `15406` and `PORT` from `3016` to `3106`. Do not commit `.env`.

## Verification

- 2026-10-22: the result is written in the PR body.
