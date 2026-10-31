-- Songs, albums and lyric lines (issue #35), and the record of imported data. Safe to re-run.
-- Column meanings: docs/design/scope-and-data-model.md section 6. Lyrics stay in the local database only.
CREATE TABLE IF NOT EXISTS artists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  musicbrainz_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS albums (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id bigint NOT NULL REFERENCES artists (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('studio', 'taylors_version')),
  -- NULL: the release date is not known.
  release_date date,
  musicbrainz_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS songs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id bigint NOT NULL REFERENCES artists (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  duration_seconds integer CHECK (duration_seconds > 0),
  musicbrainz_id uuid UNIQUE,
  -- NULL: no lyrics yet.
  lyrics_source text CHECK (lyrics_source IN ('lrclib', 'manual')),
  -- NULL: no lyrics yet. Empty text: typed in by hand.
  lyrics_source_url text,
  lyrics_fetched_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS album_tracks (
  album_id bigint NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
  song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  track_number integer NOT NULL CHECK (track_number > 0),
  PRIMARY KEY (album_id, track_number),
  UNIQUE (album_id, song_id)
);

CREATE INDEX IF NOT EXISTS album_tracks_song_id_idx ON album_tracks (song_id);

CREATE TABLE IF NOT EXISTS lyric_lines (
  song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number > 0),
  -- Empty text: a blank line between verses.
  original text NOT NULL,
  -- NULL: not translated yet.
  translation text,
  PRIMARY KEY (song_id, line_number)
);

CREATE TABLE IF NOT EXISTS import_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('musicbrainz', 'lrclib', 'ngsl', 'wiktionary')),
  url text NOT NULL,
  -- NULL: not checked. Empty text: the source shows no license.
  license text,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
