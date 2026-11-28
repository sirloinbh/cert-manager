# #242 Adopt the shared design-system components

Part of sirloinbh/project-standards#1177.

## Change

| Local copy (removed or reduced)                           | Shared component now used                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `plural.ts` (`quantity`)                                  | `plural` from `lib/format`                                                                 |
| `date-format.ts`, `serviceToday` in `word-data.ts`        | `formatDate`, `serviceToday` from `lib/format`                                             |
| `addDays`, `weekStart`, `weekDays` in `week-range.ts`     | `components/period-nav/periods` (`weekTitle` and `upcomingWeeks` stay: they are app rules) |
| local `PageHeader` and `BackLink` in `certifications.tsx` | `PageHeader` with `backTo`                                                                 |

## Visible differences

- Dates read "Oct 22, 2026" (the kit's medium style) instead of "October 22, 2026".
- The page back link uses the kit's size and place above the title.

## Verification

See the PR.
