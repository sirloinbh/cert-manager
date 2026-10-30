import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError, parseId } from '../standard/http.js';
import { body, calendarDate, shortText, toId } from '../validation.js';

// Exam attempts and earned certifications (#32). Columns and rules: docs/design/scope-and-data-model.md section 5.

const outcomes = ['waiting', 'passed', 'failed', 'scored'] as const;

// PUT replaces the whole attempt, so POST and PUT share one input.
// expiresOn: a date is the user's value, null means "not known", and omitting it asks for the goal's default.
const attemptInput = z
  .object(
    {
      examDate: calendarDate('시험일'),
      outcome: z
        .enum(outcomes, { message: '결과는 결과 전, 합격, 불합격, 점수·등급 중 하나여야 합니다' })
        .default('waiting'),
      score: z
        .number({ message: '점수는 숫자여야 합니다' })
        .int('점수는 정수여야 합니다')
        .min(0, '점수는 0 이상이어야 합니다')
        .max(100000, '점수는 100000 이하여야 합니다')
        .nullable()
        .default(null),
      grade: shortText('등급').nullable().default(null),
      expiresOn: calendarDate('만료일').nullable().optional(),
      memo: z.string({ message: '메모는 문자열이어야 합니다' }).default(''),
    },
    // express.json() accepts an array or a bare value too; the message stays Korean.
    { message: '요청 본문은 JSON 객체여야 합니다' },
  )
  .superRefine((input, ctx) => {
    if (input.outcome === 'waiting' && (input.score !== null || input.grade)) {
      ctx.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: '결과 전에는 점수와 등급을 비워 주세요',
      });
    }
    if (input.expiresOn && input.expiresOn < input.examDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresOn'],
        message: '만료일은 시험일 이후여야 합니다',
      });
    }
  });

type AttemptRow = {
  id: string;
  certificationId: string;
  examDate: string;
  outcome: (typeof outcomes)[number];
  score: number | null;
  grade: string | null;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  memo: string;
};

// daysUntilExpiry is negative once the last valid day has passed. `today` names the query parameter.
const columns = (today: string) => `a.id::text AS id, a.certification_id::text AS "certificationId",
  a.exam_date AS "examDate", a.outcome, a.score, a.grade, a.expires_on AS "expiresOn",
  a.expires_on - ${today}::date AS "daysUntilExpiry", a.memo`;

// Used by INSERT and UPDATE with the parameters from values(); `c` is the goal.
// Adding months clamps to the month's last day (2024-02-29 + 24 months = 2026-02-28).
const expiresOn = `CASE
    WHEN $3::text NOT IN ('passed', 'scored') OR c.validity_kind = 'none' THEN NULL
    WHEN $7::boolean THEN $6::date
    WHEN c.validity_kind = 'months' THEN ($2::date + make_interval(months => c.validity_months))::date
  END`;

const toAttempt = <T extends AttemptRow>(row: T) => ({
  ...row,
  id: toId(row.id),
  certificationId: toId(row.certificationId),
});

const goalNotFound = '자격증 목표를 찾을 수 없습니다';
const attemptNotFound = '응시 기록을 찾을 수 없습니다';

export function registerExamAttemptRoutes(app: Express, pool: Pool, today: () => string) {
  // The newest passed or scored attempt of each goal, which decides that goal's expiry on the dashboard.
  app.get('/api/exam-attempts/latest', async (_req, res) => {
    const current = today();
    const { rows } = await pool.query<AttemptRow & { name: string; validityKind: string }>(
      `SELECT DISTINCT ON (a.certification_id) ${columns('$1')},
         c.name, c.validity_kind AS "validityKind"
       FROM exam_attempts a
       JOIN certifications c ON c.id = a.certification_id
       WHERE a.outcome IN ('passed', 'scored')
       ORDER BY a.certification_id, a.exam_date DESC, a.id DESC`,
      [current],
    );
    res.json({ today: current, attempts: rows.map(toAttempt) });
  });

  // Newest exam first.
  app.get('/api/certifications/:id/attempts', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const current = today();
    const goal = await pool.query('SELECT 1 FROM certifications WHERE id = $1', [id]);
    if (!goal.rowCount) throw new HttpError(404, goalNotFound);
    const { rows } = await pool.query<AttemptRow>(
      `SELECT ${columns('$1')} FROM exam_attempts a
       WHERE a.certification_id = $2
       ORDER BY a.exam_date DESC, a.id DESC`,
      [current, id],
    );
    res.json({ today: current, attempts: rows.map(toAttempt) });
  });

  app.post('/api/certifications/:id/attempts', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const input = attemptInput.parse(body(req.body));
    const { rows } = await pool.query<AttemptRow>(
      `INSERT INTO exam_attempts AS a
         (certification_id, exam_date, outcome, score, grade, expires_on, memo)
       SELECT c.id, $2::date, $3::text, $4::integer, $5::text, ${expiresOn}, $8::text
       FROM certifications c WHERE c.id = $1
       RETURNING ${columns('$9')}`,
      [...values(id, input), today()],
    );
    if (!rows[0]) throw new HttpError(404, goalNotFound);
    res.status(201).json({ attempt: toAttempt(rows[0]) });
  });

  app.put('/api/certifications/:id/attempts/:attemptId', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const attemptId = parseId(req.params.attemptId, '응시 기록');
    const input = attemptInput.parse(body(req.body));
    const { rows } = await pool.query<AttemptRow>(
      `UPDATE exam_attempts a SET exam_date = $2::date, outcome = $3::text, score = $4::integer,
         grade = $5::text, expires_on = ${expiresOn}, memo = $8::text, updated_at = now()
       FROM certifications c
       WHERE a.id = $10 AND a.certification_id = $1 AND c.id = a.certification_id
       RETURNING ${columns('$9')}`,
      [...values(id, input), today(), attemptId],
    );
    if (!rows[0]) throw new HttpError(404, attemptNotFound);
    res.json({ attempt: toAttempt(rows[0]) });
  });

  app.delete('/api/certifications/:id/attempts/:attemptId', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const attemptId = parseId(req.params.attemptId, '응시 기록');
    const { rowCount } = await pool.query(
      'DELETE FROM exam_attempts WHERE id = $1 AND certification_id = $2',
      [attemptId, id],
    );
    if (!rowCount) throw new HttpError(404, attemptNotFound);
    res.status(204).end();
  });
}

// $1 goal, $2 exam date, $3 outcome, $4 score, $5 grade, $6 expiry, $7 whether $6 was given, $8 memo.
function values(certificationId: number, input: z.infer<typeof attemptInput>) {
  const waiting = input.outcome === 'waiting';
  return [
    certificationId,
    input.examDate,
    input.outcome,
    waiting ? null : input.score,
    // Before the result there is no grade to know (NULL); afterwards an empty text means the exam has none.
    waiting ? null : (input.grade ?? ''),
    input.expiresOn ?? null,
    input.expiresOn !== undefined,
    input.memo,
  ];
}
