# #140: name SQL parameters and keep exam expiry dates correct

## Purpose

The certification and exam attempt routes refer to SQL parameters by position (`$9`, `$14`), so reordering the value list silently changes which column a value fills. A changed validity rule left stale attempt expiry dates, a user-given expiry on a pending or failed attempt was dropped without an error, and one message was wrong.

## Changes

| File                                             | Change                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/named-params.ts`                    | `named(sql, params)`: `:name` placeholders become `$n` by first use; an unknown name throws                                                                                                  |
| `backend/src/routes/certifications.ts`           | All queries use named parameters; the PUT recomputes the expiry of passed and scored attempts when the validity kind or months change (months: exam date + months; none or unknown: cleared) |
| `backend/src/routes/exam-attempts.ts`            | All queries use named parameters; an expiry on a pending or failed attempt is a 400; message "on or after the exam date"                                                                     |
| `backend/test/*.test.ts`                         | New `named-params` tests; parameter positions updated; the new 400 cases                                                                                                                     |
| `backend/test/exam-attempts.integration.test.ts` | 24 to 36 months and `months` to `unknown` recompute the expiry dates (runs in CI)                                                                                                            |

## Decision

User decision 2026-11-22 (option A, recorded as a comment on #140): a validity change overwrites expiry dates the user typed by hand for passed or scored attempts, because the app cannot tell a typed date from a derived one. Reverse: store whether an expiry was typed (needs a migration).

## Verification

- `npm run check`: pass.
- No local PostgreSQL on this Mac: the integration tests skip locally and run in CI.

## Limits

- An expiry given for a goal whose validity is `none` is still cleared silently by the SQL; the issue asks for a refusal only for attempts that cannot expire.
