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

// The lemmas of the batch files still waiting for import (the files directly in the folder, not imported/).
// An unreadable file is the importer's to refuse, so it only counts as a waiting file here.
async function waitingBatches(dir: string) {
  const files: string[] = [];
  const lemmas = new Set<string>();
  for (const name of (await readdir(dir)).filter((entry) => entry.endsWith('.json')).sort()) {
    files.push(name);
    try {
      const value = JSON.parse(
        (await readFile(join(dir, name), 'utf8')).replace(/^\uFEFF/, ''),
      ) as {
        words?: { lemma?: unknown }[];
      };
      for (const word of value.words ?? [])
        if (typeof word.lemma === 'string') lemmas.add(word.lemma);
    } catch {
      // Not a batch this code can read.
    }
  }
  return { files, lemmas: [...lemmas] };
}

/**
 * Writes the next words that have an etymology looked up and no meaning yet. The existing word parts
 * go along, so the same part does not get a new name. A file already there is someone's work, so it stays,
 * and its words are not handed out again: `waiting` names the files still waiting for import, so an export
 * that finds nothing new says why.
 */
export async function exportWordBatch(pool: Pool, dir: string, size: number) {
  await mkdir(dir, { recursive: true });
  const waiting = await waitingBatches(dir);
  const { rows } = await pool.query<{
    lemma: string;
    rank: number;
    etymologySource: string;
  }>(
    `SELECT lemma, frequency_rank AS rank, etymology_source AS "etymologySource" FROM words
     WHERE meaning_ko IS NULL AND etymology_source IS NOT NULL AND lemma <> ALL($2::text[])
     ORDER BY frequency_rank LIMIT $1`,
    [size, waiting.lemmas],
  );
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return { file: null, written: false, waiting: waiting.files };
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
    return { file, written: true, waiting: waiting.files };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return { file, written: false, waiting: waiting.files };
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
  id: number;
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
          `SELECT id, lemma, meaning_ko AS "meaningKo", etymology_source AS "etymologySource"
           FROM words WHERE lemma = ANY($1::text[]) FOR UPDATE`,
          [batch.words.map((word) => word.lemma)],
        );
        const found = new Map(rows.map((row) => [row.lemma, row]));
        const problem = batchProblem(batch, found);
        if (problem) throw new RejectedBatch(problem);
        // Three statements for the whole batch instead of about two per word part (#149).
        const words = batch.words.map((word) => ({ ...word, id: found.get(word.lemma)?.id }));
        await client.query(
          `UPDATE words w SET part_of_speech = v.part_of_speech, meaning_ko = v.meaning_ko,
             example_en = v.example_en, example_ko = v.example_ko, ai_generated = true, updated_at = now()
           FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[])
             AS v(id, part_of_speech, meaning_ko, example_en, example_ko)
           WHERE w.id = v.id`,
          [
            words.map((word) => word.id),
            words.map((word) => word.partOfSpeech),
            words.map((word) => word.meaningKo),
            words.map((word) => word.exampleEn),
            words.map((word) => word.exampleKo),
          ],
        );
        // A part already there keeps its wording: the same key is the same part, and the first one in the batch wins.
        const parts = new Map<string, Batch['words'][number]['morphemes'][number]>();
        for (const word of words)
          for (const part of word.morphemes) parts.set(part.key, parts.get(part.key) ?? part);
        if (parts.size > 0) {
          const list = [...parts.values()];
          await client.query(
            `INSERT INTO morphemes (key, form, kind, meaning_ko, origin)
             SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
             ON CONFLICT (key) DO NOTHING`,
            [
              list.map((part) => part.key),
              list.map((part) => part.form),
              list.map((part) => part.kind),
              list.map((part) => part.meaningKo),
              list.map((part) => part.origin),
            ],
          );
          const links = words.flatMap((word) =>
            word.morphemes.map((part, index) => ({
              id: word.id,
              key: part.key,
              position: index + 1,
            })),
          );
          await client.query(
            `INSERT INTO word_morphemes (word_id, morpheme_id, position)
             SELECT v.word_id, m.id, v.position
             FROM unnest($1::bigint[], $2::text[], $3::integer[]) AS v(word_id, key, position)
             JOIN morphemes m ON m.key = v.key
             ON CONFLICT DO NOTHING`,
            [
              links.map((link) => link.id),
              links.map((link) => link.key),
              links.map((link) => link.position),
            ],
          );
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
