import { expect, test } from 'vitest';

import {
  type Certification,
  examCountdown,
  groupByCategory,
  upcomingExams,
  validityText,
} from './certification-data';

const goal = (fields: Partial<Certification>): Certification => ({
  id: 1,
  name: '토익',
  category: 'english',
  issuer: '',
  status: 'planned',
  goalText: '',
  targetScore: null,
  targetExamDate: null,
  daysUntilExam: null,
  validityKind: 'unknown',
  validityMonths: null,
  memo: '',
  gradeScale: 'none',
  targetGrade: null,
  ...fields,
});

test('the countdown reads as days left, the exam day, days passed or no date', () => {
  expect(examCountdown(44)).toBe('44일 남음');
  expect(examCountdown(0)).toBe('오늘 시험');
  expect(examCountdown(-5)).toBe('5일 지남');
  expect(examCountdown(null)).toBe('시험일 미정');
});

test('validity shows months, never expires or unknown', () => {
  expect(validityText({ validityKind: 'months', validityMonths: 24 })).toBe('24개월');
  expect(validityText({ validityKind: 'none', validityMonths: null })).toBe('만료 없음');
  expect(validityText({ validityKind: 'unknown', validityMonths: null })).toBe('모름');
});

test('groups follow the menu order of categories, keep item order and skip empty ones', () => {
  const list = [
    goal({ id: 1, category: 'life' }),
    goal({ id: 2, category: 'english' }),
    goal({ id: 3, category: 'life' }),
  ];
  expect(
    groupByCategory(list).map(({ category, items }) => [category, items.map((i) => i.id)]),
  ).toEqual([
    ['english', [2]],
    ['life', [1, 3]],
  ]);
});

test('upcoming exams are the nearest dates from today among goals still preparing', () => {
  const list = [
    goal({ id: 1, daysUntilExam: 30 }),
    goal({ id: 2, daysUntilExam: -1 }), // already past
    goal({ id: 3, daysUntilExam: null }), // no date
    goal({ id: 4, daysUntilExam: 0, status: 'registered' }), // today counts
    goal({ id: 5, daysUntilExam: 10, status: 'passed' }), // done
    goal({ id: 6, daysUntilExam: 12, status: 'studying' }),
    goal({ id: 7, daysUntilExam: 90 }),
  ];
  expect(upcomingExams(list).map((item) => item.id)).toEqual([4, 6, 1]);
  expect(upcomingExams(list, 5).map((item) => item.id)).toEqual([4, 6, 1, 7]);
});
