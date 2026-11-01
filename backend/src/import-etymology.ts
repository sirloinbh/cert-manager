import { Pool } from 'pg';

import { scriptDatabaseUrl } from './script-database.js';
import { fetchMissingEtymology, kaikkiUrl } from './word-etymology.js';

// Looks up each word's etymology in the database named by DATABASE_URL (#36). Takes about an hour
// the first time; stopping it loses nothing, and the next run goes on with the words left.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const { found, none, failed, stopped } = await fetchMissingEtymology(
    pool,
    { baseUrl: kaikkiUrl, sleep },
    console.log,
  );
  console.log(`찾음 ${found}단어, 자료 없음 ${none.length}단어, 실패 ${failed.length}단어`);
  if (stopped)
    console.warn(`중간에 멈췄습니다: ${stopped}. 나중에 다시 실행하면 남은 단어부터 받습니다.`);
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
