-- Things the user must do outside the app, shown as in-app alerts (issue #60). Safe to re-run.
-- Column meanings: docs/design/scope-and-data-model.md section 5.
CREATE TABLE IF NOT EXISTS user_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  note text NOT NULL DEFAULT '',
  -- Empty text: this action has no page to open.
  link_url text NOT NULL DEFAULT '' CHECK (link_url = '' OR link_url ~ '^https?://'),
  -- The alert appears from this day on.
  remind_from date NOT NULL,
  -- NULL: no deadline, or the date is not announced yet.
  due_date date,
  -- NULL: not done yet.
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_actions_due_after_reminder CHECK (due_date >= remind_from)
);

CREATE INDEX IF NOT EXISTS user_actions_open_idx
  ON user_actions (remind_from) WHERE completed_at IS NULL;
