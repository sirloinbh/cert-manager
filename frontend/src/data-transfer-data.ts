import { requestJson } from './lib/api';
// Backup of personal data (#210): the export addresses and the names shown for each table.
// The tables and the file format are defined in backend/src/data-transfer.ts.

export const exportJsonPath = '/api/data-transfer/export';

export const exportTables = [
  { name: 'certifications', label: 'Certifications' },
  { name: 'examAttempts', label: 'Exam attempts' },
  { name: 'studyStages', label: 'Study stages' },
  { name: 'studyTasks', label: 'Study tasks' },
  { name: 'userActions', label: 'Custom tasks' },
] as const;

export const exportCsvPath = (table: string) => `${exportJsonPath}/${table}`;

// Restore (#211): merge a file into the database, keeping what exists.
const importPath = '/api/data-transfer/import';

type TableResult = { added: number; skipped: number };
export type ImportResult = Record<(typeof exportTables)[number]['name'], TableResult>;

export const importApi = {
  merge: (file: unknown) =>
    requestJson<{ result: ImportResult }>(importPath, { method: 'POST', body: file }),
};

/** How many rows a file holds in the included tables; 0 when it is not an export file at all. */
export function rowCount(file: unknown): number {
  const tables = (file as { tables?: Record<string, unknown> } | null)?.tables;
  if (!tables || typeof tables !== 'object') return 0;
  return exportTables.reduce((sum, table) => {
    const rows = tables[table.name];
    return sum + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
}

/** "Added 3, skipped 2 that already existed." */
export function importSummary(result: ImportResult): string {
  const all = Object.values(result);
  const added = all.reduce((sum, table) => sum + table.added, 0);
  const skipped = all.reduce((sum, table) => sum + table.skipped, 0);
  return `Added ${added} ${added === 1 ? 'row' : 'rows'}, skipped ${skipped} that already existed.`;
}
