import assert from 'node:assert/strict';
import { test } from 'node:test';

import { politeGet } from '../src/polite-fetch.js';

test('politeGet waits the gap even when fetch throws', async (t) => {
  const waits: number[] = [];
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(
    politeGet('http://127.0.0.1:1/x', {
      name: 'Test',
      gap: 1100,
      sleep: async (ms) => {
        waits.push(ms);
      },
    }),
    TypeError,
  );
  assert.deepEqual(waits, [1100]);
});

test('politeGet cancels the body of a failed response', async (t) => {
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 500 }));
  await assert.rejects(
    politeGet('http://127.0.0.1:1/x', { name: 'Test', gap: 1, sleep: async () => {} }),
    /Test 500/,
  );
  assert.equal(cancelled, true);
});
