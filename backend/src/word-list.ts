import type { Pool } from 'pg';

import { inTransaction } from './lyrics-store.js';

// The NGSL 1.2 word list (#36). Source and license: docs/research/english-content-sources.md section 4.

export const ngslUrl = 'https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv';
export const ngslFileName = 'NGSL_12_stats.csv';
const ngslLicense = 'CC BY-SA 4.0';
const ngslSize = 2809;

export type ListedWord = { lemma: string; rank: number };

/** Words from the statistics file. The file went through a spreadsheet, which capitalized TRUE and FALSE. */
export function parseWordList(csv: string): ListedWord[] {
  const [header, ...rows] = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  if (!header?.startsWith('Lemma,SFI Rank')) throw new Error('NGSL file has unexpected columns');
  const words = rows.map((row) => {
    const [raw = '', rank = ''] = row.split(',');
    const lemma = raw === 'I' ? raw : raw.toLowerCase();
    if (!/^(?:I|[a-z]+)$/.test(lemma) || !/^[1-9]\d*$/.test(rank)) {
      throw new Error('NGSL file has an unexpected row');
    }
    return { lemma, rank: Number(rank) };
  });
  if (words.length !== ngslSize) {
    throw new Error(`NGSL file has ${words.length} words, expected ${ngslSize}`);
  }
  return words;
}

/** Saves the list in one transaction. Meanings and word parts already filled in stay. */
export async function saveWordList(pool: Pool, words: ListedWord[], url: string) {
  await inTransaction(pool, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO import_sources (kind, url, license, fetched_at)
       VALUES ('ngsl', $1, $2, now()) RETURNING id`,
      [url, ngslLicense],
    );
    await client.query(
      `INSERT INTO words (lemma, frequency_rank, list_source_id)
       SELECT l, r, $3 FROM unnest($1::text[], $2::int[]) AS v(l, r)
       ON CONFLICT (lemma) DO UPDATE SET list_source_id = EXCLUDED.list_source_id, updated_at = now()`,
      [words.map((word) => word.lemma), words.map((word) => word.rank), rows[0]?.id],
    );
  });
}
