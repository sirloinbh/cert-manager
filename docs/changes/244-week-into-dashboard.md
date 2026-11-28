# #244 Merge Week and 12 weeks into Dashboard

- Issue: [#244](https://github.com/sirloinbh/cert-manager/issues/244) (tracking: sirloinbh/project-standards#1215)

## Changes — 2026-11-29

- The Week and 12 weeks menu items are removed. Dashboard has a "Dashboard view" choice: Summary (the old dashboard), Week, 12 weeks, kept in `?view=`.
- `/week` and `/weeks` redirect to `/dashboard?view=week` and `/dashboard?view=12weeks`.
- Tests: `app.test.tsx` checks the menu and both redirects.
