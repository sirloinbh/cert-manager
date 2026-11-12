import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

type Query = { text: string; values: unknown[] };

// A fake pool that records each query and answers with the given rows.
function fakePool(answer: (query: Query) => { rows: unknown[]; rowCount?: number }) {
  const queries: Query[] = [];
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      queries.push({ text, values });
      return answer({ text, values });
    },
  } as unknown as Pool;
  return { pool, queries };
}

const row = {
  id: '3',
  certificationId: '7',
  examDate: '2026-03-15',
  outcome: 'scored',
  score: 900,
  grade: '',
  expiresOn: '2028-03-15',
  daysUntilExpiry: 502,
  memo: '',
};
const attempt = { ...row, id: 3, certificationId: 7 };

const today = () => '2026-10-30';
const path = '/api/certifications/7/attempts';

// values() order in the route: goal, exam date, outcome, score, grade, expiry, expiry given, memo, today.
const fieldsOf = (values: unknown[]) => ({
  score: values[3],
  grade: values[4],
  expiresOn: values[5],
  expiryGiven: values[6],
});

test('the list checks the goal, then answers its attempts with numeric ids', async () => {
  const { pool, queries } = fakePool(({ text }) =>
    text.startsWith('SELECT 1') ? { rows: [{}], rowCount: 1 } : { rows: [row] },
  );
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call(path);
      assert.equal(status, 200);
      assert.deepEqual(data, { today: '2026-10-30', attempts: [attempt] });
    },
    { today },
  );
  assert.deepEqual(queries[1]?.values, ['2026-10-30', 7]);
});

test('the list of a goal that does not exist is a 404', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/certifications/404/attempts');
    assert.equal(status, 404);
    assert.deepEqual(data, { error: 'Certification goal not found' });
  });
  assert.equal(queries.length, 1);
});

test('omitting the expiry asks the database for the default; null and a date are kept', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [row] }));
  const base = { examDate: '2026-03-15', outcome: 'scored', score: 900 };
  await withApi(
    pool,
    async (call) => {
      const created = await call(path, { method: 'POST', body: base });
      assert.equal(created.status, 201);
      assert.deepEqual(created.data, { attempt });
      await call(path, { method: 'POST', body: { ...base, expiresOn: null } });
      await call(path, { method: 'POST', body: { ...base, expiresOn: '2027-01-01' } });
    },
    { today },
  );
  assert.deepEqual(fieldsOf(queries[0]?.values ?? []), {
    score: 900,
    grade: '',
    expiresOn: null,
    expiryGiven: false,
  });
  assert.equal(fieldsOf(queries[1]?.values ?? []).expiryGiven, true);
  assert.equal(fieldsOf(queries[1]?.values ?? []).expiresOn, null);
  assert.equal(fieldsOf(queries[2]?.values ?? []).expiresOn, '2027-01-01');
  assert.equal(queries[0]?.values[8], '2026-10-30');
});

test('an attempt waiting for its result keeps no grade to know', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [row] }));
  await withApi(pool, async (call) => {
    const { status } = await call(path, { method: 'POST', body: { examDate: '2026-12-13' } });
    assert.equal(status, 201);
  });
  assert.equal(queries[0]?.values[2], 'waiting');
  assert.equal(fieldsOf(queries[0]?.values ?? []).score, null);
  assert.equal(fieldsOf(queries[0]?.values ?? []).grade, null);
});

test('invalid attempts are a Korean 400 and never reach the database', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  const cases: [unknown, string][] = [
    [{}, 'Exam date must be in YYYY-MM-DD'],
    [{ examDate: '2026-02-30' }, 'Exam date is not a real date'],
    [{ examDate: '2026-03-15', outcome: 'done' }, 'Outcome must be'],
    [{ examDate: '2026-03-15', outcome: 'scored', score: 1.5 }, 'Score must be a whole number'],
    [{ examDate: '2026-03-15', outcome: 'scored', score: -1 }, 'Score must be 0 or more'],
    [
      { examDate: '2026-03-15', score: 900 },
      'Leave the score and grade empty while the outcome is Pending',
    ],
    [
      { examDate: '2026-03-15', grade: 'IH' },
      'Leave the score and grade empty while the outcome is Pending',
    ],
    [
      { examDate: '2026-03-15', outcome: 'passed', expiresOn: '2026-03-14' },
      'Expiry date must be after the exam date',
    ],
    [[1], 'Request body must be a JSON object'],
  ];
  await withApi(pool, async (call) => {
    for (const [body, message] of cases) {
      const { status, data } = await call(path, { method: 'POST', body });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(String(data.error), new RegExp(message));
    }
  });
  assert.equal(queries.length, 0);
});

// The whole answer, not a part of it: which messages come together is decided by zod's rules for carrying on after a failure.
test('each invalid attempt answers exactly these messages', async () => {
  const { pool } = fakePool(() => ({ rows: [] }));
  const examDate = '2026-03-15';
  const cases: [unknown, string][] = [
    [{ examDate, outcome: 'scored', score: 'x' }, 'Score must be a number'],
    [{ examDate, outcome: 'scored', score: 1.5 }, 'Score must be a whole number'],
    [{ examDate, outcome: 'scored', score: 100001 }, 'Score must be 100000 or less'],
    // A score that is not an integer stops the other checks, so this no longer adds "0 or more".
    [{ examDate, outcome: 'scored', score: -1.5 }, 'Score must be a whole number'],
    // Nor does a fractional score reach the rule across fields.
    [{ examDate, score: 1.5 }, 'Score must be a whole number'],
    [{ examDate, score: 900 }, 'Leave the score and grade empty while the outcome is Pending'],
    [{ examDate: 'abc' }, 'Exam date must be in YYYY-MM-DD format, Exam date is not a real date'],
    // After the exam date, so the rule across fields stays out of it: whether that rule runs after
    // this failure differs between zod 3.25.76 and 4.6.7.
    [{ examDate, expiresOn: '2026-04-31' }, 'Expiry date is not a real date'],
    [
      { examDate, grade: 'x'.repeat(201) },
      'Grade must be 200 characters or fewer, Leave the score and grade empty while the outcome is Pending',
    ],
    [[1], 'Request body must be a JSON object'],
  ];
  await withApi(pool, async (call) => {
    for (const [body, message] of cases) {
      const { status, data } = await call(path, { method: 'POST', body });
      assert.equal(status, 400, JSON.stringify(body));
      assert.deepEqual(data, { error: message }, JSON.stringify(body));
    }
  });
});

test('a missing goal or attempt is a 404, and a bad id a 400', async () => {
  const { pool } = fakePool(() => ({ rows: [], rowCount: 0 }));
  const body = { examDate: '2026-03-15' };
  await withApi(pool, async (call) => {
    const create = await call(path, { method: 'POST', body });
    assert.equal(create.status, 404);
    assert.deepEqual(create.data, { error: 'Certification goal not found' });
    const replace = await call(`${path}/9`, { method: 'PUT', body });
    assert.equal(replace.status, 404);
    assert.deepEqual(replace.data, { error: 'Exam attempt not found' });
    const remove = await call(`${path}/9`, { method: 'DELETE' });
    assert.equal(remove.status, 404);
    const badId = await call(`${path}/abc`, { method: 'DELETE' });
    assert.equal(badId.status, 400);
    assert.deepEqual(badId.data, { error: 'Invalid exam attempt ID' });
  });
});

test('deleting an attempt answers 204 and only touches that goal', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [], rowCount: 1 }));
  await withApi(pool, async (call) => {
    const { status } = await call(`${path}/3`, { method: 'DELETE' });
    assert.equal(status, 204);
  });
  assert.deepEqual(queries[0]?.values, [3, 7]);
});
