import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

type Query = { text: string; values?: unknown[] };

// A fake connection that records every query. `fail` makes the INSERT that contains this text throw.
function fakePool(options: { fail?: string } = {}) {
  const queries: Query[] = [];
  let connected = 0;
  let nextId = 100;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (options.fail && text.includes(options.fail)) throw new Error('boom');
      return {
        rows: /^\s*(SELECT id|INSERT)/.test(text)
          ? text.includes('INSERT')
            ? [{ id: nextId++ }]
            : []
          : [],
      };
    },
    release: () => undefined,
  };
  const pool = {
    connect: async () => {
      connected += 1;
      return client;
    },
  } as unknown as Pool;
  return { pool, queries, connected: () => connected };
}

const stamp = '2027-01-01T00:00:00.000Z';
const goal = {
  id: 1,
  name: 'TOEIC',
  category: 'english',
  issuer: 'ETS',
  status: 'studying',
  goalText: '',
  targetScore: 900,
  targetExamDate: '2027-04-10',
  validityKind: 'months',
  validityMonths: 24,
  gradeScale: 'toeic',
  targetGrade: null,
  memo: '',
  createdAt: stamp,
  updatedAt: stamp,
};
const stage = {
  id: 5,
  certificationId: 1,
  title: 'Basics',
  position: 1,
  startDate: null,
  endDate: null,
  createdAt: stamp,
  updatedAt: stamp,
};
const task = {
  id: 9,
  stageId: 5,
  title: 'Unit 1',
  position: 1,
  dueDate: '2027-03-01',
  completedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
};

const file = (tables: Record<string, unknown[]> = {}, extra: Record<string, unknown> = {}) => ({
  version: 1,
  exportedAt: stamp,
  tables: {
    certifications: [goal],
    examAttempts: [],
    studyStages: [stage],
    studyTasks: [task],
    userActions: [],
    ...tables,
  },
  ...extra,
});

const path = '/api/data-transfer/import';

// A bad file is refused before any connection is taken, so nothing can have changed.
async function refused(body: unknown, message: RegExp) {
  const { pool, connected } = fakePool();
  await withApi(pool, async (call) => {
    const { status, data } = await call(path, { method: 'POST', body });
    assert.equal(status, 400, JSON.stringify(data));
    assert.match(String(data.error), message);
  });
  assert.equal(connected(), 0);
}

test('a file of another version is refused', () =>
  refused(file({}, { version: 2 }), /unsupported version/));

test('a file without tables is refused', () =>
  refused({ version: 1, exportedAt: stamp }, /no tables/));

test('a row that breaks a rule of the app is refused with the same message', () =>
  refused(file({ certifications: [{ ...goal, validityMonths: null }] }), /validity months/i));

test('a date that is not YYYY-MM-DD is refused', () =>
  refused(file({ certifications: [{ ...goal, targetExamDate: '2027/04/10' }] }), /YYYY-MM-DD/));

test('a row that points at a row missing from the file is refused', async () => {
  await refused(file({ studyStages: [{ ...stage, certificationId: 99 }] }), /not in the file/);
  await refused(file({ studyTasks: [{ ...task, stageId: 99 }] }), /not in the file/);
});

test('an ID or a position used twice is refused', async () => {
  await refused(file({ certifications: [goal, goal] }), /appears twice/);
  await refused(
    file({ studyStages: [stage, { ...stage, id: 6, title: 'Other' }] }),
    /position is used twice/,
  );
});

test('a valid file is written in one transaction, parents before children', async () => {
  const { pool, queries } = fakePool();
  await withApi(pool, async (call) => {
    const { status, data } = await call(path, { method: 'POST', body: file() });
    assert.equal(status, 200, JSON.stringify(data));
    const result = data.result as Record<string, { added: number; skipped: number }>;
    assert.deepEqual(result.certifications, { added: 1, skipped: 0 });
    assert.deepEqual(result.studyStages, { added: 1, skipped: 0 });
    assert.deepEqual(result.studyTasks, { added: 1, skipped: 0 });
  });
  const texts = queries.map((query) => query.text.trim());
  assert.equal(texts[0], 'BEGIN');
  assert.equal(texts.at(-1), 'COMMIT');
  const order = ['INTO certifications', 'INTO study_stages', 'INTO study_tasks'].map((part) =>
    texts.findIndex((text) => text.includes(part)),
  );
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.ok(order.every((index) => index > 0));
  // The task points at the stage's new id (100 → 101), not at the file's ids.
  const insertTask = queries.find((query) => query.text.includes('INTO study_tasks'))!;
  assert.equal(insertTask.values?.[0], 101);
});

test('a database error in the middle rolls everything back and answers 500', async () => {
  const { pool, queries } = fakePool({ fail: 'INTO study_tasks' });
  await withApi(pool, async (call) => {
    const { status } = await call(path, { method: 'POST', body: file() });
    assert.equal(status, 500);
  });
  assert.equal(queries.at(-1)!.text, 'ROLLBACK');
  assert.ok(!queries.some((query) => query.text === 'COMMIT'));
});

test('a backup larger than the usual 256kb limit is accepted', async () => {
  const many = Array.from({ length: 2500 }, (_, index) => ({
    id: index + 1,
    title: `Reminder ${index}`,
    note: 'x'.repeat(100),
    linkUrl: '',
    remindFrom: '2027-03-01',
    dueDate: null,
    completedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  assert.ok(JSON.stringify(many).length > 256 * 1024);
  const { pool } = fakePool();
  await withApi(pool, async (call) => {
    const { status, data } = await call(path, {
      method: 'POST',
      body: file({ certifications: [], studyStages: [], studyTasks: [], userActions: many }),
    });
    assert.equal(status, 200, JSON.stringify(data));
  });
});
