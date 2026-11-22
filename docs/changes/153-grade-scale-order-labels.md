# Show grade scales in order with English labels (#153)

- Date: 2026-11-22 (Asia/Seoul)

## Purpose

The grade ladder put AWS `Specialty` above Professional although it is not a step (`reachedGrade` already ignores it), notes and options mixed Korean level names into English text, and an unranked scale (license types) was drawn as a ladder with the heading "Driver license types grades".

## Contents

- `backend/src/grade-scales.ts`: every level has a `label` next to its stable `value` (the value is what goals and attempts save, so it does not change). Labels: Information Processing `Craftsman (Gineungsa)`, `Industrial Engineer (Sanupgisa)`, `Engineer (Gisa)`, `Professional Engineer (Gisulsa)`; driver licenses `Class 2 Motorcycle`, `Class 2 Small`, `Class 2 Regular`, `Class 1 Small`, `Class 1 Regular`, `Class 1 Large`, `Class 1 Special`; other levels use their value. The Information Processing note now uses the English labels.
- `frontend/src/grade-scale-data.ts`: `GradeLevel.label`.
- `frontend/src/grade-scales.tsx`: a ranked scale shows its steps from the top; off-ladder levels are listed apart under "Not part of the steps"; an unranked scale is a plain list in its own order; the heading says "… grades" only for ranked scales; rows show the label.
- `frontend/src/exam-attempts.tsx`, `frontend/src/certifications.tsx` (one-line edits approved by the coordinator for this issue): the grade and target-grade selects, and the score hint, show `level.label`; the saved value is unchanged.
- Tests: backend test that every level has an English label; screen tests for Specialty outside the AWS ladder, Information Processing English labels, and the plain license list.

## Notes

- Label wording is my choice (romanised Korean name in parentheses so the user can still recognise the exam); change it in `backend/src/grade-scales.ts` only.
- `use-grade-scales.ts` is unchanged here (lane-4 #152 edits it).

## Verification

- `npm run check`: see the PR.
