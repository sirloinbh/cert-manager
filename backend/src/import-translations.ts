import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { importTranslations, translationsDir } from './translation-files.js';

// Saves filled-in translation files (#64). A file that does not line up is not saved.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const { saved, skipped, rejected } = await importTranslations(pool, translationsDir);
  for (const { file, reason } of rejected) console.warn(`저장 안 함 ${file}: ${reason}`);
  console.log(
    `저장 ${saved.length}곡, 아직 안 채움 ${skipped.length}곡, 저장 안 함 ${rejected.length}곡`,
  );
  if (saved.length + skipped.length + rejected.length === 0) {
    console.log('들여올 파일이 없습니다. 먼저 translations:export를 실행해 주세요.');
  }
  if (rejected.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
