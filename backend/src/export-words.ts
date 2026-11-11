import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { exportWordBatch, wordBatchesDir } from './word-files.js';

// Writes the next words to fill in (#36). Size: npm run words:export -w backend -- 50

const size = Number(process.argv[2] ?? 50);
if (!Number.isInteger(size) || size < 1 || size > 1000) {
  throw new Error('Batch size must be a whole number from 1 to 1000');
}

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { file, written } = await exportWordBatch(pool, wordBatchesDir, size);
  if (!file)
    console.log('No words to fill in. Only words whose etymology was looked up are exported.');
  else console.log(`${written ? 'New file' : 'Existing file'}: ${wordBatchesDir}${file}`);
} finally {
  await pool.end();
}
