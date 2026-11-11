import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { inTransaction, lockSong, setTranslations, toLines } from '../lyrics-store.js';
import { HttpError, parseId } from '../standard/http.js';
import { body, toId } from '../validation.js';

// Songs and lyrics (#35). Columns and rules: docs/design/scope-and-data-model.md section 6.
// Lyrics live only in the local database; nothing here copies them anywhere else.

const objectMessage = { error: 'Request body must be a JSON object' };

// Large enough for any song, small enough to keep one request cheap.
const maxText = 50_000;

const lyricsInput = z.object(
  {
    original: z
      .string({ error: 'Lyrics are required' })
      .refine((value) => value.length <= maxText, `Lyrics must be ${maxText} characters or fewer`),
  },
  objectMessage,
);

const translationInput = z.object(
  {
    translation: z
      .string({ error: 'Translation is required' })
      .refine(
        (value) => value.length <= maxText,
        `Translation must be ${maxText} characters or fewer`,
      ),
  },
  objectMessage,
);

type PreviousLine = { original: string; translation: string | null };

/** Each new line takes the translation of an old line with the same text, each one used once. */
export function carryTranslations(previous: PreviousLine[], lines: string[]) {
  const kept = new Map<string, string[]>();
  for (const { original, translation } of previous) {
    if (original !== '' && translation !== null) {
      kept.set(original, [...(kept.get(original) ?? []), translation]);
    }
  }
  return lines.map((line) => kept.get(line)?.shift() ?? null);
}

const notFoundMessage = 'Song not found';

// Listed before the first line with text; "no lyrics" also covers a song with only blank lines.
const statusColumn = `CASE
    WHEN NOT EXISTS (SELECT 1 FROM lyric_lines l WHERE l.song_id = s.id AND l.original <> '') THEN 'none'
    WHEN EXISTS (SELECT 1 FROM lyric_lines l
                 WHERE l.song_id = s.id AND l.original <> '' AND l.translation IS NULL) THEN 'untranslated'
    ELSE 'translated'
  END`;

type TrackRow = {
  albumId: string;
  albumTitle: string;
  albumKind: 'studio' | 'taylors_version';
  releaseDate: string | null;
  songId: string;
  trackNumber: number;
  title: string;
  status: 'none' | 'untranslated' | 'translated';
};

type SongRow = {
  id: string;
  title: string;
  artistName: string;
  durationSeconds: number | null;
  lyricsSource: 'lrclib' | 'manual' | null;
  lyricsSourceUrl: string | null;
  note: string;
  status: TrackRow['status'];
};

async function readSong(pool: Pool, id: number) {
  const { rows } = await pool.query<SongRow>(
    `SELECT s.id::text AS id, s.title, a.name AS "artistName", s.duration_seconds AS "durationSeconds",
       s.lyrics_source AS "lyricsSource", s.lyrics_source_url AS "lyricsSourceUrl", s.note,
       ${statusColumn} AS status
     FROM songs s JOIN artists a ON a.id = s.artist_id
     WHERE s.id = $1`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, notFoundMessage);
  const albums = await pool.query<{ id: string; title: string; trackNumber: number }>(
    `SELECT al.id::text AS id, al.title, t.track_number AS "trackNumber"
     FROM album_tracks t JOIN albums al ON al.id = t.album_id
     WHERE t.song_id = $1
     ORDER BY al.release_date ASC NULLS LAST, al.id`,
    [id],
  );
  const lines = await pool.query<{
    lineNumber: number;
    original: string;
    translation: string | null;
  }>(
    `SELECT line_number AS "lineNumber", original, translation FROM lyric_lines
     WHERE song_id = $1 ORDER BY line_number`,
    [id],
  );
  return {
    ...rows[0],
    id: toId(rows[0].id),
    albums: albums.rows.map((album) => ({ ...album, id: toId(album.id) })),
    lines: lines.rows,
  };
}

export function registerSongRoutes(app: Express, pool: Pool) {
  // Albums by release date, each with its tracks in order. The screen searches this list itself.
  app.get('/api/songs', async (_req, res) => {
    const { rows } = await pool.query<TrackRow>(
      `SELECT al.id::text AS "albumId", al.title AS "albumTitle", al.kind AS "albumKind",
         al.release_date AS "releaseDate", s.id::text AS "songId", t.track_number AS "trackNumber",
         s.title, ${statusColumn} AS status
       FROM albums al
       JOIN album_tracks t ON t.album_id = al.id
       JOIN songs s ON s.id = t.song_id
       ORDER BY al.release_date ASC NULLS LAST, al.id, t.track_number`,
    );
    const albums = new Map<
      number,
      {
        id: number;
        title: string;
        kind: TrackRow['albumKind'];
        releaseDate: string | null;
        tracks: {
          songId: number;
          trackNumber: number;
          title: string;
          status: TrackRow['status'];
        }[];
      }
    >();
    for (const row of rows) {
      const id = toId(row.albumId);
      const album = albums.get(id) ?? {
        id,
        title: row.albumTitle,
        kind: row.albumKind,
        releaseDate: row.releaseDate,
        tracks: [],
      };
      album.tracks.push({
        songId: toId(row.songId),
        trackNumber: row.trackNumber,
        title: row.title,
        status: row.status,
      });
      albums.set(id, album);
    }
    res.json({ albums: [...albums.values()] });
  });

  app.get('/api/songs/:id', async (req, res) => {
    const id = parseId(req.params.id, 'song');
    res.json({ song: await readSong(pool, id) });
  });

  // Replaces the lyrics. A line whose text is still there keeps its translation, wherever it moved.
  // Saving the same text changes nothing, so a fetched song keeps its source.
  app.put('/api/songs/:id/lyrics', async (req, res) => {
    const id = parseId(req.params.id, 'song');
    const input = lyricsInput.parse(body(req.body));
    const lines = toLines(input.original);
    if (!lines.some((line) => line !== '')) throw new HttpError(400, 'Lyrics are required');
    await inTransaction(pool, async (client) => {
      await lockSong(client, id);
      const previous = await client.query<PreviousLine>(
        'SELECT original, translation FROM lyric_lines WHERE song_id = $1 ORDER BY line_number',
        [id],
      );
      const same =
        previous.rows.length === lines.length &&
        previous.rows.every((row, index) => row.original === lines[index]);
      if (same) return;
      await client.query(
        `UPDATE songs SET lyrics_source = 'manual', lyrics_source_url = '', lyrics_fetched_at = now(),
           updated_at = now()
         WHERE id = $1`,
        [id],
      );
      await client.query('DELETE FROM lyric_lines WHERE song_id = $1', [id]);
      await client.query(
        `INSERT INTO lyric_lines (song_id, line_number, original, translation)
         SELECT $1, n, o, t FROM unnest($2::int[], $3::text[], $4::text[]) AS v(n, o, t)`,
        [
          id,
          lines.map((_line, index) => index + 1),
          lines,
          carryTranslations(previous.rows, lines),
        ],
      );
    });
    res.json({ song: await readSong(pool, id) });
  });

  // Translation lines fill the lines with text in order, so blank lines may be left out when pasting.
  // All of them are saved or none. The song's lock keeps the lines from changing in between.
  app.put('/api/songs/:id/translation', async (req, res) => {
    const id = parseId(req.params.id, 'song');
    const input = translationInput.parse(body(req.body));
    const translated = toLines(input.translation).filter((line) => line !== '');
    await inTransaction(pool, async (client) => {
      await lockSong(client, id);
      const { rows: originals } = await client.query<{ lineNumber: number }>(
        `SELECT line_number AS "lineNumber" FROM lyric_lines
         WHERE song_id = $1 AND original <> '' ORDER BY line_number`,
        [id],
      );
      if (originals.length === 0) throw new HttpError(400, 'Add the original lyrics first');
      if (translated.length !== originals.length) {
        throw new HttpError(
          400,
          `The translation has ${translated.length} lines but the original has ${originals.length}. Blank lines are not counted`,
        );
      }
      await setTranslations(
        client,
        id,
        originals.map((line, index) => ({
          lineNumber: line.lineNumber,
          translation: translated[index] ?? '',
        })),
      );
    });
    res.json({ song: await readSong(pool, id) });
  });
}
