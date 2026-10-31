import { expect, test } from 'vitest';

import { type GradeScale, gradesForScore, reachedGrade, scoreRange } from './grade-scale-data';

const scale = (fields: Partial<GradeScale>): GradeScale => ({
  key: 'test',
  label: '시험',
  note: '',
  sourceUrl: 'https://example.com',
  ranked: true,
  levels: [],
  ...fields,
});

const toeic = scale({
  levels: [
    { value: 'B1', minScore: 550, maxScore: 784 },
    { value: 'B2', minScore: 785, maxScore: 944 },
  ],
});
const speaking = scale({
  levels: [
    { value: 'IM1', minScore: 110, maxScore: 130 },
    { value: 'IM2', minScore: 110, maxScore: 130 },
    { value: 'AH', minScore: 200, maxScore: 200 },
  ],
});
const aws = scale({
  levels: [
    { value: 'Foundational', minScore: null, maxScore: null },
    { value: 'Associate', minScore: null, maxScore: null },
    { value: 'Specialty', minScore: null, maxScore: null, offLadder: true },
  ],
});
const licences = scale({
  ranked: false,
  levels: [
    { value: '2종 보통', minScore: null, maxScore: null },
    { value: '1종 보통', minScore: null, maxScore: null },
  ],
});

test('a score finds its level at both ends of the range, and none outside', () => {
  expect(gradesForScore(toeic, 785).map((level) => level.value)).toEqual(['B2']);
  expect(gradesForScore(toeic, 784).map((level) => level.value)).toEqual(['B1']);
  expect(gradesForScore(toeic, 549)).toEqual([]);
  expect(gradesForScore(aws, 100)).toEqual([]);
});

test('a shared range answers every level in it', () => {
  expect(gradesForScore(speaking, 120).map((level) => level.value)).toEqual(['IM1', 'IM2']);
});

test('a higher level reaches a lower target, and a lower one does not', () => {
  expect(reachedGrade(toeic, 'B2', 'B1')).toBe(true);
  expect(reachedGrade(toeic, 'B2', 'B2')).toBe(true);
  expect(reachedGrade(toeic, 'B1', 'B2')).toBe(false);
});

test('without both grades or a known level there is nothing to compare', () => {
  expect(reachedGrade(toeic, null, 'B2')).toBe(false);
  expect(reachedGrade(toeic, 'B2', null)).toBe(false);
  expect(reachedGrade(toeic, '', 'B2')).toBe(false);
  expect(reachedGrade(toeic, 'Level 7', 'B2')).toBe(false);
  expect(reachedGrade(undefined, 'B2', 'B1')).toBe(false);
});

test('a separate field and kinds of licence only match themselves', () => {
  expect(reachedGrade(aws, 'Specialty', 'Associate')).toBe(false);
  expect(reachedGrade(aws, 'Associate', 'Specialty')).toBe(false);
  expect(reachedGrade(aws, 'Specialty', 'Specialty')).toBe(true);
  expect(reachedGrade(licences, '1종 보통', '2종 보통')).toBe(false);
  expect(reachedGrade(licences, '2종 보통', '2종 보통')).toBe(true);
});

test('score ranges read as one number when the level has one score', () => {
  expect(scoreRange({ value: 'AH', minScore: 200, maxScore: 200 })).toBe('200점');
  expect(scoreRange({ value: 'B2', minScore: 785, maxScore: 944 })).toBe('785~944점');
  expect(scoreRange({ value: '기사', minScore: null, maxScore: null })).toBe('');
});
