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
  ]);
});

test('invalid input is a Korean 400 and never reaches the database', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  const cases: [unknown, string][] = [
    [undefined, '자격증 이름을 입력해 주세요'],
    [{ name: '   ', category: 'dev' }, '자격증 이름을 입력해 주세요'],
    [{ name: 'a'.repeat(201), category: 'dev' }, '자격증 이름은 200자 이하로 입력해 주세요'],
    [{ name: '토익', category: 'music' }, '분류는 영어, 개발, 생활 중 하나여야 합니다'],
    [{ name: '토익', category: 'english', status: 'done' }, '상태는'],
    [{ name: '토익', category: 'english', targetScore: 1.5 }, '목표 점수는 정수여야 합니다'],
    [{ name: '토익', category: 'english', targetScore: -1 }, '목표 점수는 0 이상이어야 합니다'],
    [{ name: '토익', category: 'english', targetExamDate: '2026-02-30' }, '실제 날짜가 아닙니다'],
    [{ name: '토익', category: 'english', targetExamDate: '2026/12/13' }, 'YYYY-MM-DD'],
    [
      { name: '토익', category: 'english', targetExamDate: '0000-01-01' },
      '1900-01-01 이후여야 합니다',
    ],
    [[], '요청 본문은 JSON 객체여야 합니다'],
    // A bare JSON string never reaches the route: express.json() (strict) rejects it first.
    ['토익', '요청 본문의 JSON 형식이 올바르지 않습니다'],
    [{ name: '토익', category: 'english', validityKind: 'months' }, '개월 수를 입력해 주세요'],
    [
      { name: '토익', category: 'english', validityKind: 'none', validityMonths: 24 },
      '개월 수를 비워 주세요',
    ],
    [
      { name: '토익', category: 'english', validityKind: 'months', validityMonths: 0 },
      '유효기간 개월 수는 1 이상이어야 합니다',
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

test('a missing goal is a Korean 404 for read, update and delete', async () => {
  const { pool } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    const body = { name: '토익', category: 'english' };
    for (const init of [{}, { method: 'PUT', body }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/certifications/99', init);
      assert.equal(status, 404);
      assert.equal(data.error, '자격증 목표를 찾을 수 없습니다');
    }
  });
});

test('a malformed id is a Korean 400', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  await withApi(pool, async (call) => {
    for (const id of ['abc', '0', '01', '1e3']) {
      const { status, data } = await call(`/api/certifications/${id}`, { method: 'DELETE' });
      assert.equal(status, 400);
      assert.equal(data.error, '자격증 목표 ID가 올바르지 않습니다');
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
    7,
  ]);
  assert.deepEqual(queries[1]?.values, [7]);
});
