import type { Pool } from 'pg';
import { z } from 'zod';

import { inTransaction, lockSong, toLines } from './lyrics-store.js';
import {
  mostFailuresInARow,
  politeGet,
  type PoliteSource,
  RateLimited,
  ServiceError,
} from './polite-fetch.js';
import { songTitle } from './song-list.js';

// Fills songs without lyrics from LRCLIB (#64). Rules: docs/research/english-content-sources.md section 1.
// Prints titles and counts only, never the lyrics.

export const lrclibUrl = 'https://lrclib.net';
// LRCLIB allows about 90 requests a minute with a User-Agent, so about one every 667ms.
const requestGap = 700;
// A track of the same song can differ by a few seconds between releases.
const durationTolerance = 3;

const record = z.object({
  id: z.number(),
  trackName: z.string(),
  artistName: z.string(),
  duration: z.number().nullish(),
  plainLyrics: z.string().nullish(),
  syncedLyrics: z.string().nullish(),
});
type LrclibRecord = z.infer<typeof record>;

type LyricsQuery = {
  title: string;
  artist: string;
  album: string | null;
  durationSeconds: number | null;
};

async function getJson(url: string, source: PoliteSource): Promise<unknown> {
  const response = await politeGet(url, { name: 'LRCLIB', gap: requestGap, sleep: source.sleep });
  return response ? response.json() : null;
}

// Plain lyrics when there are any, else the timed ones without their "[00:12.34]" marks.
function recordLines({ plainLyrics, syncedLyrics }: LrclibRecord) {
  const text = plainLyrics?.trim()
    ? plainLyrics
    : (syncedLyrics ?? '').replace(/^(?:\[[\d:.]+\] ?)+/gm, '');
  return toLines(text);
}

// The artist alone or with guests, not a longer name like a karaoke act.
function sameArtist(found: string, artist: string) {
  const name = found.toLocaleLowerCase();
  const wanted = artist.toLocaleLowerCase();
  if (!name.startsWith(wanted)) return false;
  const rest = name.slice(wanted.length);
  return rest === '' || /^\s*(?:,|&|\(?feat(?:uring)?\b|\(?ft\b|\(?with\b)/.test(rest);
}

const sameTitle = (a: string, b: string) => {
  // Guest credits are written differently from place to place, so they do not count.
  const plain = (title: string) =>
    songTitle(title)
      .replace(/\s*[([]\s*(?:feat\.?|featuring|ft\.?|with)\s[^)\]]*[)\]]/gi, '')
      .replace(/[‘’]/g, "'")
      .toLocaleLowerCase();
  return plain(a) === plain(b);
};

function matches(found: LrclibRecord, query: LyricsQuery) {
  const closeEnough =
    query.durationSeconds === null ||
    typeof found.duration !== 'number' ||
    Math.abs(found.duration - query.durationSeconds) <= durationTolerance;
  return (
    closeEnough &&
    sameTitle(found.trackName, query.title) &&
    sameArtist(found.artistName, query.artist) &&
    recordLines(found).some((line) => line !== '') &&
    // The database cannot hold this character, and a database error stops the whole run.
    !recordLines(found).some((line) => line.includes('\u0000'))
  );
}

/** The lyrics of one song, or null when LRCLIB has none. Titles there can carry version labels, so a miss is searched. */
export async function requestLyrics(query: LyricsQuery, source: PoliteSource) {
  const params = new URLSearchParams({ track_name: query.title, artist_name: query.artist });
  const search = params.toString();
  if (query.album) params.set('album_name', query.album);
  if (query.durationSeconds !== null) params.set('duration', String(query.durationSeconds));

  const exact = await getJson(`${source.baseUrl}/api/get?${params.toString()}`, source);
  const direct = exact === null ? null : record.parse(exact);
  let found = direct && matches(direct, query) ? direct : undefined;
  if (!found) {
    const list = await getJson(`${source.baseUrl}/api/search?${search}`, source);
    found = z
      .array(record)
      .max(1000)
      .parse(list ?? [])
      .find((item) => matches(item, query));
  }
  if (!found) return null;
  return { lines: recordLines(found), sourceUrl: `${source.baseUrl}/api/get/${found.id}` };
}

type Waiting = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  durationSeconds: number | null;
};

// Songs with any line are left alone: one chance to overwrite typed-in lyrics is one too many.
async function songsWithoutLyrics(pool: Pool) {
  const { rows } = await pool.query<Waiting>(
    `SELECT s.id::text AS id, s.title, ar.name AS artist, s.duration_seconds AS "durationSeconds",
       (SELECT al.title FROM album_tracks t JOIN albums al ON al.id = t.album_id
        WHERE t.song_id = s.id ORDER BY al.release_date ASC NULLS LAST, al.id LIMIT 1) AS album
     FROM songs s JOIN artists ar ON ar.id = s.artist_id
     WHERE NOT EXISTS (SELECT 1 FROM lyric_lines l WHERE l.song_id = s.id)
     ORDER BY s.id`,
  );
  return rows;
}

async function saveLyrics(pool: Pool, id: number, lines: string[], sourceUrl: string) {
  let saved = false;
  await inTransaction(pool, async (client) => {
    await lockSong(client, id);
    const existing = await client.query('SELECT 1 FROM lyric_lines WHERE song_id = $1 LIMIT 1', [
      id,
    ]);
    if (existing.rowCount) return;
    await client.query(
      `UPDATE songs SET lyrics_source = 'lrclib', lyrics_source_url = $2, lyrics_fetched_at = now(),
         updated_at = now()
       WHERE id = $1`,
      [id, sourceUrl],
    );
    await client.query(
      `INSERT INTO lyric_lines (song_id, line_number, original)
       SELECT $1, n, o FROM unnest($2::int[], $3::text[]) AS v(n, o)`,
      [id, lines.map((_line, index) => index + 1), lines],
    );
    saved = true;
  });
  return saved;
}

/**
 * Tries every song without lyrics. One song failing does not stop the others, but a rate limit or
 * several failures in a row do. A database error stops everything, since fetched lyrics would be lost.
 */
export async function fetchMissingLyrics(
  pool: Pool,
  source: PoliteSource,
  log: (message: string) => void = () => {},
) {
  const result = {
    saved: [] as string[],
    missing: [] as string[],
    failed: [] as string[],
    stopped: null as string | null,
  };
  let failuresInARow = 0;
  for (const song of await songsWithoutLyrics(pool)) {
    let found: Awaited<ReturnType<typeof requestLyrics>>;
    try {
      found = await requestLyrics(song, source);
    } catch (error) {
      const reason = error instanceof ServiceError ? error.message : '연결 실패 또는 잘못된 응답';
      result.failed.push(song.title);
      log(`실패: ${song.title} (${reason})`);
      failuresInARow += 1;
      if (error instanceof RateLimited || failuresInARow === mostFailuresInARow) {
        result.stopped = reason;
        break;
      }
      continue;
    }
    failuresInARow = 0;
    if (!found) {
      result.missing.push(song.title);
      log(`없음: ${song.title}`);
    } else if (await saveLyrics(pool, Number(song.id), found.lines, found.sourceUrl)) {
      result.saved.push(song.title);
      log(`저장: ${song.title}`);
    }
  }
  if (result.saved.length > 0) {
    // The documentation shows no license, which is what the empty text records.
    await pool.query(
      `INSERT INTO import_sources (kind, url, license, fetched_at)
       VALUES ('lrclib', $1, '', now())`,
      [`${source.baseUrl}/api`],
    );
  }
  return result;
}
