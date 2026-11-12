---
name: cert-manager-implementation
description: Follow the user's issue, numbered branch, implementation with docs, tests, and PR workflow for changes to the sirloinbh cert-manager project. Use for code, configuration, documentation, and skill edits; exclude read-only questions and recommendations. After opening the PR, run at most two automated code reviews (review, fix commit, second review, fix commit), split fixes too large for the PR into new issues, then merge the PR with a merge commit once all required CI checks pass on the final head.
---

# Certification manager implementation procedure

This skill applies to change work in `sirloinbh/cert-manager`. Do not apply this account, repository, or policy to other projects. First read `AGENTS.md` at the project root and the related docs. Follow the order below, and deliver as the result a PR that went through automatic code review (up to 2 rounds) and the required CI checks and was merged.

## 1. Register an issue card

- Check the GitHub remote address and `gh api user --jq .login`. The expected account is `sirloinbh`; if it is another account, do not make remote changes until the authentication is fixed.
- Reuse the issue the user named or an issue already registered for the same request. Before retrying, check the existing result so you do not create a duplicate issue.
- In a new issue, write the problem and purpose, the requested scope, the done criteria, and the verification method. In this project an issue card means a GitHub Issue. Unless a separate Projects board was named, do not create or link a board.
- Write the body as a UTF-8 temporary file and register it with `gh issue create --repo sirloinbh/cert-manager --title ... --body-file ...`. Do not put tokens or secrets in the body.
- Keep the real issue number and URL that were issued. If registering the issue fails, do not invent a number or start code changes first.

## 2. Create a branch from the issue number

- Check the working tree and the current branch. If there are changes from other work, keep them and avoid mixing work.
- The default target branch is `main`. Do not start new work from an unrelated unmerged work branch. Fetch the remote main in a clean working tree and branch from it. If there are user changes, prepare a work space that keeps them.
- Branch name: `<type>/<number>-<short-slug>`. Examples: `feat/12-first-feature`, `fix/13-goal-date`, `docs/14-project-skills`, `chore/15-ci`.
- If a branch for the same issue already exists, check its state and keep using it.
- Do the changes and commits on this branch. Do not commit or push directly to `main`.

## 3. Implementation and a docs record per commit

- When you implement or fix something, read the project `skills/cert-manager-testing/SKILL.md` and write or change the related tests together. For a bug fix, add a regression test. Include the implementation, tests, and docs in the same work commit, and run the related tests before you commit.
- Implement only the requested scope. For development foundation work, read `cert-manager-foundation` too.
- Create `docs/changes/<number>-<slug>.md` and record the issue link, the purpose, the changes, the verification, and the limits and follow-up work.
- **In each work commit, record in the docs the changes and verification done in that commit.** You may accumulate entries in one issue document. A commit that changes only docs also updates that work record.
- In the record, leave the reason for the change and the observed results. Do not write that a check or a deploy you did not run is done. You do not need to create in advance the SHA that points to the commit itself. Tell them apart by the commit title or the unit of work.
- The commit title includes the type and the issue number, as in `feat: ... (#12)`, `fix: ... (#13)`, and `docs: ... (#14)`.
- Before you stage, check the diff and whether it contains secrets, and stage only the related files by name. Do not include another user's changes.

## 4. Create a PR after testing

- Before you create or update a PR, run the related tests and the required checks on the final change. Leave the test code you added or changed, the behavior verified, and the real run commands and pass/fail/skip in the docs and the PR. For the required commands and the DB integration test conditions, follow the project `AGENTS.md`. Do not add app tests that are not needed to a simple docs or skill change.
- Fix failures, and record in the docs and the PR separately the checks you could not run, the DB tests that were skipped, and the browser verification that is not done. If the verification you need is blocked, make the PR a draft.
- Push only the work branch. The PR target is `main` of `sirloinbh/cert-manager`. The subtree sync script pushes main and the sub-repositories, so do not use it in this step.
- If a PR for the same head branch exists, update it and do not create a duplicate.
- Pass the PR body as a UTF-8 file. Include the problem and the behavior after the change, the main changes, the real check commands and results, the evidence that is available for a screen change, and `Closes #<number>`. If there are no images, write why and the limits of the verification.
- Check the GitHub Actions results and fix related failures. Tell them if a check is still running. If you changed code after creating the PR, run the affected checks again and update the results in the docs and the PR.

## 5. Automatic code review after the PR (up to 2 rounds)

1. **1st review:** after you open the PR, run a read-only review that is separate from the writing context (a separate agent, a review tool, and so on). Based on the issue done criteria and the whole PR diff, look at correctness, regressions, security, missing tests, and the docs record.
2. **If there are no findings,** end the review and go on to checking CI and merging.
3. **If there are findings,** apply only the findings that should be fixed within this PR. Make an additional commit that includes the related tests and the docs record, and push.
4. **2nd review:** check that the 1st findings were applied and check the additional diff. Also look at the final whole PR diff. If there are no findings, go on to CI.
5. **2nd fixes:** apply the 2nd findings in an additional commit. The review is at most 2 rounds, so do not do a 3rd review and go on to CI.
6. **Split big changes:** do not fix findings of the following kinds in this PR. Instead create a new issue card (with the problem, scope, and done criteria). Leave the issue link in a PR comment and the docs record, and keep going with this PR.
   - A feature outside the requested scope
   - A change to the design or data structure
   - A fix across several modules
   - Work that needs separate verification
7. **Hold the merge:** if the following defects remain, do not merge and tell the user.
   - A defect that would break main if split out
   - A defect with a security or data corruption risk
8. **Record:** leave the result of each review round in a PR comment and in the docs work record. Write the findings, the commits that applied them, the issues that were split out, and whether there were no findings.

## 6. Merge after CI passes

- Run the related tests again against the last commit. If a new commit appears during review, do not merge with the earlier CI result.
- **When all required CI checks on the final head pass, the agent (main agent or local worker) merges with a merge commit by running `scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <verified head SHA>` with the project GitHub wrapper.** After merging, check that the linked issue is closed.
- Merge sequential and stacked PRs in order. When the earlier PR is merged, merge `origin/main` into the next PR branch, resolve conflicts, run the related tests again, push normally (no force), and merge after CI passes.
- **Still forbidden:** merging while a check is failing or running, `--admin` or bypassing branch protection, replacing review by approving your own PR, pushing directly to `main`, and force push.
- A merge to `main` is not connected to automatic deploy right now. When deploy is connected, check the deploy result after merging.
- Deliver the issue URL, the branch name, the PR URL, the merge result, the verification results, and the remaining work.

## Authentication and failure handling

Do not recheck the issue, push, and PR permissions that were already given without need. Respect the run permissions the tool requires and the GitHub authentication. On failure, resume from the step you already completed, and if the result of creating something remotely is unclear, look it up before retrying. Do not work around an account or authentication problem by creating things with another account.
