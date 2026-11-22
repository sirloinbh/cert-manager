# #155: mark only the completing task as busy

## Purpose

While one manual task was being completed, every row in the alerts panel had `aria-busy="true"`, so screen reader users heard the wrong state for rows that were not running.

## Changes

| File                                 | Change                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `frontend/src/user-actions.tsx`      | New `busy` prop (`pendingId === action.id`) drives `aria-busy`; `pending` still blocks clicks |
| `frontend/src/user-actions.test.tsx` | The two-task test checks only the clicked row has `aria-busy="true"`                          |

## Verification

- `npm run check`: pass (51 test files, 344 passed, 3 skipped). DB integration tests skip locally (no PostgreSQL on this Mac) and run in CI.
- Browser check (390×844, 1440×900): not run on this Mac; the change only moves one ARIA attribute and no layout.

## Limits

- Other rows still ignore clicks (`aria-disabled`) while one completion runs; that rule is unchanged.
