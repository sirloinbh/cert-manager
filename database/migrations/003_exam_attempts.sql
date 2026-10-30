-- Exam attempts and earned certifications (issue #32). Safe to re-run.
-- Column meanings and NULL rules: docs/design/scope-and-data-model.md section 5.
CREATE TABLE IF NOT EXISTS exam_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certification_id bigint NOT NULL REFERENCES certifications (id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  -- Entered by the user; the app never judges pass or fail.
  outcome text NOT NULL DEFAULT 'waiting' CHECK (outcome IN ('waiting', 'passed', 'failed', 'scored')),
  -- NULL: no score for this exam, or the result is not in yet.
  score integer CHECK (score >= 0),
  -- NULL: the result is not in yet. Empty text: this exam has no grade.
  grade text,
  -- Last valid day. NULL: see the expiry rules in the design document.
  expires_on date,
  memo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_attempts_expires_after_exam CHECK (expires_on >= exam_date)
);

CREATE INDEX IF NOT EXISTS exam_attempts_certification_id_idx
  ON exam_attempts (certification_id, exam_date DESC, id DESC);
