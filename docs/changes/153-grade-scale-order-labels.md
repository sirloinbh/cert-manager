# Show grade scales in order with English labels (#153)

- Date: 2026-11-22 (Asia/Seoul)

## Purpose

The grade ladder put AWS `Specialty` above Professional although it is not a step (`reachedGrade` already ignores it), notes and options mixed Korean level names into English text, and an unranked scale (license types) was drawn as a ladder with the heading "Driver license types grades".

## Contents

- `backend/src/grade-scales.ts`: every level has a `label` next to its stable `value` (the value is what goals and attempts save, so it does not change). Labels: Information Processing `Craftsman (Gineungsa)`, `Industrial Engineer (Sanupgisa)`, `Engineer (Gisa)`, `Professional Engineer (Gisulsa)`; driver licenses `Class 2 Motorcycle`, `Class 2 Small`, `Class 2 Regular`, `Class 1 Small`, `Class 1 Regular`, `Class 1 Large`, `Class 1 Special`; other levels use their value. The Information Processing note now uses the English labels.
- `frontend/src/grade-scale-data.ts`: `GradeLevel.label`.
- `frontend/src/grade-scales.tsx`: a ranked scale shows its steps from the top; off-ladder levels are listed apart under "Not part of the steps"; an unranked scale is a plain list in its own order; the heading says "… grades" only for ranked scales; rows show the label.
- `frontend/src/exam-attempts.tsx`, `frontend/src/certifications.tsx` (one-line edits approved by the coordinator for this issue): the grade and target-grade selects, and the score hint, show `level.label`; the saved value is unchanged.
- `frontend/src/grade-scale-data.ts` `gradeLabel()`: the goal detail "Target grade", the goal list summary and a saved attempt result also show the label instead of the saved Korean value (found in the browser check). `certifications.tsx` and `exam-attempts.tsx` use it.
- Tests: backend test that every level has an English label; screen tests for Specialty outside the AWS ladder, Information Processing English labels, and the plain license list.

## Notes

- Label wording is my choice (romanised Korean name in parentheses so the user can still recognise the exam); change it in `backend/src/grade-scales.ts` only.
- `use-grade-scales.ts` is unchanged here (lane-4 #152 edits it).

## Verification

- `npm run check`: see the PR.
- Real browser (Chrome 158 via the playwright tool, mock API + Vite dev server) at 390×844 and 1440×900: AWS shows Professional, Associate, Foundational with Target on Professional and Specialty under "Not part of the steps"; Information Processing shows `Professional Engineer (Gisulsa)` … `Craftsman (Gineungsa)`; driver licenses are a plain list under the heading "Driver license types"; the goal list, detail field and the edit form's target-grade select show English labels (values submitted unchanged); no Korean text on the page and no horizontal scroll at either size. The first pass found the raw `기사` in the detail field, which led to `gradeLabel()`.
