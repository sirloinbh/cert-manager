import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { importTranslations, translationsDir } from './translation-files.js';

// Saves filled-in translation files (#64). A file that does not line up is not saved.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { saved, rejected } = await importTranslations(pool, translationsDir);
  for (const { file, reason } of rejected) console.warn(`저장 안 함 ${file}: ${reason}`);
  console.log(`저장 ${saved.length}곡, 저장 안 함 ${rejected.length}곡`);
  if (rejected.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
