import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { Pool } from 'pg';

import { fetchMissingEtymology } from '../src/word-etymology.js';
import { exportWordBatch, importWordBatches } from '../src/word-files.js';
import { saveWordList } from '../src/word-list.js';
import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

type Filled = {
  lemma: string;
  partOfSpeech: string;
  meaningKo: string;
  exampleEn: string;
  exampleKo: string;
  morphemes: object[];
};

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
// All words and etymologies here are made up for the test.
test(
  'words go from list to etymology to filled in, and word parts link them',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const dir = await mkdtemp(join(tmpdir(), 'cert-words-'));
    const lemmas = ['zzcarry', 'zzexport', 'zzport', 'zznone'];
    const listUrl = 'https://example.test/36-list';
    const server = createServer((req, res) => {
      const known: Record<string, string> = {
        '/z/zz/zzcarry.jsonl': 'From a made-up root.',
        '/z/zz/zzexport.jsonl': 'From zzex- + zzport.',
        '/z/zz/zzport.jsonl': 'From a made-up port.',
      };
      const text = known[req.url ?? ''];
      if (text) res.end(JSON.stringify({ etymology_text: text }));
      else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(async () => {
      server.close();
      await rm(dir, { recursive: true, force: true });
      await pool.query('DELETE FROM words WHERE lemma = ANY($1::text[])', [lemmas]);
      await pool.query("DELETE FROM morphemes WHERE form LIKE 'zz%'");
      await pool.query('DELETE FROM import_sources WHERE url = ANY($1::text[])', [
        [listUrl, baseUrl],
      ]);
      await pool.end();
    });

    // The lookup below covers every word without an etymology, so real words must not be here.
    const others = await pool.query('SELECT 1 FROM words WHERE lemma <> ALL($1::text[]) LIMIT 1', [
      lemmas,
    ]);
    assert.equal(others.rowCount, 0, 'this test needs a test database with no other words');

    const words = lemmas.map((lemma, index) => ({ lemma, rank: 900_001 + index }));
    await saveWordList(pool, words, listUrl);
    await saveWordList(pool, words, listUrl);
    await assert.rejects(
      saveWordList(pool, [{ lemma: 'zzcarry', rank: 900_999 }], listUrl),
      /Word ranks changed, nothing saved. First: zzcarry/,
    );
    await assert.rejects(
      saveWordList(pool, [{ lemma: 'zzother', rank: 900_001 }], listUrl),
      /Word ranks changed/,
    );
    const listed = await pool.query('SELECT 1 FROM words WHERE lemma = ANY($1::text[])', [lemmas]);
    assert.equal(listed.rowCount, 4, 'running the list again adds nothing');

    // A word not looked up yet is not handed out for filling in.
    assert.deepEqual(await exportWordBatch(pool, dir, 10), { file: null, written: false });

    const sleep = async () => {};
    const looked = await fetchMissingEtymology(pool, { baseUrl, sleep });
    assert.equal(looked.found, 3);
    assert.deepEqual(looked.none, ['zznone']);
    const stored = await pool.query<{ etymology_source: string; etymology_url: string }>(
      'SELECT etymology_source, etymology_url FROM words WHERE lemma = ANY($1::text[]) ORDER BY frequency_rank',
      [['zzcarry', 'zznone']],
    );
    assert.deepEqual(stored.rows, [
      {
        etymology_source: 'From a made-up root.',
        etymology_url: 'https://en.wiktionary.org/wiki/zzcarry',
      },
      { etymology_source: '', etymology_url: '' },
    ]);
    assert.equal(
      (await fetchMissingEtymology(pool, { baseUrl, sleep })).found,
      0,
      'one lookup each',
    );

    const exported = await exportWordBatch(pool, dir, 2);
    assert.deepEqual(exported, { file: 'words-900001-900002.json', written: true });
    assert.equal((await exportWordBatch(pool, dir, 2)).written, false, 'work in progress stays');
    const name = exported.file ?? '';
    const batchFile = JSON.parse(await readFile(join(dir, name), 'utf8')) as {
      morphemes: unknown[];
      words: { lemma: string; etymologySource: string }[];
    };
    assert.deepEqual(batchFile.morphemes, []);
    assert.equal(batchFile.words[0]?.etymologySource, 'From a made-up root.');

    const port = {
      key: 'root:zzport',
      form: 'zzport',
      kind: 'root',
      meaningKo: '나르다',
      origin: '라틴어',
    };
    const fill = (
      lemma: string,
      morphemes: object[] = [],
      fields: Partial<Filled> = {},
    ): Filled => ({
      lemma,
      partOfSpeech: '동사',
      meaningKo: `${lemma}의 뜻`,
      exampleEn: 'A made-up sentence.',
      exampleKo: '지어낸 문장.',
      morphemes,
      ...fields,
    });
    const write = async (content: object | string) => {
      await writeFile(
        join(dir, name),
        typeof content === 'string' ? content : JSON.stringify(content),
      );
      return importWordBatches(pool, dir);
    };

    const refused: [object | string, RegExp][] = [
      ['{ 깨진 파일', /JSON으로 읽을 수 없습니다/],
      [{ words: [fill('zzcarry', [], { meaningKo: '  ' })] }, /words\.0\.meaningKo/],
      [{ words: [fill('zzmissing')] }, /목록에 없는 단어입니다: zzmissing/],
      [{ words: [fill('zzcarry'), fill('zzcarry')] }, /같은 단어가 두 번 있습니다/],
      [{ words: [fill('zznone', [port])] }, /어원 자료가 없는 단어에는/],
      [{ words: [fill('zzcarry', [{ ...port, key: 'root:other' }])] }, /이름이 규칙과 다릅니다/],
      [{ words: [fill('zzcarry', [{ ...port, key: 'root:zzport:' }])] }, /이름이 규칙과 다릅니다/],
      [{ words: [fill('zzcarry', [port, port])] }, /같은 어원 요소가 두 번/],
      [{ words: [fill('zzcarry', [], { meaningKo: '끝\u0000' })] }, /words\.0\.meaningKo/],
      [{ words: [fill('zzcarry', [{ ...port, form: 'Zz-Port' }])] }, /파일 형식이 맞지 않습니다/],
    ];
    for (const [content, reason] of refused) {
      const { saved, rejected } = await write(content);
      assert.deepEqual(saved, []);
      assert.match(rejected[0]?.reason ?? '', reason);
    }
    const untouched = await pool.query(
      'SELECT 1 FROM words WHERE lemma = ANY($1::text[]) AND meaning_ko IS NOT NULL',
      [lemmas],
    );
    assert.equal(untouched.rowCount, 0, 'a refused batch changes nothing');

    const carryPart = {
      key: 'root:zzcarry',
      form: 'zzcarry',
      kind: 'root',
      meaningKo: '옮기다',
      origin: null,
    };
    const first = await write(
      `\uFEFF${JSON.stringify({ words: [fill('zzcarry', [carryPart]), fill('zzport', [port])] })}`,
    );
    assert.deepEqual(first, { saved: [name], notMoved: [], rejected: [] });
    assert.deepEqual(await readdir(join(dir, 'imported')), [name]);

    // A second batch sees the parts already there; the same key is the same part, whatever its wording.
    const next = await exportWordBatch(pool, dir, 10);
    const nextFile = JSON.parse(await readFile(join(dir, next.file ?? ''), 'utf8')) as {
      morphemes: { key: string }[];
    };
    assert.deepEqual(
      nextFile.morphemes.map((part) => part.key).filter((key) => key.includes('zz')),
      ['root:zzcarry', 'root:zzport'],
    );
    await rm(join(dir, next.file ?? ''));
    await writeFile(
      join(dir, 'second.json'),
      JSON.stringify({
        words: [
          fill('zzexport', [
            { key: 'prefix:zzex', form: 'zzex', kind: 'prefix', meaningKo: '밖으로', origin: null },
            { ...port, meaningKo: '다르게 쓴 뜻' },
          ]),
        ],
      }),
    );
    assert.deepEqual((await importWordBatches(pool, dir)).saved, ['second.json']);
    const again = await write({ words: [fill('zzcarry')] });
    assert.match(again.rejected[0]?.reason ?? '', /이미 채운 단어입니다: zzcarry/);
    await rm(join(dir, name));

    await withApi(pool, async (call) => {
      const list = await call('/api/words');
      assert.equal(list.status, 200);
      const mine = (
        list.data.words as { lemma: string; rank: number; meaningKo: string | null }[]
      ).filter((word) => lemmas.includes(word.lemma));
      assert.deepEqual(
        mine.map((word) => word.lemma),
        lemmas,
        'most frequent first',
      );
      assert.equal(mine[3]?.meaningKo, null);
      const sources = list.data.sources as { kind: string; license: string }[];
      assert.deepEqual(sources.map((source) => [source.kind, source.license]).sort(), [
        ['ngsl', 'CC BY-SA 4.0'],
        ['wiktionary', 'CC BY-SA 4.0'],
      ]);

      const exportId = (list.data.words as { id: number; lemma: string }[]).find(
        (word) => word.lemma === 'zzexport',
      )?.id;
      const detail = await call(`/api/words/${exportId}`);
      assert.equal(detail.status, 200);
      const word = detail.data.word as {
        aiGenerated: boolean;
        etymologySource: string;
        morphemes: {
          key: string;
          meaningKo: string;
          origin: string | null;
          words: { lemma: string; meaningKo: string }[];
        }[];
      };
      assert.equal(word.aiGenerated, true);
      assert.equal(word.etymologySource, 'From zzex- + zzport.');
      assert.deepEqual(
        word.morphemes.map((part) => part.key),
        ['prefix:zzex', 'root:zzport'],
        'in the order of the word',
      );
      assert.equal(word.morphemes[1]?.meaningKo, '나르다', 'the first wording stays');
      assert.deepEqual(word.morphemes[0]?.words, [], 'no other word has this part');
      assert.deepEqual(
        word.morphemes[1]?.words.map((other) => [other.lemma, other.meaningKo]),
        [['zzport', 'zzport의 뜻']],
        'another word with the same root, not this word',
      );

      const missing = await call('/api/words/999999999');
      assert.equal(missing.status, 404);
      assert.deepEqual(missing.data, { error: '단어를 찾을 수 없습니다' });
      const bad = await call('/api/words/abc');
      assert.equal(bad.status, 400);
    });

    // A word part in use cannot be removed; deleting the word releases it.
    await assert.rejects(pool.query("DELETE FROM morphemes WHERE key = 'root:zzport'"), {
      code: '23503',
    });
    // The key rule also holds in the table itself.
    await assert.rejects(
      pool.query(
        "INSERT INTO morphemes (key, form, kind, meaning_ko) VALUES ('root:zzport:', 'zzport', 'root', '뜻')",
      ),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO morphemes (key, form, kind, meaning_ko) VALUES ('root:zzother', 'zzport', 'root', '뜻')",
      ),
      { code: '23514' },
    );
  },
);

type DayAnswer = {
  day: string;
  previousDay: string | null;
  nextDay: string | null;
  words: { id: number; lemma: string; learnedAt: string | null }[];
};

// Same reason for being here as above: choosing words looks at every word in the table.
test(
  'the same words all day, new ones the next day, and learned ones never again',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    const listUrl = 'https://example.test/37-list';
    const lemmas = Array.from({ length: 12 }, (_, index) => `zzday${index + 1}`);
    t.after(async () => {
      await pool.query('DELETE FROM words WHERE lemma = ANY($1::text[])', [lemmas]);
      await pool.query('DELETE FROM import_sources WHERE url = $1', [listUrl]);
      await pool.end();
    });
    await saveWordList(
      pool,
      lemmas.map((lemma, index) => ({ lemma, rank: 900_101 + index })),
      listUrl,
    );

    let current = '2026-11-01';
    const open = async (call: Parameters<Parameters<typeof withApi>[1]>[0], day?: string) => {
      const { status, data } = await call(`/api/daily-words${day ? `?day=${day}` : ''}`);
      assert.equal(status, 200);
      return data as unknown as DayAnswer;
    };
    const names = (answer: DayAnswer) => answer.words.map((word) => word.lemma);

    await withApi(
      pool,
      async (call) => {
        // Before anything is chosen, an earlier day stays empty and chooses nothing.
        assert.deepEqual(names(await open(call, '2026-10-31')), []);

        // Requests at the same moment choose once.
        const [first, second] = await Promise.all([open(call), open(call)]);
        assert.deepEqual(names(first as DayAnswer), lemmas.slice(0, 5));
        assert.deepEqual(names(second as DayAnswer), lemmas.slice(0, 5));
        assert.deepEqual(names(await open(call)), lemmas.slice(0, 5), 'the same words all day');

        // Learned today: still in today's list, and marked.
        const learned = (first as DayAnswer).words[1];
        assert.ok(learned);
        const marked = await call(`/api/words/${learned.id}/learned`, {
          method: 'PUT',
          body: { learned: true },
        });
        assert.equal(marked.status, 200);
        const stamp = (marked.data.word as { learnedAt: string }).learnedAt;
        assert.ok(stamp);
        const again = await call(`/api/words/${learned.id}/learned`, {
          method: 'PUT',
          body: { learned: true },
        });
        assert.equal(
          (again.data.word as { learnedAt: string }).learnedAt,
          stamp,
          'keeps the first time',
        );
        const same = await open(call);
        assert.deepEqual(names(same), lemmas.slice(0, 5));
        assert.equal(same.words[1]?.learnedAt, stamp);

        // A new day brings words not shown yet, and among those a word with a meaning comes first.
        await pool.query("UPDATE words SET meaning_ko = '뜻' WHERE lemma = $1", [lemmas[7]]);
        current = '2026-11-02';
        const notChosenYet = await open(call, '2026-11-01');
        assert.equal(notChosenYet.nextDay, '2026-11-02', 'today is reachable before it is chosen');
        const next = await open(call);
        assert.equal(next.day, '2026-11-02');
        assert.deepEqual(names(next), [lemmas[7], lemmas[5], lemmas[6], lemmas[8], lemmas[9]]);
        assert.equal(next.previousDay, '2026-11-01');
        assert.equal(next.nextDay, null);

        // Going back shows that day's words, without choosing anything.
        const past = await open(call, '2026-11-01');
        assert.deepEqual(names(past), lemmas.slice(0, 5));
        assert.equal(past.previousDay, null);
        assert.equal(past.nextDay, '2026-11-02');

        // When every word has been shown, the ones not shown for longest come back, never the learned one.
        current = '2026-11-03';
        assert.deepEqual(names(await open(call)), [
          ...lemmas.slice(10),
          lemmas[0],
          lemmas[2],
          lemmas[3],
        ]);

        // Undoing makes a word eligible again, and a word with a meaning does not repeat ahead of older ones.
        const undone = await call(`/api/words/${learned.id}/learned`, {
          method: 'PUT',
          body: { learned: false },
        });
        assert.equal((undone.data.word as { learnedAt: string | null }).learnedAt, null);
        await pool.query("UPDATE words SET meaning_ko = '뜻' WHERE lemma = $1", [lemmas[11]]);
        current = '2026-11-04';
        assert.deepEqual(names(await open(call)), [
          lemmas[1],
          lemmas[4],
          lemmas[7],
          lemmas[5],
          lemmas[6],
        ]);

        // With every word learned, today has nothing new to show.
        await pool.query('UPDATE words SET learned_at = now() WHERE lemma = ANY($1::text[])', [
          lemmas,
        ]);
        current = '2026-11-05';
        const empty = await open(call);
        assert.deepEqual(names(empty), []);
        assert.equal(empty.previousDay, '2026-11-04');
        assert.equal(
          (await open(call, '2026-11-04')).nextDay,
          '2026-11-05',
          'back to the empty day',
        );
      },
      { today: () => current },
    );
  },
);
