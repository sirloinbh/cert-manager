import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { importWordBatches, wordBatchesDir } from './word-files.js';

// Saves filled-in word batches (#36). A batch that does not fit is not saved.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { saved, rejected } = await importWordBatches(pool, wordBatchesDir);
  for (const { file, reason } of rejected) console.warn(`저장 안 함 ${file}: ${reason}`);
  console.log(`저장 ${saved.length}개, 저장 안 함 ${rejected.length}개`);
  if (rejected.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
