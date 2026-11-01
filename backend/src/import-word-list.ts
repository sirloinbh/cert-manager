import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { politeGet } from './polite-fetch.js';
import { scriptDatabaseUrl } from './script-database.js';
import { ngslFileName, ngslUrl, parseWordList, saveWordList } from './word-list.js';

// Loads the NGSL word list into the database named by DATABASE_URL (#36). Safe to run again.
// The file stays in .local/ because its license asks for attribution wherever it is shared.

const sourcesDir = fileURLToPath(new URL('../../.local/sources/', import.meta.url));

const url = scriptDatabaseUrl();
const response = await politeGet(ngslUrl, {
  name: 'NGSL',
  gap: 0,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});
if (!response) throw new Error('NGSL file was not found');
const csv = await response.text();
const words = parseWordList(csv);
await mkdir(sourcesDir, { recursive: true });
await writeFile(join(sourcesDir, ngslFileName), csv);

const pool = new Pool({ connectionString: url });
try {
  await saveWordList(pool, words, ngslUrl);
  console.log(`Saved ${words.length} words.`);
} finally {
  await pool.end();
}
