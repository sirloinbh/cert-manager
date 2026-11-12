# Change to the policy where the agent merges PRs that pass CI (#1)

- Issue: https://github.com/sirloinbh/english-study/issues/1
- Date: 2026-10-21 (Asia/Seoul)

## Purpose

At the request of the repository owner (2026-10-21), change the PR merge policy from "only the user merges" to "the agent merges with a merge commit when the required CI passes".

## Changes

- New policy: when all required CI checks pass, the agent (main agent or local worker) merges with a merge commit using `scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <verified head SHA>` and checks that the linked issue is closed.
- For sequential and stacked PRs, after the earlier PR merges, merge `origin/main` into the next branch, resolve conflicts, run the related tests again, push normally (no force), and merge after CI passes.
- Still forbidden: merging while checks are failing or running, `--admin` or bypassing branch protection, replacing review by approving your own PR, pushing directly to `main`, and force push.
- Stated that a merge to `main` is not connected to automatic deploy now, and wrote that when deploy is connected the result must be checked after merging.
- Files changed: `AGENTS.md` (step 5), `README.md` (order of work), `docs/project-setup.md` (absolute rule 2, Git strategy order and merge, the file role table, the AGENTS template), `skills/english-study-{implementation,foundation,testing}/SKILL.md` (including the YAML description of implementation), and the `.claude/skills/` copies refreshed with `npm run skills:sync`.
- Changed "squash merge recommended" in `docs/project-setup.md` to merge commit to match the new policy.
- Did not change the history records (`docs/changes/bootstrap.md`, `docs/daily`).

## Verification

- `npm run skills:sync`: refreshed `.claude/skills/`.
- `npm run test:skills`: **4 pass / 0 fail / 0 skip**.
- skill-creator `quick_validate.py` (`PYTHONUTF8=1`) on the 3 skills in `skills/` and the 3 in `.claude/skills/`: all `Skill is valid!`.
- Format: this repository has no `node_modules` (installing is subject to user reconfirmation), so I ran `prettier --check` on the changed files with the same version, Prettier 3.9.10 (the workout-memo install): pass.
- Local `npm run check`: could not run because `node_modules` is not installed, so the `prettier` command was not found at the `format:check` step. There is no app code change, so I added no app tests, and the full check is confirmed by `verify` and `docker-build` of GitHub Actions on the PR.
- Links: I did not add new links in the changed text.

## Limits and follow-up

- As requested, the user reviews and merges this PR itself.

## 2026-10-21: automatic review after the PR (up to 2 rounds)

### Changes

- Added a step before merging where the PR goes through automatic code review up to 2 rounds. The order is review → fix commit → 2nd review → fix commit, and there is no more review after the 2nd fix commit. If there are no findings, go straight to checking CI and merging.
- Changes too big to fix in this PR (a feature outside the scope, a change to the design or data structure, a fix across several modules, work that needs separate verification) are split into a new issue card. For a defect where splitting would break main, or that leaves a security or data corruption risk, hold the merge and tell the user.
- Leave the result of each review round (findings, the commit that applied them, split issues, no findings) in a PR comment and in the docs work record. If a new commit appears during review, do not merge with the earlier CI result; merge after the required CI passes on the final head.
- `skills/english-study-implementation/SKILL.md`: added the new "5. Automatic code review after the PR (up to 2 rounds)" step and renamed the merge step "6. Merge after CI passes". Also updated the YAML description.
- Short summary changes: the `AGENTS.md` steps (5 review, 6 merge), `README.md`, `docs/project-setup.md` (absolute rule 2, Git strategy order, review, merge, the file role table, the AGENTS template), and `skills/english-study-{foundation,testing}/SKILL.md`. The `.claude/skills/` copies were refreshed with `npm run skills:sync`.
- Kept the existing prohibitions (merging with checks failing or running, `--admin` or bypassing branch protection, approving your own PR, pushing directly to `main`, force push) and the handling of sequential and stacked PRs.

### Reason

The user asked to limit the depth of automatic review after the PR to at most 2 rounds, split big changes into new issues, and merge after CI passes.

### Verification

| Command                                                                                                      | Result                                   |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `npm run skills:sync` → `npm run skills:check`                                                               | pass (`.claude/skills matches skills/.`) |
| `npm run test:skills`                                                                                        | pass 4/0/0 (pass/fail/skip)              |
| `PYTHONUTF8=1 py -3 quick_validate.py` (skill-creator): 3 skills in `skills/`, 3 skills in `.claude/skills/` | pass 6/6 (`Skill is valid!`)             |
| Prettier 3.9.10 (the workout-memo install) `--check`: the changed Markdown files                             | pass                                     |
| `npm run check`                                                                                              | Not run: `node_modules` not installed    |

There is no app code change, so I added no app tests. This repository has no `node_modules` and installing is subject to user confirmation, so I did not install. The full check is confirmed by `verify` and `docker-build` of GitHub Actions on the PR.
