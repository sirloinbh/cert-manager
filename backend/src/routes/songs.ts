import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { HttpError, parseId } from '../standard/http.js';
import { body, toId } from '../validation.js';

// Songs and lyrics (#35). Columns and rules: docs/design/scope-and-data-model.md section 6.
// Lyrics live only in the local database; nothing here copies them anywhere else.

const objectMessage = { message: '요청 본문은 JSON 객체여야 합니다' };

// Large enough for any song, small enough to keep one request cheap.
const maxText = 50_000;

const lyricsInput = z.object(
  {
    original: z
      .string({ message: '가사를 입력해 주세요' })
      .max(maxText, `가사는 ${maxText}자 이하로 입력해 주세요`),
  },
  objectMessage,
);

const translationInput = z.object(
  {
    translation: z
      .string({ message: '번역을 입력해 주세요' })
      .max(maxText, `번역은 ${maxText}자 이하로 입력해 주세요`),
  },
  objectMessage,
);

/** Lines without surrounding blank lines. Windows line ends and trailing spaces do not count as content. */
export function toLines(text: string) {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trimEnd());
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

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

const notFoundMessage = '곡을 찾을 수 없습니다';

async function inTransaction(pool: Pool, work: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await work(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Both writes take this lock first, so one finishes before the other reads the lines.
async function lockSong(client: PoolClient, id: number) {
  const song = await client.query('SELECT 1 FROM songs WHERE id = $1 FOR UPDATE', [id]);
  if (!song.rowCount) throw new HttpError(404, notFoundMessage);
}

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
    const id = parseId(req.params.id, '곡');
    res.json({ song: await readSong(pool, id) });
  });

  // Replaces the lyrics. A line whose text is still there keeps its translation, wherever it moved.
  // Saving the same text changes nothing, so a fetched song keeps its source.
  app.put('/api/songs/:id/lyrics', async (req, res) => {
    const id = parseId(req.params.id, '곡');
    const input = lyricsInput.parse(body(req.body));
    const lines = toLines(input.original);
    if (!lines.some((line) => line !== '')) throw new HttpError(400, '가사를 입력해 주세요');
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
    const id = parseId(req.params.id, '곡');
    const input = translationInput.parse(body(req.body));
    const translated = toLines(input.translation).filter((line) => line !== '');
    await inTransaction(pool, async (client) => {
      await lockSong(client, id);
      const { rows: originals } = await client.query<{ lineNumber: number }>(
        `SELECT line_number AS "lineNumber" FROM lyric_lines
         WHERE song_id = $1 AND original <> '' ORDER BY line_number`,
        [id],
      );
      if (originals.length === 0) throw new HttpError(400, '원문 가사를 먼저 넣어 주세요');
      if (translated.length !== originals.length) {
        throw new HttpError(
          400,
          `번역 줄 수(${translated.length}줄)가 원문 줄 수(${originals.length}줄)와 다릅니다. 빈 줄은 세지 않습니다`,
        );
      }
      await client.query(
        `UPDATE lyric_lines l SET translation = v.t
         FROM unnest($2::int[], $3::text[]) AS v(n, t)
         WHERE l.song_id = $1 AND l.line_number = v.n`,
        [id, originals.map((line) => line.lineNumber), translated],
      );
      await client.query('UPDATE songs SET updated_at = now() WHERE id = $1', [id]);
    });
    res.json({ song: await readSong(pool, id) });
  });
}
