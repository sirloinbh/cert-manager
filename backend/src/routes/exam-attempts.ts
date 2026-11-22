import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { named } from '../named-params.js';
import { HttpError, parseId } from '../standard/http.js';
import { body, calendarDate, shortText } from '../validation.js';

// Exam attempts and earned certifications (#32). Columns and rules: docs/design/scope-and-data-model.md section 5.

const outcomes = ['waiting', 'passed', 'failed', 'scored'] as const;

// PUT replaces the whole attempt, so POST and PUT share one input.
// expiresOn: a date is the user's value, null means "not known", and omitting it asks for the goal's default.
export const attemptInput = z
  .object(
    {
      examDate: calendarDate('Exam date'),
      outcome: z
        .enum(outcomes, { error: 'Outcome must be Pending, Passed, Failed, or Score/grade' })
        .default('waiting'),
      score: z
        .number({ error: 'Score must be a number' })
        .int('Score must be a whole number')
        .min(0, 'Score must be 0 or more')
        .max(100000, 'Score must be 100000 or less')
        .nullable()
        .default(null),
      grade: shortText('Grade').nullable().default(null),
      expiresOn: calendarDate('Expiry date').nullable().optional(),
      memo: z.string({ error: 'Memo must be text' }).default(''),
    },
    // express.json() accepts an array or a bare value too; the message stays English.
    { error: 'Request body must be a JSON object' },
  )
  .superRefine((input, ctx) => {
    if (input.outcome === 'waiting' && (input.score !== null || input.grade)) {
      ctx.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'Leave the score and grade empty while the outcome is Pending',
      });
    }
    if (input.expiresOn && (input.outcome === 'waiting' || input.outcome === 'failed')) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresOn'],
        message: 'Only a passed or scored attempt can have an expiry date',
      });
    }
    if (input.expiresOn && input.expiresOn < input.examDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresOn'],
        message: 'Expiry date must be on or after the exam date',
      });
    }
  });

type AttemptRow = {
  id: number;
  certificationId: number;
  examDate: string;
  outcome: (typeof outcomes)[number];
  score: number | null;
  grade: string | null;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  memo: string;
};

// daysUntilExpiry is negative once the last valid day has passed.
const columns = `a.id, a.certification_id AS "certificationId",
  a.exam_date AS "examDate", a.outcome, a.score, a.grade, a.expires_on AS "expiresOn",
  a.expires_on - :today::date AS "daysUntilExpiry", a.memo`;

// Used by INSERT and UPDATE with the parameters from values(); `c` is the goal.
// Adding months clamps to the month's last day (2024-02-29 + 24 months = 2026-02-28).
const expiresOn = `CASE
    WHEN :outcome::text NOT IN ('passed', 'scored') OR c.validity_kind = 'none' THEN NULL
    WHEN :expiresOnGiven::boolean THEN :expiresOn::date
    WHEN c.validity_kind = 'months' THEN (:examDate::date + make_interval(months => c.validity_months))::date
  END`;

const goalNotFound = 'Certification goal not found';
const attemptNotFound = 'Exam attempt not found';

export function registerExamAttemptRoutes(app: Express, pool: Pool, today: () => string) {
  // The newest passed or scored attempt of each goal, which decides that goal's expiry on the dashboard.
  app.get('/api/exam-attempts/latest', async (_req, res) => {
    const current = today();
    const query = named(
      `SELECT DISTINCT ON (a.certification_id) ${columns},
         c.name, c.validity_kind AS "validityKind"
       FROM exam_attempts a
       JOIN certifications c ON c.id = a.certification_id
       WHERE a.outcome IN ('passed', 'scored')
       ORDER BY a.certification_id, a.exam_date DESC, a.id DESC`,
      { today: current },
    );
    const { rows } = await pool.query<AttemptRow & { name: string; validityKind: string }>(
      query.text,
      query.values,
    );
    res.json({ today: current, attempts: rows });
  });

  // Newest exam first.
  app.get('/api/certifications/:id/attempts', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const current = today();
    const goal = await pool.query('SELECT 1 FROM certifications WHERE id = $1', [id]);
    if (!goal.rowCount) throw new HttpError(404, goalNotFound);
    const query = named(
      `SELECT ${columns} FROM exam_attempts a
       WHERE a.certification_id = :id
       ORDER BY a.exam_date DESC, a.id DESC`,
      { today: current, id },
    );
    const { rows } = await pool.query<AttemptRow>(query.text, query.values);
    res.json({ today: current, attempts: rows });
  });

  app.post('/api/certifications/:id/attempts', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const input = attemptInput.parse(body(req.body));
    const query = named(
      `INSERT INTO exam_attempts AS a
         (certification_id, exam_date, outcome, score, grade, expires_on, memo)
       SELECT c.id, :examDate::date, :outcome::text, :score::integer, :grade::text, ${expiresOn}, :memo::text
       FROM certifications c WHERE c.id = :id
       RETURNING ${columns}`,
      { ...values(input), today: today(), id },
    );
    const { rows } = await pool.query<AttemptRow>(query.text, query.values);
    if (!rows[0]) throw new HttpError(404, goalNotFound);
    res.status(201).json({ attempt: rows[0] });
  });

  app.put('/api/certifications/:id/attempts/:attemptId', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const attemptId = parseId(req.params.attemptId, 'exam attempt');
    const input = attemptInput.parse(body(req.body));
    const query = named(
      `UPDATE exam_attempts a SET exam_date = :examDate::date, outcome = :outcome::text, score = :score::integer,
         grade = :grade::text, expires_on = ${expiresOn}, memo = :memo::text, updated_at = now()
       FROM certifications c
       WHERE a.id = :attemptId AND a.certification_id = :id AND c.id = a.certification_id
       RETURNING ${columns}`,
      { ...values(input), today: today(), id, attemptId },
    );
    const { rows } = await pool.query<AttemptRow>(query.text, query.values);
    if (!rows[0]) throw new HttpError(404, attemptNotFound);
    res.json({ attempt: rows[0] });
  });

  app.delete('/api/certifications/:id/attempts/:attemptId', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const attemptId = parseId(req.params.attemptId, 'exam attempt');
    const { rowCount } = await pool.query(
      'DELETE FROM exam_attempts WHERE id = $1 AND certification_id = $2',
      [attemptId, id],
    );
    if (!rowCount) throw new HttpError(404, attemptNotFound);
    res.status(204).end();
  });
}

// The named parameters of the SQL above; expiresOnGiven tells a given expiry (or null = not known) from a left-out one.
function values(input: z.infer<typeof attemptInput>) {
  const waiting = input.outcome === 'waiting';
  return {
    examDate: input.examDate,
    outcome: input.outcome,
    score: waiting ? null : input.score,
    // Before the result there is no grade to know (NULL); afterwards an empty text means the exam has none.
    grade: waiting ? null : (input.grade ?? ''),
    expiresOn: input.expiresOn ?? null,
    expiresOnGiven: input.expiresOn !== undefined,
    memo: input.memo,
  };
}
