import type { Pool } from 'pg';

import type { ListAlbum, ListTrack } from './song-list.js';

export type SongListInput = {
  artist: { id: string; name: string };
  albums: { album: ListAlbum; date: string | null; tracks: ListTrack[] }[];
  sourceUrl: string;
};

/**
 * Saves the song list in one transaction, so a failed run leaves the list as it was.
 * Never touches lyrics. Returns how many songs hold lyrics but are no longer on any album.
 */
export async function saveSongList(pool: Pool, input: SongListInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: artists } = await client.query<{ id: string }>(
      `INSERT INTO artists (name, musicbrainz_id) VALUES ($1, $2)
       ON CONFLICT (musicbrainz_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [input.artist.name, input.artist.id],
    );
    const artistId = artists[0]?.id;
    for (const { album, date, tracks } of input.albums) {
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
          'INSERT INTO album_tracks (album_id, song_id, track_number) VALUES ($1, $2, $3)',
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
    const kept = await client.query(
      `SELECT 1 FROM songs s
       WHERE s.artist_id = $1 AND NOT EXISTS (SELECT 1 FROM album_tracks t WHERE t.song_id = s.id)`,
      [artistId],
    );
    await client.query(
      `INSERT INTO import_sources (kind, url, license, fetched_at)
       VALUES ('musicbrainz', $1, 'CC0', now())`,
      [input.sourceUrl],
    );
    await client.query('COMMIT');
    return { keptSongs: kept.rowCount ?? 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
