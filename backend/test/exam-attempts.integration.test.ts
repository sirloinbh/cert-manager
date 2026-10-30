import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Attempt = {
  id: number;
  certificationId: number;
  outcome: string;
  score: number | null;
  grade: string | null;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
};

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'expiry dates are filled from the goal, kept in step with it and removed with it',
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
        const addGoal = async (body: object) => {
          const { status, data } = await call('/api/certifications', { method: 'POST', body });
          assert.equal(status, 201, JSON.stringify(data));
          const { id } = data.certification as { id: number };
          created.push(id);
          return id;
        };
        const addAttempt = async (goal: number, body: object) => {
          const { status, data } = await call(`/api/certifications/${goal}/attempts`, {
            method: 'POST',
            body,
          });
          assert.equal(status, 201, JSON.stringify(data));
          return data.attempt as Attempt;
        };

        const twoYears = {
          category: 'english',
          validityKind: 'months',
          validityMonths: 24,
        };
        const toeic = await addGoal({ ...twoYears, name: '#32 토익' });

        // The last valid day is the same date two years later.
        const scored = await addAttempt(toeic, {
          examDate: '2025-03-15',
          outcome: 'scored',
          score: 900,
        });
        assert.equal(scored.expiresOn, '2027-03-15');
        assert.equal(scored.daysUntilExpiry, 136);
        assert.equal(scored.grade, '', 'after the result, no grade is an empty text');

        // Adding months clamps to the month's last day instead of rolling into March.
        const leapDay = await addAttempt(toeic, {
          examDate: '2024-02-29',
          outcome: 'scored',
          score: 700,
        });
        assert.equal(leapDay.expiresOn, '2026-02-28');
        assert.equal(leapDay.daysUntilExpiry, -244, 'a passed date counts down below zero');

        // No expiry until the result is in, nor for a failed exam; the user's date wins.
        const waiting = await addAttempt(toeic, { examDate: '2026-12-13' });
        assert.deepEqual(
          [waiting.outcome, waiting.score, waiting.grade, waiting.expiresOn],
          ['waiting', null, null, null],
        );
        const failed = await addAttempt(toeic, { examDate: '2026-09-01', outcome: 'failed' });
        assert.equal(failed.expiresOn, null);
        const chosen = await addAttempt(toeic, {
          examDate: '2026-01-10',
          outcome: 'passed',
          expiresOn: '2026-11-30',
        });
        assert.equal(chosen.expiresOn, '2026-11-30');
        assert.equal(chosen.daysUntilExpiry, 31);
        const cleared = await addAttempt(toeic, {
          examDate: '2026-01-11',
          outcome: 'passed',
          expiresOn: null,
        });
        assert.equal(cleared.expiresOn, null, 'null means the user does not know the date');

        // Newest exam first.
        const list = await call(`/api/certifications/${toeic}/attempts`);
        assert.deepEqual(
          (list.data.attempts as Attempt[]).map((attempt) => attempt.id),
          [waiting.id, failed.id, cleared.id, chosen.id, scored.id, leapDay.id],
        );

        // A result entered later fills the date from the goal; the attempt must belong to the path's goal.
        const resulted = await call(`/api/certifications/${toeic}/attempts/${waiting.id}`, {
          method: 'PUT',
          body: { examDate: '2026-12-13', outcome: 'scored', score: 950 },
        });
        assert.equal(resulted.status, 200);
        assert.equal((resulted.data.attempt as Attempt).expiresOn, '2028-12-13');

        const other = await addGoal({ name: '#32 다른 목표', category: 'dev' });
        const wrongGoal = await call(`/api/certifications/${other}/attempts/${waiting.id}`, {
          method: 'DELETE',
        });
        assert.equal(wrongGoal.status, 404);

        // A goal with no known validity leaves the date empty; one that never expires always does.
        const unknown = await addAttempt(other, { examDate: '2026-01-10', outcome: 'passed' });
        assert.equal(unknown.expiresOn, null);
        const never = await addGoal({ name: '#32 정처기', category: 'dev', validityKind: 'none' });
        const noExpiry = await addAttempt(never, {
          examDate: '2026-01-10',
          outcome: 'passed',
          expiresOn: '2030-01-01',
        });
        assert.equal(noExpiry.expiresOn, null);

        // The dashboard's source: per goal, the newest passed or scored attempt only.
        const latest = await call('/api/exam-attempts/latest');
        const mine = (latest.data.attempts as (Attempt & { name: string })[]).filter((attempt) =>
          created.includes(attempt.certificationId),
        );
        assert.deepEqual(
          mine.map((attempt) => [attempt.certificationId, attempt.id, attempt.name]),
          [
            [toeic, waiting.id, '#32 토익'],
            [other, unknown.id, '#32 다른 목표'],
            [never, noExpiry.id, '#32 정처기'],
          ],
        );

        // A goal changed to "never expires" clears its attempts' dates in the same request.
        const stopped = await call(`/api/certifications/${toeic}`, {
          method: 'PUT',
          body: { name: '#32 토익', category: 'english', validityKind: 'none' },
        });
        assert.equal(stopped.status, 200);
        const { rows } = await pool.query<{ count: string }>(
          'SELECT count(*) FROM exam_attempts WHERE certification_id = $1 AND expires_on IS NOT NULL',
          [toeic],
        );
        assert.equal(rows[0]?.count, '0');

        // Attempts go with their goal.
        const removed = await call(`/api/certifications/${toeic}`, { method: 'DELETE' });
        assert.equal(removed.status, 204);
        const left = await pool.query('SELECT 1 FROM exam_attempts WHERE certification_id = $1', [
          toeic,
        ]);
        assert.equal(left.rowCount, 0);
      },
      { today: () => '2026-10-30' },
    );

    // The table itself rejects an expiry before the exam.
    const goal = await pool.query<{ id: string }>(
      "INSERT INTO certifications (name, category) VALUES ('#32 제약', 'dev') RETURNING id",
    );
    const goalId = Number(goal.rows[0]?.id);
    created.push(goalId);
    await assert.rejects(
      pool.query(
        "INSERT INTO exam_attempts (certification_id, exam_date, expires_on) VALUES ($1, '2026-03-15', '2026-03-14')",
        [goalId],
      ),
      { code: '23514' },
    );
  },
);
