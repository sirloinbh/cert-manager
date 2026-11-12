# Certification manager project-specific instructions

This file holds the rules that apply only to cert-manager. The common instructions are in [AGENTS.md](AGENTS.md); after the central standards sync (`sirloinbh/project-standards`) it becomes a centrally managed file. If the two files differ, this file wins.

## Work procedure (in addition to the common procedure)

- **After you open a PR, it goes through automatic code review up to 2 rounds.** Fix any findings in follow-up commits, and after the first round of fixes get one more review. Do not review again after the second round of fixes. If there are no findings, go straight to the next step. Split changes that are too big to fix in this PR into a new issue card. Follow the cert-manager-implementation skill for the detailed procedure.
- **After that, when all required CI checks on the final head pass, the agent (main agent or local worker) merges with a merge commit using `scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <verified head SHA>` and checks that the linked issue is closed.**
  - Merge sequential and stacked PRs in order. After the earlier PR merges, merge `origin/main` into the next PR branch, resolve conflicts, run the related tests again, push normally (no force), and merge after CI passes.
  - Still forbidden: merging while checks are failing or running, `--admin` or bypassing branch protection, replacing review by approving your own PR, pushing directly to `main`, and force push.
  - A merge to `main` is not connected to automatic deploy right now. When deploy is connected, check the deploy result after merging.

## Project-specific skills

- [cert-manager-implementation](skills/cert-manager-implementation/SKILL.md), [cert-manager-testing](skills/cert-manager-testing/SKILL.md), [cert-manager-foundation](skills/cert-manager-foundation/SKILL.md): they contain this project's review and merge procedure, so keep them even after the common skills (std-*) arrive.

## Service rules

- None yet. When a domain rule that applies only to this project appears, write it here.
