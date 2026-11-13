# #38 Certification candidates and recommended roadmap document

Issue: [#38](https://github.com/sirloinbh/cert-manager/issues/38)

## Purpose

Make the standard for choosing what to earn after the current goals. The exam fees and periods in the AI recommendation list the user had saved were unconfirmed values, so I checked them again with official sources.

## Changes

- `docs/research/certification-candidates.md`: candidate tables by field, the AWS lineup and recommended order, a 5-stage roadmap matched to the current goals, and the list of values I could not confirm.
- `docs/next-steps/README.md`: removed #38 and put in the state of #73.

## Verification

- The values were surveyed on official sites on 2026-11-01. The survey was done by 3 agents, one per field, and I did not cross-check every value again.
- Values I saw in search excerpts because I could not open the official page text are marked "(excerpt)".
- Values with no official evidence were left as "Could not confirm". "A source link for every exam fee and validity" in the issue applies only to **the values written down**, and the values I could not confirm are in the table at the end of the document.
- Stage 1 of the roadmap matches the app's first goals, TOEIC and the Engineer Information Processing practical exam (checked with the goals in the `cert` DB and `docs/plans/README.md`).
- Only docs changed, so I added no app tests.
- `npm run format:check`: pass.
- `node .standards/check.mjs`: pass.
- `node .standards/secret-scan.mjs`: no suspicious items.

## Applied the 1st review

The reviewer sampled about 40 values against the official pages, and all matched. I fixed 9 findings on the document side (3 medium, 6 low).

- Medium: matched the items whose Korean price I could not confirm and the issuance fees with the table at the end. KCNA cannot be called low cost, so I fixed the reason in the roadmap. Craftsman Cook is a national technical qualification, so I changed it to "No expiry" as in the Q-Net general guide.
- Low: changed the AWS exam switch dates, the LPIC price, and the Security+ V8 link to pages that have the values. Wrote down the HSK 3.0 switch, the AI-200 link, the caveat on the validity of AI Business Strategist, and that the Securities Investment Advisor was not surveyed.

The user needs to confirm narrowing the issue done criterion to "the values written down" and recommending without building an app feature, so they go in the final report.

## Applied the 2nd review

I fixed 2 findings (low) of the independent read-only review. Put Engineer Information Security in the list the no-expiry note applies to, and put CISSP in the Korean price item of the table at the end. The review is up to the 2nd round, so after this it goes to CI.

## Limits and follow-up

- I did not build a feature to pick candidates in the app and register them as goals. Choosing candidates is rare and the goal registration screen already exists, so I recommend it is not needed now. If the user wants it, register an issue.
- Exam fees change, so check again on the official site when you register.
