-- Grade scale and target grade of a goal (issue #51). Safe to re-run.
-- Scale contents and sources: backend/src/grade-scales.ts, docs/research/certification-grades.md.
ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS grade_scale text NOT NULL DEFAULT 'none'
    CHECK (grade_scale IN ('none', 'toeic', 'toeic_speaking', 'information_processing', 'aws', 'driver_license'));

-- NULL: no target grade decided yet, or the goal has no scale.
ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS target_grade text
    CHECK (grade_scale <> 'none' OR target_grade IS NULL);
