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
  console.log(`Saved ${saved.length} songs, ${missing.length} not found, ${failed.length} failed`);
  if (missing.length > 0) console.log('Songs that were not found can be pasted in on the screen.');
  if (stopped)
    console.warn(
      `Stopped early: ${stopped}. Run it again later to continue with the remaining songs.`,
    );
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
