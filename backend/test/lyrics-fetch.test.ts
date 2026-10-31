import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { requestLyrics } from '../src/lyrics-fetch.js';

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
  assert.equal(calls, 5);
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
  const timed = '[00:01.50] 종이배를 띄운다\n[00:03.00] \n[00:05.25] 강물이 흐른다';
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
