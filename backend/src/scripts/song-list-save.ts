import type { Pool, PoolClient } from 'pg';

import { withTransaction } from '../standard/db.js';
import type { ListAlbum, ListTrack } from './song-list.js';

export type SongListInput = {
  artist: { id: string; name: string };
  albums: { album: ListAlbum; date: string | null; tracks: ListTrack[] }[];
  sourceUrl: string;
};

/**
 * Saves the song list in one transaction, so a failed run leaves the list as it was.
 * Never touches lyrics. Returns the titles of songs that hold lyrics but are no longer on any album.
 */
export async function saveSongList(pool: Pool, input: SongListInput) {
  return withTransaction(pool, async (client: PoolClient) => {
    const { rows: artists } = await client.query<{ id: number }>(
      `INSERT INTO artists (name, musicbrainz_id) VALUES ($1, $2)
       ON CONFLICT (musicbrainz_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      [input.artist.name, input.artist.id],
    );
    const artistId = artists[0]?.id;
    for (const { album, date, tracks } of input.albums) {
      const { rows: albums } = await client.query<{ id: number }>(
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
      if (tracks.length > 0) {
        // One statement for the songs and one for the album tracks, not two per track (#146).
        // albumTracks() keeps one track per recording, so no row is affected twice by the upsert.
        const { rows: songs } = await client.query<{ id: number; musicbrainz_id: string }>(
          `INSERT INTO songs (artist_id, title, duration_seconds, musicbrainz_id)
           SELECT $1::bigint, v.title, v.duration_seconds, v.musicbrainz_id
           FROM unnest($2::text[], $3::int[], $4::uuid[]) AS v(title, duration_seconds, musicbrainz_id)
           ON CONFLICT (musicbrainz_id) DO UPDATE SET title = EXCLUDED.title,
             duration_seconds = EXCLUDED.duration_seconds, updated_at = now()
           RETURNING id, musicbrainz_id::text`,
          [
            artistId,
            tracks.map((track) => track.title),
            tracks.map((track) => track.durationSeconds),
            tracks.map((track) => track.recordingId),
          ],
        );
        const songIds = new Map(songs.map((song) => [song.musicbrainz_id, song.id]));
        await client.query(
          `INSERT INTO album_tracks (album_id, song_id, track_number)
           SELECT $1::bigint, v.song_id, v.track_number FROM unnest($2::bigint[], $3::int[]) AS v(song_id, track_number)`,
          [
            albumId,
            tracks.map((track) => songIds.get(track.recordingId.toLowerCase())),
            tracks.map((track) => track.trackNumber),
          ],
        );
      }
    }
    // Albums taken off the list go, with their tracks.
    await client.query(
      'DELETE FROM albums WHERE artist_id = $1 AND NOT (musicbrainz_id = ANY($2::uuid[]))',
      [artistId, input.albums.map(({ album }) => album.releaseGroupId)],
    );
    // Songs no longer on any album go too, unless they already hold lyrics.
    await client.query(
      `DELETE FROM songs s
       WHERE s.artist_id = $1
         AND NOT EXISTS (SELECT 1 FROM album_tracks t WHERE t.song_id = s.id)
         AND NOT EXISTS (SELECT 1 FROM lyric_lines l WHERE l.song_id = s.id)`,
      [artistId],
    );
    const kept = await client.query<{ title: string }>(
      `SELECT s.title FROM songs s
       WHERE s.artist_id = $1 AND NOT EXISTS (SELECT 1 FROM album_tracks t WHERE t.song_id = s.id)
       ORDER BY s.title`,
      [artistId],
    );
    await client.query(
      `INSERT INTO import_sources (kind, url, license, fetched_at)
       VALUES ('musicbrainz', $1, 'CC0', now())`,
      [input.sourceUrl],
    );
    return { keptSongs: kept.rows.map((row) => row.title) };
  });
}
