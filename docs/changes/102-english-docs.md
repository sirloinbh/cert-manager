# #102 Translate the current Korean docs to English

- Translated 24 markdown files to English: `README.md`, `AGENTS.project.md`, the `README.md` files in `backend/`, `frontend/`, and `database/`, `docs/design/`, `docs/next-steps/`, `docs/plans/`, `docs/project-setup.md`, `docs/research/`, and the three project skills under `skills/`.
- Copied the skill changes to `.claude/skills/` with `npm run skills:sync` (`node scripts/claude-skills.mjs sync`).
- Kept commands, paths, identifiers, issue numbers, and dates unchanged. Changed the link text and the heading anchor of the bootstrap checklist in `docs/project-setup.md` together (`#11-bootstrap-checklist`).
- Not translated: `AGENTS.md` and `skills/std-git-writing/SKILL.md` (centrally managed), and `docs/changes/` and `docs/daily/` (#101).
- Kept in Korean on purpose: the `'기타'` ("Other") SQL example in `docs/project-setup.md`, which shows the Korean text that PowerShell 5.1 turns into `'??'`.

## Verification

- `node node_modules/prettier/bin/prettier.cjs --check` on the changed files: pass.
- `node scripts/claude-skills.mjs`: `.claude/skills` matches `skills/`. `node --test scripts/test/claude-skills.test.mjs`: 4 pass, 0 fail.
- A Hangul search (`[\uAC00-\uD7A3]`) over the markdown files outside `docs/changes/` and `docs/daily/` finds only the three exceptions above.
- Lint, type check, and app tests were not run because only markdown files changed.
