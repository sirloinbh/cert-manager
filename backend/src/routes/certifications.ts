import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError, parseId } from '../standard/http.js';

// Certification goals (#30). Columns and rules: docs/design/scope-and-data-model.md section 5.

const categories = ['english', 'dev', 'life'] as const;
const statuses = ['planned', 'studying', 'registered', 'taken', 'passed', 'failed'] as const;
const validityKinds = ['months', 'none', 'unknown'] as const;

// A real calendar day as YYYY-MM-DD: 2026-02-30 is rejected, not rolled over to March.
const calendarDate = z
  .string({ message: '목표 시험일은 YYYY-MM-DD 형식이어야 합니다' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, '목표 시험일은 YYYY-MM-DD 형식이어야 합니다')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, '목표 시험일이 실제 날짜가 아닙니다');

const shortText = (label: string) =>
  z
    .string({ message: `${label}은 문자열이어야 합니다` })
    .trim()
    .max(200, `${label}은 200자 이하로 입력해 주세요`);

// PUT replaces the whole goal, so POST and PUT share one input; omitted optional fields take their defaults.
const certificationInput = z
  .object({
    name: z
      .string({ message: '자격증 이름을 입력해 주세요' })
      .trim()
      .min(1, '자격증 이름을 입력해 주세요')
      .max(200, '자격증 이름은 200자 이하로 입력해 주세요'),
    category: z.enum(categories, { message: '분류는 영어, 개발, 생활 중 하나여야 합니다' }),
    issuer: shortText('주관 기관').default(''),
    status: z
      .enum(statuses, {
        message: '상태는 계획, 공부 중, 접수, 응시 완료, 합격, 불합격 중 하나여야 합니다',
      })
      .default('planned'),
    goalText: shortText('목표 설명').default(''),
    targetScore: z
      .number({ message: '목표 점수는 숫자여야 합니다' })
      .int('목표 점수는 정수여야 합니다')
      .min(0, '목표 점수는 0 이상이어야 합니다')
      .max(100000, '목표 점수는 100000 이하여야 합니다')
      .nullable()
      .default(null),
    targetExamDate: calendarDate.nullable().default(null),
    validityKind: z
      .enum(validityKinds, {
        message: '유효기간 종류는 개월 수, 만료 없음, 모름 중 하나여야 합니다',
      })
      .default('unknown'),
    validityMonths: z
      .number({ message: '유효기간 개월 수는 숫자여야 합니다' })
      .int('유효기간 개월 수는 정수여야 합니다')
      .min(1, '유효기간 개월 수는 1 이상이어야 합니다')
      .max(1200, '유효기간 개월 수는 1200 이하여야 합니다')
      .nullable()
      .default(null),
    memo: z.string({ message: '메모는 문자열이어야 합니다' }).default(''),
  })
  .superRefine((input, ctx) => {
    if (input.validityKind === 'months' && input.validityMonths === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['validityMonths'],
        message: '유효기간 개월 수를 입력해 주세요',
      });
    }
    if (input.validityKind !== 'months' && input.validityMonths !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['validityMonths'],
        message: '유효기간이 개월 수가 아니면 개월 수를 비워 주세요',
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
};

// $1 is today (YYYY-MM-DD in Asia/Seoul); daysUntilExam is negative once the date has passed.
const columns = `id::text AS id, name, category, issuer, status, goal_text AS "goalText",
  target_score AS "targetScore", target_exam_date AS "targetExamDate",
  target_exam_date - $1::date AS "daysUntilExam",
  validity_kind AS "validityKind", validity_months AS "validityMonths", memo`;

// pg returns bigint as a string; ids stay within 15 digits, so they are exact as numbers.
function toCertification(row: CertificationRow) {
  const id = Number(row.id);
  if (!Number.isSafeInteger(id)) throw new Error(`certification id out of range: ${row.id}`);
  return { ...row, id };
}

const notFoundMessage = '자격증 목표를 찾을 수 없습니다';

// Express leaves req.body undefined without a JSON body; parse {} so field messages stay Korean.
const body = (value: unknown) => value ?? {};

export function registerCertificationRoutes(app: Express, pool: Pool, today: () => string) {
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
    const id = parseId(req.params.id, '자격증 목표');
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
         target_exam_date, validity_kind, validity_months, memo)
       VALUES ($2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${columns}`,
      [today(), ...values(input)],
    );
    res.status(201).json({ certification: toCertification(rows[0]) });
  });

  app.put('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const input = certificationInput.parse(body(req.body));
    const { rows } = await pool.query<CertificationRow>(
      `UPDATE certifications SET name = $2, category = $3, issuer = $4, status = $5, goal_text = $6,
         target_score = $7, target_exam_date = $8, validity_kind = $9, validity_months = $10,
         memo = $11, updated_at = now()
       WHERE id = $12
       RETURNING ${columns}`,
      [today(), ...values(input), id],
    );
    if (!rows[0]) throw new HttpError(404, notFoundMessage);
    res.json({ certification: toCertification(rows[0]) });
  });

  // Exam attempts and study plans (#32, #33) will cascade with the goal.
  app.delete('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
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
  ];
}
