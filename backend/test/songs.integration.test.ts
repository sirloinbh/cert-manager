import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Line = { lineNumber: number; original: string; translation: string | null };
type Song = {
  id: number;
  status: string;
  lyricsSource: string | null;
  lyricsSourceUrl: string | null;
  lines: Line[];
};
type Album = { id: number; tracks: { songId: number; status: string }[] };

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
// The test lyrics are made up for this test.
test(
  'songs list under their albums, and lyrics and translations line up by line',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const artist = await pool.query<{ id: string }>(
      "INSERT INTO artists (name) VALUES ('#35 가수') RETURNING id",
    );
    const artistId = artist.rows[0]?.id;
    t.after(async () => {
      await pool.query('DELETE FROM albums WHERE artist_id = $1', [artistId]);
      await pool.query('DELETE FROM songs WHERE artist_id = $1', [artistId]);
      await pool.query('DELETE FROM artists WHERE id = $1', [artistId]);
      await pool.end();
    });
    const addAlbum = async (title: string, date: string | null) => {
      const { rows } = await pool.query<{ id: string }>(
        "INSERT INTO albums (artist_id, title, kind, release_date) VALUES ($1, $2, 'studio', $3) RETURNING id",
        [artistId, title, date],
      );
      return Number(rows[0]?.id);
    };
    const later = await addAlbum('#35 나중 앨범', '2021-01-01');
    const earlier = await addAlbum('#35 처음 앨범', '2020-01-01');
    const { rows: songs } = await pool.query<{ id: string }>(
      "INSERT INTO songs (artist_id, title) VALUES ($1, '#35 공유 곡'), ($1, '#35 둘째 곡') RETURNING id",
      [artistId],
    );
    const shared = Number(songs[0]?.id);
    const second = Number(songs[1]?.id);
    await pool.query(
      'INSERT INTO album_tracks (album_id, song_id, track_number) VALUES ($1, $3, 1), ($2, $3, 1), ($2, $4, 2)',
      [earlier, later, shared, second],
    );

    await withApi(pool, async (call) => {
      const list = await call('/api/songs');
      const mine = (list.data.albums as Album[]).filter((album) =>
        [earlier, later].includes(album.id),
      );
      assert.deepEqual(
        mine.map((album) => [album.id, album.tracks.map((track) => track.songId)]),
        [
          [earlier, [shared]],
          [later, [shared, second]],
        ],
        'albums by release date; one song can be on both',
      );
      assert.equal(mine[0]?.tracks[0]?.status, 'none');

      const path = `/api/songs/${shared}`;
      const empty = await call(path);
      assert.equal((empty.data.song as Song).lines.length, 0);
      const noLyrics = await call(`${path}/translation`, {
        method: 'PUT',
        body: { translation: '번역' },
      });
      assert.equal(noLyrics.status, 400);

      const saved = await call(`${path}/lyrics`, {
        method: 'PUT',
        body: { original: '\n바람이 분다\r\n\r\n창문을 연다\n커피를 마신다\n' },
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      const lyrics = saved.data.song as Song;
      assert.equal(lyrics.status, 'untranslated');
      assert.equal(lyrics.lyricsSource, 'manual');
      assert.equal(lyrics.lyricsSourceUrl, '');
      assert.deepEqual(
        lyrics.lines.map((line) => [line.lineNumber, line.original]),
        [
          [1, '바람이 분다'],
          [2, ''],
          [3, '창문을 연다'],
          [4, '커피를 마신다'],
        ],
      );

      const wrong = await call(`${path}/translation`, {
        method: 'PUT',
        body: { translation: 'The wind blows' },
      });
      assert.equal(wrong.status, 400);
      const unchanged = await call(path);
      assert.ok((unchanged.data.song as Song).lines.every((line) => line.translation === null));

      // Blank lines may be left out of a pasted translation; lines still match up.
      const translated = await call(`${path}/translation`, {
        method: 'PUT',
        body: { translation: 'The wind blows\nI open the window\nI drink coffee' },
      });
      assert.equal(translated.status, 200, JSON.stringify(translated.data));
      const both = translated.data.song as Song;
      assert.equal(both.status, 'translated');
      assert.deepEqual(
        both.lines.map((line) => line.translation),
        ['The wind blows', null, 'I open the window', 'I drink coffee'],
      );

      // Changing one line drops only that line's translation.
      const edited = await call(`${path}/lyrics`, {
        method: 'PUT',
        body: { original: '바람이 분다\n\n문을 연다\n커피를 마신다' },
      });
      const after = edited.data.song as Song;
      assert.equal(after.status, 'untranslated');
      assert.deepEqual(
        after.lines.map((line) => line.translation),
        ['The wind blows', null, null, 'I drink coffee'],
      );

      const relisted = await call('/api/songs');
      const firstAlbum = (relisted.data.albums as Album[]).find((album) => album.id === earlier);
      assert.equal(firstAlbum?.tracks[0]?.status, 'untranslated');
    });

    // Lines go with their song.
    await pool.query('DELETE FROM songs WHERE id = $1', [shared]);
    const left = await pool.query('SELECT 1 FROM lyric_lines WHERE song_id = $1', [shared]);
    assert.equal(left.rowCount, 0);
    // An artist with songs cannot be removed.
    await assert.rejects(pool.query('DELETE FROM artists WHERE id = $1', [artistId]), {
      code: '23503',
    });
  },
);
