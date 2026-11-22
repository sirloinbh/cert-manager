import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { moveToImported } from '../src/scripts/translation-files.js';

test('a second import of the same song keeps both files (#148)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'translations-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const doneDir = join(dir, 'imported');
  await mkdir(doneDir);

  await writeFile(join(dir, '7.json'), 'first');
  assert.equal(await moveToImported(dir, doneDir, '7.json'), '7.json');

  await writeFile(join(dir, '7.json'), 'second');
  const moved = await moveToImported(dir, doneDir, '7.json', new Date('2026-11-22T01:02:03.456Z'));
  assert.equal(moved, '7.2026-11-22T01-02-03-456Z.json');

  assert.deepEqual((await readdir(doneDir)).sort(), ['7.2026-11-22T01-02-03-456Z.json', '7.json']);
  assert.equal(await readFile(join(doneDir, '7.json'), 'utf8'), 'first');
  assert.equal(await readFile(join(doneDir, moved), 'utf8'), 'second');
  assert.deepEqual(await readdir(dir), ['imported']);
});
