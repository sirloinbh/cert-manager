import { expect, test } from 'vitest';

import { addDays, upcomingWeeks, weekDays, weekStart, weekTitle } from './week-range';

test('weeks run Sunday to Saturday', () => {
  expect(weekStart('2026-11-26')).toBe('2026-11-22');
  expect(weekStart('2026-11-22')).toBe('2026-11-22');
  expect(weekStart('2026-11-28')).toBe('2026-11-22');
  expect(weekDays('2026-11-22')).toHaveLength(7);
  expect(weekDays('2026-11-22')[6]).toBe('2026-11-28');
  expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  expect(weekTitle('2026-11-22')).toBe('Nov 22 – Nov 28');
});

test('upcomingWeeks counts the tasks, finished tasks and exams of each week', () => {
  const weeks = upcomingWeeks(
    [
      { dueDate: '2026-11-26', completedAt: '2026-11-26T01:00:00Z' },
      { dueDate: '2026-11-28', completedAt: null },
      { dueDate: '2026-12-02', completedAt: null },
      { dueDate: null, completedAt: null },
      { dueDate: '2026-11-01', completedAt: null },
    ],
    ['2026-12-05', null],
    '2026-11-26',
    3,
  );
  expect(weeks).toEqual([
    { start: '2026-11-22', tasks: 2, done: 1, exams: 0 },
    { start: '2026-11-29', tasks: 1, done: 0, exams: 1 },
    { start: '2026-12-06', tasks: 0, done: 0, exams: 0 },
  ]);
});
