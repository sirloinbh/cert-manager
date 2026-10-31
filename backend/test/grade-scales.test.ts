import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { gradeScales } from '../src/grade-scales.js';
import { withApi } from './helpers.js';

function fakePool() {
  const queries: { values: unknown[] }[] = [];
  const pool = {
    query: async (_text: string, values: unknown[] = []) => {
      queries.push({ values });
      return { rows: [{ id: '8', name: '토익' }] };
    },
  } as unknown as Pool;
  return { pool, queries };
}

const toeicGoal = { name: '토익', category: 'english', gradeScale: 'toeic' };

test('the API lists every scale with its levels and source', async () => {
  const { pool, queries } = fakePool();
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/grade-scales');
    assert.equal(status, 200);
    const scales = data.scales as { key: string; sourceUrl: string; levels: unknown[] }[];
    assert.deepEqual(
      scales.map((scale) => scale.key),
      ['toeic', 'toeic_speaking', 'information_processing', 'aws', 'driver_license'],
    );
    for (const scale of scales) {
      assert.match(scale.sourceUrl, /^https:\/\//);
      assert.ok(scale.levels.length > 0);
    }
  });
  assert.equal(queries.length, 0);
});

test('a goal saves its scale and a target grade from that scale', async () => {
  const { pool, queries } = fakePool();
  await withApi(pool, async (call) => {
    const { status } = await call('/api/certifications', {
      method: 'POST',
      body: { ...toeicGoal, targetGrade: 'B2' },
    });
    assert.equal(status, 201);
  });
  assert.deepEqual(queries[0]?.values.slice(-2), ['toeic', 'B2']);
});

test('a scale without a target is allowed: the target is not decided yet', async () => {
  const { pool, queries } = fakePool();
  await withApi(pool, async (call) => {
    assert.equal(
      (await call('/api/certifications', { method: 'POST', body: toeicGoal })).status,
      201,
    );
  });
  assert.deepEqual(queries[0]?.values.slice(-2), ['toeic', null]);
});

test('an unknown scale or a target outside the scale is a Korean 400', async () => {
  const { pool, queries } = fakePool();
  const cases: [object, string][] = [
    [{ ...toeicGoal, gradeScale: 'jlpt' }, '등급 체계는 목록에 있는 값이어야 합니다'],
    [{ ...toeicGoal, targetGrade: 'AL' }, '목표 등급은 고른 등급 체계에 있는 값이어야 합니다'],
    [
      { name: '토익', category: 'english', targetGrade: 'B2' },
      '목표 등급은 고른 등급 체계에 있는 값이어야 합니다',
    ],
  ];
  await withApi(pool, async (call) => {
    for (const [body, message] of cases) {
      const { status, data } = await call('/api/certifications', { method: 'POST', body });
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(data.error, message);
    }
  });
  assert.equal(queries.length, 0);
});

test('score ranges rise from the lowest level and only IM1~IM3 share one', () => {
  for (const scale of gradeScales) {
    const ranges = scale.levels.filter((level) => level.minScore !== null);
    for (const [index, level] of ranges.entries()) {
      assert.ok(Number(level.minScore) <= Number(level.maxScore), level.value);
      const next = ranges[index + 1];
      if (!next) continue;
      const shared = level.minScore === next.minScore && level.maxScore === next.maxScore;
      if (shared) assert.match(level.value + next.value, /^IM\dIM\d$/);
      else assert.ok(Number(level.maxScore) < Number(next.minScore), level.value);
    }
  }
});
