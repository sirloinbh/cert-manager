import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { fetchMissingLyrics, requestLyrics } from '../src/lyrics-fetch.js';
import { scriptDatabaseUrl } from '../src/script-database.js';

// A fake LRCLIB. All lyrics here are made up for the test.

type Handler = (url: URL, res: ServerResponse, req: IncomingMessage) => void;

const json = (res: ServerResponse, status: number, body: unknown, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

async function withLrclib(
  handler: Handler,
  run: (
    source: { baseUrl: string; sleep: (ms: number) => Promise<void> },
    waits: number[],
  ) => Promise<void>,
) {
  const server = createServer((req, res) => handler(new URL(req.url ?? '/', 'http://x'), res, req));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const waits: number[] = [];
  try {
    await run(
      {
        baseUrl: `http://127.0.0.1:${port}`,
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
      waits,
    );
  } finally {
    server.close();
  }
}

const query = { title: 'Paper Boats', artist: '가수', album: '앨범', durationSeconds: 200 };

const item = (fields: object) => ({
  id: 7,
  trackName: 'Paper Boats',
  artistName: '가수',
  duration: 200,
  plainLyrics: '종이배를 띄운다\n\n강물이 흐른다',
  syncedLyrics: null,
  ...fields,
});

test('a 200 gives the lines and the source, and sends the song and a User-Agent', async () => {
  let seen: URL | undefined;
  let agent: string | undefined;
  await withLrclib(
    (url, res, req) => {
      seen = url;
      agent = req.headers['user-agent'];
      json(res, 200, item({}));
    },
    async (source, waits) => {
      const found = await requestLyrics(query, source);
      assert.deepEqual(found, {
        lines: ['종이배를 띄운다', '', '강물이 흐른다'],
        sourceUrl: `${source.baseUrl}/api/get/7`,
      });
      assert.deepEqual(waits, [700], 'the gap between requests');
    },
  );
  assert.equal(seen?.pathname, '/api/get');
  assert.equal(seen?.searchParams.get('track_name'), 'Paper Boats');
  assert.equal(seen?.searchParams.get('artist_name'), '가수');
  assert.equal(seen?.searchParams.get('album_name'), '앨범');
  assert.equal(seen?.searchParams.get('duration'), '200');
  assert.match(agent ?? '', /^cert-manager\//);
});

test('a song without album or duration leaves them out', async () => {
  let seen: URL | undefined;
  await withLrclib(
    (url, res) => {
      seen = url;
      json(res, 200, item({}));
    },
    async (source) => {
      await requestLyrics({ ...query, album: null, durationSeconds: null }, source);
    },
  );
  assert.equal(seen?.searchParams.has('album_name'), false);
  assert.equal(seen?.searchParams.has('duration'), false);
});

test('a 404 with nothing in search is no lyrics', async () => {
  await withLrclib(
    (url, res) => (url.pathname === '/api/get' ? json(res, 404, {}) : json(res, 200, [])),
    async (source) => {
      assert.equal(await requestLyrics(query, source), null);
    },
  );
});

test('a 429 waits as long as asked, then tries again', async () => {
  let calls = 0;
  await withLrclib(
    (_url, res) => {
      calls += 1;
      if (calls === 1) json(res, 429, {}, { 'Retry-After': '9' });
      else json(res, 200, item({}));
    },
    async (source, waits) => {
      assert.ok(await requestLyrics(query, source));
      assert.deepEqual(waits, [700, 9000, 700]);
    },
  );
  assert.equal(calls, 2);
});

test('a 429 without Retry-After waits a minute, and repeated ones give up', async () => {
  let calls = 0;
  await withLrclib(
    (_url, res) => {
      calls += 1;
      json(res, 429, {});
    },
    async (source, waits) => {
      await assert.rejects(requestLyrics(query, source), /LRCLIB 429/);
      assert.ok(waits.includes(60_000));
    },
  );
  assert.equal(calls, 3);
});

test('a 503 is waited out like a 429', async () => {
  let calls = 0;
  let accept: string | undefined;
  await withLrclib(
    (_url, res, req) => {
      calls += 1;
      accept = req.headers.accept;
      if (calls === 1) json(res, 503, {}, { 'Retry-After': '5' });
      else json(res, 200, item({}));
    },
    async (source, waits) => {
      assert.ok(await requestLyrics(query, source));
      assert.ok(waits.includes(5000));
    },
  );
  assert.equal(accept, 'application/json');
});

test('a very long wait is not waited for', async () => {
  await withLrclib(
    (_url, res) => json(res, 429, {}, { 'Retry-After': '3600' }),
    async (source, waits) => {
      await assert.rejects(requestLyrics(query, source), /LRCLIB 429/);
      assert.ok(!waits.includes(3_600_000));
    },
  );
});

test('a Retry-After given as a date waits the default', async () => {
  let calls = 0;
  await withLrclib(
    (_url, res) => {
      calls += 1;
      if (calls === 1) json(res, 429, {}, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' });
      else json(res, 200, item({}));
    },
    async (source, waits) => {
      assert.ok(await requestLyrics(query, source));
      assert.ok(waits.includes(60_000));
    },
  );
});

test('a direct answer about another song is not used', async () => {
  await withLrclib(
    (url, res) =>
      url.pathname === '/api/get'
        ? json(res, 200, item({ trackName: 'Other Song' }))
        : json(res, 200, []),
    async (source) => {
      assert.equal(await requestLyrics(query, source), null);
    },
  );
});

test('guest credits in a title do not count, on either side', async () => {
  const answer = async (title: string, trackName: string) => {
    let found: unknown;
    await withLrclib(
      (url, res) =>
        url.pathname === '/api/get' ? json(res, 200, item({ trackName })) : json(res, 200, []),
      async (source) => {
        found = await requestLyrics({ ...query, title }, source);
      },
    );
    return found;
  };
  assert.ok(await answer('Foo', 'Foo (feat. 손님)'));
  assert.ok(await answer('Foo (feat. 손님)', 'Foo'));
  assert.ok(await answer('Foo', 'Foo [with 손님]'));
  assert.equal(await answer('Foo', 'Foo (Remix)'), null);
});

test('an answer the database cannot hold is not used', async () => {
  await withLrclib(
    (url, res) =>
      url.pathname === '/api/get'
        ? json(res, 200, item({ plainLyrics: '종이배\u0000를 띄운다' }))
        : json(res, 200, []),
    async (source) => {
      assert.equal(await requestLyrics(query, source), null);
    },
  );
});

test('guests count as the artist, a longer name does not', async () => {
  const answer = async (artistName: string) => {
    let found: unknown;
    await withLrclib(
      (url, res) =>
        url.pathname === '/api/get' ? json(res, 200, item({ artistName })) : json(res, 200, []),
      async (source) => {
        found = await requestLyrics(query, source);
      },
    );
    return found;
  };
  assert.ok(await answer('가수 feat. 손님'));
  assert.ok(await answer('가수 featuring 손님'));
  assert.ok(await answer('가수 (feat. 손님)'));
  assert.equal(await answer('가수 카라오케'), null);
});

const pending = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    title: `곡 ${index + 1}`,
    artist: '가수',
    album: null,
    durationSeconds: 200,
  }));

const fakePool = (count: number) =>
  ({
    query: async () => ({ rows: pending(count), rowCount: count }),
    connect: async () => {
      throw new Error('database down');
    },
  }) as unknown as Pool;

test('a rate limit stops the run instead of asking about every other song', async () => {
  let calls = 0;
  await withLrclib(
    (_url, res) => {
      calls += 1;
      json(res, 429, {}, { 'Retry-After': '3600' });
    },
    async (source) => {
      const result = await fetchMissingLyrics(fakePool(4), source);
      assert.deepEqual(result.failed, ['곡 1']);
      assert.match(result.stopped ?? '', /LRCLIB 429/);
    },
  );
  assert.equal(calls, 1);
});

test('five failures in a row stop the run', async () => {
  await withLrclib(
    (_url, res) => json(res, 500, {}),
    async (source) => {
      const result = await fetchMissingLyrics(fakePool(8), source);
      assert.equal(result.failed.length, 5);
      assert.equal(result.stopped, 'LRCLIB 500');
    },
  );
});

test('an unreadable answer fails that song without printing the answer', async () => {
  const logged: string[] = [];
  await withLrclib(
    (_url, res) => {
      res.writeHead(200);
      res.end('지어낸 문장 not json');
    },
    async (source) => {
      const result = await fetchMissingLyrics(fakePool(1), source, (line) => logged.push(line));
      assert.deepEqual(result.failed, ['곡 1']);
      assert.equal(result.stopped, null);
    },
  );
  assert.deepEqual(logged, ['실패: 곡 1 (연결 실패 또는 잘못된 응답)']);
});

test('a database error stops the run', async () => {
  await withLrclib(
    (_url, res) => json(res, 200, item({ trackName: '곡 1' })),
    async (source) => {
      await assert.rejects(fetchMissingLyrics(fakePool(3), source), /database down/);
    },
  );
});

test('the database named for a script is shown without its password', () => {
  const before = process.env.DATABASE_URL;
  const log = console.log;
  const printed: string[] = [];
  console.log = (line: string) => printed.push(line);
  try {
    process.env.DATABASE_URL = 'postgres://u:FAKE@localhost:5432/cert';
    scriptDatabaseUrl();
    assert.deepEqual(printed, ['Target database: localhost/cert']);
    for (const bad of [
      'postgres://u:FAKE/x@h/db',
      'postgres://u:123/FAKE@h/db',
      'postgres://u:FAKE@pa#ss@h/db',
    ]) {
      process.env.DATABASE_URL = bad;
      assert.throws(scriptDatabaseUrl, (error: Error) => {
        assert.equal(error.message, 'DATABASE_URL is not a valid URL');
        return true;
      });
    }
    delete process.env.DATABASE_URL;
    assert.throws(scriptDatabaseUrl, /not set/);
  } finally {
    console.log = log;
    if (before === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = before;
  }
});

test('a server error stops that song', async () => {
  await withLrclib(
    (_url, res) => json(res, 500, {}),
    async (source) => {
      await assert.rejects(requestLyrics(query, source), /LRCLIB 500/);
    },
  );
});

test('a miss is searched, and only the same song counts', async () => {
  const results = [
    item({ id: 1, trackName: 'Other Song' }),
    item({ id: 2, artistName: '다른 가수' }),
    item({ id: 3, duration: 240 }),
    item({ id: 4, plainLyrics: null }),
    item({ id: 5, trackName: 'Paper Boats (Taylor’s Version) (From the Vault)', duration: 202 }),
  ];
  await withLrclib(
    (url, res) => (url.pathname === '/api/get' ? json(res, 404, {}) : json(res, 200, results)),
    async (source) => {
      const found = await requestLyrics(query, source);
      assert.equal(found?.sourceUrl, `${source.baseUrl}/api/get/5`);
    },
  );
});

test('a record with no text is searched too, and timed lyrics lose their marks', async () => {
  const timed = '[00:01.50][00:09.00] 종이배를 띄운다\n[00:03.00] \n[00:05.25] 강물이 흐른다';
  await withLrclib(
    (url, res) =>
      url.pathname === '/api/get'
        ? json(res, 200, item({ plainLyrics: '', syncedLyrics: null }))
        : json(res, 200, [item({ plainLyrics: null, syncedLyrics: timed })]),
    async (source) => {
      const found = await requestLyrics(query, source);
      assert.deepEqual(found?.lines, ['종이배를 띄운다', '', '강물이 흐른다']);
    },
  );
});
