# #35 Build the screens to view pop song lyrics and translations

- Issue: [#35](https://github.com/sirloinbh/cert-manager/issues/35)
- Branch: `feat/35-song-lyrics`
- Design: section 6 of [Service scope and data model](../design/scope-and-data-model.md); material: [Sources of English study material](../research/english-content-sources.md)

## Splitting the scope

I checked and split it as the first task of the issue says.

- This issue: the tables, the API, the song list and search, the line-by-line lyrics screen, pasting lyrics and translations on the screen, and the MusicBrainz song list script.
- Split into [#64](https://github.com/sirloinbh/cert-manager/issues/64): the LRCLIB lyrics fetch script, and exporting and importing translation files.

## What differs from the #31 decision

"Translate in a Claude Code session" cannot be done. Claude Code does not copy or translate full copyrighted lyrics. I changed translation to the user pasting it on the screen or importing it from a file, and fixed the conclusion and section 2 of the survey document. In this work too I did not fetch or read real lyrics, and I used only sentences I wrote myself in the tests and the browser check.

## Judgments

| Item                      | Judgment                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choosing the base edition | Among editions with 8 or more songs, the one with the fewest songs, and for a tie the earliest edition                                                                                                                                                                                                              |
| Taylor's Version          | Include only the From the Vault songs. Leave out the lyric video tracks and repeats with the same title                                                                                                                                                                                                             |
| Song title                | Remove "(Taylor's Version)" and "(From the Vault)"                                                                                                                                                                                                                                                                  |
| Running the script again  | Replace the tracks of an album. Delete songs that are in no album, but keep songs that have lyrics and print their count                                                                                                                                                                                            |
| Checking the song count   | Write the confirmed song count in `listAlbums`. If the count received differs, save nothing and stop. I chose it instead of pinning the edition ID. It gives a person the chance to look at the song count and fix the list                                                                                         |
| Song search               | There are around 200 songs, so filter on the screen                                                                                                                                                                                                                                                                 |
| Pasting a translation     | Match the lines with text in the original to the lines with text in the translation in order. Blank lines are not counted. If the counts differ, do not save                                                                                                                                                        |
| Editing lyrics            | Lines with the same content keep their translation even if their position changes. If the same content appears several times, use the translations one each. If the content is unchanged, nothing is changed, so the source is kept. I kept it simple by looking up by content instead of a complex alignment (LCS) |
| Paste dialog              | It does not close while saving. After the input is edited, it does not close with Esc or an outside click, only with the cancel and close buttons                                                                                                                                                                   |
| Search term               | Kept in the URL `?q=`. It is kept when you open a song and come back                                                                                                                                                                                                                                                |
| `lang`                    | Put `lang="en"` on the original lines so that screen readers read them in English                                                                                                                                                                                                                                   |

## Changes: 2026-10-31

- DB: `database/migrations/007_songs.sql`. `artists`, `albums`, `songs`, `album_tracks`, `lyric_lines`, `import_sources`.
- API: `backend/src/routes/songs.ts`. `GET /api/songs`, `GET /api/songs/:id`, `PUT /api/songs/:id/lyrics`, `PUT /api/songs/:id/translation`.
- Script: `backend/src/song-list.ts` (the choosing rules), `backend/src/import-song-list.ts`, and `npm run songs:import -w backend`. It fetches only song names and lengths (CC0). If MusicBrainz gives `503`, it waits and tries again, and if there are many editions it pages through them.
- Screens: `frontend/src/songs.tsx`, `frontend/src/song-data.ts`, and `/songs` and `/songs/:id` in `frontend/src/app.tsx`.
- This PC's app DB `cert`: put in the song list of 198 songs. I did not put in lyrics.

## Applied the 1st code review: 2026-10-31

I checked 5 medium, 8 low, and 2 uncertain findings of the independent review.

| Finding                                                                      | Handling                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Focus is lost when the dialog closes                                         | Returned focus to the button that opened it with `useSectionFocus`                   |
| It can be closed while saving, and the input disappears without confirmation | Raised the save state to the screen to block it (judgment table)                     |
| Inserting a line erases the later translations                               | Changed to look up by content                                                        |
| Running again can change the edition and lose songs                          | Does not save if the song count differs. Prints the number of songs left             |
| Races in saving translations, `updated_at`                                   | Wrapped in a transaction that locks the song row, and fixed `updated_at`             |
| The source disappears even if the content is the same                        | If the content is the same, nothing is changed                                       |
| It fails if one recording appears under another title                        | Also removes duplicates by recording ID, and deleted the unused `ON CONFLICT`        |
| The target DB for writing is not checked                                     | Stops if `DATABASE_URL` is missing, and prints the target (without the password)     |
| The search term is reset when you come back                                  | Kept in the URL. The scroll position is not kept                                     |
| The docs do not match                                                        | Fixed the next steps, the survey document, and the README                            |
| The save logic cannot be tested                                              | Split it into `song-list-save.ts` and added a rerun integration test                 |
| Uncertain: apostrophe search                                                 | The titles in the real data use `’`, so it was a real problem. Made both sides equal |
| Uncertain: notation merged into one parenthesis                              | Confirmed it is not in the real 198 song titles. Not fixed                           |

## Applied the 2nd code review: 2026-10-31

I checked 2 medium, 7 low, and 2 uncertain findings of the independent review.

| Finding                                                                 | Handling                                                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A wrong connection string can print the password                        | If it cannot be read as a URL or has a `#`, it does not show the value and stops                                                   |
| The search field value is updated by a transition                       | `useTransitions={false}` on `BrowserRouter`. It applies to the whole app, and nothing uses Suspense, so there is no visible change |
| Dialog state stays when only the song changes                           | Split into a screen that gets the song ID as its `key`                                                                             |
| The input can be edited while saving                                    | Read-only while saving                                                                                                             |
| The focus fallback target is not connected                              | Connected it to the `h1`                                                                                                           |
| An album removed from the list stays in the DB                          | Deleted when saving                                                                                                                |
| It does not stop if the edition changes with the same song count        | Prints the titles of the songs that get hidden                                                                                     |
| A very short track fails the whole save                                 | `NULL` if it rounds to 0 seconds                                                                                                   |
| The dialog cannot be closed if a request gets no response               | Not fixed. It is a local app and you can get out by refreshing                                                                     |
| Uncertain: the printed target and the real connection target can differ | Not fixed. It is a special case that uses `?host=` or `PGHOST`, and this project does not use them                                 |
| Uncertain: the status and lines of one response can briefly disagree    | Not fixed. There is one user, and reading again makes it right                                                                     |

## Tests

| File                                              | Behavior verified                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/song-list.test.ts`                  | 16 albums, choosing the base edition, several disc numbers, including only vault songs, excluding lyric videos and repeats, title cleanup, length                                                                                                                 |
| `backend/test/songs.test.ts`                      | Splitting lines, grouping by album, 404 and 400, Korean 400 for wrong input, line count mismatch, when there is no original, rollback on save failure                                                                                                             |
| `backend/test/song-list-save.integration.test.ts` | Replacing tracks on rerun, keeping the song ID, deleting songs without lyrics, keeping and reporting songs with lyrics, no change on failure                                                                                                                      |
| `backend/test/songs.integration.test.ts`          | On a real DB: album order, the same song in several albums, saving and line matching, no save when line counts differ, clearing the translation of only the changed lines, deleting lines when a song is deleted, refusing to delete an artist that has songs     |
| `frontend/src/songs.test.tsx`                     | Search and progress rules, list and status, no search results, empty list, failure, a song without lyrics, line matching display, no-translation message, pasting lyrics and translations, keeping the input on rejection, a missing song, the LRCLIB source link |

## Verification

- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Format, lint, and type checks pass, backend 70 passed (0 skipped), frontend 204 passed and 2 skipped, skills 4 passed, build succeeded. `npm run knip`: no findings.
- Song list: ran `npm run songs:import -w backend` against the real MusicBrainz and received 198 songs. The song counts per album are 11, 13, 14, 16, 13, 15, 18, 16, 15, 13, 16, and 12, and the vault songs are 6, 9, 6, and 5. On the first run `Red (Taylor's Version)` came out with 19 songs, so I fixed it to leave out lyric videos and repeats. I compared whether the song counts are right with the number of tracks the author knows, and I did not check song by song against official sources.
- Browser: checked with headless Edge on Vite 5206 + backend 3106 + `cert_test` using sentences I wrote myself. After the check I deleted the songs in the test DB, and I looked at the screenshots only locally.
  - Mobile 390×844: 16 albums, search and no results, a song without lyrics, pasting lyrics, rejecting a translation with a different line count, and saving a translation. The original and translation are shown stacked.
  - PC 1440×900: the same flow. The original and translation are shown side by side.
  - No console errors or warnings and no horizontal overflow.
- The 2 skipped frontend tests are the `DARK_ONLY` condition tests (`app-shell.test.tsx`, `theme.test.ts`) that came in with the central sync, and they are unrelated to this change.

## Limits

- I did not put in real lyrics or translations. The user pastes them on the screen or puts them in with the #64 script. The issue done criterion "the original and translation line up line by line" was checked with sentences I wrote myself.
- It is hard to enter around 200 songs one by one on the screen. #64 reduces that work.
- Before the app is made public, the lyrics screen must be put behind authentication (section 1 of the survey document).
