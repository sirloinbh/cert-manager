import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import type { ListTrack } from '../src/song-list.js';
import { saveSongList, type SongListInput } from '../src/song-list-save.js';

const url = process.env.TEST_DATABASE_URL;

const artist = { id: '35000000-0000-4000-8000-000000000001', name: '#35 저장 테스트 가수' };
const sourceUrl = 'https://example.test/35-song-list';
const recording = (n: number) => `35000000-0000-4000-8000-1000000000${String(n).padStart(2, '0')}`;
const firstAlbum = '35000000-0000-4000-8000-200000000001';
const secondAlbum = '35000000-0000-4000-8000-200000000002';

const track = (trackNumber: number, song: number, title = `곡 ${song}`): ListTrack => ({
  trackNumber,
  title,
  durationSeconds: 100,
  recordingId: recording(song),
});

const input = (first: ListTrack[], second: ListTrack[]): SongListInput => ({
  artist,
  sourceUrl,
  albums: [
    {
      album: { releaseGroupId: firstAlbum, title: '#35 첫판', kind: 'studio', songs: first.length },
      date: '2020-01-01',
      tracks: first,
    },
    {
      album: {
        releaseGroupId: secondAlbum,
        title: '#35 둘째판',
        kind: 'taylors_version',
        songs: second.length,
      },
      date: null,
      tracks: second,
    },
  ],
});

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test('running the song list again replaces tracks and keeps lyrics', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(async () => {
    await pool.query('DELETE FROM albums WHERE musicbrainz_id = ANY($1::uuid[])', [
      [firstAlbum, secondAlbum],
    ]);
    await pool.query('DELETE FROM songs WHERE musicbrainz_id::text LIKE $1', ['35000000-%']);
    await pool.query('DELETE FROM artists WHERE musicbrainz_id = $1', [artist.id]);
    await pool.query('DELETE FROM import_sources WHERE url = $1', [sourceUrl]);
    await pool.end();
  });
  const tracks = async (albumId: string) => {
    const { rows } = await pool.query<{ n: number; recording: string }>(
      `SELECT t.track_number AS n, s.musicbrainz_id::text AS recording
       FROM album_tracks t
       JOIN albums a ON a.id = t.album_id
       JOIN songs s ON s.id = t.song_id
       WHERE a.musicbrainz_id = $1 ORDER BY t.track_number`,
      [albumId],
    );
    return rows.map((row) => [row.n, row.recording]);
  };
  const songId = async (song: number) => {
    const { rows } = await pool.query<{ id: string; title: string }>(
      'SELECT id::text AS id, title FROM songs WHERE musicbrainz_id = $1',
      [recording(song)],
    );
    return rows[0];
  };

  // Song 1 is on both albums.
  const first = await saveSongList(
    pool,
    input([track(1, 1), track(2, 2), track(3, 3)], [track(5, 1)]),
  );
  assert.deepEqual(first, { keptSongs: [] });
  assert.deepEqual(await tracks(secondAlbum), [[5, recording(1)]]);

  // Song 2 gets lyrics; the same list again changes nothing and leaves them alone.
  const withLyrics = await songId(2);
  await pool.query(
    "INSERT INTO lyric_lines (song_id, line_number, original) VALUES ($1, 1, '지어낸 문장')",
    [withLyrics?.id],
  );
  await saveSongList(pool, input([track(1, 1), track(2, 2), track(3, 3)], [track(5, 1)]));
  assert.equal((await tracks(firstAlbum)).length, 3);
  const before = await songId(1);

  // Now songs 2 and 3 leave the list, song 4 joins, and song 1 has a new title.
  const second = await saveSongList(
    pool,
    input([track(1, 1, '새 제목'), track(2, 4)], [track(5, 1, '새 제목')]),
  );
  assert.deepEqual(await tracks(firstAlbum), [
    [1, recording(1)],
    [2, recording(4)],
  ]);
  assert.equal((await songId(1))?.id, before?.id, 'a song keeps its id');
  assert.equal((await songId(1))?.title, '새 제목');
  assert.equal(await songId(3), undefined, 'a song without lyrics goes');
  assert.equal((await songId(2))?.id, withLyrics?.id, 'a song with lyrics stays');
  assert.deepEqual(second, { keptSongs: ['곡 2'] }, 'and is reported');
  const lines = await pool.query('SELECT 1 FROM lyric_lines WHERE song_id = $1', [withLyrics?.id]);
  assert.equal(lines.rowCount, 1);

  // A failure saves nothing: two tracks on one number break the second album.
  await assert.rejects(saveSongList(pool, input([track(1, 1)], [track(5, 1), track(5, 4)])), {
    code: '23505',
  });
  assert.equal((await tracks(firstAlbum)).length, 2, 'the list is as it was');

  // An album taken off the list goes; its song stays while another album has it.
  await saveSongList(pool, {
    ...input([track(1, 1, '새 제목'), track(2, 4)], []),
    albums: input([track(1, 1, '새 제목'), track(2, 4)], []).albums.slice(0, 1),
  });
  const albums = await pool.query('SELECT 1 FROM albums WHERE musicbrainz_id = $1', [secondAlbum]);
  assert.equal(albums.rowCount, 0);
  assert.equal((await songId(1))?.id, before?.id);
});
