# #58 Add weekday time before exams to the study plan and remove the lower grades

- Issue: [#58](https://github.com/sirloinbh/cert-manager/issues/58)
- Branch: `docs/58-weekday-study-time`

## User answers: 2026-10-31

- The Craftsman and Industrial Engineer grades are not pursued.
- The study time other than public holidays is 1 hour on weekdays in the 2 weeks before the exam day.

## Judgments

- "The previous 2 weeks" is counted as 14 days up to the day before the exam date. There are at most 10 weekdays in it, and a weekday public holiday already uses 2 hours, so it is not counted.
- The weekday time of the 2nd and 3rd practical sessions is used only when you take that session.
- I did not change the grade table itself. The `information_processing` system still shows Craftsman and Industrial Engineer, but they are official grade guidance and you simply do not choose them as a goal.

## Changes: 2026-10-31

- `docs/plans/README.md`: the user decisions, the time explanation, the weekday column of the schedule table, and the grade explanation.
- `docs/plans/information-processing.md`: changed the next grade to Professional Engineer and added a row for the 2 weeks before the exam.
- The rest of `docs/plans/`: wrote the weekday time in the 2 weeks before the exam.
- This PC's app DB `cert`: added 9 weekday study tasks before exams and 1 task for taking the 2nd practical session, and fixed the information processing memo. There are 69 tasks in total.

## Verification

- Dates: I computed the start and end days of the week of the weekday periods. They are 2027-01-18 (Mon) to 01-29 (Fri) 10 days, 04-05 (Mon) to 04-16 (Fri) 10 days, 07-12 (Mon) to 07-23 (Fri) 9 days excluding the 7/19 public holiday, and 10-12 (Tue) to 10-22 (Fri) 9 days. For the 3rd session, 10/23 is the Saturday that corresponds to the 2026 start date (10/24), and if you count from after 10/26 it becomes 10 days. All exam dates are tentative.
- In `docs/plans/`, Craftsman and Industrial Engineer remain only in exclusion wording such as "not pursued" and "left out", and not as goals.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Backend 40 passed (0 skipped), frontend 163 passed, skills 4 passed, build succeeded.

## Automatic code review: 2026-10-31

1st (read-only review agent): 0 high, 1 medium, 3 low. All were handled. I fixed the sentence that counted only 48 hours as the total time, the distinction between holiday time and weekday time, the caveat on the 3rd session weekday time, and the change record wording. I kept 10/23 as the 3rd session reference day because there is a basis.

2nd (review agent that looked at the diff again): 0 high or medium, 1 low. I fixed "10 hours if later" to "if it is after 10/26", and the review ended after 2 rounds.

## Limits

- The exam dates are tentative, so the weekday periods are tentative too. Fix them together when an exam date changes.
- There is no evidence that the time split is enough to pass.
