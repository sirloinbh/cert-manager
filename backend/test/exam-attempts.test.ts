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
    assert.deepEqual(data, { error: '자격증 목표를 찾을 수 없습니다' });
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
    [{}, '시험일은 YYYY-MM-DD'],
    [{ examDate: '2026-02-30' }, '시험일이 실제 날짜가 아닙니다'],
    [{ examDate: '2026-03-15', outcome: 'done' }, '결과는'],
    [{ examDate: '2026-03-15', outcome: 'scored', score: 1.5 }, '점수는 정수여야 합니다'],
    [{ examDate: '2026-03-15', outcome: 'scored', score: -1 }, '점수는 0 이상이어야 합니다'],
    [{ examDate: '2026-03-15', score: 900 }, '결과 전에는 점수와 등급을 비워 주세요'],
    [{ examDate: '2026-03-15', grade: 'IH' }, '결과 전에는 점수와 등급을 비워 주세요'],
    [
      { examDate: '2026-03-15', outcome: 'passed', expiresOn: '2026-03-14' },
      '만료일은 시험일 이후여야 합니다',
    ],
    [[1], '요청 본문은 JSON 객체여야 합니다'],
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

test('a missing goal or attempt is a 404, and a bad id a 400', async () => {
  const { pool } = fakePool(() => ({ rows: [], rowCount: 0 }));
  const body = { examDate: '2026-03-15' };
  await withApi(pool, async (call) => {
    const create = await call(path, { method: 'POST', body });
    assert.equal(create.status, 404);
    assert.deepEqual(create.data, { error: '자격증 목표를 찾을 수 없습니다' });
    const replace = await call(`${path}/9`, { method: 'PUT', body });
    assert.equal(replace.status, 404);
    assert.deepEqual(replace.data, { error: '응시 기록을 찾을 수 없습니다' });
    const remove = await call(`${path}/9`, { method: 'DELETE' });
    assert.equal(remove.status, 404);
    const badId = await call(`${path}/abc`, { method: 'DELETE' });
    assert.equal(badId.status, 400);
    assert.deepEqual(badId.data, { error: '응시 기록 ID가 올바르지 않습니다' });
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
