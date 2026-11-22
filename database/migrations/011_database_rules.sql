-- Rules the API already enforces, now enforced by the database too (issue #142). Safe to re-run.
-- Applied migration files are frozen (database/README.md), so every change to 003, 005, 007 and 008 lives here.

-- Exam attempts: a pending attempt has no score or grade; only passed or scored attempts can expire.
-- Same rules as backend/src/routes/exam-attempts.ts (values() and the expiresOn CASE).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_attempts_waiting_has_no_result') THEN
    ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_waiting_has_no_result CHECK (
      outcome <> 'waiting' OR (score IS NULL AND grade IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_attempts_expiry_needs_result') THEN
    ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_expiry_needs_result CHECK (
      expires_on IS NULL OR outcome IN ('passed', 'scored')
    );
  END IF;
END $$;

-- Songs: source, source URL and fetch time are set together (no lyrics yet: all three NULL).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_lyrics_group') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_lyrics_group CHECK (
      (lyrics_source IS NULL) = (lyrics_source_url IS NULL)
      AND (lyrics_source IS NULL) = (lyrics_fetched_at IS NULL)
    );
  END IF;
END $$;

-- Words: the rank stays unique, but the check waits until the end of the statement or transaction,
-- so a re-ranking that swaps or shifts ranks does not collide halfway.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'words'::regclass AND conname = 'words_frequency_rank_key' AND NOT condeferrable
  ) THEN
    ALTER TABLE words DROP CONSTRAINT words_frequency_rank_key;
    ALTER TABLE words ADD CONSTRAINT words_frequency_rank_key
      UNIQUE (frequency_rank) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- Certifications: give the two unnamed CHECKs from 005 explicit names.
DO $$
DECLARE
  old record;
BEGIN
  FOR old IN
    SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'certifications'::regclass AND contype = 'c'
  LOOP
    IF old.def LIKE '%grade_scale = ANY%' AND old.def NOT LIKE '%target_grade%'
       AND old.conname <> 'certifications_grade_scale_known' THEN
      EXECUTE format('ALTER TABLE certifications RENAME CONSTRAINT %I TO certifications_grade_scale_known', old.conname);
    ELSIF old.def LIKE '%target_grade IS NULL%' AND old.conname <> 'certifications_target_grade_needs_scale' THEN
      EXECUTE format('ALTER TABLE certifications RENAME CONSTRAINT %I TO certifications_target_grade_needs_scale', old.conname);
    END IF;
  END LOOP;
END $$;
