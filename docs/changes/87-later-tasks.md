# #87 Organize later tasks

Issue: [#87](https://github.com/sirloinbh/cert-manager/issues/87)

## Purpose

The user asked to leave in the docs the tasks to continue because they were going out.

## Changes

Wrote 6 tasks in the priority section of `docs/next-steps/README.md`. They come from the limits of the #64, #70, and #80 records and the GitHub state on 2026-11-02.

## Verification

- I ran the Prettier check on the changed docs. The result is written in the PR.
- Only docs changed, so I did not run app tests, and a separate worktree has no `node_modules`, so I did not run `npm run check` either. It is confirmed by the required CI.
- The user request was up to opening the PR, so I did not merge and I did not do an automatic review.

## 2026-11-03: continued work and applying the review

The next day the agent finished 3 tasks and removed them from the table.

- PR #86: applied the 2 findings of the independent review (a record sentence and the Escape test) and merged it. Details are in the [#85 record](85-passed-question-focus.md).
- project-standards#390: left a comment correcting the 15-second measurement condition.
- Other apps: I read the main of the 8 apps that use vitest from the central list through the GitHub API, and confirmed that all of them have `testTimeout: 15_000` in `frontend/vitest.config.ts`.

I also applied the findings of the independent review of this PR: a finished task was left as a task, a sentence asserted that there was no lyrics request, and there was no link to project-standards#390.

- Prettier check: pass. `npm run check` (`cert_test` on this PC): pass. Backend 118, frontend 240 passed and 2 skipped, skills 4. `node .standards/check.mjs`, `node .standards/secret-scan.mjs`: pass.
- The review ended at the 1st round. Only the docs table was fixed, so I did not do a 2nd round.

## Limits and follow-up

- I did not check whether the user has already run the lyrics fetch. The record does not say they did.
