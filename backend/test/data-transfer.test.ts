import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { exportTables, exportVersion, toCsv } from '../src/data-transfer.js';
import { listenLocally, withApi } from './helpers.js';

type Query = { text: string };

// One fake connection: each table's SELECT answers the rows given for its name.
function fakePool(rows: Record<string, Record<string, unknown>[]>) {
  const queries: Query[] = [];
  let released = 0;
  const client = {
    query: async (text: string) => {
      queries.push({ text });
      const table = exportTables.find((item) => item.select === text);
      return { rows: table ? (rows[table.name] ?? []) : [] };
    },
    release: () => {
      released += 1;
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, queries, released: () => released };
}

const today = () => '2027-03-08';

const goal = {
  id: 1,
  name: 'TOEIC, "Speaking"',
  category: 'english',
  issuer: '',
  status: 'studying',
  goalText: '=SUM(A1)',
  targetScore: 900,
  targetExamDate: '2027-04-10',
  validityKind: 'months',
  validityMonths: 24,
  gradeScale: 'toeic',
  targetGrade: null,
  memo: '첫 줄\n둘째 줄',
  createdAt: new Date('2027-01-01T00:00:00Z'),
  updatedAt: new Date('2027-01-02T00:00:00Z'),
};

test('the export has a version, the export time and every included table', async () => {
  const { pool, queries, released } = fakePool({ certifications: [goal] });
  await withApi(
    pool,
    async (call) => {
      const { status, data, headers } = await call('/api/data-transfer/export');
      assert.equal(status, 200);
      assert.equal(data.version, exportVersion);
      assert.match(String(data.exportedAt), /^\d{4}-\d{2}-\d{2}T/);
      const tables = data.tables as Record<string, unknown[]>;
      assert.deepEqual(Object.keys(tables), [
        'certifications',
        'examAttempts',
        'studyStages',
        'studyTasks',
        'userActions',
      ]);
      assert.equal(tables.certifications?.length, 1);
      assert.equal((tables.certifications?.[0] as typeof goal).targetExamDate, '2027-04-10');
      assert.match(headers.get('content-disposition') ?? '', /cert-manager-2027-03-08\.json/);
    },
    { today },
  );
  // One read-only snapshot, always ended, and the connection goes back to the pool.
  assert.match(queries[0]!.text, /READ ONLY/);
  assert.equal(queries.at(-1)!.text, 'ROLLBACK');
  assert.equal(released(), 1);
  assert.ok(queries.every((query) => !/\b(INSERT|UPDATE|DELETE)\b/i.test(query.text)));
});

test('the export leaves out words, daily words, songs and lyrics', () => {
  const sql = exportTables.map((table) => table.select).join('\n');
  assert.doesNotMatch(sql, /\b(words|daily_words|songs|lyric\w*)\b/i);
});

// withApi parses JSON, so a CSV answer needs its own server.
async function getText(pool: Pool, path: string) {
  const server = createServer(createApp(pool, { today }));
  const port = await listenLocally(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    // text() drops a leading BOM, so keep the bytes and decode without stripping it.
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { response, text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('a CSV file holds one table with a header row', async () => {
  const { pool } = fakePool({ certifications: [goal] });
  const { response, text } = await getText(pool, '/api/data-transfer/export/certifications');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/csv/);
  assert.match(
    response.headers.get('content-disposition') ?? '',
    /cert-manager-certifications-2027-03-08\.csv/,
  );
  assert.equal(text.split('\r\n')[0], `\uFEFF${exportTables[0]!.columns.join(',')}`);
});

test('toCsv quotes commas, quotes and line breaks and keeps formulas as text', () => {
  const table = exportTables[0]!;
  const csv = toCsv(table, [goal]);
  assert.ok(csv.startsWith('﻿id,name,category,'));
  const [header, row] = csv.slice(1).split('\r\n');
  assert.equal(header, table.columns.join(','));
  assert.ok(
    row!.startsWith('1,"TOEIC, ""Speaking""",english,,studying,\'=SUM(A1),900,2027-04-10,'),
  );
  assert.ok(row!.includes('"첫 줄\n둘째 줄"'));
  assert.ok(row!.endsWith('2027-01-02T00:00:00.000Z'));
  assert.ok(csv.endsWith('\r\n'));
});

test('an unknown table answers 404 with an English message', async () => {
  const { pool } = fakePool({});
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/data-transfer/export/words');
    assert.equal(status, 404);
    assert.equal(typeof data.error, 'string');
  });
});
