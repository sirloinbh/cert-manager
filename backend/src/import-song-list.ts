import { Pool } from 'pg';

import {
  albumTracks,
  listAlbums,
  type ListTrack,
  type MbRelease,
  pickBaseRelease,
  pickVaultRelease,
} from './song-list.js';

// Loads the song list from MusicBrainz into the database named by DATABASE_URL (#35). Safe to run again.
// Only titles, dates and lengths are stored (CC0); this script never touches lyrics.

const api = 'https://musicbrainz.org/ws/2';
const artist = { id: '20244d07-534f-4eff-b4d4-930878889970', name: 'Taylor Swift' };
const userAgent = 'cert-manager/0.1 (https://github.com/sirloinbh/cert-manager)';
// MusicBrainz allows one request a second on average.
const requestGap = 1100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const maxAttempts = 6;

// A busy MusicBrainz answers 503; it asks to slow down, so each retry waits longer.
async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${api}${path}`, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    });
    await sleep(requestGap);
    if (response.ok) return (await response.json()) as T;
    if (response.status !== 503 || attempt === maxAttempts) {
      throw new Error(`MusicBrainz ${response.status}: ${path}`);
    }
    const asked = Number(response.headers.get('retry-after'));
    await sleep(Math.max(asked * 1000 || 0, attempt * 5000));
  }
}

async function allReleases(releaseGroupId: string) {
  const releases: MbRelease[] = [];
  for (;;) {
    const page = await get<{ releases: MbRelease[]; 'release-count': number }>(
      `/release?release-group=${releaseGroupId}&status=official&inc=recordings&limit=100&offset=${releases.length}&fmt=json`,
    );
    releases.push(...page.releases);
    if (page.releases.length === 0 || releases.length >= page['release-count']) return releases;
  }
}

type ReleaseGroup = { 'first-release-date'?: string };

// A full date is required by the column; a bare year or month is not known precisely enough.
const fullDate = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const loaded: { album: (typeof listAlbums)[number]; date: string | null; tracks: ListTrack[] }[] =
    [];
  try {
    for (const album of listAlbums) {
      const group = await get<ReleaseGroup>(`/release-group/${album.releaseGroupId}?fmt=json`);
      const releases = await allReleases(album.releaseGroupId);
      const release =
        album.kind === 'studio' ? pickBaseRelease(releases) : pickVaultRelease(releases);
      if (!release) throw new Error(`No release found for ${album.title}`);
      const tracks = albumTracks(album, release);
      loaded.push({ album, date: fullDate(group['first-release-date']), tracks });
      console.log(`${album.title}: ${tracks.length} songs`);
    }

    // One transaction, so a failed run leaves the list as it was.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: artists } = await client.query<{ id: string }>(
        `INSERT INTO artists (name, musicbrainz_id) VALUES ($1, $2)
         ON CONFLICT (musicbrainz_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id`,
        [artist.name, artist.id],
      );
      const artistId = artists[0]?.id;
      for (const { album, date, tracks } of loaded) {
        const { rows: albums } = await client.query<{ id: string }>(
          `INSERT INTO albums (artist_id, title, kind, release_date, musicbrainz_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (musicbrainz_id) DO UPDATE SET title = EXCLUDED.title, kind = EXCLUDED.kind,
             release_date = EXCLUDED.release_date, updated_at = now()
           RETURNING id`,
          [artistId, album.title, album.kind, date, album.releaseGroupId],
        );
        const albumId = albums[0]?.id;
        // The album's tracks are replaced, so a corrected list leaves nothing behind.
        await client.query('DELETE FROM album_tracks WHERE album_id = $1', [albumId]);
        for (const track of tracks) {
          const { rows: songs } = await client.query<{ id: string }>(
            `INSERT INTO songs (artist_id, title, duration_seconds, musicbrainz_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (musicbrainz_id) DO UPDATE SET title = EXCLUDED.title,
               duration_seconds = EXCLUDED.duration_seconds, updated_at = now()
             RETURNING id`,
            [artistId, track.title, track.durationSeconds, track.recordingId],
          );
          await client.query(
            `INSERT INTO album_tracks (album_id, song_id, track_number) VALUES ($1, $2, $3)
             ON CONFLICT (album_id, track_number) DO UPDATE SET song_id = EXCLUDED.song_id`,
            [albumId, songs[0]?.id, track.trackNumber],
          );
        }
      }
      // Songs no longer on any album go too, unless they already hold lyrics.
      await client.query(
        `DELETE FROM songs s
         WHERE s.artist_id = $1
           AND NOT EXISTS (SELECT 1 FROM album_tracks t WHERE t.song_id = s.id)
           AND NOT EXISTS (SELECT 1 FROM lyric_lines l WHERE l.song_id = s.id)`,
        [artistId],
      );
      await client.query(
        `INSERT INTO import_sources (kind, url, license, fetched_at)
         VALUES ('musicbrainz', $1, 'CC0', now())`,
        [api],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(
      `Saved ${loaded.reduce((sum, { tracks }) => sum + tracks.length, 0)} album tracks.`,
    );
  } finally {
    await pool.end();
  }
}

await main();
