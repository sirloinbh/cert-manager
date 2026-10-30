import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'baseline schema is applied and health answers against the real database',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings'",
    );
    assert.equal(tables.rowCount, 1, 'Apply database/migrations/001_initial.sql to the test DB');
    await withApi(pool, async (call) => {
      const { status, data } = await call('/api/health');
      assert.equal(status, 200);
      assert.equal(data.ok, true);
    });
  },
);

type Certification = { id: number; name: string; daysUntilExam: number | null };

test(
  'certification goals are created, listed in order, replaced and deleted in the real database',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const created: number[] = [];
    // after() hooks run in the order they are added, so clean up and close in one hook.
    t.after(async () => {
      await pool.query('DELETE FROM certifications WHERE id = ANY($1::bigint[])', [created]);
      await pool.end();
    });
    await withApi(
      pool,
      async (call) => {
        const add = async (body: object) => {
          const { status, data } = await call('/api/certifications', { method: 'POST', body });
          assert.equal(status, 201, JSON.stringify(data));
          const certification = data.certification as Certification;
          created.push(certification.id);
          return certification;
        };
        const license = await add({ name: '#30 운전면허', category: 'life' });
        const later = await add({
          name: '#30 AWS SAA',
          category: 'dev',
          targetExamDate: '2027-03-01',
          validityKind: 'months',
          validityMonths: 36,
        });
        const undated = await add({ name: '#30 정보처리기사', category: 'dev' });
        const sooner = await add({
          name: '#30 AWS CP',
          category: 'dev',
          targetExamDate: '2026-11-20',
        });
        const toeic = await add({
          name: '#30 토익',
          category: 'english',
          targetExamDate: '2026-10-25',
        });
        assert.equal(sooner.daysUntilExam, 21);
        assert.equal(toeic.daysUntilExam, -5, 'a passed date counts down below zero');
        assert.equal(undated.daysUntilExam, null);

        const list = await call('/api/certifications');
        assert.equal(list.status, 200);
        const ids = (list.data.certifications as Certification[])
          .map((certification) => certification.id)
          .filter((id) => created.includes(id));
        // english → dev → life, nearest date first, no date last within a category.
        assert.deepEqual(ids, [toeic.id, sooner.id, later.id, undated.id, license.id]);

        const replaced = await call(`/api/certifications/${later.id}`, {
          method: 'PUT',
          body: { name: '#30 AWS SAA', category: 'dev', status: 'studying', validityKind: 'none' },
        });
        assert.equal(replaced.status, 200);
        assert.deepEqual(
          (({ status, targetExamDate, validityKind, validityMonths }) => ({
            status,
            targetExamDate,
            validityKind,
            validityMonths,
          }))(replaced.data.certification as Record<string, unknown>),
          { status: 'studying', targetExamDate: null, validityKind: 'none', validityMonths: null },
        );

        const deleted = await call(`/api/certifications/${license.id}`, { method: 'DELETE' });
        assert.equal(deleted.status, 204);
        const gone = await call(`/api/certifications/${license.id}`);
        assert.equal(gone.status, 404);
      },
      { today: () => '2026-10-30' },
    );

    // The table itself rejects a months count that does not match the validity kind.
    await assert.rejects(
      pool.query(
        "INSERT INTO certifications (name, category, validity_kind, validity_months) VALUES ('x', 'dev', 'none', 12)",
      ),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query("INSERT INTO certifications (name, category) VALUES ('  ', 'dev')"),
      { code: '23514' },
    );
  },
);
