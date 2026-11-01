import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { Pool } from 'pg';

import { fetchMissingLyrics } from '../src/lyrics-fetch.js';
import {
  exportTranslations,
  importTranslations,
  translationsDir,
} from '../src/translation-files.js';

const url = process.env.TEST_DATABASE_URL;

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
// All lyrics here are made up for the test.
test('lyrics arrive, go out to a file and come back translated', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  const dir = await mkdtemp(join(tmpdir(), 'cert-translations-'));
  const artist = await pool.query<{ id: string }>(
    "INSERT INTO artists (name) VALUES ('#64 가수') RETURNING id",
  );
  const artistId = artist.rows[0]?.id;
  const server = createServer((req, res) => {
    const found = new URL(req.url ?? '/', 'http://x');
    const title = found.searchParams.get('track_name');
    res.setHeader('Content-Type', 'application/json');
    if (found.pathname === '/api/get' && title === '#64 받을 곡') {
      res.end(
        JSON.stringify({
          id: 64,
          trackName: title,
          artistName: '#64 가수',
          duration: 100,
          plainLyrics: '구름이 간다\n\n새가 난다',
        }),
      );
    } else if (found.pathname === '/api/get' && title === '#64 서버 오류 곡') {
      res.statusCode = 500;
      res.end('{}');
    } else if (found.pathname === '/api/get') {
      res.statusCode = 404;
      res.end('{}');
    } else {
      res.end('[]');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
    await pool.query('DELETE FROM songs WHERE artist_id = $1', [artistId]);
    await pool.query('DELETE FROM artists WHERE id = $1', [artistId]);
    await pool.query('DELETE FROM import_sources WHERE url = $1', [`${baseUrl}/api`]);
    await pool.end();
  });
  const addSong = async (title: string) => {
    const { rows } = await pool.query<{ id: string }>(
      'INSERT INTO songs (artist_id, title, duration_seconds) VALUES ($1, $2, 100) RETURNING id',
      [artistId, title],
    );
    return Number(rows[0]?.id);
  };
  const fetched = await addSong('#64 받을 곡');
  await addSong('#64 없는 곡');
  await addSong('#64 서버 오류 곡');
  const typed = await addSong('#64 이미 넣은 곡');
  await pool.query(
    "INSERT INTO lyric_lines (song_id, line_number, original) VALUES ($1, 1, '직접 넣은 문장')",
    [typed],
  );
  const sleep = async () => {};

  const first = await fetchMissingLyrics(pool, { baseUrl, sleep });
  assert.ok(first.saved.includes('#64 받을 곡'));
  assert.ok(first.missing.includes('#64 없는 곡'));
  assert.ok(first.failed.includes('#64 서버 오류 곡'), 'one failure does not stop the rest');
  assert.ok(!first.saved.includes('#64 이미 넣은 곡'));
  const song = await pool.query<{ lyrics_source: string; lyrics_source_url: string }>(
    'SELECT lyrics_source, lyrics_source_url FROM songs WHERE id = $1',
    [fetched],
  );
  assert.deepEqual(song.rows[0], {
    lyrics_source: 'lrclib',
    lyrics_source_url: `${baseUrl}/api/get/64`,
  });
  const lines = async (id: number) =>
    (
      await pool.query<{ original: string; translation: string | null }>(
        'SELECT original, translation FROM lyric_lines WHERE song_id = $1 ORDER BY line_number',
        [id],
      )
    ).rows;
  assert.deepEqual(
    (await lines(fetched)).map((line) => line.original),
    ['구름이 간다', '', '새가 난다'],
  );
  const typedLines = await lines(typed);
  assert.equal(typedLines[0]?.original, '직접 넣은 문장', 'typed-in lyrics stay');
  const sources = await pool.query(
    "SELECT license FROM import_sources WHERE kind = 'lrclib' AND url = $1",
    [`${baseUrl}/api`],
  );
  assert.deepEqual(sources.rows, [{ license: '' }]);

  // Running again asks only about songs still without lyrics.
  const second = await fetchMissingLyrics(pool, { baseUrl, sleep });
  assert.ok(!second.saved.includes('#64 받을 곡'));
  const again = await pool.query('SELECT 1 FROM import_sources WHERE url = $1', [`${baseUrl}/api`]);
  assert.equal(again.rowCount, 1, 'no new record when nothing was saved');

  // Export leaves blank lines out and a file already there alone.
  const fileName = `${fetched}.json`;
  const path = join(dir, fileName);
  const exported = await exportTranslations(pool, dir);
  assert.ok(exported.written.includes('#64 받을 곡'));
  assert.ok((await readdir(dir)).includes(`${typed}.json`));
  const file = JSON.parse(await readFile(path, 'utf8')) as {
    songId: number;
    title: string;
    lines: { lineNumber: number; original: string; atExport: string | null; translation: string }[];
  };
  assert.deepEqual(file.lines, [
    { lineNumber: 1, original: '구름이 간다', atExport: null, translation: '' },
    { lineNumber: 3, original: '새가 난다', atExport: null, translation: '' },
  ]);
  await writeFile(path, '{"mine":true}');
  const exportedAgain = await exportTranslations(pool, dir);
  assert.ok(exportedAgain.kept.includes('#64 받을 곡'));
  assert.equal(await readFile(path, 'utf8'), '{"mine":true}');

  // Only this test's file from here on, so other tests' songs are not touched.
  for (const name of await readdir(dir)) if (name !== fileName) await rm(join(dir, name));
  const importing = async (content: object | string) => {
    await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content));
    return importTranslations(pool, dir);
  };
  const translation = (first: string, second: string) => ({
    ...file,
    lines: [
      { ...file.lines[0], translation: first },
      { ...file.lines[1], translation: second },
    ],
  });
  const untouched = async () =>
    assert.ok((await lines(fetched)).every((line) => line.translation === null));

  for (const [content, reason] of [
    ['{ 깨진 파일', 'JSON으로 읽을 수 없습니다'],
    [{ songId: fetched }, '파일 형식이 내보낸 형식과 다릅니다'],
    [{ ...file, songId: fetched + 1 }, '파일 이름과 곡 ID가 다릅니다'],
    [{ ...file, songId: 1.5 }, '파일 형식이 내보낸 형식과 다릅니다'],
    [translation('Clouds go', 'Birds\u0000fly'), '번역에 쓸 수 없는 문자가 있습니다'],
    [{ ...file, lines: file.lines.slice(0, 1) }, '번역 줄 수(1줄)가 원문 줄 수(2줄)와 다릅니다'],
    [translation('Clouds go', '  '), '번역이 비어 있는 줄이 1개 있습니다'],
    [translation('Clouds go', 'Birds\nfly'), '번역 한 칸에는 한 줄만 쓸 수 있습니다'],
    [
      { ...file, lines: [{ ...file.lines[0], original: '바뀐 원문' }, file.lines[1]] },
      '원문이 DB와 다릅니다. 파일을 지우고 다시 내보내 주세요',
    ],
  ] as const) {
    const rejected = await importing(content);
    assert.deepEqual(rejected.saved, []);
    assert.deepEqual(rejected.rejected, [{ file: fileName, reason }]);
    await untouched();
  }

  // A file nobody filled in yet is not a problem, and it stays for later.
  const waiting = await importing(file);
  assert.deepEqual(waiting, { saved: [], skipped: [fileName], rejected: [] });
  assert.ok((await readdir(dir)).includes(fileName));

  // Saved, even from a tool that starts the file with a byte order mark, and moved out of the way.
  const saved = await importing(`\uFEFF${JSON.stringify(translation(' Clouds go ', 'Birds fly'))}`);
  assert.deepEqual(saved, { saved: [fileName], skipped: [], rejected: [] });
  assert.ok(!(await readdir(dir)).includes(fileName));
  assert.deepEqual(await readdir(join(dir, 'imported')), [fileName]);
  assert.deepEqual(
    (await lines(fetched)).map((line) => line.translation),
    ['Clouds go', null, 'Birds fly'],
  );

  // A saved file an earlier run could not move is only moved.
  const notMoved = await importing(translation('Clouds go', 'Birds fly'));
  assert.deepEqual(notMoved, { saved: [fileName], skipped: [], rejected: [] });
  assert.ok(!(await readdir(dir)).includes(fileName));

  // Importing again cannot bring back an old translation over an edit made on the screen.
  await pool.query(
    'UPDATE lyric_lines SET translation = $2 WHERE song_id = $1 AND line_number = 1',
    [fetched, '화면에서 고친 번역'],
  );
  assert.deepEqual(await importTranslations(pool, dir), { saved: [], skipped: [], rejected: [] });
  assert.equal((await lines(fetched))[0]?.translation, '화면에서 고친 번역');

  // Nor can a file written before that edit, unless nothing was typed in it.
  const stale = await importing(translation('Clouds go', 'Birds fly'));
  assert.deepEqual(stale.rejected, [
    { file: fileName, reason: '내보낸 뒤 번역이 바뀌었습니다. 파일을 지우고 다시 내보내 주세요' },
  ]);
  assert.equal((await lines(fetched))[0]?.translation, '화면에서 고친 번역');
  assert.deepEqual(await importing(file), { saved: [], skipped: [fileName], rejected: [] });
  assert.equal((await lines(fetched))[0]?.translation, '화면에서 고친 번역');

  // A song that is gone is named, not fatal.
  await pool.query('DELETE FROM songs WHERE id = $1', [fetched]);
  const gone = await importing(translation('Clouds go', 'Birds fly'));
  assert.deepEqual(gone.rejected, [{ file: fileName, reason: '곡을 찾을 수 없습니다' }]);
});

test('the work folder is the ignored one at the top of the repository', () => {
  assert.match(translationsDir.replaceAll('\\', '/'), /\/\.local\/translations\/$/);
  assert.ok(!translationsDir.replaceAll('\\', '/').includes('/backend/'));
});
