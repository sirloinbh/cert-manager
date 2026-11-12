# Service scope and data model

- Issue: [#28](https://github.com/sirloinbh/cert-manager/issues/28)
- Written: 2026-10-30 (Asia/Seoul)
- This document is the design draft for the first features. Each feature issue uses it as the standard when it creates a migration, and changes are fixed in that issue's change record and in this document together.
- See also: [Sources of English study material](../research/english-content-sources.md), and the central rules in project-standards `docs/conventions/domain.md` (dates, time zone, NULL) and `docs/conventions/database.md` (migrations)

## 1. Scope

The service is split into two areas and a dashboard. English study is an area separate from certifications (decision in #25). TOEIC and TOEIC Speaking are handled as goals in the certification area.

| Area           | What it covers                                                                                                | Issues                                |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Certifications | Target certifications, exam attempt and acquisition records with expiry dates, study plans (stages and tasks) | #30, #32, #33, #34                    |
| English study  | Original and translated pop song lyrics, frequently used words and etymology, word of the day                 | #35, #36, #37                         |
| Dashboard      | A combined view of what to look at today from both areas                                                      | A card is added in each feature issue |

Out of scope: login and multiple users, notifications outside the app (push and email; in-app notifications are #60), exam registration on the user's behalf, and public exposure. There is one user, the owner.

Candidates listed in the tasks of #28, and what was decided for the first scope:

| Candidate                              | Handling                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exam sessions and registration periods | Not stored separately. Keep only the target exam date (`target_exam_date`) and write the registration period in the memo. Make a new issue if it becomes necessary |
| Study log (hours studied)              | Not stored separately. The completion of tasks in the study plan (`completed_at`) stands in for it                                                                 |
| Scores and pass results                | Kept in the exam attempt and acquisition records (`exam_attempts`)                                                                                                 |
| Expiry and renewal dates               | Kept in the expiry date (`expires_on`) of the exam attempt and acquisition record. The driver's license renewal deadline uses the same field                       |
| Schedule screen                        | Not built separately. The dashboard cards for the nearest exam and today's tasks stand in for it                                                                   |

## 2. User decisions (2026-10-30)

| Item          | Decision                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goal status   | The user chooses it. When "passed" is entered in an attempt record, the app asks whether to change the goal status to "passed"                                   |
| Pass judgment | The app does not judge. The user enters the attempt result (passed, failed, score, grade). The app only shows "goal achieved" by comparing with the target score |
| Expiring soon | Show "expiring soon" when 90 days or fewer remain until the expiry date, and "expired" after it passes                                                           |
| Menu          | Dashboard · Certifications · Pop song lyrics · Word list · Settings                                                                                              |

## 3. Screens

Screen addresses are kept in one place, `pages` in `frontend/src/app.tsx`.

| Menu            | Address                                           | Screen                                                                                        | Issues             |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------ |
| Dashboard       | `/`                                               | Cards for the nearest exam (days left), today's tasks, expiring soon, and the word of the day | #30, #32, #33, #37 |
| Certifications  | `/certifications`                                 | Goal list (grouped by category and ordered by target exam date)                               | #30                |
|                 | `/certifications/new`, `/certifications/:id/edit` | Create and edit a goal                                                                        | #30                |
|                 | `/certifications/:id`                             | Detail: goal info, attempt and acquisition records, study plan                                | #30, #32, #33      |
| Pop song lyrics | `/songs`                                          | Song list by album, song search, translation status                                           | #35                |
|                 | `/songs/:id`                                      | Original and translation side by side line by line (stacked on mobile)                        | #35                |
| Word list       | `/words`                                          | Word list in frequency order, search                                                          | #36                |
|                 | `/words/:id`                                      | Meaning, examples, etymology parts, words with the same root                                  | #36                |
| Settings        | `/settings`                                       | Keep the current screen                                                                       | —                  |

Deletion goes through the shared delete confirmation dialog. When a certification goal is deleted, the dialog says that its attempt records and study plan are deleted with it.

## 4. Common rules

- Keys: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`. Link tables use a composite primary key.
- Record times: `created_at` and `updated_at` (`timestamptz NOT NULL DEFAULT now()`) on every main table. `updated_at` changes when the API edits the row.
- Dates: a day the user picks (exam date, deadline) is `date`, and the API value is `YYYY-MM-DD`. "Today" is computed with the server's `serviceDate()` (`Asia/Seoul`).
- The time something happened (task completion, when lyrics were fetched, when a word was memorized) is `timestamptz`.
- NULL: a value that is unknown or not filled in yet is `NULL`, and a value that was checked and really does not exist is the empty string `''`. Only columns that do not need to separate "none" from "unknown", such as a memo, are `NOT NULL DEFAULT ''`. A column that cannot use `''`, such as a number or date, uses `NULL` alone, and if the two meanings must be separated, another column (`outcome`, `validity_kind`) tells them apart. The meaning of each column is in the tables below.
- Text length: names and titles use `CHECK (length(btrim(col)) BETWEEN 1 AND 200)`. A memo has no limit (`text NOT NULL DEFAULT ''`).
- Duration units: the central rule sets durations as `integer` minutes. This app has two durations where minutes do not fit, so they are exceptions (central issue [project-standards#353](https://github.com/sirloinbh/project-standards/issues/353)): the song length `duration_seconds` (seconds, because the LRCLIB and MusicBrainz values are in seconds or milliseconds) and the validity `validity_months` (calendar months, because certification guides say "2 years" or "3 years"). Both have `CHECK (… > 0)`.
- Order column (`position`): starts at 1 and has `CHECK (position > 0)`.
  - Only `study_stages` and `study_tasks`, whose order the user changes, make `UNIQUE (…, position)` `DEFERRABLE INITIALLY DEFERRED`. PostgreSQL checks a non-deferred UNIQUE row by row immediately, so an UPDATE that swaps the order of two rows fails even inside a transaction.
  - Write the deferred constraint as a table constraint inside `CREATE TABLE IF NOT EXISTS`. An index (`CREATE UNIQUE INDEX`) cannot be deferred. `ALTER TABLE … ADD CONSTRAINT` has no `IF NOT EXISTS`, so if it must be added later, write it as a `DO` block that checks `pg_constraint` so it is safe to run again.
  - Do not defer the keys of `album_tracks`, `word_morphemes`, and `daily_words`. `INSERT … ON CONFLICT` cannot use a deferred constraint to detect conflicts, which would break handling of concurrent requests (`daily_words`) and imports.
- A fixed list of values is `text` + `CHECK (col IN (...))`. Values are lowercase English, and the screen text is localized in the frontend.
- Deletion: rows that belong to a parent (attempt records, plans, lyric lines) use `ON DELETE CASCADE`. Shared material (etymology parts) uses `ON DELETE RESTRICT`.
- The migration number is decided when work starts. The order below is an estimate.

## 5. Certification area

### `certifications`: target certifications (#30, expected `002`)

| Column             | Type                              | Meaning and rules                                                                                                                                     |
| ------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | `text NOT NULL`                   | Certification name. 1 to 200 characters                                                                                                               |
| `category`         | `text NOT NULL`                   | `english` (English) · `dev` (development) · `life` (life)                                                                                             |
| `issuer`           | `text NOT NULL DEFAULT ''`        | Issuing organization (for example YBM, Human Resources Development Service of Korea, AWS)                                                             |
| `status`           | `text NOT NULL DEFAULT 'planned'` | `planned` · `studying` · `registered` · `taken` (exam taken) · `passed` · `failed`. The user chooses it                                               |
| `goal_text`        | `text NOT NULL DEFAULT ''`        | Goal description (for example "900 points or more", "Level 7", "Pass")                                                                                |
| `target_score`     | `integer NULL`                    | A score-type goal. `NULL` if the certification has no score or no goal is set. `CHECK (target_score >= 0)`                                            |
| `target_exam_date` | `date NULL`                       | Target exam date. `NULL` if not decided yet                                                                                                           |
| `validity_kind`    | `text NOT NULL DEFAULT 'unknown'` | Kind of validity: `months` (has a number of months) · `none` (does not expire) · `unknown`                                                            |
| `validity_months`  | `integer NULL`                    | Has a value only when `validity_kind = 'months'`. `CHECK ((validity_kind = 'months') = (validity_months IS NOT NULL))`, `CHECK (validity_months > 0)` |
| `memo`             | `text NOT NULL DEFAULT ''`        | Memo                                                                                                                                                  |
| `grade_scale`      | `text NOT NULL DEFAULT 'none'`    | Grade system (#51): `none` (not used) · `toeic` · `toeic_speaking` · `information_processing` · `aws` · `driver_license`. The user chooses it         |
| `target_grade`     | `text NULL`                       | The grade to aim for next (#51, #34). Accepts only values in the system. `NULL` if not decided or if there is no system                               |

- The grade tables and sources are in [Grade systems by certification](../research/certification-grades.md), and the source of the values is `backend/src/grade-scales.ts`. The `grade` of an attempt record stays free text so formats from before a revision can be kept.
- Ordering: the list is grouped by `category`, ordered by nearest `target_exam_date`, with `NULL` last.
- The first 6 goals (#30): TOEIC, TOEIC Speaking, Engineer Information Processing, AWS Cloud Practitioner, AWS Solutions Architect – Associate, and the driver's license. They are personal data, so they are registered on screen instead of being seeded in a migration.

### `exam_attempts`: exam attempt and acquisition records (#32, `003`)

| Column             | Type                              | Meaning and rules                                                                                                                              |
| ------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `certification_id` | `bigint NOT NULL`                 | `certifications(id) ON DELETE CASCADE`                                                                                                         |
| `exam_date`        | `date NOT NULL`                   | Exam date                                                                                                                                      |
| `outcome`          | `text NOT NULL DEFAULT 'waiting'` | `waiting` (before the result) · `passed` · `failed` · `scored` (an exam that has only a score or grade). The user enters it                    |
| `score`            | `integer NULL`                    | Score. `NULL` if the exam has no score or before the result. `CHECK (score >= 0)`                                                              |
| `grade`            | `text NULL`                       | Grade (for example "Level 7", "IH"). `''` if the exam has no grade, `NULL` before the result                                                   |
| `expires_on`       | `date NULL`                       | Last valid day (valid through that day). The meaning of `NULL` is told apart by the goal's `validity_kind` and `outcome` (display rules below) |
| `memo`             | `text NOT NULL DEFAULT ''`        | Memo                                                                                                                                           |

- Default expiry date: when the result is entered as `passed` or `scored` and the goal's `validity_kind` is `months`, fill it by adding `validity_months` months to `exam_date`. The user can edit it.
  - Adding months uses the same end-of-month adjustment as PostgreSQL `date + interval`. Example: `2024-02-29` + 24 months = `2026-02-28`. JavaScript `setUTCMonth` overflows to `2026-03-01`, so do not use it as it is.
  - TOEIC and TOEIC Speaking (2 years) and AWS (3 years) count from the exam date. The last valid day is "the added day". For TOEIC it was confirmed as "2 years after the exam date, through the same exam date"; AWS has no day-level guidance, so it uses the same calculation. The basis is the [#32 change record](../changes/32-exam-attempts-expiry.md).
  - The driver's license is set to `validity_kind = 'months'` with the renewal cycle. `expires_on` is the renewal deadline. A value computed from the exam date is only a reference, so check the real deadline and fix it.
- The expiry date must be after the exam date (table constraint `exam_attempts_expires_after_exam`). For records whose result is `waiting` or `failed`, the API stores `expires_on` as `NULL`. A `waiting` record does not accept a score or grade.
- For records of a goal whose `validity_kind` is `none`, the API stores `expires_on` as `NULL`. When a goal is changed to `none`, the `expires_on` of those records is cleared in the same transaction.
- If a certification has several records (retakes), the expiry card on the dashboard uses only the one record with the latest exam date among the `passed` and `scored` records. In the earlier records on the detail screen, show "newer record exists" instead of an expiry state.
- Expiry state (computed, not stored; the first match from the top wins):

| Condition                                                                       | Display          |
| ------------------------------------------------------------------------------- | ---------------- |
| `outcome` is `waiting` or `failed`                                              | Not shown        |
| The goal's `validity_kind` is `none`                                            | "No expiry"      |
| `expires_on` is `NULL` (`validity_kind` is `unknown`, or the value was cleared) | "Expiry unknown" |
| Today > `expires_on`                                                            | "Expired"        |
| `expires_on` − today ≤ 90 days                                                  | "Expiring soon"  |
| Anything else                                                                   | "Valid"          |

- Goal achieved (computed, not stored): it is "goal achieved" when every goal that is set, the target score or the target grade, is met. If both are `NULL`, it is not shown.
  - Score: `score >= target_score`.
  - Grade (#51): the `grade` of a `passed` or `scored` result equals `target_grade`, or is higher in a system that has levels. The grade of a failed record is only the level that was taken, so it does not count as achieved. For AWS Specialty and the driver's license, it is achieved only when the value is the same.
- When a result is saved without choosing a grade for a goal that has a grade system, `grade` is `''`. The choice field has "None", so it is not mixed up with "no grade".
- When a result is saved as `passed`, the screen asks "Change the goal status to passed?". It does not change it in the same request; if the user chooses to, the goal update API is called separately.

### `study_stages`, `study_tasks`: study plan (#33, `004`)

`study_stages`

| Column                   | Type               | Meaning and rules                                                                                       |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `certification_id`       | `bigint NOT NULL`  | `certifications(id) ON DELETE CASCADE`                                                                  |
| `title`                  | `text NOT NULL`    | Stage name (for example "Week 1", "Past exam practice"). 1 to 200 characters                            |
| `position`               | `integer NOT NULL` | Display order. Deferred UNIQUE `(certification_id, position)` within the same certification (section 4) |
| `start_date`, `end_date` | `date NULL`        | Stage period. `NULL` if not decided. If both exist, `start_date <= end_date`                            |

`study_tasks`

| Column         | Type               | Meaning and rules                                  |
| -------------- | ------------------ | -------------------------------------------------- |
| `stage_id`     | `bigint NOT NULL`  | `study_stages(id) ON DELETE CASCADE`               |
| `title`        | `text NOT NULL`    | The task. 1 to 200 characters                      |
| `position`     | `integer NOT NULL` | Deferred UNIQUE `(stage_id, position)` (section 4) |
| `due_date`     | `date NULL`        | Deadline. `NULL` if none                           |
| `completed_at` | `timestamptz NULL` | When it was completed. `NULL` if not yet           |

- Progress (computed): number of completed tasks ÷ total number of tasks. Not shown if there are no tasks.
- Today's tasks (computed): tasks where `completed_at IS NULL` and `due_date <= today`. Past ones are shown as "overdue".
- New stages and tasks are added at the end. There is no reorder screen yet (#33 change record).
- Reordering edits several rows, so it is handled in one transaction. UNIQUE is made a deferred constraint so it is checked only once at commit (section 4).

### `user_actions`: notifications for things the user must do (#60, `006`)

These are things the app cannot do for the user, such as registration and checking documents. They are shown in the bell icon in the top bar and its panel.

| Column         | Type                       | Meaning and rules                                                                              |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `title`        | `text NOT NULL`            | The task. 1 to 200 characters                                                                  |
| `note`         | `text NOT NULL DEFAULT ''` | Description                                                                                    |
| `link_url`     | `text NOT NULL DEFAULT ''` | Shortcut address. `''` if none. Accepts only `http` and `https`                                |
| `remind_from`  | `date NOT NULL`            | The notification is visible from this day                                                      |
| `due_date`     | `date NULL`                | Deadline. `NULL` if there is no deadline or it has not been announced yet. After `remind_from` |
| `completed_at` | `timestamptz NULL`         | When it was completed. `NULL` if not yet                                                       |

- Visibility condition (computed): `completed_at IS NULL` and `remind_from <= today`. Nearest deadline first, with tasks that have no deadline last.
- They are personal data, so they are not seeded in a migration.

## 6. English study area

### Songs and lyrics (#35, `007`)

Original lyrics and translations are stored only in the local DB (section 1 of the [source material](../research/english-content-sources.md)).

| Table          | Columns                                                                                                                                                                                                                                | Meaning and rules                                                                                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artists`      | `name text NOT NULL`, `musicbrainz_id uuid NULL UNIQUE`                                                                                                                                                                                | Artist. At first there is only one, Taylor Swift                                                                                                                                                                                                                      |
| `albums`       | `artist_id` (`RESTRICT`), `title`, `kind`, `release_date date NULL`, `musicbrainz_id uuid NULL UNIQUE`                                                                                                                                 | `kind`: `studio` (regular) · `taylors_version`. `NULL` if the release date is unknown                                                                                                                                                                                 |
| `songs`        | `artist_id` (`RESTRICT`), `title`, `duration_seconds integer NULL`, `musicbrainz_id uuid NULL UNIQUE`, `lyrics_source text NULL`, `lyrics_source_url text NULL`, `lyrics_fetched_at timestamptz NULL`, `note text NOT NULL DEFAULT ''` | `lyrics_source`: `lrclib` · `manual`. `NULL` if there are no lyrics yet. `lyrics_source_url` is the address if fetched from LRCLIB, `''` if entered by hand, and `NULL` if there are no lyrics yet. Write lyrics that changed in a re-recording and similar in `note` |
| `album_tracks` | `album_id` (`CASCADE`), `song_id` (`CASCADE`), `track_number integer NOT NULL`                                                                                                                                                         | Primary key `(album_id, track_number)`, `UNIQUE (album_id, song_id)`. The same song appears on several albums                                                                                                                                                         |
| `lyric_lines`  | `song_id` (`CASCADE`), `line_number integer NOT NULL`, `original text NOT NULL`, `translation text NULL`                                                                                                                               | Primary key `(song_id, line_number)`. A blank line (verse break) is `original = ''`. `translation` is `NULL` if not translated yet                                                                                                                                    |

- Lyrics state (computed; the first match from the top wins):
  - "No lyrics": no line has `original <> ''` (this includes songs whose `lyrics_source` is `NULL`).
  - "Not translated": among the lines with `original <> ''`, some have `translation` as `NULL`.
  - "Translated": anything else. The song list and the translation progress are shown with this value.
- Saving a translation edits all the lines of one song at once. It matches the lines with text in the original to the lines with text in the translation in order, and if the counts differ it saves nothing. Blank lines are not counted.
- When lyrics are edited, lines with the same content keep their translation even if their position changes, and the translation of a new line becomes `NULL`. If the content is unchanged, nothing is changed, so the source stays the same too.
- Saving lyrics and translations is done in a transaction that locks the song row.

### Words and etymology (#36, `008`)

| Table            | Columns                                                                                                                                                                                                                                                                                                                                                               | Meaning and rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `words`          | `lemma text NOT NULL UNIQUE`, `frequency_rank integer NOT NULL UNIQUE`, `part_of_speech text NULL`, `meaning_ko text NULL`, `example_en text NULL`, `example_ko text NULL`, `ai_generated boolean NOT NULL DEFAULT false`, `list_source_id` (`RESTRICT`), `etymology_source text NULL`, `etymology_url text NULL`, `etymology_source_id` (`RESTRICT`, `NULL` allowed) | `frequency_rank` is the NGSL 1.2 rank (from 1). `NULL` if the part of speech, meaning, or example is not filled in yet. `etymology_source` is the original Wiktionary etymology text: `NULL` if not looked up yet, and `''` if it was looked up and there is no data. `etymology_url` (the address of the Wiktionary entry) follows the same rule. `etymology_source_id` is the record of the fetch when it was looked up, and `NULL` if not looked up yet (it has a value if it was looked up even when there was no data). `list_source_id` is the record of fetching the word list (NGSL) |
| `morphemes`      | `key text NOT NULL UNIQUE`, `form text NOT NULL`, `kind text NOT NULL`, `meaning_ko text NOT NULL`, `origin text NULL`                                                                                                                                                                                                                                                | Etymology part. `kind`: `prefix` · `root` · `suffix`. `key` is a fixed name for finding the same part. A part made first is `<kind>:<form>` (for example `root:port`, to carry). If a part with the same spelling but a different meaning appears later, add `:<English meaning>` to that part only (for example `root:port:harbor`, harbor). Never change a `key` once set. The format is enforced with `CHECK`: `key = kind \|\| ':' \|\| form` or `key LIKE kind \|\| ':' \|\| form \|\| ':%'`. `form` is lowercase and has no hyphen. `origin` example: "Latin", `NULL` if unknown       |
| `word_morphemes` | `word_id` (`CASCADE`), `morpheme_id` (`RESTRICT`), `position integer NOT NULL`                                                                                                                                                                                                                                                                                        | Primary key `(word_id, position)`. The order of the parts within a word                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

- An import does not overwrite a word whose meaning is already filled in. Parts cannot be added to a word with no etymology data (`etymology_source = ''`).
- Words with the same root: other words that have the same `morpheme_id` in `word_morphemes`.
- The etymology import looks up each part by `key` and uses that row if it already exists. The export file includes the list of parts that exist now (`key`, `meaning_ko`) so a Claude Code session does not create a new name for the same part. If the meaning sentence differs a little but the `key` is the same, it is the same part.
- Attribution: below the word list screen and the word-of-the-day card on the dashboard, show the material name from `import_sources` (the screen turns `kind` into "NGSL 1.2" or "Wiktionary") and the license (CC BY-SA 4.0 for NGSL, and for Wiktionary the version confirmed when it was fetched).

### `import_sources`: records of fetching external material (#35, `007`)

This table is for "store the source URL and the fetch date together" in section 6 of the [source material](../research/english-content-sources.md). One row is left each time an import script runs. The LRCLIB address and fetch time for each song are kept in `songs`, so the `musicbrainz` and `lrclib` rows are not referenced by other tables and stay only for run history and license checks. On the word side, `words` references them.

| Column       | Type                   | Meaning and rules                                                                                                      |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `kind`       | `text NOT NULL`        | `musicbrainz` · `lrclib` · `ngsl` · `wiktionary`                                                                       |
| `url`        | `text NOT NULL`        | Address fetched (a file or the API base address)                                                                       |
| `license`    | `text NULL`            | License notice confirmed when fetched (for example `CC BY-SA 4.0`). `''` if there was no notice, `NULL` if not checked |
| `fetched_at` | `timestamptz NOT NULL` | When it was fetched                                                                                                    |

### Word of the day (#37, `009`)

| Table                   | Columns                                                                 | Meaning and rules                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daily_words`           | `day date NOT NULL`, `position integer NOT NULL`, `word_id` (`CASCADE`) | Primary key `(day, position)`, `UNIQUE (day, word_id)`. Chosen the first time it is opened that day, and the same words are shown when it is opened again |
| Column added to `words` | `learned_at timestamptz NULL`                                           | When "I memorized it" was pressed. `NULL` if not yet. A memorized word is not picked again                                                                |

- 5 words a day. Among words not memorized, pick words that have not appeared yet first, then the word that appeared longest ago. For a tie, words with a filled-in meaning come first, then frequency order.
- A day that has been decided is not changed. A day decided with fewer than 5 words because not enough words were left is not refilled even if words are added later. A day with no words decided is picked again the next time it is opened.
- So that two simultaneous requests on the same day decide it only once, read again after `INSERT … ON CONFLICT DO NOTHING`. Opening a past day does not pick new words.

## 7. Relationships at a glance

```
certifications 1─* exam_attempts
certifications 1─* study_stages 1─* study_tasks

artists 1─* albums 1─* album_tracks *─1 songs 1─* lyric_lines
artists 1─* songs

words 1─* word_morphemes *─1 morphemes
words 1─* daily_words
import_sources 1─* words (word list, etymology)
```
