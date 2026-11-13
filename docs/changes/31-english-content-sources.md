# #31 Survey how to get pop song lyrics and translations and English words and etymology

- Issue: [#31](https://github.com/sirloinbh/cert-manager/issues/31)
- Branch: `docs/31-english-content-sources`

## Purpose

Before building the English study area features (#35 viewing pop song lyrics, #36 word list and etymology, #37 word of the day), decide where and how to get the material.

## Changes: 2026-10-30

- Wrote `docs/research/english-content-sources.md` as a new document. For the original lyrics, the translation, the song list, the song scope, the word list, the etymology, and where to store things, it gives the method decided, the reason, and the sources.
  - YouTube Music has no official lyrics API and the YouTube terms forbid automated access, so it is not used. Fetching the original lyrics from LRCLIB was recommended.
  - For translation, translating once with the Claude API when fetching and storing it in the DB was recommended (changed in "Applying the user decision" below).
  - Because the repository is public, I wrote the rule that the original lyrics and translations stay only in the local DB.
- Follow-up issue: using the Claude API needs this app's registry `features.claude` turned on, so I registered [sirloinbh/project-standards#351](https://github.com/sirloinbh/project-standards/issues/351). Getting the key follows the existing user step [project-standards#266](https://github.com/sirloinbh/project-standards/issues/266).
- Added the survey document link to the `README.md` docs list.
- `docs/next-steps/README.md`: "Register the detailed requirement issue cards" is done (#30 to #38), so I fixed the table.
- Wrote `docs/daily/2026-10-30.md` as a new file and added it to the list.

The decisions that need user confirmation (the lyrics source, the translation method, and the song scope) were recorded in a comment on issue #31.

## Applying the user decision: 2026-10-30

- The user chose the recommendation for the lyrics source, LRCLIB, and for the song scope, the 12 regular albums + From the Vault songs. For translation, instead of the recommendation (batch translation with the Claude API), the user decided to **translate in a Claude Code session**.
- Changed the conclusion table and section 2 of the survey document to the session translation order (export to `.local/translations/` → translate in a session → import after checking the line counts). Matched the word meaning and etymology organizing to the same method.
- The app does not use the Claude API, so I closed [project-standards#351](https://github.com/sirloinbh/project-standards/issues/351) as not planned. Deleted the "Follow-up issue" section and the sentences about the Claude API key from the survey document.
- Changed the tasks of the follow-up feature issues #35 and #36 to match the conclusion (edited the issue bodies).
- `docs/next-steps/README.md`: the decision is done, so I removed the "Check the #31 decision" line.

## Verification

Only docs changed, so I added no app tests.

- Formatted the 6 changed Markdown files with Prettier 3.9.10 (the same version as the lockfile, already installed in the old folder). The table alignment changed in 3 files. I did not install new packages.
- Link check: all 21 relative links in the 6 changed documents point to files that exist.
- `node .standards/secret-scan.mjs`: no suspicious items.
- `node .standards/check.mjs`: only the item saying 4 shared packages are not installed appeared. It is because the new folder `cert-manager` has no `node_modules` (the remaining user step of #26). It is unrelated to the docs change.
- `npm run check`: could not run. There is no `node_modules`, and installing needs user approval. The full check including the format check is confirmed by the GitHub Actions result.

## Applied the 1st automatic review: 2026-10-30

The 1st review of PR #39 (a read-only agent separate from the writing context) had no high or medium findings and found 4 low ones.

- Wrote the required values (`track_name`, `artist_name`) and the optional values (`album_name`, `duration`) of LRCLIB `/api/get` separately.
- The finding that "200 to 500 ms between requests" had no source: the LRCLIB `docs.md` original has "add a short delay between requests (200–500 ms)", so I left the sentence as it was.
- Wrote in the copyright section that "it is an operating rule, not a judgment that it is legally allowed", and wrote in section 2 that session translation also sends the lyrics to Claude Code (Anthropic).
- Format command: wrote in the verification section below, as a command, how I used the Prettier in the old folder `english-study.old`.

## Verification: after applying the review

- Format: for each changed Markdown, I formatted standard input in the `english-study.old` folder with `node node_modules/prettier/bin/prettier.cjs --stdin-filepath <the same path inside the old folder>` and overwrote the file with the result. That folder's `prettier.config.mjs` is the same as this repository's (no difference in `diff`). The new folder does not have `@sirloinbh/prettier-config` installed, so I used this method.
- Link check: all 20 relative links in the 6 changed documents point to files that exist (the survey document link was removed from the next steps table, so the count went from 21 to 20).
- `node .standards/secret-scan.mjs`: no suspicious items.
- GitHub Actions (commit `7a0da56`): `ci / verify`, `ci / docker-build`, and CodeQL passed. `ci / e2e` and `ci / e2e-visual` are turned off for this app and were skipped.

## Applied the 2nd automatic review: 2026-10-30

The 2nd review confirmed that the 4 findings of the 1st and the user decision were applied correctly, and raised 4 new ones (1 medium, 3 low). All were fixed in this PR. There is no 3rd review.

- Medium: the #31 task "compare other lyrics source candidates and their terms" was missing. Added a comparison table of YouTube Music, Genius, Musixmatch, LRCLIB, and pasting by hand in section 1. Wrote that the Genius and Musixmatch limits come from secondary sources, not the official terms.
- Low: changed "re-recorded songs have the same lyrics as the originals" to "mostly the same", and decided that for songs whose lyrics changed ("Better than Revenge"), the original lyrics are used and the changed lines are written in the memo.
- Low: the verification record after the review had no link check or secret-scan result. Added them to "Verification: after applying the review" above.
- Low: the note in the #35 body did not point to the common rules in section 6 (the downloaded originals stay outside the repository, store the source URL and the fetch date). Fixed the issue body.

Verification (after the 2nd fixes): Prettier format (the same method), 20 relative links fine, and `secret-scan` found no suspicious items. I checked again that the source URLs are the same as the addresses in the search results.
