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

const stageRow = {
  id: '4',
  certificationId: '7',
  title: '1주차',
  position: 1,
  startDate: null,
  endDate: null,
};
const taskRow = {
  id: '9',
  stageId: '4',
  title: '기출 풀기',
  position: 1,
  dueDate: '2026-11-01',
  daysUntilDue: 2,
  completedAt: null,
};
const today = () => '2026-10-30';

test('the plan nests each stage’s tasks and answers numeric ids', async () => {
  const other = { ...taskRow, id: '10', stageId: '5' };
  const { pool, queries } = fakePool(({ text }) => {
    if (text.startsWith('SELECT 1')) return { rows: [{}], rowCount: 1 };
    if (text.includes('study_tasks')) return { rows: [taskRow, other] };
    return { rows: [stageRow, { ...stageRow, id: '5', position: 2 }] };
  });
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/certifications/7/plan');
      assert.equal(status, 200);
      assert.deepEqual(data, {
        today: '2026-10-30',
        stages: [
          {
            ...stageRow,
            id: 4,
            certificationId: 7,
            tasks: [{ ...taskRow, id: 9, stageId: 4 }],
          },
          {
            ...stageRow,
            id: 5,
            position: 2,
            certificationId: 7,
            tasks: [{ ...other, id: 10, stageId: 5 }],
          },
        ],
      });
    },
    { today },
  );
  assert.deepEqual(queries[2]?.values, ['2026-10-30', 7]);
});

test('the plan of a goal that does not exist is a 404', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/certifications/404/plan');
    assert.equal(status, 404);
    assert.deepEqual(data, { error: '자격증 목표를 찾을 수 없습니다' });
  });
  assert.equal(queries.length, 1);
});

test('today’s tasks send the service date and name their goal', async () => {
  const row = { ...taskRow, certificationId: '7', certificationName: '토익', daysUntilDue: -1 };
  const { pool, queries } = fakePool(() => ({ rows: [row] }));
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/study-tasks/today');
      assert.equal(status, 200);
      assert.deepEqual(data, {
        today: '2026-10-30',
        tasks: [{ ...row, id: 9, stageId: 4, certificationId: 7 }],
      });
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, ['2026-10-30']);
});

test('new stages and tasks trim the title and default their dates to null', async () => {
  const { pool, queries } = fakePool(({ text }) => ({
    rows: [text.includes('study_tasks') ? taskRow : stageRow],
  }));
  await withApi(
    pool,
    async (call) => {
      const stage = await call('/api/certifications/7/stages', {
        method: 'POST',
        body: { title: ' 1주차 ' },
      });
      assert.equal(stage.status, 201);
      assert.deepEqual(stage.data, {
        stage: { ...stageRow, id: 4, certificationId: 7, tasks: [] },
      });
      const task = await call('/api/study-stages/4/tasks', {
        method: 'POST',
        body: { title: ' 기출 풀기 ' },
      });
      assert.equal(task.status, 201);
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, [7, '1주차', null, null]);
  assert.deepEqual(queries[1]?.values, [4, '기출 풀기', null, '2026-10-30']);
});

test('invalid input is a Korean 400 and never reaches the database', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  const cases: [string, unknown, string][] = [
    ['/api/certifications/7/stages', {}, '단계 이름을 입력해 주세요'],
    ['/api/certifications/7/stages', { title: '   ' }, '단계 이름을 입력해 주세요'],
    ['/api/certifications/7/stages', { title: 'x'.repeat(201) }, '200자 이하'],
    ['/api/certifications/7/stages', { title: 'a', startDate: '2026-02-30' }, '시작일이 실제 날짜'],
    [
      '/api/certifications/7/stages',
      { title: 'a', startDate: '2026-02-02', endDate: '2026-02-01' },
      '종료일은 시작일 이후',
    ],
    ['/api/study-stages/4/tasks', {}, '할 일을 입력해 주세요'],
    ['/api/study-stages/4/tasks', { title: 'a', dueDate: '2026/11/01' }, '마감일은 YYYY-MM-DD'],
    ['/api/study-stages/4/tasks', [1], '요청 본문은 JSON 객체여야 합니다'],
  ];
  await withApi(pool, async (call) => {
    for (const [path, body, message] of cases) {
      const { status, data } = await call(path, { method: 'POST', body });
      assert.equal(status, 400, JSON.stringify(body));
      assert.match(String(data.error), new RegExp(message));
    }
    const completion = await call('/api/study-tasks/9/completion', {
      method: 'PATCH',
      body: { completed: 'yes' },
    });
    assert.equal(completion.status, 400);
    assert.match(String(completion.data.error), /완료 여부/);
  });
  assert.equal(queries.length, 0);
});

test('missing rows are a 404 naming what is missing, and a bad id a 400', async () => {
  const { pool } = fakePool(() => ({ rows: [], rowCount: 0 }));
  const title = { title: 'a' };
  await withApi(pool, async (call) => {
    const missing: [string, string, object | undefined, string][] = [
      ['POST', '/api/certifications/7/stages', title, '자격증 목표를 찾을 수 없습니다'],
      ['PUT', '/api/study-stages/4', title, '공부 단계를 찾을 수 없습니다'],
      ['DELETE', '/api/study-stages/4', undefined, '공부 단계를 찾을 수 없습니다'],
      ['POST', '/api/study-stages/4/tasks', title, '공부 단계를 찾을 수 없습니다'],
      ['PUT', '/api/study-tasks/9', title, '할 일을 찾을 수 없습니다'],
      ['PATCH', '/api/study-tasks/9/completion', { completed: true }, '할 일을 찾을 수 없습니다'],
      ['DELETE', '/api/study-tasks/9', undefined, '할 일을 찾을 수 없습니다'],
    ];
    for (const [method, path, body, error] of missing) {
      const { status, data } = await call(path, { method, body });
      assert.equal(status, 404, `${method} ${path}`);
      assert.deepEqual(data, { error });
    }
    const badId = await call('/api/study-tasks/abc', { method: 'DELETE' });
    assert.equal(badId.status, 400);
    assert.deepEqual(badId.data, { error: '할 일 ID가 올바르지 않습니다' });
  });
});

test('deleting answers 204 and completion passes the choice through', async () => {
  const { pool, queries } = fakePool(({ text }) => ({ rows: [taskRow], rowCount: 1, text }));
  await withApi(
    pool,
    async (call) => {
      assert.equal((await call('/api/study-stages/4', { method: 'DELETE' })).status, 204);
      assert.equal((await call('/api/study-tasks/9', { method: 'DELETE' })).status, 204);
      const done = await call('/api/study-tasks/9/completion', {
        method: 'PATCH',
        body: { completed: true },
      });
      assert.equal(done.status, 200);
      assert.deepEqual(done.data, { task: { ...taskRow, id: 9, stageId: 4 } });
    },
    { today },
  );
  assert.deepEqual(queries[2]?.values, [9, true, '2026-10-30']);
});
