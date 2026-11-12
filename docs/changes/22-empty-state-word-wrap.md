# #22 Word-level line wrapping for the empty-state message on mobile

Issue: [#22](https://github.com/sirloinbh/cert-manager/issues/22)

## Purpose

On a 390×844 screen the empty-state message broke in the middle of a word, as in "추가합니 / 다." (Korean text split mid-word).

## Changes

- Added `className="break-keep"` at the 7 places that call `EmptyState`: `app.tsx`, `certifications.tsx`, `exam-attempts.tsx`, `songs.tsx` (2 places), `study-plan.tsx`, and `words.tsx`.
- The issue named only `app.tsx`, but features built since then use the same component on other screens and could have the same problem, so I fixed them together.
- Did not change the centrally managed file `components/ui/empty-state.tsx`.
- `frontend/src/app.test.tsx`: checks that `break-keep` is attached to the message.
- `docs/next-steps/README.md`: removed #22 and fixed the state of #70.

## Verification

Ran with `TEST_DATABASE_URL` set to `cert_test`.

- `npm run check`: pass. Backend 108 passed, frontend 236 passed and 2 skipped (`DARK_ONLY`), skills 4 passed, build succeeded.
- `npm run knip`: no findings.
- `node .standards/check.mjs`: pass.
- `node .standards/secret-scan.mjs`: no suspicious items.
- Screen: checked the empty states of `/settings`, `/certifications`, `/songs`, and `/words` at 390×844 and 1440×900 with headless Edge. On all four screens the computed `word-break` is `keep-all` and there is no horizontal overflow. For `/settings` at 390×844, I checked the screenshot by eye.

## Limits and follow-up

- I did not check the same problem in other apps. So I did not propose changing the `EmptyState` default in project-standards.
