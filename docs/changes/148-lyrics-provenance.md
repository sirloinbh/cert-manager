# #148 Record lyrics provenance per save and keep old translation files

- `backend/src/lyrics-fetch.ts`: the `import_sources` row is written in the transaction of the first saved song, not after the loop, so a run that fails or stops later still has provenance for the lyrics it saved. Still one row per run, and none when nothing was saved.
- `backend/src/lyrics-fetch.ts`: a song deleted during the run (`lockSong` answers 404) is skipped and listed in the new `gone` result and the log; the run goes on. Other errors still stop it. `import-lyrics.ts` prints the count.
- `backend/src/translation-files.ts`: `moveToImported` keeps an earlier file of the same name in `imported/` and gives the new one a timestamp (`<id>.<time>.json`). The first import keeps the plain name, so existing behavior and tests are unchanged. This is the one deviation from the issue wording ("add a timestamp to the name"): a timestamp only when the name is taken.
- Tests: `lyrics-fetch.test.ts` (provenance written with the first save and kept after a later stop; a deleted song is skipped), `translation-files.test.ts` (second import keeps both files).

## Checks

- `npm run check` passed: backend 133 passed and 16 skipped, frontend 344 passed and 3 skipped, skills 4 passed.
- The DB integration tests (`lyrics-scripts.integration.test.ts` covers the one-row-per-run provenance and the first-import file name) were skipped locally: no PostgreSQL on this Mac. CI runs them.
