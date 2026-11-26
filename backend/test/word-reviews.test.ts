import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { nextStep, reviewIntervals } from '../src/routes/word-reviews.js';
import { withApi } from './helpers.js';

const today = () => '2026-11-27';

// Answers each query by its text: the word lookup first, then the upsert.
function fakePool(existingStep: number | null | 'missing') {
  const queries: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('LEFT JOIN word_reviews')) {
        return existingStep === 'missing'
          ? { rows: [] }
          : { rows: [{ id: 1, step: existingStep }] };
      }
      if (text.includes('INSERT INTO word_reviews'))
        return { rows: [{ nextReviewOn: '2026-12-04' }] };
      return { rows: [] };
    },
  } as unknown as Pool;
  return { pool, queries };
}

test('the intervals are 1, 3, 7, 14 and 30 days', () => {
  assert.deepEqual([...reviewIntervals], [1, 3, 7, 14, 30]);
});

test('Know moves one step up and stays at the top step', () => {
  assert.equal(nextStep(null, 'know'), 1);
  assert.equal(nextStep(0, 'know'), 1);
  assert.equal(nextStep(3, 'know'), 4);
  assert.equal(nextStep(4, 'know'), 4);
});

test('Unsure keeps the step and Dont know goes back to 1 day', () => {
  assert.equal(nextStep(null, 'unsure'), 0);
  assert.equal(nextStep(3, 'unsure'), 3);
  assert.equal(nextStep(4, 'dontKnow'), 0);
  assert.equal(nextStep(null, 'dontKnow'), 0);
});

test('an answer saves the new step and a next review date counted from today', async () => {
  const { pool, queries } = fakePool(2);
  await withApi(
    pool,
    async (call) => {
      const know = await call('/api/words/1/review', { method: 'PUT', body: { answer: 'know' } });
      assert.equal(know.status, 200);
      assert.deepEqual(know.data, {
        review: { wordId: 1, step: 3, nextReviewOn: '2026-12-04', lastAnswer: 'know' },
      });
      await call('/api/words/1/review', { method: 'PUT', body: { answer: 'dontKnow' } });
    },
    { today },
  );
  const writes = queries.filter((query) => query.text.includes('INSERT'));
  // [word id, step, today, interval in days, answer]
  assert.deepEqual(writes[0]?.values, [1, 3, '2026-11-27', 14, 'know']);
  assert.deepEqual(writes[1]?.values, [1, 0, '2026-11-27', 1, 'dontKnow']);
});

test('an answer needs a known value and an existing word', async () => {
  const { pool, queries } = fakePool('missing');
  await withApi(
    pool,
    async (call) => {
      const missing = await call('/api/words/1/review', { method: 'PUT' });
      assert.equal(missing.status, 400);
      assert.deepEqual(missing.data, { error: 'Answer must be know, unsure or dontKnow' });
      const wrong = await call('/api/words/1/review', { method: 'PUT', body: { answer: 'yes' } });
      assert.equal(wrong.status, 400);
      const badId = await call('/api/words/x/review', { method: 'PUT', body: { answer: 'know' } });
      assert.deepEqual(badId.data, { error: 'Invalid word ID' });
      assert.deepEqual(queries, []);
      const gone = await call('/api/words/1/review', { method: 'PUT', body: { answer: 'know' } });
      assert.equal(gone.status, 404);
      assert.deepEqual(gone.data, { error: 'Word not found' });
    },
    { today },
  );
});

test('the due list uses today in Seoul unless a day is given, and refuses a bad day', async () => {
  const { pool, queries } = fakePool(null);
  await withApi(
    pool,
    async (call) => {
      const due = await call('/api/word-reviews/due');
      assert.equal(due.status, 200);
      assert.deepEqual(due.data, { today: '2026-11-27', day: '2026-11-27', count: 0, words: [] });
      await call('/api/word-reviews/due?day=2026-12-01');
      const bad = await call('/api/word-reviews/due?day=2026-02-30');
      assert.equal(bad.status, 400);
    },
    { today },
  );
  const reads = queries.filter((query) => query.text.includes('next_review_on <='));
  assert.deepEqual(
    reads.map((query) => query.values),
    [['2026-11-27'], ['2026-12-01']],
  );
});
