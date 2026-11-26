import type { PoolClient } from 'pg';

// Personal data backup (#210). Which tables leave the database, in which columns, and how they are written.
// Words, daily words, songs and lyrics are left out on purpose: the import scripts rebuild them.

/** The format version of the export file. Raise it when a change would make an older file unreadable. */
export const exportVersion = 1;

type Table = {
  /** The key in the JSON file and the name of the CSV file. */
  name: string;
  /** Parents come before their children, so a restore can insert in this order. */
  select: string;
  columns: string[];
};

const stamps = `created_at AS "createdAt", updated_at AS "updatedAt"`;

export const exportTables: readonly Table[] = [
  {
    name: 'certifications',
    columns: [
      'id',
      'name',
      'category',
      'issuer',
      'status',
      'goalText',
      'targetScore',
      'targetExamDate',
      'validityKind',
      'validityMonths',
      'gradeScale',
      'targetGrade',
      'memo',
      'createdAt',
      'updatedAt',
    ],
    select: `SELECT id, name, category, issuer, status, goal_text AS "goalText", target_score AS "targetScore",
      target_exam_date AS "targetExamDate", validity_kind AS "validityKind", validity_months AS "validityMonths",
      grade_scale AS "gradeScale", target_grade AS "targetGrade", memo, ${stamps}
      FROM certifications ORDER BY id`,
  },
  {
    name: 'examAttempts',
    columns: [
      'id',
      'certificationId',
      'examDate',
      'outcome',
      'score',
      'grade',
      'expiresOn',
      'memo',
      'createdAt',
      'updatedAt',
    ],
    select: `SELECT id, certification_id AS "certificationId", exam_date AS "examDate", outcome, score, grade,
      expires_on AS "expiresOn", memo, ${stamps} FROM exam_attempts ORDER BY id`,
  },
  {
    name: 'studyStages',
    columns: [
      'id',
      'certificationId',
      'title',
      'position',
      'startDate',
      'endDate',
      'createdAt',
      'updatedAt',
    ],
    select: `SELECT id, certification_id AS "certificationId", title, position, start_date AS "startDate",
      end_date AS "endDate", ${stamps} FROM study_stages ORDER BY id`,
  },
  {
    name: 'studyTasks',
    columns: [
      'id',
      'stageId',
      'title',
      'position',
      'dueDate',
      'completedAt',
      'createdAt',
      'updatedAt',
    ],
    select: `SELECT id, stage_id AS "stageId", title, position, due_date AS "dueDate",
      completed_at AS "completedAt", ${stamps} FROM study_tasks ORDER BY id`,
  },
  {
    name: 'userActions',
    columns: [
      'id',
      'title',
      'note',
      'linkUrl',
      'remindFrom',
      'dueDate',
      'completedAt',
      'createdAt',
      'updatedAt',
    ],
    select: `SELECT id, title, note, link_url AS "linkUrl", remind_from AS "remindFrom", due_date AS "dueDate",
      completed_at AS "completedAt", ${stamps} FROM user_actions ORDER BY id`,
  },
];

type ExportTables = Record<string, Record<string, unknown>[]>;

export type ExportFile = {
  version: number;
  exportedAt: string;
  tables: ExportTables;
};

/**
 * Reads every included table in one read-only snapshot, so the file never mixes two moments:
 * a task cannot point at a stage that was deleted between two reads.
 */
export async function readExport(client: PoolClient, now: Date): Promise<ExportFile> {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const tables: ExportTables = {};
    for (const table of exportTables) {
      tables[table.name] = (await client.query<Record<string, unknown>>(table.select)).rows;
    }
    return { version: exportVersion, exportedAt: now.toISOString(), tables };
  } finally {
    await client.query('ROLLBACK');
  }
}

const bom = String.fromCodePoint(0xfeff);

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  // A spreadsheet runs text that starts with these characters as a formula; a leading quote keeps it text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One table as CSV: a header row, then one row per record. Starts with a BOM so Excel reads UTF-8 (Korean). */
export function toCsv(table: Table, rows: Record<string, unknown>[]): string {
  const lines = [table.columns.join(',')];
  for (const row of rows) lines.push(table.columns.map((column) => cell(row[column])).join(','));
  return `${bom}${lines.join('\r\n')}\r\n`;
}
