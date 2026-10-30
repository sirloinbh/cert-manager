-- Certification goals (issue #30). Safe to re-run.
-- Column meanings and NULL rules: docs/design/scope-and-data-model.md section 5.
CREATE TABLE IF NOT EXISTS certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN ('english', 'dev', 'life')),
  issuer text NOT NULL DEFAULT '',
  -- Chosen by the user; the app never judges pass or fail.
  status text NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'studying', 'registered', 'taken', 'passed', 'failed')
  ),
  goal_text text NOT NULL DEFAULT '',
  -- NULL: no score for this exam, or not decided yet.
  target_score integer CHECK (target_score >= 0),
  -- NULL: exam date not decided yet.
  target_exam_date date,
  -- months: validity_months is set; none: never expires; unknown: not checked yet.
  validity_kind text NOT NULL DEFAULT 'unknown' CHECK (validity_kind IN ('months', 'none', 'unknown')),
  validity_months integer CHECK (validity_months > 0),
  memo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT certifications_validity_months CHECK (
    (validity_kind = 'months') = (validity_months IS NOT NULL)
  )
);
