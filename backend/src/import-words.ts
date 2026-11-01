import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { importWordBatches, wordBatchesDir } from './word-files.js';

// Saves filled-in word batches (#36). A batch that does not fit is not saved.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { saved, notMoved, rejected } = await importWordBatches(pool, wordBatchesDir);
  for (const { file, reason } of rejected) console.warn(`저장 안 함 ${file}: ${reason}`);
  for (const file of notMoved)
    console.warn(`저장했지만 옮기지 못함 ${file}: 이 파일은 지워 주세요`);
  console.log(`저장 ${saved.length}개, 저장 안 함 ${rejected.length}개`);
  if (rejected.length + notMoved.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
