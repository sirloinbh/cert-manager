import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { inTransaction, lockSong, setTranslations } from './lyrics-store.js';
import { HttpError } from './standard/http.js';

// Translation work files (#64): one JSON per song, filled in by hand or by a translation tool.
// The folder is in .gitignore because the files hold lyrics.

export const translationsDir = fileURLToPath(
  new URL('../../.local/translations/', import.meta.url),
);

const fileSchema = z.object({
  songId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  title: z.string(),
  // Far more lines, and far longer ones, than any song has.
  lines: z
    .array(
      z.object({
        lineNumber: z.number().int().positive(),
        original: z.string().max(5000),
        // The translation when the file was written, to notice edits made on the screen since.
        atExport: z.string().max(5000).nullable(),
        translation: z.string().max(5000).nullable(),
      }),
    )
    .max(5000),
});
type TranslationFile = z.infer<typeof fileSchema>;

type TextLine = { lineNumber: number; original: string; translation: string | null };

// A file that cannot be saved. Anything else, like a lost database connection, stops the script.
class RejectedFile extends Error {}

/** Why these lines are not the song's lines, or null when they are. */
function lineProblem(file: TranslationFile, originals: TextLine[]) {
  if (file.lines.length !== originals.length) {
    return `번역 줄 수(${file.lines.length}줄)가 원문 줄 수(${originals.length}줄)와 다릅니다`;
  }
  const moved = file.lines.some(
    (line, index) =>
      line.lineNumber !== originals[index]?.lineNumber ||
      line.original !== originals[index]?.original,
  );
  return moved ? '원문이 DB와 다릅니다. 파일을 지우고 다시 내보내 주세요' : null;
}

const cell = (value: string | null | undefined) => (value ?? '').trim();

// An earlier run saved this file but could not move it. The translation is in, so it only needs moving.
const alreadySaved = (file: TranslationFile, originals: TextLine[]) =>
  file.lines.every(
    (line, index) =>
      cell(line.translation) !== '' &&
      cell(line.translation) === cell(originals[index]?.translation),
  );

// Nothing was written in this file yet, so there is nothing to save or complain about.
const nothingTyped = (file: TranslationFile) =>
  file.lines.every((line) => cell(line.translation) === cell(line.atExport));

// Saving writes every line, which would undo what was changed on the screen after the export.
const changedSinceExport = (file: TranslationFile, originals: TextLine[]) =>
  file.lines.some((line, index) => cell(line.atExport) !== cell(originals[index]?.translation));

/** Why these translations cannot be saved, or null. Saving is all or nothing. */
function translationProblem(file: TranslationFile) {
  const empty = file.lines.filter((line) => !line.translation?.trim()).length;
  if (empty > 0) return `번역이 비어 있는 줄이 ${empty}개 있습니다`;
  if (file.lines.some((line) => /[\r\n]/.test(line.translation ?? ''))) {
    return '번역 한 칸에는 한 줄만 쓸 수 있습니다';
  }
  if (file.lines.some((line) => line.translation?.includes('\u0000'))) {
    return '번역에 쓸 수 없는 문자가 있습니다';
  }
  return null;
}

async function textLines(pool: Pick<Pool, 'query'>, id: number) {
  const { rows } = await pool.query<TextLine>(
    `SELECT line_number AS "lineNumber", original, translation FROM lyric_lines
     WHERE song_id = $1 AND original <> '' ORDER BY line_number`,
    [id],
  );
  return rows;
}

/** Writes a file for each song with lines still to translate. A file already there is someone's work, so it stays. */
export async function exportTranslations(pool: Pool, dir: string) {
  await mkdir(dir, { recursive: true });
  const { rows } = await pool.query<{ id: string; title: string }>(
    `SELECT s.id::text AS id, s.title FROM songs s
     WHERE EXISTS (SELECT 1 FROM lyric_lines l
                   WHERE l.song_id = s.id AND l.original <> '' AND l.translation IS NULL)
     ORDER BY s.id`,
  );
  const result = { written: [] as string[], kept: [] as string[] };
  for (const song of rows) {
    const songId = Number(song.id);
    const lines = (await textLines(pool, songId)).map((line) => ({
      lineNumber: line.lineNumber,
      original: line.original,
      atExport: line.translation,
      translation: line.translation ?? '',
    }));
    const file: TranslationFile = { songId, title: song.title, lines };
    try {
      await writeFile(join(dir, `${songId}.json`), `${JSON.stringify(file, null, 2)}\n`, {
        flag: 'wx',
      });
      result.written.push(song.title);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      result.kept.push(song.title);
    }
  }
  return result;
}

function parseFile(name: string, text: string) {
  let value: unknown;
  try {
    // Some Windows tools start a UTF-8 file with a byte order mark.
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new RejectedFile('JSON으로 읽을 수 없습니다');
  }
  const parsed = fileSchema.safeParse(value);
  if (!parsed.success) throw new RejectedFile('파일 형식이 내보낸 형식과 다릅니다');
  if (`${parsed.data.songId}.json` !== name) {
    throw new RejectedFile('파일 이름과 곡 ID가 다릅니다');
  }
  return parsed.data;
}

/**
 * Saves each file whose lines all match, then moves it to imported/ so a later run cannot undo
 * edits made on the screen. Files not filled in yet are skipped; bad ones stay and are named with the reason.
 */
export async function importTranslations(pool: Pool, dir: string) {
  const result = {
    saved: [] as string[],
    skipped: [] as string[],
    rejected: [] as { file: string; reason: string }[],
  };
  const doneDir = join(dir, 'imported');
  await mkdir(doneDir, { recursive: true });
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  for (const name of names) {
    try {
      const file = parseFile(name, await readFile(join(dir, name), 'utf8'));
      let skip = false;
      await inTransaction(pool, async (client) => {
        await lockSong(client, file.songId);
        const originals = await textLines(client, file.songId);
        const mismatch = lineProblem(file, originals);
        if (mismatch) throw new RejectedFile(mismatch);
        if (alreadySaved(file, originals)) return;
        skip = nothingTyped(file);
        if (skip) return;
        if (changedSinceExport(file, originals)) {
          throw new RejectedFile('내보낸 뒤 번역이 바뀌었습니다. 파일을 지우고 다시 내보내 주세요');
        }
        const problem = translationProblem(file);
        if (problem) throw new RejectedFile(problem);
        await setTranslations(
          client,
          file.songId,
          file.lines.map((line) => ({
            lineNumber: line.lineNumber,
            translation: (line.translation ?? '').trim(),
          })),
        );
      });
      if (skip) {
        result.skipped.push(name);
      } else {
        await rename(join(dir, name), join(doneDir, name));
        result.saved.push(name);
      }
    } catch (error) {
      // lockSong's HttpError is a song that no longer exists.
      if (!(error instanceof RejectedFile || error instanceof HttpError)) throw error;
      result.rejected.push({ file: name, reason: error.message });
    }
  }
  return result;
}
