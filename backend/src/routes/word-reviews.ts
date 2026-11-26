import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { body, dayQuery } from '../validation.js';

// Spaced review of words (#209). Columns: database/migrations/012_word_reviews.sql.

/** Days until the next review at each step. */
export const reviewIntervals = [1, 3, 7, 14, 30] as const;
const lastStep = reviewIntervals.length - 1;

const answers = ['know', 'unsure', 'dontKnow'] as const;
export type ReviewAnswer = (typeof answers)[number];

export const reviewInput = z.object(
  { answer: z.enum(answers, { error: 'Answer must be know, unsure or dontKnow' }) },
  { error: 'Request body must be a JSON object' },
);

/**
 * The step after an answer. Know moves one step up (the top step stays), Unsure keeps the step, Don't know goes
 * back to 1 day. A word answered for the first time counts as step 0, so Know first gives 3 days.
 */
export function nextStep(step: number | null, answer: ReviewAnswer) {
  const current = step ?? 0;
  if (answer === 'know') return Math.min(current + 1, lastStep);
  return answer === 'unsure' ? current : 0;
}

export function registerWordReviewRoutes(app: Express, pool: Pool, today: () => string) {
  // Records an answer and schedules the next review `interval` days after today (Asia/Seoul).
  app.put('/api/words/:id/review', async (req, res) => {
    const id = parseId(req.params.id, 'word');
    const input = reviewInput.parse(body(req.body));
    const current = today();
    const word = await pool.query<{ step: number | null }>(
      `SELECT w.id, r.step FROM words w LEFT JOIN word_reviews r ON r.word_id = w.id WHERE w.id = $1`,
      [id],
    );
    if (!word.rows[0]) throw new HttpError(404, 'Word not found');
    const step = nextStep(word.rows[0].step, input.answer);
    const { rows } = await pool.query<{ nextReviewOn: string }>(
      `INSERT INTO word_reviews (word_id, step, next_review_on, last_answer, last_reviewed_at)
       VALUES ($1, $2, $3::date + $4::integer, $5, now())
       ON CONFLICT (word_id) DO UPDATE SET step = EXCLUDED.step, next_review_on = EXCLUDED.next_review_on,
         last_answer = EXCLUDED.last_answer, last_reviewed_at = EXCLUDED.last_reviewed_at
       RETURNING next_review_on AS "nextReviewOn"`,
      [id, step, current, reviewIntervals[step], input.answer],
    );
    res.json({
      review: { wordId: id, step, nextReviewOn: rows[0]?.nextReviewOn, lastAnswer: input.answer },
    });
  });

  // Words whose next review is on or before the day (today by default), the longest overdue first.
  app.get('/api/word-reviews/due', async (req, res) => {
    const current = today();
    const day = dayQuery.parse(req.query).day ?? current;
    const { rows } = await pool.query(
      `SELECT w.id, w.lemma, w.frequency_rank AS rank, w.part_of_speech AS "partOfSpeech",
         w.meaning_ko AS "meaningKo", r.step, r.next_review_on AS "nextReviewOn",
         r.last_answer AS "lastAnswer"
       FROM word_reviews r JOIN words w ON w.id = r.word_id
       WHERE r.next_review_on <= $1::date
       ORDER BY r.next_review_on, w.frequency_rank`,
      [day],
    );
    res.json({ today: current, day, count: rows.length, words: rows });
  });
}
