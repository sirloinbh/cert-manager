import { expect, test } from 'vitest';

import {
  isOverdue,
  periodText,
  progress,
  type StudyStage,
  type StudyTask,
  withChoices,
} from './study-plan-data';

const task = (fields: Partial<StudyTask> = {}): StudyTask => ({
  id: 1,
  stageId: 1,
  title: '할 일',
  position: 1,
  dueDate: null,
  daysUntilDue: null,
  completedAt: null,
  ...fields,
});
const done = task({ completedAt: '2026-10-30T01:00:00.000Z' });

test('progress is finished tasks out of all of them', () => {
  expect(progress([done, task(), task()])).toEqual({ done: 1, total: 3, percent: 33 });
  expect(progress([done, done])).toEqual({ done: 2, total: 2, percent: 100 });
  expect(progress([task()])).toEqual({ done: 0, total: 1, percent: 0 });
});

test('a stage with no tasks shows no progress at all', () => {
  expect(progress([])).toBeNull();
});

test.each([
  [-1, null, true],
  [0, null, false],
  [1, null, false],
  [null, null, false],
  // A finished task is never late, however old its due date.
  [-1, '2026-10-30T01:00:00.000Z', false],
])('with %s days left and completed at %s, overdue is %s', (days, completedAt, expected) => {
  expect(isOverdue({ daysUntilDue: days, completedAt })).toBe(expected);
});

test('the period names whichever dates are set', () => {
  expect(periodText({ startDate: '2026-11-01', endDate: '2026-11-07' })).toBe(
    '2026-11-01 ~ 2026-11-07',
  );
  expect(periodText({ startDate: '2026-11-01', endDate: null })).toBe('2026-11-01부터');
  expect(periodText({ startDate: null, endDate: '2026-11-07' })).toBe('2026-11-07까지');
  expect(periodText({ startDate: null, endDate: null })).toBe('');
});

test('choices still being saved count at once, and other tasks stay as they are', () => {
  const stage: StudyStage = {
    id: 1,
    certificationId: 1,
    title: '1주차',
    position: 1,
    startDate: null,
    endDate: null,
    tasks: [task({ id: 1 }), { ...done, id: 2 }, task({ id: 3 })],
  };
  const [chosen] = withChoices([stage], { 1: true, 2: false });
  expect(chosen?.tasks.map((item) => item.completedAt !== null)).toEqual([true, false, false]);
  expect(progress(chosen?.tasks ?? [])).toEqual({ done: 1, total: 3, percent: 33 });
  // Choosing "done" again keeps the moment it was first finished.
  expect(withChoices([stage], { 2: true })[0]?.tasks[1]?.completedAt).toBe(done.completedAt);
});
