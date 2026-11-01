import { Pool } from 'pg';

import { fetchMissingLyrics, lrclibUrl } from './lyrics-fetch.js';
import { scriptDatabaseUrl } from './script-database.js';

// Fills songs without lyrics from LRCLIB into the database named by DATABASE_URL (#64). Safe to run again.
// The owner runs this; lyrics stay in that database.

const pool = new Pool({ connectionString: scriptDatabaseUrl() });
try {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const { saved, missing, failed, stopped } = await fetchMissingLyrics(
    pool,
    { baseUrl: lrclibUrl, sleep },
    console.log,
  );
  console.log(`저장 ${saved.length}곡, 없음 ${missing.length}곡, 실패 ${failed.length}곡`);
  if (missing.length > 0) console.log('없는 곡은 화면에서 직접 붙여 넣을 수 있습니다.');
  if (stopped)
    console.warn(`중간에 멈췄습니다: ${stopped}. 나중에 다시 실행하면 남은 곡부터 받습니다.`);
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
