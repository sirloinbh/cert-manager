import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Rows = Record<string, Record<string, unknown>[]>;
type Result = Record<string, { added: number; skipped: number }>;

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'export, delete, import gets the same data back; importing again changes nothing and overwrites nothing',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    // Other tests share this database, so the cleanup and the file cover only this test's own rows.
    const mark = '#211 round trip';
    t.after(async () => {
      await pool.query(`DELETE FROM certifications WHERE name = $1`, [mark]);
      await pool.query(`DELETE FROM user_actions WHERE title = $1`, [mark]);
      await pool.end();
    });

    await withApi(pool, async (call) => {
      const goal = await call('/api/certifications', {
        method: 'POST',
        body: {
          name: mark,
          category: 'dev',
          issuer: 'Me',
          memo: 'original',
          targetExamDate: '2027-05-01',
        },
      });
      assert.equal(goal.status, 201, JSON.stringify(goal.data));
      const goalId = (goal.data.certification as { id: number }).id;
      const attempt = await call(`/api/certifications/${goalId}/attempts`, {
        method: 'POST',
        body: { examDate: '2027-05-01' },
      });
      assert.equal(attempt.status, 201, JSON.stringify(attempt.data));
      const stage = await call(`/api/certifications/${goalId}/stages`, {
        method: 'POST',
        body: { title: 'Stage A', startDate: '2027-03-01', endDate: '2027-04-01' },
      });
      const stageId = (stage.data.stage as { id: number }).id;
      for (const title of ['Task 1', 'Task 2']) {
        const task = await call(`/api/study-stages/${stageId}/tasks`, {
          method: 'POST',
          body: { title, dueDate: '2027-04-01' },
        });
        assert.equal(task.status, 201, JSON.stringify(task.data));
      }
      const action = await call('/api/user-actions', {
        method: 'POST',
        body: { title: mark, remindFrom: '2027-03-01', dueDate: '2027-03-20' },
      });
      assert.equal(action.status, 201, JSON.stringify(action.data));

      const exported = (await call('/api/data-transfer/export')).data as unknown as {
        version: number;
        exportedAt: string;
        tables: Rows;
      };
      const goalIds = new Set(
        exported.tables.certifications!.filter((row) => row.name === mark).map((row) => row.id),
      );
      const stageIds = new Set(
        exported.tables
          .studyStages!.filter((row) => goalIds.has(row.certificationId))
          .map((row) => row.id),
      );
      const mine: Rows = {
        certifications: exported.tables.certifications!.filter((row) => goalIds.has(row.id)),
        examAttempts: exported.tables.examAttempts!.filter((row) =>
          goalIds.has(row.certificationId),
        ),
        studyStages: exported.tables.studyStages!.filter((row) => goalIds.has(row.certificationId)),
        studyTasks: exported.tables.studyTasks!.filter((row) => stageIds.has(row.stageId)),
        userActions: exported.tables.userActions!.filter((row) => row.title === mark),
      };
      assert.deepEqual(
        Object.values(mine).map((rows) => rows.length),
        [1, 1, 1, 2, 1],
      );
      const backup = { version: exported.version, exportedAt: exported.exportedAt, tables: mine };

      // The same content, whatever the new ids are.
      const content = async () => {
        const read = (await call('/api/data-transfer/export')).data as unknown as { tables: Rows };
        const strip = (rows: Record<string, unknown>[]) =>
          rows.map(({ id, certificationId, stageId, createdAt, updatedAt, ...rest }) => {
            void [id, certificationId, stageId, createdAt, updatedAt];
            return rest;
          });
        const goalNow = new Set(
          read.tables.certifications!.filter((row) => row.name === mark).map((row) => row.id),
        );
        const stageNow = new Set(
          read.tables
            .studyStages!.filter((row) => goalNow.has(row.certificationId))
            .map((row) => row.id),
        );
        return {
          certifications: strip(read.tables.certifications!.filter((row) => row.name === mark)),
          examAttempts: strip(
            read.tables.examAttempts!.filter((row) => goalNow.has(row.certificationId)),
          ),
          studyStages: strip(
            read.tables.studyStages!.filter((row) => goalNow.has(row.certificationId)),
          ),
          studyTasks: strip(read.tables.studyTasks!.filter((row) => stageNow.has(row.stageId))),
          userActions: strip(read.tables.userActions!.filter((row) => row.title === mark)),
        };
      };
      const before = await content();

      // Delete this test's data, then restore it from the file.
      await pool.query(`DELETE FROM certifications WHERE name = $1`, [mark]);
      await pool.query(`DELETE FROM user_actions WHERE title = $1`, [mark]);
      const restored = await call('/api/data-transfer/import', { method: 'POST', body: backup });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      const added = restored.data.result as Result;
      assert.deepEqual(
        Object.values(added).map((table) => table.added),
        [1, 1, 1, 2, 1],
      );
      assert.deepEqual(await content(), before);

      // Importing again skips every row, and an edit made since the export is not overwritten.
      await pool.query(`UPDATE certifications SET memo = 'edited later' WHERE name = $1`, [mark]);
      const again = await call('/api/data-transfer/import', { method: 'POST', body: backup });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      assert.deepEqual(
        Object.values(again.data.result as Result).map((table) => [table.added, table.skipped]),
        [
          [0, 1],
          [0, 1],
          [0, 1],
          [0, 2],
          [0, 1],
        ],
      );
      const now = await content();
      assert.equal(now.certifications[0]!.memo, 'edited later');
      assert.equal(now.studyTasks.length, 2);
    });
  },
);

test('a bad file changes nothing', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const count = async () =>
    (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM certifications`)).rows[0]!.n;
  await withApi(pool, async (call) => {
    const before = await count();
    const bad = {
      version: 1,
      exportedAt: '2027-01-01T00:00:00.000Z',
      tables: {
        certifications: [{ id: 1, name: '#211 bad file', category: 'nope' }],
        examAttempts: [],
        studyStages: [],
        studyTasks: [],
        userActions: [],
      },
    };
    const { status } = await call('/api/data-transfer/import', { method: 'POST', body: bad });
    assert.equal(status, 400);
    assert.equal(await count(), before);
  });
});
