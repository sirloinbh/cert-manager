import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { entryUrl, etymologyText, fetchMissingEtymology } from '../src/word-etymology.js';
import { parseWordList } from '../src/word-list.js';

const csv = (rows: string[]) =>
  ['Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)', ...rows].join('\r\n');

const fullList = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `w${'a'.repeat(0)}${String.fromCharCode(97 + (index % 26))},${index + 1},50.1,7`,
  );

test('the list keeps rank order and undoes the spreadsheet capitals', () => {
  const rows = fullList(2809);
  rows[0] = 'the,1,87.85,60910';
  rows[1] = 'I,2,78.34,6820';
  rows[2] = 'TRUE,3,63.17,208';
  const words = parseWordList(`\uFEFF${csv(rows)}\r\n`);
  assert.equal(words.length, 2809);
  assert.deepEqual(words.slice(0, 3), [
    { lemma: 'the', rank: 1 },
    { lemma: 'I', rank: 2 },
    { lemma: 'true', rank: 3 },
  ]);
});

test('an unexpected file is refused', () => {
  assert.throws(() => parseWordList('a,b\n1,2'), /unexpected columns/);
  assert.throws(() => parseWordList(csv(['the,1,87,6'])), /1 words, expected 2809/);
  assert.throws(() => parseWordList(csv(['two words,1,87,6'])), /unexpected row/);
  assert.throws(() => parseWordList(csv(['the,x,87,6'])), /unexpected row/);
});

test('entries live under the first one and two letters', () => {
  assert.equal(entryUrl('http://x', 'transport'), 'http://x/t/tr/transport.jsonl');
  assert.equal(entryUrl('http://x', 'a'), 'http://x/a/a/a.jsonl');
  assert.equal(entryUrl('http://x', 'I'), 'http://x/i/i/I.jsonl');
});

const entry = (text?: string) => JSON.stringify({ word: 'x', etymology_text: text });

test('etymology text loses the generated tree and repeats', () => {
  const tree =
    'Etymology tree\nProto-Italic *portā\nLatin portō\nFrom Latin portō (“to carry”), with a made-up note.';
  assert.equal(
    etymologyText(`${entry(tree)}\n${entry(tree)}\n${entry('From Old English bar.')}\n`),
    'From Latin portō (“to carry”), with a made-up note.\n\nFrom Old English bar.',
  );
  assert.equal(etymologyText(`${entry()}\n`), '');
  assert.equal(etymologyText(entry('Etymology tree\nLatin a\nLatin b')), 'Latin b');
});

const fakePool = (lemmas: string[], fail = false) => {
  const updates: unknown[][] = [];
  const pool = {
    query: async (text: string, values: unknown[]) => {
      if (text.includes('etymology_source IS NULL')) {
        return { rows: lemmas.map((lemma, index) => ({ id: String(index + 1), lemma })) };
      }
      if (fail) throw new Error('database down');
      if (text.startsWith('UPDATE')) updates.push(values);
      return { rows: [{ id: '7' }] };
    },
  } as unknown as Pool;
  return { pool, updates };
};

async function withKaikki(
  handler: (path: string, res: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
) {
  const server = createServer((req, res) => handler(req.url ?? '/', res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

const sleep = async () => {};

test('a found word gets its text and page, a missing one an empty mark', async () => {
  const { pool, updates } = fakePool(['carry', 'nothing']);
  await withKaikki(
    (path, res) => {
      if (path === '/c/ca/carry.jsonl') res.end(entry('From a made-up word.'));
      else {
        res.statusCode = 404;
        res.end();
      }
    },
    async (baseUrl) => {
      const result = await fetchMissingEtymology(pool, { baseUrl, sleep });
      assert.deepEqual(result, { found: 1, none: ['nothing'], failed: [], stopped: null });
    },
  );
  assert.deepEqual(updates, [
    ['1', 'From a made-up word.', 'https://en.wiktionary.org/wiki/carry', '7'],
    ['2', '', '', '7'],
  ]);
});

test('being asked to wait too long stops the run', async () => {
  let calls = 0;
  await withKaikki(
    (_path, res) => {
      calls += 1;
      res.writeHead(503, { 'Retry-After': '3600' });
      res.end();
    },
    async (baseUrl) => {
      const result = await fetchMissingEtymology(fakePool(['a', 'b', 'c']).pool, {
        baseUrl,
        sleep,
      });
      assert.deepEqual(result.failed, ['a']);
      assert.match(result.stopped ?? '', /kaikki\.org 503/);
    },
  );
  assert.equal(calls, 1);
});

test('five failures in a row stop the run, and an unreadable answer is not printed', async () => {
  const logged: string[] = [];
  await withKaikki(
    (_path, res) => res.end('made-up text, not json'),
    async (baseUrl) => {
      const result = await fetchMissingEtymology(
        fakePool(['a', 'b', 'c', 'd', 'e', 'f', 'g']).pool,
        { baseUrl, sleep },
        (line) => logged.push(line),
      );
      assert.equal(result.failed.length, 5);
    },
  );
  assert.equal(logged[0], '실패: a (연결 실패 또는 잘못된 응답)');
});

test('a database error stops the run', async () => {
  await withKaikki(
    (_path, res) => res.end(entry('From a made-up word.')),
    async (baseUrl) => {
      await assert.rejects(
        fetchMissingEtymology(fakePool(['a', 'b'], true).pool, { baseUrl, sleep }),
        /database down/,
      );
    },
  );
});
