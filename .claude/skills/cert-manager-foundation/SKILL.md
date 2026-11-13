---
name: cert-manager-foundation
description: Establish or improve the repeatable development foundation of the cert-manager app, covering stack, structure, conventions, API contracts, design, tests, AI guidance, and deployment. Use for project foundation requests; apply only the requested scope through the cert-manager-implementation issue-to-PR workflow.
---

# Certification manager development foundation

Make how this app is developed, verified, and operated repeatable. First read `AGENTS.md` at the project root and `skills/cert-manager-implementation/SKILL.md`, and then follow the procedure: issue → branch based on the issue number → implementation and docs record → tests and PR → automatic code review (up to 2 rounds) → agent merge after required CI passes. This skill does not skip the issue and PR procedure or the CI pass condition, and it does not grant deploy permission.

## Standards

- The standard document is `docs/project-setup.md`. Check the current package.json, lockfiles, API and SQL, Compose, and CI, and separate what is really implemented from recommendations (not adopted). Do not install the whole recommendation list automatically.
- There is one user, the owner, and login is not in the current requirements. Dates use Asia/Seoul.
- When you change or add a tool, first write down the real problem, the data impact, and how to verify it, and install packages only after the user confirms again.

## Steps

1. Decide the current state and the issue's done criteria, and record the reason for the choice, the structure, and the contract in the docs.
2. Keep tool settings, run commands, CI, and docs in step in the same change. Do not create unused settings, scripts, or empty modules.
3. For API and DB changes, keep the meaning of existing data and of dates and units, and verify how the migration is applied and how a failure is recovered. Have only one source of DB migrations.
4. For screen changes, keep the design tokens (the CSS variables in `frontend/src/style.css`) and existing components, and sort out loading, empty results, errors, and keyboard access within that scope.
5. Apply `skills/cert-manager-testing/SKILL.md` together. Write the implementation and tests together, add a regression test for a bug, and record the real results in the docs and the PR.
6. Deploy only within the scope the user requested. Prepare image versions, a health check, secret management, backup and restore, and recovery to the previous version.
7. Include a docs record in each work commit and open a verified PR. After the PR, go through automatic code review up to 2 rounds and fix findings (a new issue for big changes), and when all required CI checks on the final head pass, merge with a merge commit following the cert-manager-implementation procedure and check that the linked issue is closed.

## Done criteria

You must be able to reproduce install, run, and verification in a new environment by following the docs, and the tools you chose must be reflected in the real code, commands, and CI. State tools that are not installed, checks that were skipped, and deploys that were not actually done as follow-up work.
