import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError, parseId } from '../standard/http.js';
import { body, calendarDate, toId } from '../validation.js';

// Study plans (#33): a goal's stages and their tasks. Columns and rules: docs/design/scope-and-data-model.md section 5.

const title = (label: string) =>
  z
    .string({ message: `${label}을 입력해 주세요` })
    .trim()
    .min(1, `${label}을 입력해 주세요`)
    .max(200, `${label}은 200자 이하로 입력해 주세요`);

// express.json() accepts an array or a bare value too; the message stays Korean.
const objectMessage = { message: '요청 본문은 JSON 객체여야 합니다' };

// PUT replaces the whole stage or task, so POST and PUT share one input.
const stageInput = z
  .object(
    {
      title: title('단계 이름'),
      startDate: calendarDate('시작일').nullable().default(null),
      endDate: calendarDate('종료일').nullable().default(null),
    },
    objectMessage,
  )
  .superRefine((input, ctx) => {
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '종료일은 시작일 이후여야 합니다',
      });
    }
  });

const taskInput = z.object(
  {
    title: title('할 일'),
    dueDate: calendarDate('마감일').nullable().default(null),
  },
  objectMessage,
);

const completionInput = z.object(
  { completed: z.boolean({ message: '완료 여부는 true나 false여야 합니다' }) },
  objectMessage,
);

type StageRow = {
  id: string;
  certificationId: string;
  title: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
};

type TaskRow = {
  id: string;
  stageId: string;
  title: string;
  position: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  completedAt: Date | null;
};

const stageColumns = `s.id::text AS id, s.certification_id::text AS "certificationId", s.title, s.position,
  s.start_date AS "startDate", s.end_date AS "endDate"`;

// daysUntilDue is negative once the due date has passed. `today` names the query parameter.
const taskColumns = (
  today: string,
) => `t.id::text AS id, t.stage_id::text AS "stageId", t.title, t.position,
  t.due_date AS "dueDate", t.due_date - ${today}::date AS "daysUntilDue", t.completed_at AS "completedAt"`;

const toStage = (row: StageRow) => ({
  ...row,
  id: toId(row.id),
  certificationId: toId(row.certificationId),
});

const toTask = <T extends TaskRow>(row: T) => ({
  ...row,
  id: toId(row.id),
  stageId: toId(row.stageId),
});

const goalNotFound = '자격증 목표를 찾을 수 없습니다';
const stageNotFound = '공부 단계를 찾을 수 없습니다';
const taskNotFound = '할 일을 찾을 수 없습니다';

export function registerStudyPlanRoutes(app: Express, pool: Pool, today: () => string) {
  // Stages in order, each with its tasks in order.
  app.get('/api/certifications/:id/plan', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const current = today();
    const goal = await pool.query('SELECT 1 FROM certifications WHERE id = $1', [id]);
    if (!goal.rowCount) throw new HttpError(404, goalNotFound);
    const stages = await pool.query<StageRow>(
      `SELECT ${stageColumns} FROM study_stages s
       WHERE s.certification_id = $1
       ORDER BY s.position`,
      [id],
    );
    const tasks = await pool.query<TaskRow>(
      `SELECT ${taskColumns('$1')} FROM study_tasks t
       JOIN study_stages s ON s.id = t.stage_id
       WHERE s.certification_id = $2
       ORDER BY t.position`,
      [current, id],
    );
    const list = tasks.rows.map(toTask);
    res.json({
      today: current,
      stages: stages.rows.map(toStage).map((stage) => ({
        ...stage,
        tasks: list.filter((task) => task.stageId === stage.id),
      })),
    });
  });

  // The dashboard's list: not done and due today or earlier, the oldest first.
  app.get('/api/study-tasks/today', async (_req, res) => {
    const current = today();
    const { rows } = await pool.query<
      TaskRow & { certificationId: string; certificationName: string }
    >(
      `SELECT ${taskColumns('$1')}, c.id::text AS "certificationId", c.name AS "certificationName"
       FROM study_tasks t
       JOIN study_stages s ON s.id = t.stage_id
       JOIN certifications c ON c.id = s.certification_id
       WHERE t.completed_at IS NULL AND t.due_date <= $1::date
       ORDER BY t.due_date, c.id, s.position, t.position`,
      [current],
    );
    res.json({
      today: current,
      tasks: rows.map((row) => ({ ...toTask(row), certificationId: toId(row.certificationId) })),
    });
  });

  // A new stage or task goes last. The goal or stage must exist, or the SELECT inserts nothing.
  app.post('/api/certifications/:id/stages', async (req, res) => {
    const id = parseId(req.params.id, '자격증 목표');
    const input = stageInput.parse(body(req.body));
    const { rows } = await pool.query<StageRow>(
      `INSERT INTO study_stages AS s (certification_id, title, position, start_date, end_date)
       SELECT c.id, $2::text,
         (SELECT COALESCE(MAX(e.position), 0) + 1 FROM study_stages e WHERE e.certification_id = c.id),
         $3::date, $4::date
       FROM certifications c WHERE c.id = $1
       RETURNING ${stageColumns}`,
      [id, input.title, input.startDate, input.endDate],
    );
    if (!rows[0]) throw new HttpError(404, goalNotFound);
    res.status(201).json({ stage: { ...toStage(rows[0]), tasks: [] } });
  });

  app.put('/api/study-stages/:id', async (req, res) => {
    const id = parseId(req.params.id, '공부 단계');
    const input = stageInput.parse(body(req.body));
    const { rows } = await pool.query<StageRow>(
      `UPDATE study_stages s SET title = $2, start_date = $3, end_date = $4, updated_at = now()
       WHERE s.id = $1
       RETURNING ${stageColumns}`,
      [id, input.title, input.startDate, input.endDate],
    );
    if (!rows[0]) throw new HttpError(404, stageNotFound);
    res.json({ stage: toStage(rows[0]) });
  });

  // Its tasks go with it.
  app.delete('/api/study-stages/:id', async (req, res) => {
    const id = parseId(req.params.id, '공부 단계');
    const { rowCount } = await pool.query('DELETE FROM study_stages WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, stageNotFound);
    res.status(204).end();
  });

  app.post('/api/study-stages/:id/tasks', async (req, res) => {
    const id = parseId(req.params.id, '공부 단계');
    const input = taskInput.parse(body(req.body));
    const { rows } = await pool.query<TaskRow>(
      `INSERT INTO study_tasks AS t (stage_id, title, position, due_date)
       SELECT s.id, $2::text,
         (SELECT COALESCE(MAX(e.position), 0) + 1 FROM study_tasks e WHERE e.stage_id = s.id),
         $3::date
       FROM study_stages s WHERE s.id = $1
       RETURNING ${taskColumns('$4')}`,
      [id, input.title, input.dueDate, today()],
    );
    if (!rows[0]) throw new HttpError(404, stageNotFound);
    res.status(201).json({ task: toTask(rows[0]) });
  });

  app.put('/api/study-tasks/:id', async (req, res) => {
    const id = parseId(req.params.id, '할 일');
    const input = taskInput.parse(body(req.body));
    const { rows } = await pool.query<TaskRow>(
      `UPDATE study_tasks t SET title = $2, due_date = $3, updated_at = now()
       WHERE t.id = $1
       RETURNING ${taskColumns('$4')}`,
      [id, input.title, input.dueDate, today()],
    );
    if (!rows[0]) throw new HttpError(404, taskNotFound);
    res.json({ task: toTask(rows[0]) });
  });

  // Asking for a finished task to be finished again keeps the moment it was first finished.
  app.patch('/api/study-tasks/:id/completion', async (req, res) => {
    const id = parseId(req.params.id, '할 일');
    const input = completionInput.parse(body(req.body));
    const { rows } = await pool.query<TaskRow>(
      `UPDATE study_tasks t
       SET completed_at = CASE WHEN $2::boolean THEN COALESCE(t.completed_at, now()) END,
         updated_at = now()
       WHERE t.id = $1
       RETURNING ${taskColumns('$3')}`,
      [id, input.completed, today()],
    );
    if (!rows[0]) throw new HttpError(404, taskNotFound);
    res.json({ task: toTask(rows[0]) });
  });

  app.delete('/api/study-tasks/:id', async (req, res) => {
    const id = parseId(req.params.id, '할 일');
    const { rowCount } = await pool.query('DELETE FROM study_tasks WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, taskNotFound);
    res.status(204).end();
  });
}
