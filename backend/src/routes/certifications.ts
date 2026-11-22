import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { gradeScaleKeys, gradeScales, hasLevel } from '../grade-scales.js';
import { named } from '../named-params.js';
import { HttpError, parseId, serviceDate } from '../standard/http.js';
import { body, calendarDate, shortText } from '../validation.js';

// Certification goals (#30). Columns and rules: docs/design/scope-and-data-model.md section 5.

const categories = ['english', 'dev', 'life'] as const;
const statuses = ['planned', 'studying', 'registered', 'taken', 'passed', 'failed'] as const;
const validityKinds = ['months', 'none', 'unknown'] as const;

// PUT replaces the whole goal, so POST and PUT share one input; omitted optional fields take their defaults.
export const certificationInput = z
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
  id: number;
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

// :today is today (YYYY-MM-DD in Asia/Seoul); daysUntilExam is negative once the date has passed.
const columns = `id, name, category, issuer, status, goal_text AS "goalText",
  target_score AS "targetScore", target_exam_date AS "targetExamDate",
  target_exam_date - :today::date AS "daysUntilExam",
  validity_kind AS "validityKind", validity_months AS "validityMonths", memo,
  grade_scale AS "gradeScale", target_grade AS "targetGrade"`;

const notFoundMessage = 'Certification goal not found';

/**
 * The goals in menu order, nearest exam first. The list route and the AI tool share it; `limit` is for the tool only,
 * the route lists them all (a person has a handful).
 */
export async function listCertifications(
  db: Pick<Pool, 'query'>,
  limit?: number,
  current = serviceDate(),
) {
  const query = named(
    `SELECT ${columns} FROM certifications
     ORDER BY array_position(ARRAY['english', 'dev', 'life'], category),
       target_exam_date ASC NULLS LAST, id${limit === undefined ? '' : ' LIMIT :limit'}`,
    { today: current, limit },
  );
  const { rows } = await db.query<CertificationRow>(query.text, query.values);
  return { today: current, certifications: rows };
}

export function registerCertificationRoutes(app: Express, pool: Pool, today: () => string) {
  app.get('/api/grade-scales', (_req, res) => {
    res.json({ scales: gradeScales });
  });

  // Grouped by category in menu order, then the nearest target exam date first; no date goes last.
  app.get('/api/certifications', async (_req, res) => {
    res.json(await listCertifications(pool, undefined, today()));
  });

  app.get('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const current = today();
    const query = named(`SELECT ${columns} FROM certifications WHERE id = :id`, {
      today: current,
      id,
    });
    const { rows } = await pool.query<CertificationRow>(query.text, query.values);
    if (!rows[0]) throw new HttpError(404, notFoundMessage);
    res.json({ today: current, certification: rows[0] });
  });

  app.post('/api/certifications', async (req, res) => {
    const input = certificationInput.parse(body(req.body));
    const query = named(
      `INSERT INTO certifications (name, category, issuer, status, goal_text, target_score,
         target_exam_date, validity_kind, validity_months, memo, grade_scale, target_grade)
       VALUES (:name, :category, :issuer, :status, :goalText, :targetScore, :targetExamDate,
         :validityKind, :validityMonths, :memo, :gradeScale, :targetGrade)
       RETURNING ${columns}`,
      { today: today(), ...input },
    );
    const { rows } = await pool.query<CertificationRow>(query.text, query.values);
    res.status(201).json({ certification: rows[0] });
  });

  app.put('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const input = certificationInput.parse(body(req.body));
    // One statement, so the goal and its attempts' expiry dates change together. When the validity kind or months
    // change, the expiry of every passed or scored attempt is recomputed from the new rule (exam date + months, or
    // none when the goal does not expire or its validity is unknown). `old` is the goal before this UPDATE.
    const query = named(
      `WITH old AS (
         SELECT validity_kind, validity_months FROM certifications WHERE id = :id
       ), recomputed AS (
         UPDATE exam_attempts a SET updated_at = now(),
           expires_on = CASE WHEN :validityKind::text = 'months'
             THEN (a.exam_date + make_interval(months => :validityMonths::integer))::date END
         FROM old
         WHERE a.certification_id = :id AND a.outcome IN ('passed', 'scored')
           AND (old.validity_kind IS DISTINCT FROM :validityKind::text
             OR old.validity_months IS DISTINCT FROM :validityMonths::integer)
       )
       UPDATE certifications SET name = :name, category = :category, issuer = :issuer, status = :status,
         goal_text = :goalText, target_score = :targetScore, target_exam_date = :targetExamDate,
         validity_kind = :validityKind, validity_months = :validityMonths, memo = :memo,
         grade_scale = :gradeScale, target_grade = :targetGrade, updated_at = now()
       WHERE id = :id
       RETURNING ${columns}`,
      { today: today(), ...input, id },
    );
    const { rows } = await pool.query<CertificationRow>(query.text, query.values);
    if (!rows[0]) throw new HttpError(404, notFoundMessage);
    res.json({ certification: rows[0] });
  });

  // Exam attempts (#32) and study plans (#33) go with the goal.
  app.delete('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'certification goal');
    const { rowCount } = await pool.query('DELETE FROM certifications WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, notFoundMessage);
    res.status(204).end();
  });
}
