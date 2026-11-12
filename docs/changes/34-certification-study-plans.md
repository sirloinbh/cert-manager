# #34 Write detailed study plans for the 6 goal certifications

- Issue: [#34](https://github.com/sirloinbh/cert-manager/issues/34)
- Branch: `docs/34-certification-study-plans`
- Result: [Detailed certification study plans](../plans/README.md)

## Purpose

Make the real content to put into the study plan feature (#33).

## User decisions: 2026-10-31

- Study time is only 2 hours per public holiday. There are no textbooks or courses owned.
- Follow the recommendation for order and timing.
- All grades are goals, and the grade is raised step by step by taking exams several times.

## Judgments

- Split the 24 public holidays of 2027, 48 hours, across 5 exams. The time assignment is the author's estimate.
- Marked as "tentative" the exams whose official 2027 schedule I could not confirm. The only announced session is TOEIC 2026-12-27.
- The app's target grade has one value, so it is used as "the grade to aim for next". I did not change the app. If a feature that manages a goal per grade is needed, handle it in a new issue.
- There is no app code change, so I did not add app tests.

## Changes: 2026-10-31

- `docs/plans/`: the overall schedule and 6 plans per certification.
- `docs/design/scope-and-data-model.md`: fixed the meaning of the target grade.
- `docs/next-steps/README.md`, `docs/daily/2026-10-31.md`: the next steps and the daily log.
- Put 6 goals, 8 stages, and 34 tasks into this PC's app DB `cert` through the API. Of the 36 rows in the plan document tables, I did not put in 2 rows, the driver's license exam and the 2028 study assignment for information processing, and I put in the other 2 information processing rows without deadlines. It is personal data, so it is not in the repository (design section 5). On another PC or an empty DB, enter it on the screen by following this document.

## Verification

- Time: the 24 study days of 2027 are assigned to the 5 exams once each, for 48 hours in total. The 2027 deadlines put in the app are 28, equal to the 24 study days plus the 4 days for exams and score checks.
- Exam date overlap: the 5 exam dates that are decided are all different. For the driver's license and information processing, check once the dates are decided.
- Day of the week: I computed the days of the week of the tentative exam dates (2027-03-13, 2027-05-22, 2027-08-29, 2028-03-11) with a calendar.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Backend 40 passed (0 skipped), frontend 163 passed, skills 4 passed, build succeeded. On the first run, 1 test in `frontend/src/study-plan.test.tsx` failed with a 5 second timeout, and it passed when run again with no other work. This branch did not change app code. I could not determine the cause, so I split it into [#54](https://github.com/sirloinbh/cert-manager/issues/54).
- Relative link check: no broken links in `docs/plans/`. `node .standards/secret-scan.mjs`: no suspicious items. `node .standards/check.mjs`: pass.

## Limits

- Except for TOEIC 2026-12-27, I could not confirm the official exam schedule for 2027 and 2028, so it is tentative.
- I could not confirm the driver's license procedure and amounts with official sources. I did not write the subject composition and passing criteria of information processing either, because I could not confirm them with the Q-Net original.
- Some exam fees (TOEIC, TOEIC Speaking, Engineer Information Processing) are private source values. I marked them in the document.
- I could not read the text of the official TOEIC schedule, the official TOEIC Speaking schedule, or the Q-Net annual schedule page with a tool. I confirmed the date of TOEIC session 586 with search results that quote the official page, so check it again when you register.
- I could not keep "only values confirmed on the official site" in the issue notes for 3 exam fees and the TOEIC session 586 schedule. I marked in the document that the exam fees are private source values and the schedule is a value from search results that quote the official page, and recorded it as a limit in the issue.
- The planned exam dates of the driver's license and information processing are periods (around November 2027 and October 2028), not dates. Check the overlap again once the dates are decided.
- I did not include the pass rate of Engineer Information Processing because I could not find a source to quote.
- The original source of the public holiday dates is the Korea Astronomy and Space Science Institute calendar data, and the data itself says it is not an official announcement.

## Automatic code review: 2026-10-31

1st (read-only review agent): 1 high, 6 medium, 6 low. I handled 12. They were adding the information processing exam period, narrowing the overlap scope, deleting a pass rate that is not confirmed in the source, marking estimates, fixing wording that promised a result, separating announced from tentative, and recording the limits. I also fixed the stage names and memos in the app DB.

Not fixed: the empty `step_2=` in the TOEIC RC textbook link. It is the address as it appeared in search results, and I could not confirm whether it works.

2nd (review agent that looked at the diff again): 0 high, 2 medium, 2 low. All were fixed, and the review ended after 2 rounds. I made the claim that there is no official schedule consistent as "could not confirm", and wrote the limit that the TOEIC schedule was also confirmed with search results. I also fixed the overlap scope, the "confirmed" wording, and the description of the number of task rows.
