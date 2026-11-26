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
