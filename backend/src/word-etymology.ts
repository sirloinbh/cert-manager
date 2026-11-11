import type { Pool } from 'pg';

import {
  mostFailuresInARow,
  politeGet,
  type PoliteSource,
  RateLimited,
  ServiceError,
} from './polite-fetch.js';

// Fills each word's Wiktionary etymology text from kaikki.org (#36). Safe to stop and run again.
// Rules: docs/research/english-content-sources.md section 5.

export const kaikkiUrl = 'https://kaikki.org/dictionary/English/meaning';
const wiktionaryLicense = 'CC BY-SA 4.0';
// One large file at a time from a volunteer-run site.
const requestGap = 1000;

// The site's folders are the word's first one and two letters, capitals kept (checked: I/I/I.jsonl).
export function entryUrl(baseUrl: string, lemma: string) {
  return `${baseUrl}/${lemma.slice(0, 1)}/${lemma.slice(0, 2)}/${encodeURIComponent(lemma)}.jsonl`;
}

// The text can start with a generated tree of ancestor words, one to a line, which ends at
// "English <word>". Without such a line there is no telling tree from sentences, so nothing is kept:
// no text means "no source", which is better than a made-up one.
function withoutTree(text: string, lemma: string) {
  if (!text.startsWith('Etymology tree\n')) return text.trim();
  const lines = text.split('\n');
  // The word itself, so a short sentence opening with "English" is not taken for the end.
  const treeEnd = new RegExp(`^English ${lemma}(?: ?[a-z]{2,5}\\.)*$`);
  const end = lines.map((line) => treeEnd.test(line)).lastIndexOf(true);
  return end === -1
    ? ''
    : lines
        .slice(end + 1)
        .join('\n')
        .trim();
}

/** The etymology of one word from its entries, once for each different text. Empty when there is none. */
export function etymologyText(jsonl: string, lemma: string) {
  const texts = jsonl
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => (JSON.parse(line) as { etymology_text?: unknown }).etymology_text)
    .filter((text): text is string => typeof text === 'string')
    .map((text) => withoutTree(text, lemma))
    .filter((text) => text !== '');
  return [...new Set(texts)].join('\n\n');
}

/**
 * Looks up every word not looked up yet, most frequent first. One word failing does not stop the
 * others, but a rate limit or several failures in a row do. A database error stops everything.
 */
export async function fetchMissingEtymology(
  pool: Pool,
  source: PoliteSource,
  log: (message: string) => void = () => {},
) {
  const { rows } = await pool.query<{ id: string; lemma: string }>(
    `SELECT id::text AS id, lemma FROM words WHERE etymology_source IS NULL ORDER BY frequency_rank`,
  );
  const result = {
    found: 0,
    none: [] as string[],
    failed: [] as string[],
    stopped: null as string | null,
  };
  let sourceId: string | undefined;
  let failuresInARow = 0;
  for (const word of rows) {
    let text: string;
    try {
      const response = await politeGet(entryUrl(source.baseUrl, word.lemma), {
        name: 'kaikki.org',
        gap: requestGap,
        sleep: source.sleep,
      });
      text = response ? etymologyText(await response.text(), word.lemma) : '';
    } catch (error) {
      const reason =
        error instanceof ServiceError ? error.message : 'connection failed or invalid response';
      result.failed.push(word.lemma);
      log(`Failed: ${word.lemma} (${reason})`);
      failuresInARow += 1;
      if (error instanceof RateLimited || failuresInARow === mostFailuresInARow) {
        result.stopped = reason;
        break;
      }
      continue;
    }
    failuresInARow = 0;
    if (!sourceId) {
      const { rows: created } = await pool.query<{ id: string }>(
        `INSERT INTO import_sources (kind, url, license, fetched_at)
         VALUES ('wiktionary', $1, $2, now()) RETURNING id`,
        [source.baseUrl, wiktionaryLicense],
      );
      sourceId = created[0]?.id;
    }
    await pool.query(
      `UPDATE words SET etymology_source = $2, etymology_url = $3, etymology_source_id = $4, updated_at = now()
       WHERE id = $1`,
      [
        word.id,
        text,
        text ? `https://en.wiktionary.org/wiki/${encodeURIComponent(word.lemma)}` : '',
        sourceId,
      ],
    );
    if (text) result.found += 1;
    else result.none.push(word.lemma);
  }
  return result;
}
