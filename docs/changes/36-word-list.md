# #36 Build the frequently used English word list and etymology analysis

- Issue: [#36](https://github.com/sirloinbh/cert-manager/issues/36)
- Branch: `feat/36-word-list`
- Design: section 6 of [Service scope and data model](../design/scope-and-data-model.md); material: sections 4 to 6 of [Sources of English study material](../research/english-content-sources.md)

## Order of use

All of them write to the DB in `DATABASE_URL` and print the target DB when they start.

1. `npm run words:import -w backend`: fetches the NGSL 1.2 list and puts it in. The original is kept in `.local/sources/`.
2. `npm run words:etymology -w backend`: looks up the Wiktionary etymology of each word. The first run takes about 1 hour, and if you stop it, the next run fetches from the remaining words.
3. `npm run words:export -w backend -- 50`: exports words whose etymology was looked up and that have no meaning yet, in frequency order, to `.local/word-batches/`.
4. Fill in the meanings, examples, and etymology parts of the file in a Claude Code session.
5. `npm run words:fill -w backend`: saves a whole file and moves it to `imported/`. A file that does not fit prints the reason and is not saved. If it was saved but could not be moved, it separately tells you to delete it.

## Judgments

| Item                 | Judgment                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                | This issue covers the table, the scripts, the API, and the screens. Filling in 2,809 words needs several sessions, so I split it into a follow-up issue                                                              |
| Fetching etymology   | Instead of the 3.2GB full dump (marked for removal), fetch the per-word files from kaikki.org at 1 second intervals                                                                                                  |
| Etymology text       | Cut the auto-generated lineage at the start up to the `English <word>` line. If that line is missing or there is no text after it, treat it as no data. Put the same text for different parts of speech in only once |
| Original files       | Keep only the NGSL CSV in `.local/sources/`. For the per-word files, put only the etymology text into the DB and discard them                                                                                        |
| Spreadsheet traces   | Fix `TRUE` and `FALSE` in the original to lowercase, and leave `I` as it is                                                                                                                                          |
| License              | NGSL is CC BY-SA 4.0 as the site states. kaikki.org has no notice, so I record CC BY-SA 4.0 from the Wiktionary copyright page                                                                                       |
| Etymology parts      | They cannot be added to a word with no etymology data. The same `key` is the same part and keeps the meaning written first                                                                                           |
| Words already filled | The import does not overwrite them and rejects the file                                                                                                                                                              |
| List                 | Fetch all 2,809 rows at once, search on the screen, and show 100 at a time                                                                                                                                           |
| Shared code          | Moved the request interval and retry into `polite-fetch.ts`, shared with the lyrics fetch. In the process the lyrics fetch also waits and retries on `503`, and if it gives up it stops the whole run like `429`     |

## Changes: 2026-11-01

- DB: `database/migrations/008_words.sql`. `words`, `morphemes`, `word_morphemes`. `import_sources` was created in #35.
- Scripts: `backend/src/word-list.ts`, `import-word-list.ts`, `word-etymology.ts`, `import-etymology.ts`, `word-files.ts`, `export-words.ts`, `import-words.ts`, `polite-fetch.ts`.
- API: `backend/src/routes/words.ts`. `GET /api/words`, `GET /api/words/:id`.
- Screens: `frontend/src/words.tsx`, `word-data.ts`, and `/words` and `/words/:id` in `app.tsx`. The source and license are written below both screens.
- This PC's app DB `cert`: put in 2,809 words and ran the etymology lookup.

## Applied the 1st code review: 2026-11-01

I checked 2 medium and 10 low findings of the independent review. I sampled the stored values and confirmed that two were real problems, stopped the etymology fetch that was running, fixed them, and fetched again from the start (one more time after the 2nd review).

| Finding                                                        | Handling                                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Removing the lineage drops a sentence or stores a lineage line | A lineage line was really mixed into `well`. Instead of guessing, cut at the `English <word>` line                               |
| The test also changes other words in the DB                    | If other words exist, it fails at the start                                                                                      |
| The address of `I` (uncertain)                                 | It was really wrong. Keep the case of the address                                                                                |
| If the list changes, ranks collide                             | A list whose ranks changed reports the reason and is not saved                                                                   |
| CSV duplicates and missing ranks                               | Rejected                                                                                                                         |
| A DB error from file content stops the script                  | Reject only that file                                                                                                            |
| Move failure after commit                                      | It was saved, so tell the user to delete the file                                                                                |
| The same part twice in one word                                | Rejected                                                                                                                         |
| Moving to a related word loses the search term                 | Pass the return information                                                                                                      |
| The page count is outside the URL                              | Go to the first page for a different search. Coming back from the detail still starts from the first 100, and I left it as it is |
| Empty trailing key                                             | Rejected in the file check and in the DB                                                                                         |
| Behavior change in the lyrics fetch                            | Restored the `Accept` header, added a `503` test, and recorded it in the judgment table above                                    |

## Applied the 2nd code review: 2026-11-01

I checked 1 medium and 6 low findings of the independent review.

| Finding                                                      | Handling                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A short sentence is mistaken for the end of the lineage      | Treat only the `English <that word>` line as the end. Stopped the etymology fetch and fetched again |
| The fixed constraint is not applied to an already created DB | The file is not merged yet, so I fixed both DBs on this PC directly                                 |
| The output for a failed move is contradictory                | Print saved and could-not-move separately                                                           |
| The cause cannot be found from the DB rejection message      | A NUL is rejected in the file check with the item position. DB errors get a code attached           |
| A list that will be rejected overwrites the original first   | Write the original after the save succeeds                                                          |
| Page reset differs from the comment                          | There is no harm to behavior, so I fixed the comment                                                |
| Docs do not match                                            | Fixed                                                                                               |

## Tests

| File                                     | Behavior verified                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/word-list.test.ts`         | Reading the list and spreadsheet traces, rejecting wrong files, entry addresses, removing the lineage line and duplicates, 200, 404, and 503 from a fake server, stop conditions, not printing the response, stopping on a DB error                                                                                               |
| `backend/test/words.integration.test.ts` | On a real DB: rerunning the list, not exporting words whose etymology was not looked up, marking found and none, 10 kinds of wrong files, sharing parts and keeping the first meaning, rejecting words already filled, the API frequency order, source, same root, 404, 400, refusing to delete a part in use, and the `key` rule |
| `frontend/src/words.test.tsx`            | Search rules, list and source, showing 100 at a time, keeping the search term, empty list, failure, detail display, pressing a part shows words with the same root, moving words resets the selection, a word not filled in, no etymology data, a missing word                                                                    |

## Verification

- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 103 passed (0 skipped), frontend 222 passed and 2 skipped (`DARK_ONLY`), skills 4 passed, build succeeded. `npm run knip`: no findings.
- Real data: ran `words:import` against the real site and received 2,809 words (ranks 1 to 2809 with none missing). Ran `words:etymology` on `cert`. The sample results are written in the PR comment.
- Browser: checked with headless Edge on Vite 5206 + backend 3106 + `cert_test`. The word list is the real NGSL, and I put meanings and etymology parts into only four words for the check and then deleted them.
  - Mobile 390×844 and PC 1440×900: list, show more, search, detail, pressing a part to see words with the same root, and the source notice. No console errors or warnings and no horizontal overflow.

## Limits

- Most meanings, examples, and etymology parts are still empty. A follow-up issue fills them in frequency order.
- The etymology parts and meanings are AI-generated values and can be wrong. The screen marks them as "AI 정리" ("organized by AI") and shows the Wiktionary original text together.
- If this app is made public, keep the source notice according to CC BY-SA 4.0, and distribute a modified list under the same license.
