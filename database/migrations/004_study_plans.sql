-- Study plans: stages and their tasks (issue #33). Safe to re-run.
-- Column meanings and rules: docs/design/scope-and-data-model.md sections 4 and 5.
-- Order is a deferred UNIQUE so that swapping two rows' positions passes when checked at commit.
CREATE TABLE IF NOT EXISTS study_stages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certification_id bigint NOT NULL REFERENCES certifications (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  position integer NOT NULL CHECK (position > 0),
  -- NULL: not decided yet.
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_stages_dates CHECK (start_date <= end_date),
  CONSTRAINT study_stages_position UNIQUE (certification_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS study_tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stage_id bigint NOT NULL REFERENCES study_stages (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  position integer NOT NULL CHECK (position > 0),
  -- NULL: no due date.
  due_date date,
  -- NULL: not done yet.
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_tasks_position UNIQUE (stage_id, position) DEFERRABLE INITIALLY DEFERRED
);
