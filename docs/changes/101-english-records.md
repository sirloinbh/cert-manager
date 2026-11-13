# #101 Translate past records in docs to English

- Translated the Korean change records in `docs/changes/` (36 files, including `README.md` and `bootstrap.md`) and the daily logs in `docs/daily/` (13 files, including `README.md`) to English. There were no ADRs.
- Kept file names, headings structure, commands, command output, file paths, identifiers, issue and PR numbers, commit SHAs, and dates unchanged. Link text was translated and link targets were not changed.
- Kept in Korean on purpose, with an English gloss in parentheses: quoted UI text and API or script messages that the app showed at the time (for example `"자격증 관리"` and the `Retry-After` log line in `89-lrclib-503.md`), and the Korean validation messages in the table of `73-zod4-syntax.md`.
- Translated the English-visible parts of the records only. The wording of old records was not updated to today's state, so names such as `english-study` stay as they were.

## Verification

- `node node_modules/prettier/bin/prettier.cjs --check` on the changed files: pass (formatted with `--write` first; tables were realigned).
- A Hangul search (`[\uAC00-\uD7A3]`) over `docs/changes/` and `docs/daily/` finds only the quoted Korean strings described above.
- Only markdown files changed, so lint, type check, and app tests were not run locally. CI runs the full check.
