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
  console.log(
    `Found ${found} words, no data for ${none.length} words, ${failed.length} words failed`,
  );
  if (stopped)
    console.warn(
      `Stopped early: ${stopped}. Run it again later to continue with the remaining words.`,
    );
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
