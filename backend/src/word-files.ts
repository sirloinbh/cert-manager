import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { inTransaction } from './lyrics-store.js';

// Work files for filling in meanings, examples and word parts (#36), most frequent words first.
// The folder is in .gitignore because the files hold Wiktionary text.

export const wordBatchesDir = fileURLToPath(new URL('../../.local/word-batches/', import.meta.url));

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !value.includes('\u0000'));

const batchSchema = z.object({
  words: z
    .array(
      z.object({
        lemma: text(200),
        partOfSpeech: text(100),
        meaningKo: text(500),
        exampleEn: text(500),
        exampleKo: text(500),
        morphemes: z
          .array(
            z.object({
              key: text(200),
              form: z
                .string()
                .max(200)
                .regex(/^[a-z]+$/),
              kind: z.enum(['prefix', 'root', 'suffix']),
              meaningKo: text(200),
              origin: text(100).nullable(),
            }),
          )
          .max(12),
      }),
    )
    .min(1)
    .max(1000),
});
type Batch = z.infer<typeof batchSchema>;

/**
 * Writes the next words that have an etymology looked up and no meaning yet. The existing word parts
 * go along, so the same part does not get a new name. A file already there is someone's work, so it stays.
 */
export async function exportWordBatch(pool: Pool, dir: string, size: number) {
  await mkdir(dir, { recursive: true });
  const { rows } = await pool.query<{
    lemma: string;
    rank: number;
    etymologySource: string;
  }>(
    `SELECT lemma, frequency_rank AS rank, etymology_source AS "etymologySource" FROM words
     WHERE meaning_ko IS NULL AND etymology_source IS NOT NULL
     ORDER BY frequency_rank LIMIT $1`,
    [size],
  );
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return { file: null, written: false };
  const { rows: morphemes } = await pool.query(
    `SELECT key, form, kind, meaning_ko AS "meaningKo", origin FROM morphemes ORDER BY key`,
  );
  const file = `words-${first.rank}-${last.rank}.json`;
  const content = {
    morphemes,
    words: rows.map((word) => ({
      lemma: word.lemma,
      rank: word.rank,
      etymologySource: word.etymologySource,
      partOfSpeech: '',
      meaningKo: '',
      exampleEn: '',
      exampleKo: '',
      morphemes: [],
    })),
  };
  try {
    await writeFile(join(dir, file), `${JSON.stringify(content, null, 2)}\n`, { flag: 'wx' });
    return { file, written: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return { file, written: false };
  }
}

// A batch that cannot be saved. Anything else, like a lost database connection, stops the script.
class RejectedBatch extends Error {}

function parseBatch(content: string) {
  let value: unknown;
  try {
    value = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new RejectedBatch('Cannot be read as JSON');
  }
  const parsed = batchSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new RejectedBatch(`The file format is invalid: ${issue?.path.join('.') ?? ''}`);
}

type WordRow = {
  id: string;
  lemma: string;
  meaningKo: string | null;
  etymologySource: string | null;
};

/** Why this batch cannot be saved, or null. Word parts must rest on a source, never made up. */
function batchProblem(batch: Batch, found: Map<string, WordRow>) {
  for (const word of batch.words) {
    const row = found.get(word.lemma);
    if (!row) return `Word is not in the list: ${word.lemma}`;
    if (row.meaningKo !== null) return `Word is already filled in: ${word.lemma}`;
    if (row.etymologySource === null)
      return `Etymology has not been looked up for this word yet: ${word.lemma}`;
    if (row.etymologySource === '' && word.morphemes.length > 0) {
      return `A word with no etymology data cannot have etymology parts: ${word.lemma}`;
    }
    for (const part of word.morphemes) {
      const name = `${part.kind}:${part.form}`;
      if (
        part.key !== name &&
        !(part.key.startsWith(`${name}:`) && part.key.length > name.length + 1)
      ) {
        return `Etymology part key does not follow the rule: ${part.key}`;
      }
    }
    if (new Set(word.morphemes.map((part) => part.key)).size !== word.morphemes.length) {
      return `The same etymology part appears twice in one word: ${word.lemma}`;
    }
  }
  return new Set(batch.words.map((word) => word.lemma)).size === batch.words.length
    ? null
    : 'The same word appears twice';
}

/** Saves each batch whole, marked as AI-made, then moves it to imported/. Bad ones stay and are named with the reason. */
export async function importWordBatches(pool: Pool, dir: string) {
  const result = {
    saved: [] as string[],
    notMoved: [] as string[],
    rejected: [] as { file: string; reason: string }[],
  };
  const doneDir = join(dir, 'imported');
  await mkdir(doneDir, { recursive: true });
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  for (const name of names) {
    try {
      const batch = parseBatch(await readFile(join(dir, name), 'utf8'));
      await inTransaction(pool, async (client) => {
        const { rows } = await client.query<WordRow>(
          `SELECT id::text AS id, lemma, meaning_ko AS "meaningKo", etymology_source AS "etymologySource"
           FROM words WHERE lemma = ANY($1::text[]) FOR UPDATE`,
          [batch.words.map((word) => word.lemma)],
        );
        const found = new Map(rows.map((row) => [row.lemma, row]));
        const problem = batchProblem(batch, found);
        if (problem) throw new RejectedBatch(problem);
        for (const word of batch.words) {
          const id = found.get(word.lemma)?.id;
          await client.query(
            `UPDATE words SET part_of_speech = $2, meaning_ko = $3, example_en = $4, example_ko = $5,
               ai_generated = true, updated_at = now()
             WHERE id = $1`,
            [id, word.partOfSpeech, word.meaningKo, word.exampleEn, word.exampleKo],
          );
          for (const [index, part] of word.morphemes.entries()) {
            // A part already there keeps its wording: the same key is the same part.
            await client.query(
              `INSERT INTO morphemes (key, form, kind, meaning_ko, origin) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (key) DO NOTHING`,
              [part.key, part.form, part.kind, part.meaningKo, part.origin],
            );
            await client.query(
              `INSERT INTO word_morphemes (word_id, morpheme_id, position)
               SELECT $1, id, $3 FROM morphemes WHERE key = $2`,
              [id, part.key, index + 1],
            );
          }
        }
      });
    } catch (error) {
      // A value the database refuses is the file's fault; a lost connection is not.
      const refused = /^2[23]/.test((error as { code?: string }).code ?? '');
      if (!(error instanceof RejectedBatch || refused)) throw error;
      const reason = refused
        ? `The database rejected a value (${(error as { code: string }).code})`
        : (error as Error).message;
      result.rejected.push({ file: name, reason });
      continue;
    }
    result.saved.push(name);
    try {
      await rename(join(dir, name), join(doneDir, name));
    } catch {
      // OneDrive can hold a file for a moment. The words are in, and a rerun would only be refused.
      result.notMoved.push(name);
    }
  }
  return result;
}
