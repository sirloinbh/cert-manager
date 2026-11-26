import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test('answers schedule reviews and the due list follows Seoul today', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  const source = await pool.query<{ id: number }>(
    "INSERT INTO import_sources (kind, url, fetched_at) VALUES ('ngsl', 'https://example.test/209', now()) RETURNING id",
  );
  const sourceId = source.rows[0]?.id;
  const made = await pool.query<{ id: number }>(
    `INSERT INTO words (lemma, frequency_rank, list_source_id)
     VALUES ('zz209word', (SELECT COALESCE(max(frequency_rank), 0) + 1 FROM words), $1) RETURNING id`,
    [sourceId],
  );
  const id = made.rows[0]?.id;
  t.after(async () => {
    await pool.query('DELETE FROM words WHERE id = $1', [id]);
    await pool.query('DELETE FROM import_sources WHERE id = $1', [sourceId]);
    await pool.end();
  });
  let day = '2026-11-27';
  await withApi(
    pool,
    async (call) => {
      const due = async (on?: string) =>
        (await call(`/api/word-reviews/due${on ? `?day=${on}` : ''}`)).data.words as {
          id: number;
        }[];
      assert.equal(
        (await due('2099-01-01')).some((word) => word.id === id),
        false,
      );

      const first = await call(`/api/words/${id}/review`, {
        method: 'PUT',
        body: { answer: 'know' },
      });
      assert.deepEqual(first.data.review, {
        wordId: id,
        step: 1,
        nextReviewOn: '2026-11-30',
        lastAnswer: 'know',
      });
      assert.equal(
        (await due()).some((word) => word.id === id),
        false,
      );
      assert.equal(
        (await due('2026-11-30')).some((word) => word.id === id),
        true,
      );

      day = '2026-11-30';
      const unsure = await call(`/api/words/${id}/review`, {
        method: 'PUT',
        body: { answer: 'unsure' },
      });
      assert.equal((unsure.data.review as { nextReviewOn: string }).nextReviewOn, '2026-12-03');
      const reset = await call(`/api/words/${id}/review`, {
        method: 'PUT',
        body: { answer: 'dontKnow' },
      });
      assert.deepEqual(reset.data.review, {
        wordId: id,
        step: 0,
        nextReviewOn: '2026-12-01',
        lastAnswer: 'dontKnow',
      });
      assert.equal(
        (await due('2026-12-01')).some((word) => word.id === id),
        true,
      );
    },
    { today: () => day },
  );
});
