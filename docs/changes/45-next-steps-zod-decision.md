# #45 Fix the guidance on security PR #15 in the next steps document

- Issue: [#45](https://github.com/sirloinbh/cert-manager/issues/45)
- Decision: [sirloinbh/project-standards#307](https://github.com/sirloinbh/project-standards/issues/307) candidate A, the decision section of project-standards `docs/research/zod4.md`

## Purpose

The next steps document told us to handle PR #15 (`zod` 3 → 4) as the top priority, and in [#27](27-rename-to-cert-manager.md) it even added to recreate the lockfile. The guidance differs from the central decision, so I am fixing it.

## Changes: 2026-10-30

- `docs/next-steps/README.md`: removed the PR #15 row from the table and renumbered. Wrote the decision and whether this app is exposed under "Also see".

## Verification

- `git grep -n "z\.array\|\.array(" -- backend/src`: no results
- `node .standards/check.mjs`: pass, no zod array warning
- `npm audit --omit=dev`: 1 zod high (GHSA-mrhx-c7xc-m3w5). It remains as decided
- `npm run format:check`: pass

## Limits

I did not change the code. PR #15 stays open as decided.

## Automatic code review: 2026-10-30

- 1st (read-only review agent): no defects. I compared the decision content and dates, the centrally managed values, no `z.array`, the message count limit (`MAX_ISSUES = 10`), and whether only the PR #15 row was removed from the table against the original. There was no fix commit, so I did not do a 2nd review.
