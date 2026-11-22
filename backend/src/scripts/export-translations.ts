import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { exportTranslations, translationsDir } from './translation-files.js';

// Writes translation work files for songs not fully translated (#64).

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { written, kept } = await exportTranslations(pool, translationsDir);
  console.log(
    `${written.length} new files, ${kept.length} files left as they were: ${translationsDir}`,
  );
} finally {
  await pool.end();
}
