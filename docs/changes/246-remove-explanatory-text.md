# #246 Remove explanatory, example and motivational text

- Issue: [#246](https://github.com/sirloinbh/cert-manager/issues/246) (tracking: sirloinbh/project-standards#1216; rule: design-system `docs/guidelines.md`, "Screen text rule")

## Changes — 2026-11-29

Search used: `description=`, `e\.g\.`, `placeholder=`, `aria-describedby`, `-hint` ids and `text-muted-foreground` paragraphs in `frontend/src` (not tests, not the UI kit).

Removed:

- Page descriptions: Today, Dashboard, Settings, Certifications, Add goal (`Page` description is now optional) and the unused "No features yet" explanation.
- Every input placeholder: `e.g. TOEIC`, `e.g. 900 or higher, pass`, the issuer prompt, `e.g. 24`, the memo prompt, `e.g. Level 7, IH`, and the stage and task title examples (the `placeholder` prop of the plan item form is gone).
- Hint lines under fields and their `aria-describedby`: target score ("Leave empty ..."), target exam date, expiry date.
- Export and import intros: "Save your certifications ...", "The JSON file is the backup ...", "Add the data of an exported JSON file ...".

Not touched: `songs.tsx` and `words.tsx`, because cert-manager#232 removes those screens. Empty-state descriptions with a next step stay.

Kept: labels, errors, empty-state text, status text, dialog consequence text, the grade list status line.

Tests: the test that checked the removed export intro is gone.
