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
  if (!file) console.log('채울 단어가 없습니다. 어원을 찾아본 단어만 내보냅니다.');
  else console.log(`${written ? '새 파일' : '이미 있는 파일'}: ${wordBatchesDir}${file}`);
} finally {
  await pool.end();
}
