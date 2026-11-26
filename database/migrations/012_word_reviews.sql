-- Spaced review of words (issue #209). Safe to re-run.
-- One row per word the user has answered; a word never answered has no row and is never due.
-- step indexes the intervals 1, 3, 7, 14, 30 days (0..4). Rules: backend/src/routes/word-reviews.ts.
CREATE TABLE IF NOT EXISTS word_reviews (
  word_id bigint PRIMARY KEY REFERENCES words (id) ON DELETE CASCADE,
  step smallint NOT NULL CHECK (step BETWEEN 0 AND 4),
  next_review_on date NOT NULL,
  last_answer text NOT NULL CHECK (last_answer IN ('know', 'unsure', 'dontKnow')),
  last_reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS word_reviews_next_review_on_idx ON word_reviews (next_review_on);
