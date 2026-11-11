import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { body, calendarDate, toId } from '../validation.js';

// Things the user must do outside the app, shown as alerts (#60). Columns: docs/design/scope-and-data-model.md section 5.

const objectMessage = { error: 'Request body must be a JSON object' };

const actionInput = z
  .object(
    {
      title: z
        .string({ error: 'Task is required' })
        .trim()
        .refine((value) => value.length >= 1, 'Task is required')
        .refine((value) => value.length <= 200, 'Task must be 200 characters or fewer'),
      note: z.string({ error: 'Note must be text' }).default(''),
      // The link becomes an href, so only web addresses are accepted.
      linkUrl: z
        .string({ error: 'Link must be text' })
        .regex(/^(https?:\/\/\S+)?$/i, 'Link must be an http or https address')
        .default(''),
      remindFrom: calendarDate('Reminder start date'),
      dueDate: calendarDate('Due date').nullable().default(null),
    },
    objectMessage,
  )
  .superRefine((input, ctx) => {
    if (input.dueDate && input.dueDate < input.remindFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Due date must be on or after the reminder start date',
      });
    }
  });

const completionInput = z.object(
  { completed: z.boolean({ error: 'Completed must be true or false' }) },
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

const notFoundMessage = 'Custom task not found';

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
    const id = parseId(req.params.id, 'custom task');
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
    const id = parseId(req.params.id, 'custom task');
    const { rowCount } = await pool.query('DELETE FROM user_actions WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, notFoundMessage);
    res.status(204).end();
  });
}
