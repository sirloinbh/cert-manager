import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { importTranslations, translationsDir } from './translation-files.js';

// Saves filled-in translation files (#64). A file that does not line up is not saved.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { saved, skipped, rejected } = await importTranslations(pool, translationsDir);
  for (const { file, reason } of rejected) console.warn(`Not saved ${file}: ${reason}`);
  console.log(
    `Saved ${saved.length} songs, ${skipped.length} not filled in yet, ${rejected.length} not saved`,
  );
  if (saved.length + skipped.length + rejected.length === 0) {
    console.log('No files to import. Run translations:export first.');
  }
  if (rejected.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
