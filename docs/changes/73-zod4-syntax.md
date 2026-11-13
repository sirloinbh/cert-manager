# #73 Move the backend validation code to zod 4 syntax

- Issue: [#73](https://github.com/sirloinbh/cert-manager/issues/73)
- Branch: `chore/73-zod4-syntax`

## Purpose

This is step 1 of the central `sirloinbh/project-standards#386`. Move the code first so this app does not break when the center raises `zod` to 4.6.7. The Dependabot alert for security advisory GHSA-mrhx-c7xc-m3w5 is closed by that sync. This PR alone does not close it.

## Changes: 2026-11-01

- The 10 zod files in `backend/src` (including `daily-words.ts` that came from main) import from `zod/v4`. The installed 3.25.76 contains this path, so I did not change the install or the lockfiles.
- Moved the `message` option of the schemas to `error`. The `message` of `ctx.addIssue` is used as it is in zod 4 too.
- Moved the string length checks (`.min`, `.max`) that show on screen to `.refine`. Zod 4 runs `.min` and `.max` on a value that has a length even if the type check fails, so sending an array where a string goes gives the same message twice. I left the `.min` and `.max` of number ranges, array lengths, and the script file schemas as they are.
- `.partial()`, `.merge()`, `.default().optional()`, and `z.record` are not in this app. All `.default()` values are values without a transform, so there is no validation skipped after them.
- Fixed the zod 3 keep guidance in `docs/next-steps/README.md` to match the 2026-11-01 decision.

## Responses that change

I put about 670,000 of the same inputs into the schemas before and after the switch and compared them (combinations that change one and two fields, including inputs with a `constructor` key). The results for valid input are all the same, and no wrong input passes. The only thing that changes for screen input is the message of input that was already a 400. As in the table below, a message can be dropped, added, or changed.

| Input                                                                                            | Before                                                                                     | After (`zod/v4` of 3.25.76)                                | After (4.6.7)  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------- |
| Negative decimal score (`-1.5`)                                                                  | 정수여야 + 0 이상이어야 (must be an integer + must be 0 or more)                           | 정수여야 (must be an integer)                              | Same           |
| Decimal score and a violation of another field rule (`score: 1.5`, before the result)            | 정수여야 + 결과 전에는 비워 주세요 (must be an integer + leave it empty before the result) | 정수여야 (must be an integer)                              | Same           |
| An integer beyond the safe range (`1e20`)                                                        | 이하여야 (must be at most)                                                                 | 정수여야 + 이하여야 (must be an integer + must be at most) | Same           |
| JSON `1e999` (infinity)                                                                          | 정수여야 + 이하여야 (must be an integer + must be at most)                                 | 숫자여야 (must be a number)                                | Same           |
| A wrong expiry date earlier than the exam date (`expiresOn: "2026-02-30"`, exam date 2026-03-15) | 실제 날짜가 아닙니다 + 시험일 이후여야 (not a real date + must be after the exam date)     | 실제 날짜가 아닙니다 (not a real date)                     | Same as before |

In the scripts, it is the judgment that changes, not the response.

- If a number in an LRCLIB response is infinity, it is treated as a wrong response.
- If the `lineNumber` of a translation file is beyond the safe range, it is rejected as "파일 형식이 내보낸 형식과 다릅니다" ("the file format differs from the export format") instead of "원문이 DB와 다릅니다" ("the original differs from the DB").
- If a word file has more than 1000 entries and also has a wrong entry, in `zod/v4` of 3.25.76 the path of the rejection reason changes from `words` to that entry. In 4.6.7 it is `words` as before.
- If there are more than 12 morphemes and also a wrong entry, in 4.6.7 the path changes from the entry (`words.0.morphemes.13.key`) to `words.0.morphemes`.
- 4.6.7 counts the `.max()` of script strings in code points. For `original`, `atExport`, and `translation` of the translation file and `lemma`, part of speech, meaning, the morpheme `key`, `meaningKo`, and `origin` of the word file, an input that used to be rejected passes if it has many emoji. The `length()` limit in the migration is based on the number of characters, so no new DB error occurs.

## Verification

- `npm run check`: pass. Backend 98 of 108 passed and 10 skipped (the DB integration tests were left out by emptying `TEST_DATABASE_URL`). Frontend 222 of 224 passed and 2 skipped. 4 skill tests passed.
- The DB integration tests are confirmed by the PR CI. I did not run them locally so as not to touch the shared DB.
- New tests: full message comparison (`backend/test/exam-attempts.test.ts`), the case of sending an array where a string goes (`backend/test/certifications.test.ts`), and the array length limit of the file schemas (`backend/test/array-limits.test.ts`).
- In the review, I ran the backend tests and the type check with the 4.6.7 copy that is in the dev dependencies (leaving out the DB integration tests). For 1 failed expiry date case, I fixed the input. The check of the real installed state is done by the CI of the central sync PR.

## Follow-up after the merge: 2026-11-01

After PR #74 was merged, I applied the remaining findings of a separate review in a follow-up PR. The same expiry date test finding had already been fixed in #74, so I left that fix as it is.

- **Separate review:** I ran the pre-switch code, the PR before the fixes, and that PR + 4.6.7 on a fake DB and compared the same 41,180 cases. The status codes and the values going to the DB are all the same, and there are 0 cases of 5xx. Message differences appear only within 400. I unpacked the 4.6.7 package only into a temporary folder.
- **Applied:** added tests that send an array where the title, lyrics, and translation go. Fixed the number of files above.
- **Not applied (low):** there is no test for the maximum length boundary value and `.max(1000)` in `lyrics-fetch.ts`. The current behavior is correct.
