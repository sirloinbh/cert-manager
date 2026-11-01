-- Frequent English words and their word parts (issue #36). Safe to re-run.
-- Column meanings: docs/design/scope-and-data-model.md section 6.
CREATE TABLE IF NOT EXISTS words (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lemma text NOT NULL UNIQUE CHECK (length(btrim(lemma)) BETWEEN 1 AND 200),
  frequency_rank integer NOT NULL UNIQUE CHECK (frequency_rank > 0),
  -- NULL: not filled in yet.
  part_of_speech text,
  meaning_ko text,
  example_en text,
  example_ko text,
  ai_generated boolean NOT NULL DEFAULT false,
  list_source_id bigint NOT NULL REFERENCES import_sources (id) ON DELETE RESTRICT,
  -- NULL: not looked up yet. Empty text: looked up, nothing found.
  etymology_source text,
  etymology_url text,
  etymology_source_id bigint REFERENCES import_sources (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS morphemes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL UNIQUE,
  form text NOT NULL CHECK (form = lower(form) AND form NOT LIKE '%-%' AND length(form) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('prefix', 'root', 'suffix')),
  meaning_ko text NOT NULL CHECK (length(btrim(meaning_ko)) BETWEEN 1 AND 200),
  -- NULL: not known.
  origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT morphemes_key_format CHECK (key = kind || ':' || form OR left(key, length(kind || ':' || form || ':')) = kind || ':' || form || ':')
);

CREATE TABLE IF NOT EXISTS word_morphemes (
  word_id bigint NOT NULL REFERENCES words (id) ON DELETE CASCADE,
  morpheme_id bigint NOT NULL REFERENCES morphemes (id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  PRIMARY KEY (word_id, position)
);

CREATE INDEX IF NOT EXISTS word_morphemes_morpheme_id_idx ON word_morphemes (morpheme_id);
