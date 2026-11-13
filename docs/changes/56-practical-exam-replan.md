# #56 Redo the study plan to fit the Engineer Information Processing practical exam deadline

- Issue: [#56](https://github.com/sirloinbh/cert-manager/issues/56)
- Branch: `docs/56-practical-exam-replan`
- Result: [Detailed certification study plans](../plans/README.md)

## Purpose

Reflect the answers received after the #34 plan was written.

## User answers: 2026-10-31

- The TOEIC goal is January 2027.
- The Engineer Information Processing written exam is passed, and the practical exam deadline is the 3rd session of 2027.
- You have no driver's license.

## Judgments

- Put the practical exam, which has a deadline, first and use the 2027 public holidays on it first. I split them so that preparation days remain for the 2nd and 3rd sessions even if the 1st session fails.
- TOEIC keeps the January 2027 the user chose. I could not confirm the official 2027 schedule, so I made it tentatively 2027-01-31 (Sunday). The study days are 2026-12-25 and 2027-01-01, and I removed registration for the 2026-12-27 session from the plan.
- Changed the next grade of information processing from Craftsman to Engineer. The written exam is already passed, so starting from Craftsman or Industrial Engineer could miss the deadline. I postponed the lower grades by the author's judgment. This does not cancel the "all grades" decision, and the document says the user decides the order after earning Engineer.
- For the driver's license, AWS, TOEIC Speaking, and the second TOEIC attempt, I removed the fixed dates and decided them after the practical result. Depending on which session the practical exam passes, the remaining holidays are at most 28 hours, 18 hours, or 4 hours. If the announcement is late, it shrinks more.
- The practical exam periods are tentative values carried over from the 2026 schedule. The dates in the app are the same.

## Changes: 2026-10-31

- `docs/plans/README.md`: the user answers, the 2027 schedule table, the order after the practical exam, the holidays left by passing session, and the reasons for the recommendation.
- `docs/plans/information-processing.md`: rewritten around the Engineer practical exam.
- `docs/plans/toeic.md`, `toeic-speaking.md`, `aws-cloud-practitioner.md`, `aws-solutions-architect.md`, `driver-license.md`: changed to the first TOEIC timing and the "after the practical" schedule.
- This PC's app DB `cert`: fixed the TOEIC exam date and tasks, the information processing goal (name, status, target grade Engineer, exam date) and its 3 stages and 26 tasks. Cleared the exam dates and task dates of the other goals.

## Verification

- Time: the 24 public holidays of 2027 are assigned to the schedule table once each, for 48 hours in total. The 2 hours of 2026-12-25 are separate.
- App: 22 of the 2027 public holidays have one task each. The remaining 12/25 and 12/27 are left empty for the exams after the practical. The Engineer Information Processing practical has the target grade Engineer, and the TOEIC exam date is 2027-01-31.
- Preparation days per session: preparation for the 1st session ends by 3/1 and for the 3rd by 10/11, which are before the 2026 exam start dates (April 18 and October 24). 7/17 and 7/19 of the 2nd session preparation are near the 2026 start date (July 18), so they can overlap the exam period. So the plan says to choose a day after 7/19 for the 2nd session when you register, and the issue criterion "before the expected period" is met with this condition added.
- `TEST_DATABASE_URL=… npm run check`: pass (exit 0). Backend 40 passed (0 skipped), frontend 163 passed, skills 4 passed, build succeeded.
- `node .standards/secret-scan.mjs`: no suspicious items. There is no app code change, so I added no app tests.

## Automatic code review: 2026-10-31

1st (read-only review agent): 0 high, 4 medium, 2 low. All were fixed.

| Finding                                                                                                   | Handling                                                                                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| The explanation that left out Craftsman and Industrial Engineer conflicts with the "all grades" decision  | Kept the decision and wrote that it was postponed. The user decides the order after Engineer |
| The study days just before the 2nd session can overlap the exam period                                    | Wrote to choose a day after 7/19 when you register and fixed the verification sentence       |
| 6/6 may be before the 1st session's 2nd announcement                                                      | Wrote the announcement as "early to mid" and wrote the case where it becomes 26 hours        |
| The eligibility document guidance disappeared                                                             | Restored the guidance and put it in the user tasks                                           |
| No mention that the exam time after the practical is not enough, and "from 2028" assumes the old schedule | Wrote the total of 50 hours and the hours that move over, and fixed the wording              |
| The May study days assume the 1st session is already taken                                                | Wrote to choose a day in April for the 1st session                                           |

I fixed the task wording in the app the same way.

2nd (review agent that looked at the diff again): 0 high, 1 medium, 2 low. All were fixed, and the review ended after 2 rounds. I added the caveat that the hours for passing the 2nd session also shrink depending on the announcement time, restored the 1st session announcement check row, and wrote the exam date condition in the schedule table and the user tasks too.

## Limits

- The practical exam periods and TOEIC 2027-01-31 are tentative. I could not confirm the official 2027 schedule.
- The practical exam format, passing criteria, and exam fees are private source values.
- The practical exam deadline is the value the user answered. Check your own deadline on Q-Net.
- The grouping of study and the time split are the author's estimate, and there is no evidence that they are enough to pass.
