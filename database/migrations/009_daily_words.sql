-- The day's words on the dashboard and the words already learned (issue #37). Safe to re-run.
-- Column meanings: docs/design/scope-and-data-model.md section 6.
ALTER TABLE words ADD COLUMN IF NOT EXISTS learned_at timestamptz;

CREATE TABLE IF NOT EXISTS daily_words (
  day date NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  word_id bigint NOT NULL REFERENCES words (id) ON DELETE CASCADE,
  PRIMARY KEY (day, position),
  UNIQUE (day, word_id)
);

CREATE INDEX IF NOT EXISTS daily_words_word_id_idx ON daily_words (word_id);
