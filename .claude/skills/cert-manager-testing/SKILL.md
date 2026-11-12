---
name: cert-manager-testing
description: Write or update behavior-focused tests with cert-manager implementations and fixes, run them before commits and PR creation or updates, and record actual results. Use with cert-manager-implementation; for documentation-only changes validate the changed artifacts instead of adding unrelated app tests.
---

# Certification manager: writing and running tests

Follow the project's AGENTS.md and the cert-manager-implementation procedure together. This skill is the standard for writing and running tests, and it keeps the issue, branch, docs, and PR procedure and the policy of automatic code review after the PR (up to 2 rounds) → merge after CI passes.

## Write them together with the implementation or fix

- When you implement a feature or fix behavior, add or change the test code that verifies that requirement, and include the implementation and the tests in the same work commit. Do not let running existing tests stand in for verifying a new feature.
- For a bug fix, add a regression test that catches the bug coming back. Where possible, confirm that it fails before the fix and passes after it, and if you cannot reproduce it, record that limit.
- For a refactor, verify that existing behavior is kept. If the related tests are enough you can keep them as they are, but strengthen the scenarios that are missing.
- Verify results the user sees and domain rules rather than writing tests that repeat the internal implementation. Choose the normal path and the input errors, boundaries, and failure paths related to the change.
- Choose unit tests for business logic, integration tests for API, DB saves, and transactions, and component or browser tests for screen input and save flows. Do not add every kind to every change.
- Check the test tools and commands that are installed now. Do not report that you used tools that are not adopted yet, such as Vitest or Playwright, as if they were installed.
- Keep test data separate from production and user data. Write checks that depend on time, dates, or random values so that they verify the same meaning even when the run environment changes.

## Before committing

- Check the changes and tests in the final commit and actually run the related tests. Include the implementation, tests, and docs record in the same commit.
- Leave the test code paths, the behavior verified, and the run commands and results in the docs/changes record of that issue.
- Do not make a failing test pass by skipping or deleting it or by weakening an assertion. Fix the failure and then commit.
- If you cannot prepare the run environment you need, record that you did not run it. Do not report an unverified implementation as done, and hand over a PR with verification left as a draft.

## Before creating or updating a PR

- Run the related tests and the project required checks on the final diff and confirm they succeed. If nothing changed after the commit and the result for the same target is still valid, you do not need to repeat the same check.
- Record in the PR the tests you added or changed, the run commands, pass/fail/skip, and the reason for anything not run. An integration test skipped because the DB environment variable was not set does not count as success.
- If you fix code or tests after the PR, run the affected checks again and update the results in the docs and the PR. Fix CI failures too.
- If only docs, skills, or formatting changed and app behavior did not change, verify with the validator, format, and link checks for that output and write why you did not add app tests. A behavior change in executable code or a check script includes related tests or a run verification.
- Put related tests in the follow-up commits of the automatic code review too, run them again, and record the results. Merge following the cert-manager-implementation procedure only after all required CI checks on the final head pass. Do not merge if any check is failing or running.
