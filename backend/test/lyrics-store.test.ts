import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool, PoolClient } from 'pg';

import { inTransaction } from '../src/lyrics-store.js';

// A fake pool whose ROLLBACK fails, like a connection that dropped in the middle of a script.
function fakePool(failRollback: boolean) {
  const released: unknown[] = [];
  const client = {
    query: async (text: string) => {
      if (failRollback && text === 'ROLLBACK') throw new Error('connection lost');
      return { rows: [] };
    },
    release: (destroy?: unknown) => released.push(destroy),
  };
  return { pool: { connect: async () => client } as unknown as Pool, released };
}

test('a failing ROLLBACK keeps the original error and destroys the client', async () => {
  const { pool, released } = fakePool(true);
  await assert.rejects(
    inTransaction(pool, async () => {
      throw new Error('the real problem');
    }),
    { message: 'the real problem' },
  );
  assert.deepEqual(released, [true]);
});

test('a working ROLLBACK returns the client to the pool', async () => {
  const { pool, released } = fakePool(false);
  await assert.rejects(
    inTransaction(pool, async () => {
      throw new Error('the real problem');
    }),
    { message: 'the real problem' },
  );
  assert.deepEqual(released, [false]);
});

test('inTransaction returns the value of the work', async () => {
  const { pool } = fakePool(false);
  const value = await inTransaction(pool, async (_client: PoolClient) => 42);
  assert.equal(value, 42);
});
