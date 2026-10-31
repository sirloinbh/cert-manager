import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

type Query = { text: string; values: unknown[] };

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
  title: '실기 접수',
  note: '',
  linkUrl: 'https://www.q-net.or.kr/',
  remindFrom: '2027-03-08',
  dueDate: '2027-03-22',
  daysUntilDue: 14,
  completedAt: null,
};
const action = { ...row, id: 3 };
const today = () => '2027-03-08';
const path = '/api/user-actions';
const valid = { title: '실기 접수', remindFrom: '2027-03-08' };

test('the list asks for what is due today and answers numeric ids', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [row] }));
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call(path);
      assert.equal(status, 200);
      assert.deepEqual(data, { today: '2027-03-08', actions: [action] });
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, ['2027-03-08']);
  assert.match(queries[0]?.text ?? '', /completed_at IS NULL AND remind_from <= \$1::date/);
});

test('a new action fills omitted fields and answers 201', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [row] }));
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call(path, { method: 'POST', body: valid });
      assert.equal(status, 201);
      assert.deepEqual(data, { action });
    },
    { today },
  );
  assert.deepEqual(queries[0]?.values, ['실기 접수', '', '', '2027-03-08', null, '2027-03-08']);
});

test('invalid actions are a Korean 400 and never reach the database', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [] }));
  const cases: [unknown, string][] = [
    [{ remindFrom: '2027-03-08' }, '할 일을 입력해 주세요'],
    [{ ...valid, title: '   ' }, '할 일을 입력해 주세요'],
    [{ ...valid, title: 'a'.repeat(201) }, '할 일은 200자 이하로 입력해 주세요'],
    [{ title: '실기 접수' }, '알림 시작일은 YYYY-MM-DD'],
    [{ ...valid, remindFrom: '2027-02-30' }, '알림 시작일이 실제 날짜가 아닙니다'],
    [{ ...valid, dueDate: '2027-03-07' }, '마감일은 알림 시작일 이후여야 합니다'],
    [{ ...valid, linkUrl: 'javascript:alert(1)' }, '링크는 http 또는 https 주소여야 합니다'],
    [{ ...valid, linkUrl: 'www.q-net.or.kr' }, '링크는 http 또는 https 주소여야 합니다'],
    [{ ...valid, linkUrl: 'https://' }, '링크는 http 또는 https 주소여야 합니다'],
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

test('completion needs a boolean, and a missing action is a 404', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [], rowCount: 0 }));
  await withApi(pool, async (call) => {
    const bad = await call(`${path}/3/completion`, { method: 'PUT', body: { completed: 'yes' } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.data, { error: '완료 여부는 true나 false여야 합니다' });
    assert.equal(queries.length, 0);

    const missing = await call(`${path}/9/completion`, {
      method: 'PUT',
      body: { completed: true },
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.data, { error: '직접 할 일을 찾을 수 없습니다' });
    const removed = await call(`${path}/9`, { method: 'DELETE' });
    assert.equal(removed.status, 404);
    const badId = await call(`${path}/abc`, { method: 'DELETE' });
    assert.equal(badId.status, 400);
    assert.deepEqual(badId.data, { error: '직접 할 일 ID가 올바르지 않습니다' });
  });
});

test('deleting an action answers 204', async () => {
  const { pool, queries } = fakePool(() => ({ rows: [], rowCount: 1 }));
  await withApi(pool, async (call) => {
    assert.equal((await call(`${path}/3`, { method: 'DELETE' })).status, 204);
  });
  assert.deepEqual(queries[0]?.values, [3]);
});
