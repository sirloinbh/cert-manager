import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { gradeScaleKeys, gradeScales, hasLevel } from '../grade-scales.js';
import { HttpError, parseId } from '../standard/http.js';
import { body, calendarDate, shortText, toId } from '../validation.js';

// Certification goals (#30). Columns and rules: docs/design/scope-and-data-model.md section 5.

const categories = ['english', 'dev', 'life'] as const;
const statuses = ['planned', 'studying', 'registered', 'taken', 'passed', 'failed'] as const;
const validityKinds = ['months', 'none', 'unknown'] as const;

// PUT replaces the whole goal, so POST and PUT share one input; omitted optional fields take their defaults.
const certificationInput = z
  .object(
    {
      name: z
        .string({ error: 'Certification name is required' })
        .trim()
        .refine((value) => value.length >= 1, 'Certification name is required')
        .refine(
          (value) => value.length <= 200,
          'Certification name must be 200 characters or fewer',
        ),
      category: z.enum(categories, { error: 'Category must be English, Development, or Life' }),
      issuer: shortText('Issuer').default(''),
      status: z
        .enum(statuses, {
          error: 'Status must be Planned, Studying, Registered, Taken, Passed, or Failed',
        })
        .default('planned'),
      goalText: shortText('Goal description').default(''),
      targetScore: z
        .number({ error: 'Target score must be a number' })
        .int('Target score must be a whole number')
        .min(0, 'Target score must be 0 or more')
        .max(100000, 'Target score must be 100000 or less')
        .nullable()
        .default(null),
      targetExamDate: calendarDate('Target exam date').nullable().default(null),
      validityKind: z
        .enum(validityKinds, {
          error: 'Validity type must be Months, No expiry, or Unknown',
        })
        .default('unknown'),
      validityMonths: z
        .number({ error: 'Validity months must be a number' })
        .int('Validity months must be a whole number')
        .min(1, 'Validity months must be 1 or more')
        .max(1200, 'Validity months must be 1200 or less')
        .nullable()
        .default(null),
      memo: z.string({ error: 'Memo must be text' }).default(''),
      gradeScale: z
        .enum(gradeScaleKeys, { error: 'Grade scale must be one of the listed values' })
        .default('none'),
      targetGrade: shortText('Target grade').nullable().default(null),
    },
    // express.json() accepts an array or a bare value too; the message stays English.
    { error: 'Request body must be a JSON object' },
  )
  .superRefine((input, ctx) => {
    if (input.validityKind === 'months' && input.validityMonths === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['validityMonths'],
        message: 'Enter the validity months',
      });
    }
    if (input.validityKind !== 'months' && input.validityMonths !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['validityMonths'],
        message: 'Leave the validity months empty unless the validity type is Months',
      });
    }
    if (input.targetGrade !== null && !hasLevel(input.gradeScale, input.targetGrade)) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetGrade'],
        message: 'Target grade must be a level of the chosen grade scale',
      });
    }
  });

type CertificationRow = {
  id: string;
  name: string;
  category: (typeof categories)[number];
  issuer: string;
  status: (typeof statuses)[number];
  goalText: string;
  targetScore: number | null;
  targetExamDate: string | null;
  daysUntilExam: number | null;
  validityKind: (typeof validityKinds)[number];
  validityMonths: number | null;
  memo: string;
  gradeScale: string;
  targetGrade: string | null;
};

// $1 is today (YYYY-MM-DD in Asia/Seoul); daysUntilExam is negative once the date has passed.
const columns = `id::text AS id, name, category, issuer, status, goal_text AS "goalText",
  target_score AS "targetScore", target_exam_date AS "targetExamDate",
  target_exam_date - $1::date AS "daysUntilExam",
  validity_kind AS "validityKind", validity_months AS "validityMonths", memo,
  grade_scale AS "gradeScale", target_grade AS "targetGrade"`;

const toCertification = (row: CertificationRow) => ({ ...row, id: toId(row.id) });

const notFoundMessage = 'Certification goal not found';

export function registerCertificationRoutes(app: Express, pool: Pool, today: () => string) {
  app.get('/api/grade-scales', (_req, res) => {
    res.json({ scales: gradeScales });
  });

  // Grouped by category in menu order, then the nearest target exam date first; no date goes last.
  app.get('/api/certifications', async (_req, res) => {
    const current = today();
    const { rows } = await pool.query<CertificationRow>(
      `SELECT ${columns} FROM certifications
       ORDER BY array_position(ARRAY['english', 'dev', 'life'], category),
         target_exam_date ASC NULLS LAST, id`,
      [current],
    );
    res.json({ today: current, certifications: rows.map(toCertification) });
  });

  app.get('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const current = today();
    const { rows } = await pool.query<CertificationRow>(
      `SELECT ${columns} FROM certifications WHERE id = $2`,
      [current, id],
    );
    if (!rows[0]) throw new HttpError(404, notFoundMessage);
    res.json({ today: current, certification: toCertification(rows[0]) });
  });

  app.post('/api/certifications', async (req, res) => {
    const input = certificationInput.parse(body(req.body));
    const { rows } = await pool.query<CertificationRow>(
      `INSERT INTO certifications (name, category, issuer, status, goal_text, target_score,
         target_exam_date, validity_kind, validity_months, memo, grade_scale, target_grade)
       VALUES ($2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${columns}`,
      [today(), ...values(input)],
    );
    res.status(201).json({ certification: toCertification(rows[0]) });
  });

  app.put('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const input = certificationInput.parse(body(req.body));
    // One statement, so a goal that stops expiring and its attempts' expiry dates change together.
    const { rows } = await pool.query<CertificationRow>(
      `WITH cleared AS (
         UPDATE exam_attempts SET expires_on = NULL, updated_at = now()
         WHERE certification_id = $14 AND $9::text = 'none' AND expires_on IS NOT NULL
       )
       UPDATE certifications SET name = $2, category = $3, issuer = $4, status = $5, goal_text = $6,
         target_score = $7, target_exam_date = $8, validity_kind = $9, validity_months = $10,
         memo = $11, grade_scale = $12, target_grade = $13, updated_at = now()
       WHERE id = $14
       RETURNING ${columns}`,
      [today(), ...values(input), id],
    );
    if (!rows[0]) throw new HttpError(404, notFoundMessage);
    res.json({ certification: toCertification(rows[0]) });
  });

  // Exam attempts (#32) and study plans (#33) go with the goal.
  app.delete('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const { rowCount } = await pool.query('DELETE FROM certifications WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, notFoundMessage);
    res.status(204).end();
  });
}

function values(input: z.infer<typeof certificationInput>) {
  return [
    input.name,
    input.category,
    input.issuer,
    input.status,
    input.goalText,
    input.targetScore,
    input.targetExamDate,
    input.validityKind,
    input.validityMonths,
    input.memo,
    input.gradeScale,
    input.targetGrade,
  ];
}
