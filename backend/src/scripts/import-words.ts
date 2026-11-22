import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { importWordBatches, wordBatchesDir } from './word-files.js';

// Saves filled-in word batches (#36). A batch that does not fit is not saved.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { saved, notMoved, rejected } = await importWordBatches(pool, wordBatchesDir);
  for (const { file, reason } of rejected) console.warn(`Not saved ${file}: ${reason}`);
  for (const file of notMoved)
    console.warn(`Saved but could not move ${file}: please delete this file`);
  console.log(`Saved ${saved.length}, not saved ${rejected.length}`);
  if (rejected.length + notMoved.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
