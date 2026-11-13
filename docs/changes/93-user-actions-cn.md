# #93 Revert the cn() workaround in the user action notifications

- `frontend/src/user-actions.tsx`: reverted the `className` of the deadline text to `cn()` and deleted the workaround comment.
- The central `cn()` fix (sirloinbh/project-standards#357) came in with #63, so `text-caption` is no longer removed. The same workaround in `study-plan.tsx` was removed in #66.

## Checks

- Screen (Vite dev server, a fake API response with Playwright, headless Chrome 1440×900 and 390×844): the deadline text in the notification panel is `14px`/`20px` for both past and remaining tasks, and only the past tasks have the `text-destructive` color.
- The "삭제" ("Delete", `text-destructive`) and "수정" ("Edit") buttons in the certification detail are both `14px`/`20px` with a height of `36px` (the #357 done criterion).
- `npm run check` passed: format, lint, type check, and build pass, backend 112 passed and 11 skipped, frontend 240 passed and 2 skipped, skills 4 passed.
- I did not run the 11 DB integration tests. There was no test DB running locally, so I ran with `TEST_DATABASE_URL` empty. This change is one line of screen code, so it has nothing to do with the DB.
