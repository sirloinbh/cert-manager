import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { gradeScaleKeys } from '../src/grade-scales.js';
import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'a goal keeps its scale and target grade, and the table rejects a target without a scale',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const created: number[] = [];
    t.after(async () => {
      await pool.query('DELETE FROM certifications WHERE id = ANY($1::bigint[])', [created]);
      await pool.end();
    });
    await withApi(pool, async (call) => {
      const body = {
        name: '#51 토익 스피킹',
        category: 'english',
        gradeScale: 'toeic_speaking',
        targetGrade: 'AL',
      };
      const saved = await call('/api/certifications', { method: 'POST', body });
      assert.equal(saved.status, 201, JSON.stringify(saved.data));
      const { id } = saved.data.certification as { id: number };
      created.push(id);

      const read = await call(`/api/certifications/${id}`);
      assert.deepEqual(
        [
          (read.data.certification as { gradeScale: string }).gradeScale,
          (read.data.certification as { targetGrade: string }).targetGrade,
        ],
        ['toeic_speaking', 'AL'],
      );

      // Replacing the goal without a scale clears both.
      const cleared = await call(`/api/certifications/${id}`, {
        method: 'PUT',
        body: { name: body.name, category: body.category },
      });
      assert.equal(cleared.status, 200);
      assert.deepEqual(
        [
          (cleared.data.certification as { gradeScale: string }).gradeScale,
          (cleared.data.certification as { targetGrade: string | null }).targetGrade,
        ],
        ['none', null],
      );
    });

    // The table accepts every scale the API offers, so a new scale cannot pass validation and then fail with a 500.
    for (const key of gradeScaleKeys) {
      const { rows } = await pool.query<{ id: string }>(
        "INSERT INTO certifications (name, category, grade_scale) VALUES ('#51 체계', 'dev', $1) RETURNING id",
        [key],
      );
      created.push(Number(rows[0]?.id));
    }

    await assert.rejects(
      pool.query(
        "INSERT INTO certifications (name, category, target_grade) VALUES ('#51 제약', 'dev', 'B2')",
      ),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO certifications (name, category, grade_scale) VALUES ('#51 제약', 'dev', 'jlpt')",
      ),
      { code: '23514' },
    );
  },
);
