import type { Pool, PoolClient } from 'pg';

import { HttpError } from './standard/http.js';

// Line rules and database steps shared by the song routes and the lyrics scripts (#35, #64).

/** Lines without surrounding blank lines. Windows line ends and trailing spaces do not count as content. */
export function toLines(text: string) {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trimEnd());
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export async function inTransaction(pool: Pool, work: (client: PoolClient) => Promise<void>) {
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

// Every write takes this lock first, so one finishes before the next reads the lines.
export async function lockSong(client: PoolClient, id: number) {
  const song = await client.query('SELECT 1 FROM songs WHERE id = $1 FOR UPDATE', [id]);
  if (!song.rowCount) throw new HttpError(404, 'Song not found');
}

/** Writes translations onto existing lines. Call inside a transaction holding the song's lock. */
export async function setTranslations(
  client: PoolClient,
  id: number,
  lines: { lineNumber: number; translation: string }[],
) {
  await client.query(
    `UPDATE lyric_lines l SET translation = v.t
     FROM unnest($2::int[], $3::text[]) AS v(n, t)
     WHERE l.song_id = $1 AND l.line_number = v.n`,
    [id, lines.map((line) => line.lineNumber), lines.map((line) => line.translation)],
  );
  await client.query('UPDATE songs SET updated_at = now() WHERE id = $1', [id]);
}
