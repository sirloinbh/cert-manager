import assert from 'node:assert/strict';
import { test } from 'node:test';

import { named } from '../src/named-params.js';

test('named parameters are numbered by first use and reused', () => {
  const { text, values } = named('UPDATE t SET a = :b::text, c = :a, d = :b WHERE id = :id', {
    id: 7,
    a: 1,
    b: 'x',
  });
  assert.equal(text, 'UPDATE t SET a = $1::text, c = $2, d = $1 WHERE id = $3');
  assert.deepEqual(values, ['x', 1, 7]);
});

test('casts are not parameters and an unknown name throws', () => {
  assert.equal(named("SELECT now()::date, 'a'", {}).text, "SELECT now()::date, 'a'");
  assert.throws(() => named('SELECT :missing', {}), /Missing SQL parameter :missing/);
});
