# #28 Decide the feature scope and data structure of the certification manager service

- Issue: [#28](https://github.com/sirloinbh/cert-manager/issues/28)
- Branch: `docs/28-scope-data-model`

## Purpose

Before building the first feature (starting with #30 goal registration), decide the service scope, the screens, the tables, and the date and NULL rules. "Design the DB migration `002` for the first feature" in `docs/next-steps/README.md` was waiting for this decision.

## Changes: 2026-10-30

- Wrote `docs/design/scope-and-data-model.md` as a new document.
  - Scope: the certification area, the English study area (separate from certifications, decision in #25), and the dashboard. It also lists what is out of scope (login, notifications, public exposure).
  - Screens: 5 menu items and the address list, with the issue in charge of each screen.
  - Tables: 4 in the certification area, 9 in the English study area, and 1 added column (10 after adding `import_sources` following the 1st review). For each column it gives the type, the meaning of NULL, `CHECK`, and the delete behavior. The migration numbers are estimates and are decided when work starts.
  - Decided that computed values (expiry state, goal achieved, progress, today's tasks, lyrics state) are computed and not stored. The lyrics state was a single "translated" at first and was split into three states after the 1st review.
- Recorded the 4 user decisions in section 2 of the document and in a comment on issue #28: the goal status is chosen by hand and the app asks whether to change it when a pass is recorded, the pass judgment is entered by hand, expiring soon is 90 days, and the menu has 5 items by feature.
- Reflected the matching sections and decisions of this document in the bodies of the follow-up feature issues #30, #32, #33, #35, #36, and #37.
- `docs/next-steps/README.md`: removed the finished #26 line and put #30 (followed by #32 and #33) and #34 as next work. English study #35, #36, and #37 are written after #30.
- Added the design document link to the `README.md` docs list. Added what was done today to `docs/daily/2026-10-30.md`.

## Verification

Only docs changed, so I added no app tests.

- Format: fixed the 5 changed Markdown files with the Prettier installed in this folder (`node node_modules/prettier/bin/prettier.cjs --write`).
- Link check: all 18 relative links in the 5 changed documents point to files that exist.
- `npm run check` (Node 24.21.0 / npm 11.19.0): pass. Format, lint, and type checks pass. Backend tests 4 of 5 passed and 1 was skipped (`TEST_DATABASE_URL` not set, not counted as success), frontend 52 passed, skills 4 passed, build succeeded.
- `node .standards/secret-scan.mjs`: no suspicious items. `node .standards/check.mjs`: pass.
- The table design is a document and there is no migration yet. I did not actually apply it with SQL, so the `CHECK` and key rules are confirmed in the migration and the DB integration test of each feature issue.

## Applied the 1st automatic review: 2026-10-30

The 1st review of PR #40 (a read-only agent separate from the writing context) found 0 high, 6 medium, and 4 low items. All were fixed in the design document in this PR.

- Medium: swapping the order is blocked by `UNIQUE (…, position)`. Made the order UNIQUE a `DEFERRABLE INITIALLY DEFERRED` constraint and wrote the reason in section 4.
- Medium: "translated" is also true for a song with no lyrics. Split the lyrics state into three: "no lyrics / not translated / translated".
- Medium: the `NULL` of `expires_on` meant both "no expiry" and "unknown", which did not match the #32 done criterion (showing "no expiry"). Added a table of display rules that tells them apart by `validity_kind` and `outcome`.
- Medium: the `NULL` of `etymology_source` meant both "not looked up yet" and "no data". Decided that no data is `''`.
- Medium: `UNIQUE (form, kind, meaning_ko)` on etymology parts splits the same root if the meaning sentence differs between sessions. Added a fixed name `key` (for example `root:port`) and made the export pass the list of existing parts too.
- Medium: "store the source URL and fetch date" in section 6 of the survey document was missing. Added the `import_sources` table, `songs.lyrics_source_url`, and the source link column of `words`.
- Low: changed the columns that are `''` even before the result (`grade`, `part_of_speech`, `origin`) to allow `NULL`.
- Low: durations in seconds and months differ from the central rule (minutes). Wrote the exception and the reason in section 4 and registered central issue [project-standards#353](https://github.com/sirloinbh/project-standards/issues/353).
- Low: wrote the end-of-month adjustment for the expiry calculation (`2024-02-29` + 24 months = `2026-02-28`), the meaning of `expires_on` as the last valid day, and the driver's license handling. Whether the last valid day is the added day or the day before is decided in #32 from the official guide.
- Low: decided in the table of section 1 whether to cover the candidates in the #28 tasks (exam sessions and registration, study log, renewal date, schedule screen). Fixed the table count in the change record and the next-steps description.

Verification (after the 1st fixes): Prettier `--check .` passes. All 19 relative links in the 5 changed documents point to files that exist (1 link to the survey document was added in the `import_sources` section). `secret-scan` found no suspicious items. `npm run check` passes (the numbers are the same as the first verification).

## Applied the 2nd automatic review: 2026-10-30

The 2nd review confirmed that the 10 findings of the 1st are in the document, and raised 7 new ones (2 medium, 5 low). All were fixed in this PR. There is no 3rd review.

- Medium: "a deferred constraint can only be created with `ALTER TABLE … ADD CONSTRAINT`" was wrong, and writing it that way fails when applied again (`ADD CONSTRAINT` has no `IF NOT EXISTS`). Changed it to write it as a table constraint inside `CREATE TABLE IF NOT EXISTS`, and use a `DO` block that checks `pg_constraint` only when adding it later.
- Medium: the etymology part `key` examples (`root:port`, `root:port:carry`) split the same root in two. Wrote the rule that a part made first is `<kind>:<form>`, only a later part with a different meaning gets a suffix, an existing `key` is never changed, and the format `CHECK`. The examples are `root:port` (to carry) and `root:port:harbor` (harbor).
- Low: wrote that the deferred UNIQUE is used only for `study_stages` and `study_tasks`, and the keys of `album_tracks`, `word_morphemes`, and `daily_words` are not deferred (`ON CONFLICT` cannot use a deferred constraint for conflict detection).
- Low: matched the meaning of NULL. The rule that number and date columns use `NULL` alone and are told apart by another column, `lyrics_source_url` (`''` if entered by hand), and the meaning of `etymology_url`, `etymology_source_id`, and `list_source_id`.
- Low: decided that `import_sources` is one row per script run and the screen name is shown by converting `kind`. The rows on the song side are a run history that nothing references.
- Low: if there are several records because of retakes, the expiry card uses only the latest `passed` or `scored` record. If `validity_kind` is `none`, clear `expires_on`.
- Low: changed "translated" that was left in the computed values list of the change record to "lyrics state".

Verification (after the 2nd fixes): Prettier `--check .` passes (inside `npm run check`). All 19 relative links are fine. `secret-scan` found no suspicious items. `npm run check` passes: backend 4 passed and 1 skipped (`TEST_DATABASE_URL` not set, not counted as success), frontend 52, skills 4 passed, build succeeded. I did not apply the deferred UNIQUE and `CHECK` statements with SQL, and they are confirmed in the DB integration tests of the #33 and #36 migrations.
