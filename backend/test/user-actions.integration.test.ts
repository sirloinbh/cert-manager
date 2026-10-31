import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Action = {
  id: number;
  title: string;
  daysUntilDue: number | null;
  completedAt: string | null;
};

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'alerts appear from their reminder day, nearest deadline first, until they are done',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const created: number[] = [];
    t.after(async () => {
      await pool.query('DELETE FROM user_actions WHERE id = ANY($1::bigint[])', [created]);
      await pool.end();
    });
    const mine = (data: Record<string, unknown>) =>
      (data.actions as Action[]).filter((action) => created.includes(action.id));

    // One app per "today", so the reminder day can be crossed.
    const on = (day: string, run: Parameters<typeof withApi>[1]) =>
      withApi(pool, run, { today: () => day });

    await on('2027-03-07', async (call) => {
      const add = async (body: object) => {
        const { status, data } = await call('/api/user-actions', { method: 'POST', body });
        assert.equal(status, 201, JSON.stringify(data));
        const { id } = data.action as Action;
        created.push(id);
        return id;
      };
      await add({ title: '#60 나중 마감', remindFrom: '2027-03-01', dueDate: '2027-04-01' });
      await add({ title: '#60 마감 없음', remindFrom: '2027-03-02' });
      await add({ title: '#60 가까운 마감', remindFrom: '2027-03-03', dueDate: '2027-03-09' });
      await add({ title: '#60 내일부터', remindFrom: '2027-03-08', dueDate: '2027-03-22' });

      const { data } = await call('/api/user-actions');
      assert.deepEqual(
        mine(data).map((action) => action.title),
        ['#60 가까운 마감', '#60 나중 마감', '#60 마감 없음'],
        'not yet its reminder day, and no deadline goes last',
      );
      assert.equal(mine(data)[0]?.daysUntilDue, 2);
    });

    await on('2027-03-08', async (call) => {
      const first = await call('/api/user-actions');
      assert.ok(mine(first.data).some((action) => action.title === '#60 내일부터'));

      const target = mine(first.data).find((action) => action.title === '#60 가까운 마감');
      const done = await call(`/api/user-actions/${target?.id}/completion`, {
        method: 'PUT',
        body: { completed: true },
      });
      assert.equal(done.status, 200);
      const firstDone = (done.data.action as Action).completedAt;
      assert.ok(firstDone);

      const after = await call('/api/user-actions');
      assert.ok(!mine(after.data).some((action) => action.id === target?.id));

      // Marking it done again keeps the first time.
      const again = await call(`/api/user-actions/${target?.id}/completion`, {
        method: 'PUT',
        body: { completed: true },
      });
      assert.equal((again.data.action as Action).completedAt, firstDone);

      // Undoing brings it back.
      await call(`/api/user-actions/${target?.id}/completion`, {
        method: 'PUT',
        body: { completed: false },
      });
      const undone = await call('/api/user-actions');
      assert.ok(mine(undone.data).some((action) => action.id === target?.id));

      assert.equal(
        (await call(`/api/user-actions/${target?.id}`, { method: 'DELETE' })).status,
        204,
      );
      const gone = await call('/api/user-actions');
      assert.ok(!mine(gone.data).some((action) => action.id === target?.id));
    });

    // A capitalized scheme is a valid address for both the API and the table.
    await on('2027-03-08', async (call) => {
      const { status, data } = await call('/api/user-actions', {
        method: 'POST',
        body: {
          title: '#60 대문자 링크',
          remindFrom: '2027-03-08',
          linkUrl: 'HTTPS://www.q-net.or.kr/',
        },
      });
      assert.equal(status, 201, JSON.stringify(data));
      created.push((data.action as Action).id);
    });

    // The table rejects what the API rejects.
    await assert.rejects(
      pool.query(
        "INSERT INTO user_actions (title, remind_from, link_url) VALUES ('#60 제약', '2027-03-01', 'javascript:alert(1)')",
      ),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO user_actions (title, remind_from, link_url) VALUES ('#60 제약', '2027-03-01', 'https://')",
      ),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO user_actions (title, remind_from, due_date) VALUES ('#60 제약', '2027-03-02', '2027-03-01')",
      ),
      { code: '23514' },
    );
  },
);
