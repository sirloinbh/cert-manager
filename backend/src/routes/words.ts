import type { Express } from 'express';
import type { Pool } from 'pg';

import { HttpError, parseId } from '../standard/http.js';
import { toId } from '../validation.js';

// Frequent words and their word parts (#36). Columns and rules: docs/design/scope-and-data-model.md section 6.

type SourceRow = { kind: string; url: string; license: string | null; fetchedAt: string };

// The latest record of each source, for the attribution on the screens.
async function readSources(pool: Pool) {
  const { rows } = await pool.query<SourceRow>(
    `SELECT DISTINCT ON (kind) kind, url, license, fetched_at AS "fetchedAt" FROM import_sources
     WHERE kind IN ('ngsl', 'wiktionary') ORDER BY kind, fetched_at DESC, id DESC`,
  );
  return rows;
}

export function registerWordRoutes(app: Express, pool: Pool) {
  // Every word by frequency. About 2,800 short rows; the screen searches and pages them itself.
  app.get('/api/words', async (_req, res) => {
    const { rows } = await pool.query<{
      id: string;
      lemma: string;
      rank: number;
      partOfSpeech: string | null;
      meaningKo: string | null;
    }>(
      `SELECT id::text AS id, lemma, frequency_rank AS rank, part_of_speech AS "partOfSpeech",
         meaning_ko AS "meaningKo"
       FROM words ORDER BY frequency_rank`,
    );
    res.json({
      words: rows.map((row) => ({ ...row, id: toId(row.id) })),
      sources: await readSources(pool),
    });
  });

  app.get('/api/words/:id', async (req, res) => {
    const id = parseId(req.params.id, '단어');
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id::text AS id, lemma, frequency_rank AS rank, part_of_speech AS "partOfSpeech",
         meaning_ko AS "meaningKo", example_en AS "exampleEn", example_ko AS "exampleKo",
         ai_generated AS "aiGenerated", etymology_source AS "etymologySource",
         etymology_url AS "etymologyUrl"
       FROM words WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new HttpError(404, '단어를 찾을 수 없습니다');
    const parts = await pool.query<{ id: string }>(
      `SELECT m.id::text AS id, m.key, m.form, m.kind, m.meaning_ko AS "meaningKo", m.origin
       FROM word_morphemes wm JOIN morphemes m ON m.id = wm.morpheme_id
       WHERE wm.word_id = $1 ORDER BY wm.position`,
      [id],
    );
    const others = await pool.query<{
      morphemeId: string;
      id: string;
      lemma: string;
      meaningKo: string | null;
    }>(
      `SELECT DISTINCT wm.morpheme_id::text AS "morphemeId", w.id::text AS id, w.lemma,
         w.meaning_ko AS "meaningKo", w.frequency_rank
       FROM word_morphemes wm JOIN words w ON w.id = wm.word_id
       WHERE w.id <> $1 AND wm.morpheme_id IN (SELECT morpheme_id FROM word_morphemes WHERE word_id = $1)
       ORDER BY w.frequency_rank`,
      [id],
    );
    res.json({
      word: {
        ...rows[0],
        id: toId(rows[0].id),
        morphemes: parts.rows.map((part) => ({
          ...part,
          id: toId(part.id),
          words: others.rows
            .filter((other) => other.morphemeId === part.id)
            .map((other) => ({
              id: toId(other.id),
              lemma: other.lemma,
              meaningKo: other.meaningKo,
            })),
        })),
      },
      sources: await readSources(pool),
    });
  });
}
