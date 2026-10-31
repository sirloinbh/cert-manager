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

test('requests over the limit get a Korean 429 and never reach the database', async () => {
  const { pool, state } = countingPool();
  await withApi(
    pool,
    async (call) => {
      assert.equal((await call('/api/health')).status, 200);
      assert.equal((await call('/api/health')).status, 200);
      const refused = await call('/api/health');
      assert.equal(refused.status, 429);
      assert.deepEqual(refused.data, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' });
    },
    { rateLimit: { limit: 2 } },
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
    { rateLimit: { limit: 1 } },
  );
  assert.equal(state.queries, 1);
});

test('a new window allows requests again', async () => {
  const { pool } = countingPool();
  await withApi(
    pool,
    async (call) => {
      assert.equal((await call('/api/health')).status, 200);
      assert.equal((await call('/api/health')).status, 429);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      assert.equal((await call('/api/health')).status, 200);
    },
    // Long enough that a slow machine still makes the second request inside the window.
    { rateLimit: { limit: 1, windowMs: 1000 } },
  );
});

test('the default limit is 1200 requests a minute', async () => {
  const { pool } = countingPool();
  await withApi(pool, async (call) => {
    const { headers } = await call('/api/health');
    assert.match(headers.get('ratelimit-policy') ?? '', /q=1200; w=60/);
  });
});

test('a forged forwarding header does not get around the limit', async () => {
  const { pool, state } = countingPool();
  await withApi(
    pool,
    async (call) => {
      const from = (address: string) =>
        call('/api/health', {
          headers: { 'x-forwarded-for': address, forwarded: `for=${address}` },
        });
      assert.equal((await from('203.0.113.1')).status, 200);
      assert.equal((await from('203.0.113.2')).status, 429);
    },
    { rateLimit: { limit: 1 } },
  );
  assert.equal(state.queries, 1);
});
