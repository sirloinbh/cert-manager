import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Task = {
  id: number;
  stageId: number;
  title: string;
  position: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  completedAt: string | null;
};
type Stage = {
  id: number;
  title: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
  tasks: Task[];
};
type TodayTask = Task & { certificationId: number; certificationName: string };

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'a plan keeps its order, tracks completion, feeds today’s tasks and goes with its goal',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const created: number[] = [];
    t.after(async () => {
      await pool.query('DELETE FROM certifications WHERE id = ANY($1::bigint[])', [created]);
      await pool.end();
    });
    await withApi(
      pool,
      async (call) => {
        const post = async <T>(path: string, body: object, key: string) => {
          const { status, data } = await call(path, { method: 'POST', body });
          assert.equal(status, 201, JSON.stringify(data));
          return data[key] as T;
        };
        const goal = (
          await post<{ id: number }>(
            '/api/certifications',
            { name: '#33 토익', category: 'english' },
            'certification',
          )
        ).id;
        created.push(goal);
        const addStage = (body: object) =>
          post<Stage>(`/api/certifications/${goal}/stages`, body, 'stage');
        const addTask = (stage: number, body: object) =>
          post<Task>(`/api/study-stages/${stage}/tasks`, body, 'task');

        // New rows go last, numbered from 1.
        const first = await addStage({
          title: '1주차',
          startDate: '2026-11-01',
          endDate: '2026-11-07',
        });
        const second = await addStage({ title: '2주차' });
        assert.deepEqual([first.position, second.position], [1, 2]);
        const overdue = await addTask(first.id, { title: '단어 외우기', dueDate: '2026-10-29' });
        const dueToday = await addTask(first.id, { title: '기출 풀기', dueDate: '2026-10-30' });
        const later = await addTask(first.id, { title: '오답 정리', dueDate: '2026-10-31' });
        const undated = await addTask(second.id, { title: '모의고사' });
        assert.deepEqual([overdue.position, dueToday.position, later.position], [1, 2, 3]);
        assert.equal(undated.position, 1, 'positions count within a stage');
        assert.equal(overdue.daysUntilDue, -1);
        assert.equal(later.daysUntilDue, 1);
        assert.equal(undated.daysUntilDue, null);

        const plan = async () => {
          const { status, data } = await call(`/api/certifications/${goal}/plan`);
          assert.equal(status, 200);
          return data.stages as Stage[];
        };
        const shape = await plan();
        assert.deepEqual(
          shape.map((stage) => [stage.title, stage.tasks.map((task) => task.title)]),
          [
            ['1주차', ['단어 외우기', '기출 풀기', '오답 정리']],
            ['2주차', ['모의고사']],
          ],
        );
        assert.equal(shape[0]?.startDate, '2026-11-01');

        const todayTitles = async () => {
          const { data } = await call('/api/study-tasks/today');
          return (data.tasks as TodayTask[])
            .filter((task) => task.certificationId === goal)
            .map((task) => [task.title, task.certificationName]);
        };
        // Due today or earlier, the oldest first; not a later task or one with no date.
        assert.deepEqual(await todayTitles(), [
          ['단어 외우기', '#33 토익'],
          ['기출 풀기', '#33 토익'],
        ]);

        // Finishing a task takes it off today's list; finishing it again keeps the first moment.
        const finish = (id: number, completed: boolean) =>
          call(`/api/study-tasks/${id}/completion`, { method: 'PATCH', body: { completed } });
        const finished = (await finish(overdue.id, true)).data.task as Task;
        assert.ok(finished.completedAt);
        assert.equal(finished.daysUntilDue, -1, 'completion answers the same fields as the plan');
        const again = (await finish(overdue.id, true)).data.task as Task;
        assert.equal(again.completedAt, finished.completedAt);
        assert.deepEqual(await todayTitles(), [['기출 풀기', '#33 토익']]);
        const undone = (await finish(overdue.id, false)).data.task as Task;
        assert.equal(undone.completedAt, null);
        assert.equal((await todayTitles()).length, 2);

        // Editing keeps position and completion.
        await finish(later.id, true);
        const edited = await call(`/api/study-tasks/${later.id}`, {
          method: 'PUT',
          body: { title: '오답 노트', dueDate: null },
        });
        assert.equal(edited.status, 200);
        const task = edited.data.task as Task;
        assert.deepEqual(
          [task.title, task.dueDate, task.position, task.completedAt !== null],
          ['오답 노트', null, 3, true],
        );
        const renamed = await call(`/api/study-stages/${second.id}`, {
          method: 'PUT',
          body: { title: '마무리', startDate: '2026-11-08' },
        });
        assert.equal(renamed.status, 200);
        const stage = renamed.data.stage as Stage;
        assert.deepEqual(
          [stage.title, stage.position, stage.startDate],
          ['마무리', 2, '2026-11-08'],
        );

        const moved = await call(`/api/study-tasks/${undated.id}`, {
          method: 'PUT',
          body: { title: '모의고사', dueDate: '2026-11-01' },
        });
        assert.equal((moved.data.task as Task).daysUntilDue, 2);

        // A deleted position is not reused by mistake: the next row still goes last.
        assert.equal(
          (await call(`/api/study-tasks/${dueToday.id}`, { method: 'DELETE' })).status,
          204,
        );
        const added = await addTask(first.id, { title: '추가' });
        assert.equal(added.position, 4);

        // Two positions can be swapped within a transaction, which is why the UNIQUE is deferred.
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('UPDATE study_stages SET position = 2 WHERE id = $1', [first.id]);
          await client.query('UPDATE study_stages SET position = 1 WHERE id = $1', [second.id]);
          await client.query('COMMIT');
        } finally {
          client.release();
        }
        assert.deepEqual(
          (await plan()).map((row) => row.id),
          [second.id, first.id],
        );

        // A stage takes its tasks with it, and the goal takes everything.
        assert.equal(
          (await call(`/api/study-stages/${second.id}`, { method: 'DELETE' })).status,
          204,
        );
        const gone = await pool.query('SELECT 1 FROM study_tasks WHERE id = $1', [undated.id]);
        assert.equal(gone.rowCount, 0);
        assert.equal((await call(`/api/certifications/${goal}`, { method: 'DELETE' })).status, 204);
        const left = await pool.query('SELECT 1 FROM study_stages WHERE certification_id = $1', [
          goal,
        ]);
        assert.equal(left.rowCount, 0);
      },
      { today: () => '2026-10-30' },
    );

    // The tables themselves reject bad dates and a repeated position.
    const inserted = await pool.query<{ id: string }>(
      "INSERT INTO certifications (name, category) VALUES ('#33 제약', 'dev') RETURNING id",
    );
    const goalId = Number(inserted.rows[0]?.id);
    created.push(goalId);
    await assert.rejects(
      pool.query(
        "INSERT INTO study_stages (certification_id, title, position, start_date, end_date) VALUES ($1, 'a', 1, '2026-02-02', '2026-02-01')",
        [goalId],
      ),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO study_stages (certification_id, title, position) VALUES ($1, 'a', 1), ($1, 'b', 1)",
        [goalId],
      ),
      { code: '23505' },
    );
  },
);
