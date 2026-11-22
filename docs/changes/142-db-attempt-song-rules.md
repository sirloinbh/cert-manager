# Enforce exam attempt and song rules in the database (#142)

- Date: 2026-11-22 (Asia/Seoul)

## Purpose

The API already refuses invalid exam attempts and partial lyrics data, but the database accepted them. Applied migration files are frozen, so the rules go into a new migration.

## Contents

- `database/migrations/011_database_rules.sql` (safe to re-run):
  - `exam_attempts_waiting_has_no_result`: a `waiting` attempt has no score and no grade.
  - `exam_attempts_expiry_needs_result`: `expires_on` is set only for `passed` or `scored` attempts.
  - `songs_lyrics_group`: `lyrics_source`, `lyrics_source_url` and `lyrics_fetched_at` are all NULL or all set.
  - `words_frequency_rank_key` is recreated as `DEFERRABLE INITIALLY IMMEDIATE`, so a re-ranking can swap ranks in one transaction with `SET CONSTRAINTS ... DEFERRED`. Existing statements behave as before.
  - The two unnamed CHECKs from 005 are renamed to `certifications_grade_scale_known` and `certifications_target_grade_needs_scale` (found by definition, so it works whatever name PostgreSQL gave them).
- `database/README.md`: applied migration files are never edited, because `CREATE TABLE IF NOT EXISTS` skips a changed definition on an existing database.
- `backend/test/database-rules.integration.test.ts`: invalid attempts and partial lyrics groups are refused, valid ones are accepted, the rank constraint is deferrable and swappable, and the CHECK names exist.

## Notes

- If the production database holds rows that break a new CHECK, the migration fails and rolls back, and nothing changes. The routes already refuse such rows, so none are expected.

## Verification

- No local PostgreSQL on this Mac: the integration tests skip locally and run in CI against the migrated test DB.
- `npm run check`: see the PR.
