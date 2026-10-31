import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError, parseId } from '../standard/http.js';
import { body, calendarDate, toId } from '../validation.js';

// Things the user must do outside the app, shown as alerts (#60). Columns: docs/design/scope-and-data-model.md section 5.

const objectMessage = { message: '요청 본문은 JSON 객체여야 합니다' };

const actionInput = z
  .object(
    {
      title: z
        .string({ message: '할 일을 입력해 주세요' })
        .trim()
        .min(1, '할 일을 입력해 주세요')
        .max(200, '할 일은 200자 이하로 입력해 주세요'),
      note: z.string({ message: '설명은 문자열이어야 합니다' }).default(''),
      // The link becomes an href, so only web addresses are accepted.
      linkUrl: z
        .string({ message: '링크는 문자열이어야 합니다' })
        .regex(/^(https?:\/\/\S+)?$/i, '링크는 http 또는 https 주소여야 합니다')
        .default(''),
      remindFrom: calendarDate('알림 시작일'),
      dueDate: calendarDate('마감일').nullable().default(null),
    },
    objectMessage,
  )
  .superRefine((input, ctx) => {
    if (input.dueDate && input.dueDate < input.remindFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: '마감일은 알림 시작일 이후여야 합니다',
      });
    }
  });

const completionInput = z.object(
  { completed: z.boolean({ message: '완료 여부는 true나 false여야 합니다' }) },
  objectMessage,
);

type ActionRow = {
  id: string;
  title: string;
  note: string;
  linkUrl: string;
  remindFrom: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  completedAt: Date | null;
};

// daysUntilDue is negative once the due date has passed. `today` names the query parameter.
const columns = (today: string) => `id::text AS id, title, note, link_url AS "linkUrl",
  remind_from AS "remindFrom", due_date AS "dueDate", due_date - ${today}::date AS "daysUntilDue",
  completed_at AS "completedAt"`;

const toAction = (row: ActionRow) => ({ ...row, id: toId(row.id) });

const notFoundMessage = '직접 할 일을 찾을 수 없습니다';

export function registerUserActionRoutes(app: Express, pool: Pool, today: () => string) {
  // What needs attention now: not done and past its reminder day, the nearest deadline first.
  app.get('/api/user-actions', async (_req, res) => {
    const current = today();
    const { rows } = await pool.query<ActionRow>(
      `SELECT ${columns('$1')} FROM user_actions
       WHERE completed_at IS NULL AND remind_from <= $1::date
       ORDER BY due_date ASC NULLS LAST, remind_from, id`,
      [current],
    );
    res.json({ today: current, actions: rows.map(toAction) });
  });

  app.post('/api/user-actions', async (req, res) => {
    const input = actionInput.parse(body(req.body));
    const { rows } = await pool.query<ActionRow>(
      `INSERT INTO user_actions (title, note, link_url, remind_from, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${columns('$6')}`,
      [input.title, input.note, input.linkUrl, input.remindFrom, input.dueDate, today()],
    );
    res.status(201).json({ action: toAction(rows[0]) });
  });

  // Marking it done again keeps the first time; undoing clears it.
  app.put('/api/user-actions/:id/completion', async (req, res) => {
    const id = parseId(req.params.id, '직접 할 일');
    const input = completionInput.parse(body(req.body));
    const { rows } = await pool.query<ActionRow>(
      `UPDATE user_actions
       SET completed_at = CASE WHEN $2::boolean THEN COALESCE(completed_at, now()) END,
         updated_at = now()
       WHERE id = $1
       RETURNING ${columns('$3')}`,
      [id, input.completed, today()],
    );
    if (!rows[0]) throw new HttpError(404, notFoundMessage);
    res.json({ action: toAction(rows[0]) });
  });

  app.delete('/api/user-actions/:id', async (req, res) => {
    const id = parseId(req.params.id, '직접 할 일');
    const { rowCount } = await pool.query('DELETE FROM user_actions WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, notFoundMessage);
    res.status(204).end();
  });
}
