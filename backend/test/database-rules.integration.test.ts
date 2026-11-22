import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL;

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'the database refuses an invalid attempt row and a partial lyrics group',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const goal = await pool.query<{ id: number }>(
      "INSERT INTO certifications (name, category) VALUES ('#142 rules', 'dev') RETURNING id",
    );
    const goalId = goal.rows[0]?.id;
    const artist = await pool.query<{ id: number }>(
      "INSERT INTO artists (name) VALUES ('#142 artist') RETURNING id",
    );
    const artistId = artist.rows[0]?.id;
    t.after(async () => {
      await pool.query('DELETE FROM certifications WHERE id = $1', [goalId]);
      await pool.query('DELETE FROM songs WHERE artist_id = $1', [artistId]);
      await pool.query('DELETE FROM artists WHERE id = $1', [artistId]);
      await pool.end();
    });

    const attempt = (
      outcome: string,
      score: number | null,
      grade: string | null,
      expires: string | null,
    ) =>
      pool.query(
        `INSERT INTO exam_attempts (certification_id, exam_date, outcome, score, grade, expires_on)
         VALUES ($1, '2026-01-10', $2, $3, $4, $5)`,
        [goalId, outcome, score, grade, expires],
      );
    await assert.rejects(
      attempt('waiting', 700, null, null),
      /exam_attempts_waiting_has_no_result/,
    );
    await assert.rejects(
      attempt('waiting', null, 'A', null),
      /exam_attempts_waiting_has_no_result/,
    );
    await assert.rejects(
      attempt('failed', null, '', '2028-01-10'),
      /exam_attempts_expiry_needs_result/,
    );
    await attempt('waiting', null, null, null);
    await attempt('failed', 300, '', null);
    await attempt('scored', 800, 'A', '2028-01-10');

    const song = (source: string | null, sourceUrl: string | null, fetched: string | null) =>
      pool.query(
        `INSERT INTO songs (artist_id, title, lyrics_source, lyrics_source_url, lyrics_fetched_at)
         VALUES ($1, '#142 song', $2, $3, $4)`,
        [artistId, source, sourceUrl, fetched],
      );
    await assert.rejects(song('lrclib', null, null), /songs_lyrics_group/);
    await assert.rejects(song(null, '', null), /songs_lyrics_group/);
    await assert.rejects(song('manual', '', null), /songs_lyrics_group/);
    await assert.rejects(song(null, null, '2026-01-01T00:00:00Z'), /songs_lyrics_group/);
    await song(null, null, null);
    await song('manual', '', '2026-01-01T00:00:00Z');
  },
);

test(
  'the rank constraint is deferrable and the grade CHECKs have explicit names',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());

    const rank = await pool.query<{ condeferrable: boolean }>(
      "SELECT condeferrable FROM pg_constraint WHERE conrelid = 'words'::regclass AND conname = 'words_frequency_rank_key'",
    );
    assert.equal(rank.rows[0]?.condeferrable, true);

    const names = await pool.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'certifications'::regclass AND contype = 'c'",
    );
    const found = names.rows.map((row) => row.conname);
    assert.ok(found.includes('certifications_grade_scale_known'), found.join(', '));
    assert.ok(found.includes('certifications_target_grade_needs_scale'), found.join(', '));
  },
);

test('two ranks can be swapped inside one transaction', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  t.after(async () => {
    client.release();
    await pool.end();
  });
  await client.query('BEGIN');
  try {
    const source = await client.query<{ id: number }>(
      "INSERT INTO import_sources (kind, url, fetched_at) VALUES ('ngsl', 'https://example.test/142', now()) RETURNING id",
    );
    const sourceId = source.rows[0]?.id;
    await client.query(
      `INSERT INTO words (lemma, frequency_rank, list_source_id)
       VALUES ('zz142a', 900001, $1), ('zz142b', 900002, $1)`,
      [sourceId],
    );
    await client.query('SET CONSTRAINTS words_frequency_rank_key DEFERRED');
    await client.query(
      `UPDATE words SET frequency_rank = CASE lemma WHEN 'zz142a' THEN 900002 ELSE 900001 END
       WHERE lemma IN ('zz142a', 'zz142b')`,
    );
    const { rows } = await client.query<{ lemma: string }>(
      "SELECT lemma FROM words WHERE lemma LIKE 'zz142%' ORDER BY frequency_rank",
    );
    assert.deepEqual(
      rows.map((row) => row.lemma),
      ['zz142b', 'zz142a'],
    );
  } finally {
    await client.query('ROLLBACK');
  }
});
