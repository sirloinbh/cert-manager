import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Exported = {
  version: number;
  tables: Record<string, { id: number; title?: string; name?: string }[]>;
};

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'the export holds every row of each included table and nothing else',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const created = { goals: [] as number[], actions: [] as number[] };
    t.after(async () => {
      await pool.query('DELETE FROM certifications WHERE id = ANY($1::bigint[])', [created.goals]);
      await pool.query('DELETE FROM user_actions WHERE id = ANY($1::bigint[])', [created.actions]);
      await pool.end();
    });

    await withApi(pool, async (call) => {
      const goal = await call('/api/certifications', {
        method: 'POST',
        body: { name: '#210 goal', category: 'dev', targetExamDate: '2027-05-01' },
      });
      assert.equal(goal.status, 201, JSON.stringify(goal.data));
      const goalId = (goal.data.certification as { id: number }).id;
      created.goals.push(goalId);
      const attempt = await call(`/api/certifications/${goalId}/attempts`, {
        method: 'POST',
        body: { examDate: '2027-05-01' },
      });
      assert.equal(attempt.status, 201, JSON.stringify(attempt.data));
      const stage = await call(`/api/certifications/${goalId}/stages`, {
        method: 'POST',
        body: { title: '#210 stage' },
      });
      assert.equal(stage.status, 201, JSON.stringify(stage.data));
      const stageId = (stage.data.stage as { id: number }).id;
      const task = await call(`/api/study-stages/${stageId}/tasks`, {
        method: 'POST',
        body: { title: '#210 task', dueDate: '2027-04-01' },
      });
      assert.equal(task.status, 201, JSON.stringify(task.data));
      const action = await call('/api/user-actions', {
        method: 'POST',
        body: { title: '#210 action', remindFrom: '2027-03-01' },
      });
      assert.equal(action.status, 201, JSON.stringify(action.data));
      created.actions.push((action.data.action as { id: number }).id);

      const { status, data } = await call('/api/data-transfer/export');
      assert.equal(status, 200);
      const file = data as unknown as Exported;
      assert.equal(file.version, 1);

      // Every row of each table is in the file, with dates as YYYY-MM-DD.
      for (const [name, table] of [
        ['certifications', 'certifications'],
        ['examAttempts', 'exam_attempts'],
        ['studyStages', 'study_stages'],
        ['studyTasks', 'study_tasks'],
        ['userActions', 'user_actions'],
      ] as const) {
        const { rows } = await pool.query<{ id: number }>(`SELECT id FROM ${table} ORDER BY id`);
        assert.deepEqual(
          file.tables[name]!.map((row) => row.id),
          rows.map((row) => row.id),
          name,
        );
      }
      const mine = file.tables.certifications!.find((row) => row.id === goalId) as unknown as {
        targetExamDate: string;
      };
      assert.equal(mine.targetExamDate, '2027-05-01');
      const dated = file.tables.studyTasks!.find((row) => row.title === '#210 task') as unknown as {
        dueDate: string;
      };
      assert.equal(dated.dueDate, '2027-04-01');
    });
  },
);
