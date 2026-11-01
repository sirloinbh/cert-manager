import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { exportTranslations, translationsDir } from './translation-files.js';

// Writes translation work files for songs not fully translated (#64).

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { written, kept } = await exportTranslations(pool, translationsDir);
  console.log(`새 파일 ${written.length}개, 그대로 둔 파일 ${kept.length}개: ${translationsDir}`);
} finally {
  await pool.end();
}
