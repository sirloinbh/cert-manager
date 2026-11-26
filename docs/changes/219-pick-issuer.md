# 219 Pick values instead of typing them in forms

## Purpose

User requirement (2026-11-26, central rule sirloinbh/project-standards#1130): a field whose values repeat is picked, not typed.

## Free-text inputs and what was decided

| Form          | Field                                                              | Decision                                                                                                                          |
| ------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Certification | Category, status, validity, grade scale, target grade              | Already pickers (select).                                                                                                         |
| Certification | Target exam date, target score                                     | Already date and number inputs.                                                                                                   |
| Certification | **Issuer**                                                         | Repeats (YBM, AWS, ...): now the shared Combobox with the issuers already used, most used first. A new issuer can still be typed. |
| Certification | Name, goal, memo                                                   | Open text, kept.                                                                                                                  |
| Certification | Validity months                                                    | Number input with a minimum, kept.                                                                                                |
| Exam attempt  | Exam date, expiry date, score, outcome, grade (with a grade scale) | Already date, number and select inputs.                                                                                           |
| Exam attempt  | Grade without a grade scale                                        | Open text on purpose (no known list), kept.                                                                                       |
| Exam attempt  | Memo                                                               | Open text, kept.                                                                                                                  |
| Study plan    | Stage and task titles, dates                                       | Titles are open text; dates are date inputs.                                                                                      |
| Songs, words  | Search boxes                                                       | Search text, kept.                                                                                                                |

## Changes

- `usedIssuers` in `certification-data.ts` and the Combobox on the Issuer field in `certifications.tsx`. The list comes from the goals already loaded by `GET /api/certifications`; while it loads or when it fails, the field behaves as plain text.
- Tests: `certification-data.test.ts`, `certifications.test.tsx`.

## Limits

- Songs and words have no typed field with a repeating set of values in this app today.
