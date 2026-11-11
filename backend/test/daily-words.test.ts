import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { serviceDate } from '../src/standard/http.js';
import { withApi } from './helpers.js';

function fakePool(rows: unknown[] = []) {
  const queries: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      queries.push({ text, values });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Pool;
  return { pool, queries };
}

const today = () => '2026-11-01';

test('the day turns over at midnight in Seoul, not at the server clock', () => {
  assert.equal(serviceDate(new Date('2026-11-01T14:59:59Z')), '2026-11-01');
  assert.equal(serviceDate(new Date('2026-11-01T15:00:00Z')), '2026-11-02');
});

test('a day that is not a real date, or has not come yet, is refused before any query', async () => {
  const { pool, queries } = fakePool();
  await withApi(
    pool,
    async (call) => {
      const bad = await call('/api/daily-words?day=2026-02-30');
      assert.equal(bad.status, 400);
      assert.deepEqual(bad.data, { error: 'Date is not a real date' });
      const late = await call('/api/daily-words?day=2026-11-02');
      assert.equal(late.status, 400);
      assert.deepEqual(late.data, { error: 'Words for a future date are not available' });
    },
    { today },
  );
  assert.deepEqual(queries, []);
});

test('opening today chooses the words; opening an earlier day never does', async () => {
  const { pool, queries } = fakePool();
  await withApi(
    pool,
    async (call) => {
      await call('/api/daily-words?day=2026-10-31');
      assert.equal(queries.filter((query) => query.text.includes('INSERT')).length, 0);
      await call('/api/daily-words');
      assert.deepEqual(queries.find((query) => query.text.includes('INSERT'))?.values, [
        '2026-11-01',
        5,
      ]);
    },
    { today },
  );
});

test('learning a word needs a yes or no and an existing word', async () => {
  const { pool, queries } = fakePool();
  await withApi(pool, async (call) => {
    const missing = await call('/api/words/1/learned', { method: 'PUT' });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.data, { error: 'Learned must be true or false' });
    const notBoolean = await call('/api/words/1/learned', {
      method: 'PUT',
      body: { learned: 'yes' },
    });
    assert.equal(notBoolean.status, 400);
    const badId = await call('/api/words/x/learned', { method: 'PUT', body: { learned: true } });
    assert.deepEqual(badId.data, { error: 'Invalid word ID' });
    assert.deepEqual(queries, []);
    const gone = await call('/api/words/1/learned', { method: 'PUT', body: { learned: true } });
    assert.equal(gone.status, 404);
    assert.deepEqual(gone.data, { error: 'Word not found' });
  });
});
