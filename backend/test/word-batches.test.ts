import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { entryUrl, etymologyText } from '../src/word-etymology.js';
import { exportWordBatch } from '../src/word-files.js';

test('entry URLs encode each path segment, by code point', () => {
  assert.equal(entryUrl('http://x', 'c++'), 'http://x/c/c%2B/c%2B%2B.jsonl');
  assert.equal(entryUrl('http://x', 'a.m.'), 'http://x/a/a./a.m..jsonl');
  assert.equal(entryUrl('http://x', '?x'), 'http://x/%3F/%3Fx/%3Fx.jsonl');
  // One code point outside the BMP is one letter, not two broken halves.
  assert.equal(
    entryUrl('http://x', '😀a'),
    `http://x/%F0%9F%98%80/%F0%9F%98%80a/%F0%9F%98%80a.jsonl`,
  );
});

test('a lemma with regular expression characters neither throws nor matches loosely', () => {
  const entry = (text: string) => JSON.stringify({ etymology_text: text });
  const tree = (word: string) => `Etymology tree\nLatin a\nEnglish ${word}\nFrom Latin a.`;
  assert.equal(etymologyText(entry(tree('c++')), 'c++'), 'From Latin a.');
  assert.equal(etymologyText(entry(tree('a.m.')), 'a.m.'), 'From Latin a.');
  // "." in the lemma is a dot, not any character: this tree is for another word, so there is no source.
  assert.equal(etymologyText(entry(tree('axmx')), 'a.m.'), '');
});

const fakePool = (rows: { lemma: string; rank: number }[]) => {
  const queries: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[]) => {
      queries.push({ text, values });
      if (text.includes('FROM words')) {
        const skip = values[1] as string[];
        return {
          rows: rows
            .filter((row) => !skip.includes(row.lemma))
            .slice(0, values[0] as number)
            .map((row) => ({ ...row, etymologySource: 'From x.' })),
        };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
  return { pool, queries };
};

test('a second export before the import reports the waiting batch and repeats no word', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cert-batches-'));
  const { pool } = fakePool([
    { lemma: 'a', rank: 1 },
    { lemma: 'b', rank: 2 },
    { lemma: 'c', rank: 3 },
  ]);
  const first = await exportWordBatch(pool, dir, 2);
  assert.deepEqual(first, { file: 'words-1-2.json', written: true, waiting: [] });
  const second = await exportWordBatch(pool, dir, 2);
  assert.deepEqual(second, { file: 'words-3-3.json', written: true, waiting: ['words-1-2.json'] });
  const third = await exportWordBatch(pool, dir, 2);
  assert.deepEqual(third, {
    file: null,
    written: false,
    waiting: ['words-1-2.json', 'words-3-3.json'],
  });
  assert.deepEqual((await readdir(dir)).sort(), ['words-1-2.json', 'words-3-3.json']);
});

test('an unreadable file in the folder still counts as waiting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cert-batches-'));
  await writeFile(join(dir, 'broken.json'), '{ nope');
  const { pool } = fakePool([]);
  assert.deepEqual(await exportWordBatch(pool, dir, 2), {
    file: null,
    written: false,
    waiting: ['broken.json'],
  });
});
