import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

function countingPool() {
  const state = { queries: 0 };
  const pool = {
    query: async () => {
      state.queries += 1;
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
  return { pool, state };
}

test('requests over the limit get a 429 and never reach the database', async () => {
  const { pool, state } = countingPool();
  await withApi(
    pool,
    async (call) => {
      assert.equal((await call('/api/certifications')).status, 200);
      assert.equal((await call('/api/certifications')).status, 200);
      const refused = await call('/api/certifications');
      assert.equal(refused.status, 429);
      assert.deepEqual(refused.data, { error: 'Too many requests. Try again in a minute.' });
    },
    { requestsPerMinute: 2 },
  );
  assert.equal(state.queries, 2);
});

test('the limit covers feature routes and writes, counted together', async () => {
  const { pool, state } = countingPool();
  await withApi(
    pool,
    async (call) => {
      assert.equal((await call('/api/certifications')).status, 200);
      const refused = await call('/api/certifications', {
        method: 'POST',
        body: { name: '토익', category: 'english' },
      });
      assert.equal(refused.status, 429);
    },
    { requestsPerMinute: 1 },
  );
  assert.equal(state.queries, 1);
});

test('the default limit is 600 requests a minute', async () => {
  const { pool } = countingPool();
  await withApi(pool, async (call) => {
    const { headers } = await call('/api/certifications');
    assert.match(headers.get('ratelimit') ?? '', /limit=600/);
  });
});

test('the health check is not counted, and the client is the last X-Forwarded-For entry', async () => {
  const { pool } = countingPool();
  await withApi(
    pool,
    async (call) => {
      const from = (address: string, path = '/api/certifications') =>
        call(path, { headers: { 'x-forwarded-for': `198.51.100.9, ${address}` } });
      assert.equal((await from('203.0.113.1', '/api/health')).status, 200);
      assert.equal((await from('203.0.113.1', '/api/health')).status, 200);
      assert.equal((await from('203.0.113.1')).status, 200);
      assert.equal((await from('203.0.113.1')).status, 429);
      assert.equal((await from('203.0.113.2')).status, 200);
    },
    { requestsPerMinute: 1 },
  );
});
