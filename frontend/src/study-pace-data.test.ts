import { expect, test } from 'vitest';

import { daysBetween, studyPace } from './study-pace-data';
import type { StudyStage, StudyTask } from './study-plan-data';

const task = (fields: Partial<StudyTask> = {}): StudyTask => ({
  id: 1,
  stageId: 1,
  title: 'Task',
  position: 1,
  dueDate: null,
  daysUntilDue: null,
  completedAt: null,
  ...fields,
});
const done = task({ completedAt: '2026-11-01T01:00:00.000Z' });
const stage = (tasks: StudyTask[], startDate: string | null = null): StudyStage => ({
  id: 1,
  certificationId: 1,
  title: 'Stage',
  position: 1,
  startDate,
  endDate: null,
  tasks,
});

test('tasks per day is the open tasks over the days left, rounded up', () => {
  const pace = studyPace([stage([done, task(), task(), task(), task()])], 3, '2026-12-01');
  expect(pace).toMatchObject({ open: 4, daysLeft: 3, perDay: 2, behind: false });
});

test.each([
  ['no exam date', null, null],
  ['the exam is today', 0, '2026-11-27'],
  ['the exam has passed', -2, '2026-11-25'],
])('there is no pace when %s', (_name, days, date) => {
  expect(studyPace([stage([task()])], days, date)).toBeNull();
});

test('there is no pace when every task is done or there are none', () => {
  expect(studyPace([stage([done])], 5, '2026-12-02')).toBeNull();
  expect(studyPace([stage([])], 5, '2026-12-02')).toBeNull();
});

test('an open task past its due date means behind plan', () => {
  const late = task({ daysUntilDue: -1 });
  expect(studyPace([stage([late, done, done, done])], 10, '2026-12-07')?.behind).toBe(true);
});

test('a finished task past its due date does not', () => {
  const finishedLate = task({ daysUntilDue: -3, completedAt: '2026-11-26T01:00:00.000Z' });
  expect(studyPace([stage([finishedLate, task()])], 10, '2026-12-07')?.behind).toBe(false);
});

test('more tasks open than the plan expected by today means behind plan', () => {
  // The plan runs 10 days (11-22 to 12-02) with 5 left, so half of the 4 tasks (2) should still be open.
  const stages = [stage([task(), task(), task(), done], '2026-11-22')];
  expect(studyPace(stages, 5, '2026-12-02')?.behind).toBe(true);
  const onTrack = [stage([task(), task(), done, done], '2026-11-22')];
  expect(studyPace(onTrack, 5, '2026-12-02')?.behind).toBe(false);
});

test('without a start date only due dates can make it behind', () => {
  expect(studyPace([stage([task(), task(), task(), done])], 5, '2026-12-02')?.behind).toBe(false);
});

test('daysBetween counts whole days across a month end', () => {
  expect(daysBetween('2026-11-28', '2026-12-02')).toBe(4);
});
