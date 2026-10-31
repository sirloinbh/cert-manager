import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { carryTranslations, toLines } from '../src/routes/songs.js';
import { withApi } from './helpers.js';

type Query = { text: string; values: unknown[] };

function fakePool(answer: (query: Query) => { rows: unknown[]; rowCount?: number }) {
  const queries: Query[] = [];
  const connections = { taken: 0, released: 0 };
  const query = async (text: string, values: unknown[] = []) => {
    queries.push({ text, values });
    return answer({ text, values });
  };
  const pool = {
    query,
    connect: async () => {
      connections.taken += 1;
      return {
        query,
        release: () => {
          connections.released += 1;
        },
      };
    },
  } as unknown as Pool;
  return { pool, queries, connections };
}

test('translations follow their text when lines are added, removed or moved', () => {
  const previous = [
    { original: '하나', translation: 'one' },
    { original: '', translation: null },
    { original: '둘', translation: 'two' },
    { original: '셋', translation: null },
  ];
  assert.deepEqual(carryTranslations(previous, ['새 줄', '하나', '', '셋', '둘']), [
    null,
    'one',
    null,
    null,
    'two',
  ]);
  assert.deepEqual(carryTranslations(previous, ['둘']), ['two']);
});

test('a repeated line uses each old translation once', () => {
  const previous = [
    { original: '후렴', translation: 'first' },
    { original: '후렴', translation: 'second' },
  ];
  assert.deepEqual(carryTranslations(previous, ['후렴', '후렴', '후렴']), [
    'first',
    'second',
    null,
  ]);
});

test('lines ignore line-end style, trailing spaces and surrounding blank lines', () => {
  assert.deepEqual(toLines('\n\n첫 줄  \r\n\r\n둘째 줄\r셋째 줄\n\n'), [
    '첫 줄',
    '',
    '둘째 줄',
    '셋째 줄',
  ]);
  assert.deepEqual(toLines('   \n '), []);
});

test('the list groups tracks under albums with numeric ids', async () => {
  const row = {
    albumId: '1',
    albumTitle: '앨범',
    albumKind: 'studio',
    releaseDate: '2020-01-01',
    trackNumber: 1,
    status: 'none',
  };
  const { pool } = fakePool(() => ({
    rows: [
      { ...row, songId: '5', title: '첫 곡' },
      { ...row, songId: '6', title: '둘째 곡', trackNumber: 2, status: 'translated' },
      { ...row, albumId: '2', albumTitle: '다른 앨범', songId: '5', title: '첫 곡' },
    ],
  }));
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/songs');
    assert.equal(status, 200);
    const albums = data.albums as { id: number; title: string; tracks: { songId: number }[] }[];
    assert.deepEqual(
      albums.map((album) => [album.id, album.tracks.map((track) => track.songId)]),
      [
        [1, [5, 6]],
        [2, [5]],
      ],
    );
  });
});

test('a missing song is a 404, and a bad id a 400', async () => {
  const { pool } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    const missing = await call('/api/songs/9');
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.data, { error: '곡을 찾을 수 없습니다' });
    const bad = await call('/api/songs/abc');
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.data, { error: '곡 ID가 올바르지 않습니다' });
    const save = await call('/api/songs/9/lyrics', {
      method: 'PUT',
      body: { original: '새로 지은 문장' },
    });
    assert.equal(save.status, 404);
  });
});

test('invalid lyrics and translations are a Korean 400 and change nothing', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  await withApi(pool, async (call) => {
    const cases: [string, unknown, string][] = [
      ['lyrics', {}, '가사를 입력해 주세요'],
      ['lyrics', { original: '  \n  ' }, '가사를 입력해 주세요'],
      ['lyrics', { original: 1 }, '가사를 입력해 주세요'],
      ['lyrics', { original: 'a'.repeat(50_001) }, '가사는 50000자 이하로 입력해 주세요'],
      ['translation', {}, '번역을 입력해 주세요'],
      ['translation', { translation: 'a'.repeat(50_001) }, '번역은 50000자 이하로 입력해 주세요'],
      ['lyrics', [1], '요청 본문은 JSON 객체여야 합니다'],
    ];
    for (const [kind, body, message] of cases) {
      const { status, data } = await call(`/api/songs/3/${kind}`, { method: 'PUT', body });
      assert.equal(status, 400, JSON.stringify(body).slice(0, 60));
      assert.equal(data.error, message);
    }
  });
  assert.equal(queries.length, 0);
});

test('a translation with the wrong line count says both counts and saves nothing', async () => {
  const { pool, queries } = fakePool(({ text }) =>
    text.includes('SELECT line_number')
      ? { rows: [{ lineNumber: 1 }, { lineNumber: 3 }] }
      : { rows: [], rowCount: 1 },
  );
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/songs/3/translation', {
      method: 'PUT',
      body: { translation: '한 줄뿐' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '번역 줄 수(1줄)가 원문 줄 수(2줄)와 다릅니다. 빈 줄은 세지 않습니다');
  });
  assert.ok(!queries.some((query) => query.text.startsWith('UPDATE')));
  assert.ok(queries.some((query) => query.text === 'ROLLBACK'));
});

test('a missing song rolls back and gives the connection back', async () => {
  const { pool, queries, connections } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    for (const [kind, body] of [
      ['lyrics', { original: '새로 지은 문장' }],
      ['translation', { translation: '새로 지은 번역' }],
    ] as const) {
      const { status } = await call(`/api/songs/9/${kind}`, { method: 'PUT', body });
      assert.equal(status, 404);
    }
  });
  assert.equal(queries.filter((query) => query.text === 'ROLLBACK').length, 2);
  assert.deepEqual(connections, { taken: 2, released: 2 });
});

test('a translation needs lyrics first', async () => {
  const { pool } = fakePool(({ text }) =>
    text.startsWith('SELECT 1') ? { rows: [{}], rowCount: 1 } : { rows: [], rowCount: 0 },
  );
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/songs/3/translation', {
      method: 'PUT',
      body: { translation: '번역' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '원문 가사를 먼저 넣어 주세요');
  });
});

test('a failure while saving lyrics rolls back', async () => {
  const { pool, queries, connections } = fakePool(({ text }) => {
    if (text.startsWith('INSERT')) throw new Error('boom');
    return { rows: [], rowCount: 1 };
  });
  const original = console.error;
  console.error = () => {};
  try {
    await withApi(pool, async (call) => {
      const { status } = await call('/api/songs/3/lyrics', {
        method: 'PUT',
        body: { original: '새로 지은 문장' },
      });
      assert.equal(status, 500);
    });
  } finally {
    console.error = original;
  }
  assert.ok(queries.some((query) => query.text === 'ROLLBACK'));
  assert.ok(!queries.some((query) => query.text === 'COMMIT'));
  assert.deepEqual(connections, { taken: 1, released: 1 });
});
