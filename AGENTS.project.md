# Certification manager project-specific instructions

This file holds the rules that apply only to cert-manager. The common instructions are in [AGENTS.md](AGENTS.md); after the central standards sync (`sirloinbh/project-standards`) it becomes a centrally managed file. If the two files differ, this file wins.

## Work procedure (in addition to the common procedure)

- **After you open a PR, review it yourself 1 or 2 times (more only while blocking findings remain, per std-code-review section 8).** Fix findings on the same branch in additional commits between rounds, and post each round as a PR comment. If there are no findings, go straight to the next step. File a new issue card for a big problem outside this PR's scope instead of growing the PR. Follow the cert-manager-implementation skill for the detailed procedure.
- **After that, when all required CI checks on the final head pass, the agent (main agent or local worker) merges with a merge commit using `scripts/gh-project.ps1 pr merge <url> --merge --match-head-commit <verified head SHA>` and checks that the linked issue is closed.**
- **Merge guards (project-standards ADR-0016):** if the PR's "Check before merging" lists an item that needs the user's own decision, ask the user and do not merge. Merging is not applying: real production or AWS changes (for example `terraform apply` or a manual deploy action) still need the user's OK.
  - Merge sequential and stacked PRs in order. After the earlier PR merges, merge `origin/main` into the next PR branch, resolve conflicts, run the related tests again, push normally (no force), and merge after CI passes.
  - Still forbidden: merging while checks are failing or running, `--admin` or bypassing branch protection, replacing review by approving your own PR, pushing directly to `main`, and force push.
  - A merge to `main` is not connected to automatic deploy right now. When deploy is connected, check the deploy result after merging.

## Project-specific skills

- [cert-manager-implementation](skills/cert-manager-implementation/SKILL.md), [cert-manager-testing](skills/cert-manager-testing/SKILL.md), [cert-manager-foundation](skills/cert-manager-foundation/SKILL.md): they contain this project's review and merge procedure, so keep them even after the common skills (std-*) arrive.

## Service rules

- None yet. When a domain rule that applies only to this project appears, write it here.
