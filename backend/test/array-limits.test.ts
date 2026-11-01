import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { importTranslations } from '../src/translation-files.js';
import { importWordBatches } from '../src/word-files.js';

// The zod advisory GHSA-mrhx-c7xc-m3w5 reaches arrays without a length limit. A file over the limit stops at the
// schema, so the pool here is never used.
const unused = {} as Pool;

async function inFolder(name: string, content: unknown, run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'array-limits-'));
  try {
    await writeFile(join(dir, name), JSON.stringify(content));
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const word = {
  lemma: 'run',
  partOfSpeech: 'verb',
  meaningKo: '달리다',
  exampleEn: 'I run.',
  exampleKo: '나는 달린다.',
  morphemes: [],
};

test('a word file over 1000 words is refused', async () => {
  const content = { words: Array.from({ length: 1001 }, () => word) };
  await inFolder('words.json', content, async (dir) => {
    const { rejected, saved } = await importWordBatches(unused, dir);
    assert.deepEqual(saved, []);
    assert.deepEqual(rejected, [
      { file: 'words.json', reason: '파일 형식이 맞지 않습니다: words' },
    ]);
  });
});

test('a word with more than 12 parts is refused', async () => {
  const part = { key: 'root:a', form: 'a', kind: 'root', meaningKo: '뜻', origin: null };
  const content = { words: [{ ...word, morphemes: Array.from({ length: 13 }, () => part) }] };
  await inFolder('words.json', content, async (dir) => {
    const { rejected } = await importWordBatches(unused, dir);
    assert.deepEqual(rejected, [
      { file: 'words.json', reason: '파일 형식이 맞지 않습니다: words.0.morphemes' },
    ]);
  });
});

test('a translation file over 5000 lines is refused', async () => {
  const line = { lineNumber: 1, original: 'a', atExport: null, translation: '가' };
  const content = { songId: 1, title: '곡', lines: Array.from({ length: 5001 }, () => line) };
  await inFolder('1.json', content, async (dir) => {
    const { rejected } = await importTranslations(unused, dir);
    assert.deepEqual(rejected, [{ file: '1.json', reason: '파일 형식이 내보낸 형식과 다릅니다' }]);
  });
});
