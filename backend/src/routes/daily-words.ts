import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { body, dayQuery, toId } from '../validation.js';
import { readWordSources } from './words.js';

// The day's words on the dashboard (#37). Columns and rules: docs/design/scope-and-data-model.md section 6.

const wordsPerDay = 5;

const learnedInput = z.object(
  { learned: z.boolean({ error: '외웠는지는 true나 false여야 합니다' }) },
  { error: '요청 본문은 JSON 객체여야 합니다' },
);

/**
 * Chooses the day's words the first time that day is opened. Two requests at once choose the same
 * words, so the second inserts nothing. Words never shown come first, then the ones not shown for the
 * longest time; among those, words with a meaning, then the most frequent. A day already chosen stays
 * as it is, even when it got fewer words than usual.
 */
async function chooseWords(pool: Pool, day: string) {
  await pool.query(
    `INSERT INTO daily_words (day, position, word_id)
     SELECT $1::date, chosen.position, chosen.id
     FROM (
       SELECT w.id, (row_number() OVER (
         ORDER BY (SELECT max(d.day) FROM daily_words d WHERE d.word_id = w.id) ASC NULLS FIRST,
           w.meaning_ko IS NULL,
           w.frequency_rank
       ))::integer AS position
       FROM words w
       WHERE w.learned_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM daily_words t WHERE t.day = $1::date)
     ) chosen
     WHERE chosen.position <= $2
     ON CONFLICT DO NOTHING`,
    [day, wordsPerDay],
  );
}

export function registerDailyWordRoutes(app: Express, pool: Pool, today: () => string) {
  // Today's words, or an earlier day's with ?day=. Only today can choose new words.
  // Today always counts as the next day of an earlier one, even before its words are chosen.
  app.get('/api/daily-words', async (req, res) => {
    const current = today();
    const day = dayQuery.parse(req.query).day ?? current;
    if (day > current) throw new HttpError(400, '아직 오지 않은 날짜의 단어는 볼 수 없습니다');
    if (day === current) await chooseWords(pool, day);
    const { rows } = await pool.query<{ id: string }>(
      `SELECT w.id::text AS id, w.lemma, w.frequency_rank AS rank, w.part_of_speech AS "partOfSpeech",
         w.meaning_ko AS "meaningKo", w.example_en AS "exampleEn", w.example_ko AS "exampleKo",
         w.ai_generated AS "aiGenerated", w.etymology_source AS "etymologySource",
         w.etymology_url AS "etymologyUrl", w.learned_at AS "learnedAt"
       FROM daily_words d JOIN words w ON w.id = d.word_id
       WHERE d.day = $1::date ORDER BY d.position`,
      [day],
    );
    const days = await pool.query<{ previousDay: string | null; nextDay: string | null }>(
      `SELECT (SELECT max(d.day) FROM daily_words d WHERE d.day < $1::date) AS "previousDay",
         CASE WHEN $1::date < $2::date THEN COALESCE(
           (SELECT min(d.day) FROM daily_words d WHERE d.day > $1::date AND d.day <= $2::date),
           $2::date
         ) END AS "nextDay"`,
      [day, current],
    );
    res.json({
      today: current,
      day,
      previousDay: days.rows[0]?.previousDay ?? null,
      nextDay: days.rows[0]?.nextDay ?? null,
      words: rows.map((row) => ({ ...row, id: toId(row.id) })),
      sources: rows.length > 0 ? await readWordSources(pool) : [],
    });
  });

  // Marking it learned again keeps the first time; undoing clears it.
  app.put('/api/words/:id/learned', async (req, res) => {
    const id = parseId(req.params.id, '단어');
    const input = learnedInput.parse(body(req.body));
    const { rows } = await pool.query<{ learnedAt: Date | null }>(
      `UPDATE words
       SET learned_at = CASE WHEN $2::boolean THEN COALESCE(learned_at, now()) END,
         updated_at = now()
       WHERE id = $1
       RETURNING learned_at AS "learnedAt"`,
      [id, input.learned],
    );
    if (!rows[0]) throw new HttpError(404, '단어를 찾을 수 없습니다');
    res.json({ word: { id, learnedAt: rows[0].learnedAt } });
  });
}
