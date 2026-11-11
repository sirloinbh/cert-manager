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
  id: '7',
  name: '토익',
  category: 'english',
  issuer: 'YBM',
  status: 'planned',
  goalText: '900점 이상',
  targetScore: 900,
  targetExamDate: '2026-12-13',
  daysUntilExam: 44,
  validityKind: 'months',
  validityMonths: 24,
  memo: '',
  gradeScale: 'none',
  targetGrade: null,
};

const today = () => '2026-10-30';

test('the list sends the service date and answers numeric ids under named keys', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [row] }));
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/certifications');
      assert.equal(status, 200);
      assert.deepEqual(data, { today: '2026-10-30', certifications: [{ ...row, id: 7 }] });
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, ['2026-10-30']);
});

test('a new goal fills omitted optional fields with their defaults and answers 201', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [{ ...row, id: '8' }] }));
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/certifications', {
        method: 'POST',
        body: { name: '  정보처리기사 ', category: 'dev' },
      });
      assert.equal(status, 201);
      assert.equal((data.certification as { id: number }).id, 8);
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, [
    '2026-10-30',
    '정보처리기사',
    'dev',
    '',
    'planned',
    '',
    null,
    null,
    'unknown',
    null,
    '',
    'none',
    null,
  ]);
});

test('invalid input is a Korean 400 and never reaches the database', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  const cases: [unknown, string][] = [
    [undefined, 'Certification name is required'],
    [{ name: '   ', category: 'dev' }, 'Certification name is required'],
    [
      { name: 'a'.repeat(201), category: 'dev' },
      'Certification name must be 200 characters or fewer',
    ],
    [{ name: '토익', category: 'music' }, 'Category must be English, Development, or Life'],
    [{ name: '토익', category: 'english', status: 'done' }, 'Status must be'],
    [
      { name: '토익', category: 'english', targetScore: 1.5 },
      'Target score must be a whole number',
    ],
    [{ name: '토익', category: 'english', targetScore: -1 }, 'Target score must be 0 or more'],
    [{ name: '토익', category: 'english', targetExamDate: '2026-02-30' }, 'is not a real date'],
    [{ name: '토익', category: 'english', targetExamDate: '2026/12/13' }, 'YYYY-MM-DD'],
    [
      { name: '토익', category: 'english', targetExamDate: '0000-01-01' },
      'must be on or after 1900-01-01',
    ],
    [[], 'Request body must be a JSON object'],
    // A bare JSON string never reaches the route: express.json() (strict) rejects it first.
    ['토익', 'Request body is not valid JSON'],
    [{ name: '토익', category: 'english', validityKind: 'months' }, 'Enter the validity months'],
    [
      { name: '토익', category: 'english', validityKind: 'none', validityMonths: 24 },
      'Leave the validity months empty',
    ],
    [
      { name: '토익', category: 'english', validityKind: 'months', validityMonths: 0 },
      'Validity months must be 1 or more',
    ],
  ];
  await withApi(pool, async (call) => {
    for (const [body, message] of cases) {
      const { status, data } = await call('/api/certifications', { method: 'POST', body });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(String(data.error), new RegExp(message), JSON.stringify(body));
    }
  });
  assert.equal(queries.length, 0);
});

test('an array sent as text answers only the type message', async () => {
  const { pool } = fakePool(() => ({ rows: [] }));
  const cases: [unknown, string][] = [
    [{ name: [], category: 'dev' }, 'Certification name is required'],
    [{ name: Array(201).fill(0), category: 'dev' }, 'Certification name is required'],
    [{ name: 'n', category: 'dev', issuer: Array(201).fill(0) }, 'Issuer must be text'],
  ];
  await withApi(pool, async (call) => {
    for (const [body, message] of cases) {
      const { status, data } = await call('/api/certifications', { method: 'POST', body });
      assert.equal(status, 400);
      assert.deepEqual(data, { error: message });
    }
  });
});

test('a missing goal is a Korean 404 for read, update and delete', async () => {
  const { pool } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    const body = { name: '토익', category: 'english' };
    for (const init of [{}, { method: 'PUT', body }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/certifications/99', init);
      assert.equal(status, 404);
      assert.equal(data.error, 'Certification goal not found');
    }
  });
});

test('a malformed id is a Korean 400', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  await withApi(pool, async (call) => {
    for (const id of ['abc', '0', '01', '1e3']) {
      const { status, data } = await call(`/api/certifications/${id}`, { method: 'DELETE' });
      assert.equal(status, 400);
      assert.equal(data.error, 'Invalid certification goal ID');
    }
  });
  assert.equal(queries.length, 0);
});

test('update replaces every field of the goal and delete answers 204', async () => {
  const { pool, queries } = fakePool(({ text }) =>
    text.startsWith('DELETE') ? { rows: [], rowCount: 1 } : { rows: [row], rowCount: 1 },
  );
  await withApi(
    pool,
    async (call) => {
      const put = await call('/api/certifications/7', {
        method: 'PUT',
        body: {
          name: '토익',
          category: 'english',
          issuer: 'YBM',
          status: 'studying',
          goalText: '900점 이상',
          targetScore: 900,
          targetExamDate: '2026-12-13',
          validityKind: 'months',
          validityMonths: 24,
          memo: '접수 11월 초',
          gradeScale: 'toeic',
          targetGrade: 'B2',
        },
      });
      assert.equal(put.status, 200);
      const deleted = await call('/api/certifications/7', { method: 'DELETE' });
      assert.equal(deleted.status, 204);
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, [
    '2026-10-30',
    '토익',
    'english',
    'YBM',
    'studying',
    '900점 이상',
    900,
    '2026-12-13',
    'months',
    24,
    '접수 11월 초',
    'toeic',
    'B2',
    7,
  ]);
  assert.deepEqual(queries[1]?.values, [7]);
});
