# #64 Build the lyrics fetch and translation file scripts

- Issue: [#64](https://github.com/sirloinbh/cert-manager/issues/64)
- Branch: `feat/64-lyrics-scripts`
- Material: sections 1 and 2 of [Sources of English study material](../research/english-content-sources.md); earlier work: [#35 change record](35-song-lyrics.md)

## Order of use

The user runs them directly. All of them write to the DB in `DATABASE_URL` and print the target DB when they start.

1. `npm run lyrics:import -w backend`: fetches the lyrics of songs without lyrics from LRCLIB and puts them in.
2. `npm run translations:export -w backend`: exports songs that are not fully translated to `.local/translations/<song ID>.json`.
3. Fill the `translation` in the file by hand or with another translation tool.
4. `npm run translations:import -w backend`: puts only the files where every line matches into the DB and moves them to `imported/`. It skips files that are not filled in yet, and for a file that does not fit it prints the reason and does not save.

## Judgments

| Item                           | Judgment                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request interval               | 700 ms instead of the 200-500 ms in the issue. To stay under the roughly 90 per minute limit in the survey document, it must be 667 ms or more                                                                                                                                              |
| Songs not found                | If `api/get` gives `404`, has no text, or returns a different song, look it up with `api/search`. It is because the LRCLIB title may carry a version label. On both paths, use it only when the title (excluding version and guest labels), the artist, and the length (±3 seconds) match   |
| Songs that already have lyrics | Do not touch them. Do not overwrite lyrics entered by hand                                                                                                                                                                                                                                  |
| One song fails                 | Continue with the rest, and at the end report the failed songs and exit with code 1. Stop the whole run when giving up on the rate limit, on 5 failed songs in a row, and on a DB error                                                                                                     |
| Output                         | Print only the song title and counts. Do not print lyrics                                                                                                                                                                                                                                   |
| Time-synced lyrics             | If there are no plain lyrics, strip the time marks and use them                                                                                                                                                                                                                             |
| Export                         | Do not overwrite a file that already exists, to protect a translation in progress. Blank lines are not put in the file                                                                                                                                                                      |
| Import                         | A file is saved entirely or not at all. If the line count, line number, or original differs from the DB, or there is an empty translation, it is not saved. If the `atExport` in the file differs from the DB translation, it was edited on the screen after the export, so it is not saved |
| Code location                  | Moved the line splitting and the transaction to `lyrics-store.ts` and the target DB output to `script-database.ts`, so the route and the scripts share them                                                                                                                                 |

## Changes: 2026-11-01

- Lyrics fetch: `backend/src/lyrics-fetch.ts`, `backend/src/import-lyrics.ts`. The fetch record is left in `import_sources` (empty license because there is no notice).
- Translation files: `backend/src/translation-files.ts`, `backend/src/export-translations.ts`, `backend/src/import-translations.ts`.
- Shared: `backend/src/lyrics-store.ts`, `backend/src/script-database.ts`. `backend/src/routes/songs.ts` and `backend/src/import-song-list.ts` use them.
- Docs: the README usage, section 2 of the survey document, the next steps, and the daily log.

## Applied the 1st code review: 2026-11-01

I checked 1 high, 4 medium, and 8 low findings of the independent review.

| Finding                                                                 | Handling                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Importing again overwrites a translation edited on the screen (high)    | Moved the saved file to `imported/`                                                                                                                           |
| A file that is not filled in is counted as all rejected and exit code 1 | A file the same as the DB is counted separately as skipped                                                                                                    |
| It does not check that the `/api/get` result is the right song          | It goes through the same check as the search                                                                                                                  |
| It does not stop even if everything fails                               | Stops if it gives up on 429 or is told to wait over 300 seconds, stops after 5 failed songs in a row, stops on a DB error, and a 30 second request time limit |
| A file with a BOM is rejected                                           | Strip the BOM                                                                                                                                                 |
| An error if you run the import first                                    | Create the folder and tell the user to export first                                                                                                           |
| A fractional or huge song ID or a NUL character stops the script        | Reject the file                                                                                                                                               |
| No upper limit on the file's character count                            | 5,000 characters per line. The LRCLIB response size is not limited. It is a local script the owner runs, so I left it                                         |
| Consecutive time marks                                                  | Fixed the regular expression                                                                                                                                  |
| The fetch record is left only at the end of a run                       | Not fixed. There is a per-song source column, so the effect is small                                                                                          |
| The artist comparison is loose                                          | Accept only the name alone, or when a guest label follows                                                                                                     |
| A response fragment can get mixed into the failure log                  | Print a fixed phrase other than the status code                                                                                                               |
| Part of the password can appear in the target DB output                 | Reject it if the path has `@`                                                                                                                                 |

## Applied the 2nd code review: 2026-11-01

I checked 3 medium and 5 low findings of the independent review.

| Finding                                                                 | Handling                                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| If moving the file fails after saving, the overwrite problem comes back | Move a file that is already the same as the DB instead of skipping it                                                                                |
| A translation edited on the screen after the export is overwritten      | Save `atExport` in the file and reject it if it differs from the DB                                                                                  |
| Cannot find a song whose translated edition has a guest label           | Removed the guest label in the title comparison                                                                                                      |
| `sameArtist` misses `featuring` and parenthesis notation                | Fixed the regular expression                                                                                                                         |
| A file that is not filled in is rejected                                | If there is no input, skip it even if the DB changed                                                                                                 |
| A NUL character in a response stops everything                          | Do not use that response                                                                                                                             |
| The docs do not match                                                   | Fixed the judgment table, the test table, and the README                                                                                             |
| Test gaps                                                               | Added a rerun after a failed move and a change after the export. The fetch record when stopping with 429 after saving songs was checked only by code |

## Tests

| File                                              | Behavior verified                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/lyrics-fetch.test.ts`               | With a fake server: 200, 404, 429 (waiting for `Retry-After` and retrying, 60 seconds when it is missing, stopping on repeats), 500, the request values and `User-Agent`, search fallback and filtering out other songs, time-synced lyrics, 3 stop conditions, and the target DB output                                                                                               |
| `backend/test/lyrics-scripts.integration.test.ts` | On a real DB: saving and the source, keeping lyrics already entered, continuing after one song fails, the fetch record, running again, the export content and not overwriting, 9 kinds of wrong files not being saved, skipping files not filled in, a BOM file and the move to `imported/`, rerun after a failed move, keeping translations edited on the screen, and a vanished song |

## Verification

- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 91 passed (0 skipped), frontend 207 passed and 2 skipped (`DARK_ONLY`), skills 4 passed, build succeeded. `npm run knip`: no findings.
- I did not send requests to the real LRCLIB. The user runs the lyrics fetch directly. Whether it matches the real responses will show up on the first run.
- All test sentences were written by hand. I confirmed with `git check-ignore` that `.local/` is in `.gitignore`.
- No screen changes.

## Limits

- How many songs it finds is known only by running it. Paste the songs it could not find on the screen.
- It does not automatically check that the lyrics received are the right edition. It looks only at the title, artist, and length.
- Filling in the translations is not part of this work. Claude Code does not translate lyrics.
