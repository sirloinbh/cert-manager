# #37 English word of the day

Issue: [#37](https://github.com/sirloinbh/cert-manager/issues/37)

## Purpose

The word list is only seen if you open it yourself. Show a fixed set of words on the dashboard every day, and record the words you memorized, so you can keep memorizing steadily.

## Rules decided

The user said to go with the recommendation (2026-11-01). The same content is written in the issue.

- 5 words a day. They are decided the first time it is opened that day, and the same words are shown for that day.
- Memorized words are not picked.
- Picking order: words that have not appeared yet → the word that appeared longest ago. For a tie, words with a filled-in meaning → frequency order.
- Among words that have not appeared, words with a filled-in meaning come first, so words whose meaning can be seen come out first even before filling in meanings (#70) is finished.
- A day decided with fewer than 5 words because not enough words were left is not refilled even if words are added later.
- When the words that were not seen run out, words that were not memorized come back in order of oldest first.
- A past day has a record only if it was opened. Opening a past day does not pick new words.

## Changes

- `database/migrations/009_daily_words.sql`: the `daily_words` table and the `words.learned_at` column.
- `backend/src/routes/daily-words.ts`:
  - `GET /api/daily-words`: the word of the day. Use `?day=YYYY-MM-DD` to see a past day. A day after today is 400.
  - `PUT /api/words/:id/learned`: mark and unmark "I memorized it". Marking again keeps the first time.
- `backend/src/routes/words.ts`: exported the function that reads the source.
- `frontend/src/daily-words.tsx`: the dashboard card. Meaning, example, and etymology expand when pressed, and pressing a word goes to the detail. Arrows show past days.
- `frontend/src/words.tsx`: exported the license notice (`SourceNote`) so the card uses it too.
- Added `words: []` to the fake API of the existing tests that draw the dashboard.
- Wrote the rules in section 6 of `docs/design/scope-and-data-model.md`.

## Tests

- `backend/test/words.integration.test.ts`: simultaneous requests, the same words on the same day, new words the next day, excluding memorized words, undo, words with a meaning first, and the case where all are memorized. I put it in the same file so it does not run at the same time as the #36 test that looks at the whole word table.
- `backend/test/daily-words.test.ts`: the Seoul midnight boundary, a wrong date, picking words only for today, and input checks.
- `frontend/src/daily-words.test.tsx`: collapse and expand, a word with no meaning, memorized and undo, save failure, moving to a past day, empty state, and load failure.

## Verification

Ran with `TEST_DATABASE_URL` set to `cert_test`. Applied the migration to both `cert` and `cert_test`.

- `npm run check`: pass. Backend 108 passed, frontend 234 passed and 2 skipped (`DARK_ONLY`), skills 4 passed, build succeeded.
- `npm run knip`: no findings.
- `node .standards/check.mjs`: pass.
- `node .standards/secret-scan.mjs`: no suspicious items.
- Screen: put 7 made-up words in `cert_test` and checked with headless Edge at 390×844 and 1440×900. No horizontal overflow, long words wrap correctly, and no console errors or warnings. "Memorized" stays after a refresh, and moving to a past day and moving to the detail work. I did not imitate a touch environment, so I could not check the large touch area of `pointer-coarse`. I checked again with the final code after applying the review, and deleted the temporary data after the check.

## Applied the 1st review

I fixed 8 findings of the independent read-only review in this PR.

- Medium: if the word of the day was not decided, you could not return from a past day to today. `nextDay` of a past day is now at least today.
- Medium: if moving to another day failed, you could not try again with the same arrow. It requests again each time you press.
- Medium: a screen left open overnight showed yesterday's words as the word of the day. When you come back to the screen, it reads again if the Seoul date changed.
- Medium: words with a filled-in meaning could repeat every day regardless of frequency. At first, words with a filled-in meaning came first, but to match the "new words the next day" criterion I put words that have not appeared first.
- Low: the arrow at the end was `disabled` and lost keyboard focus. Changed it to `aria-disabled`.
- Low: the date change notice did not reach screen readers well. The notice element is always present and only its content changes.
- Low: a word whose etymology was not looked up yet also showed "no etymology data". Separated it with the same wording as the word detail.
- Low: wrote the rule of not refilling a day decided with fewer than 5 words and the source notice on the card in the design document.

## Applied the 2nd review

I fixed 1 finding (low) of the independent read-only review. If midnight passed after a failed move to another day, coming back to the screen read the failed day again instead of today. If you were looking at today, it reads today. The other 7 fixes and the docs had no findings. The review is up to the 2nd round, so after this it goes to CI.

## Limits and follow-up

- The meanings and examples are still empty (#70), so for now only the word and etymology are shown.
- A feature to mark memorized words in the word list or detail screen and view them together is out of scope.
- Push notifications are out of the issue scope.
