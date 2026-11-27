import type { PoolClient } from 'pg';

import type { ImportFile } from './data-transfer-file.js';

// Restore from an export file by merging it in, keeping what exists (#211, user decision 2026-11-27):
// a row whose natural key is already in the database is skipped and never overwritten, and every other
// row is added. Rows match on natural keys, not ids; a row that points at another row follows that row's
// match, so children of a skipped parent are matched against the parent that already exists.
//
// Natural keys (the one place to change them):
//   certifications  name + category + issuer
//   examAttempts    certification + exam date
//   studyStages     certification + title
//   studyTasks      stage + title
//   userActions     title + reminder start date

type TableResult = { added: number; skipped: number };
type ImportResult = Record<keyof ImportFile['tables'], TableResult>;

type Ids = Map<number, number>;

const one = async (client: PoolClient, text: string, values: unknown[]) =>
  (await client.query<{ id: number }>(text, values)).rows[0]?.id;

/** Runs inside the caller's transaction: any error leaves the caller to roll everything back. */
export async function mergeImport(client: PoolClient, file: ImportFile): Promise<ImportResult> {
  const { tables } = file;
  const result: ImportResult = {
    certifications: { added: 0, skipped: 0 },
    examAttempts: { added: 0, skipped: 0 },
    studyStages: { added: 0, skipped: 0 },
    studyTasks: { added: 0, skipped: 0 },
    userActions: { added: 0, skipped: 0 },
  };
  // Records one row: existing means skipped, otherwise added.
  const count = (name: keyof ImportResult, existed: boolean) => {
    result[name][existed ? 'skipped' : 'added'] += 1;
  };

  // Parents are written before their children, and the file's ids are translated to the database's.
  const goals: Ids = new Map();
  for (const item of tables.certifications) {
    const existing = await one(
      client,
      `SELECT id FROM certifications WHERE name = $1 AND category = $2 AND issuer = $3 ORDER BY id LIMIT 1`,
      [item.name, item.category, item.issuer],
    );
    const id =
      existing ??
      (await one(
        client,
        `INSERT INTO certifications
           (name, category, issuer, status, goal_text, target_score, target_exam_date, validity_kind,
            validity_months, grade_scale, target_grade, memo, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          item.name,
          item.category,
          item.issuer,
          item.status,
          item.goalText,
          item.targetScore,
          item.targetExamDate,
          item.validityKind,
          item.validityMonths,
          item.gradeScale,
          item.targetGrade,
          item.memo,
          item.createdAt,
          item.updatedAt,
        ],
      ));
    goals.set(item.id, id);
    count('certifications', existing !== undefined);
  }

  for (const item of tables.examAttempts) {
    const goalId = goals.get(item.certificationId)!;
    const existing = await one(
      client,
      `SELECT id FROM exam_attempts WHERE certification_id = $1 AND exam_date = $2 LIMIT 1`,
      [goalId, item.examDate],
    );
    if (existing === undefined) {
      await client.query(
        `INSERT INTO exam_attempts
           (certification_id, exam_date, outcome, score, grade, expires_on, memo, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          goalId,
          item.examDate,
          item.outcome,
          item.score,
          item.grade,
          item.expiresOn,
          item.memo,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
    count('examAttempts', existing !== undefined);
  }

  // The file's own position when it is free under that parent, otherwise the next free one.
  const position = async (
    table: 'study_stages' | 'study_tasks',
    parent: string,
    parentId: number,
    wanted: number,
  ) => {
    const taken = await one(
      client,
      `SELECT id FROM ${table} WHERE ${parent} = $1 AND position = $2`,
      [parentId, wanted],
    );
    if (taken === undefined) return wanted;
    const { rows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ${table} WHERE ${parent} = $1`,
      [parentId],
    );
    return rows[0].next;
  };

  const stages: Ids = new Map();
  for (const item of [...tables.studyStages].sort((a, b) => a.position - b.position)) {
    const goalId = goals.get(item.certificationId)!;
    const existing = await one(
      client,
      `SELECT id FROM study_stages WHERE certification_id = $1 AND title = $2 ORDER BY id LIMIT 1`,
      [goalId, item.title],
    );
    const id =
      existing ??
      (await one(
        client,
        `INSERT INTO study_stages (certification_id, title, position, start_date, end_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          goalId,
          item.title,
          await position('study_stages', 'certification_id', goalId, item.position),
          item.startDate,
          item.endDate,
          item.createdAt,
          item.updatedAt,
        ],
      ));
    stages.set(item.id, id);
    count('studyStages', existing !== undefined);
  }

  for (const item of [...tables.studyTasks].sort((a, b) => a.position - b.position)) {
    const stageId = stages.get(item.stageId)!;
    const existing = await one(
      client,
      `SELECT id FROM study_tasks WHERE stage_id = $1 AND title = $2 LIMIT 1`,
      [stageId, item.title],
    );
    if (existing === undefined) {
      await client.query(
        `INSERT INTO study_tasks (stage_id, title, position, due_date, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stageId,
          item.title,
          await position('study_tasks', 'stage_id', stageId, item.position),
          item.dueDate,
          item.completedAt,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
    count('studyTasks', existing !== undefined);
  }

  for (const item of tables.userActions) {
    const existing = await one(
      client,
      `SELECT id FROM user_actions WHERE title = $1 AND remind_from = $2 LIMIT 1`,
      [item.title, item.remindFrom],
    );
    if (existing === undefined) {
      await client.query(
        `INSERT INTO user_actions
           (title, note, link_url, remind_from, due_date, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.title,
          item.note,
          item.linkUrl,
          item.remindFrom,
          item.dueDate,
          item.completedAt,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
    count('userActions', existing !== undefined);
  }

  return result;
}
