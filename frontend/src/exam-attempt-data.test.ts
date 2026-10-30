import { expect, test } from 'vitest';

import { deadlineCountdown } from './certification-data';
import {
  addMonths,
  currentAttempt,
  type ExamAttempt,
  expiringSoon,
  expiryState,
  type LatestAttempt,
  reachedGoal,
} from './exam-attempt-data';

const attempt = (fields: Partial<ExamAttempt> = {}): ExamAttempt => ({
  id: 1,
  certificationId: 1,
  examDate: '2026-01-10',
  outcome: 'scored',
  score: null,
  grade: '',
  expiresOn: null,
  daysUntilExpiry: null,
  memo: '',
  ...fields,
});

test.each([
  ['2026-03-15', 24, '2028-03-15'],
  // Clamped to the month's last day, like PostgreSQL, instead of rolling into March.
  ['2024-02-29', 24, '2026-02-28'],
  ['2024-02-29', 48, '2028-02-29'],
  ['2026-01-31', 1, '2026-02-28'],
  ['2026-12-31', 3, '2027-03-31'],
  ['2026-11-15', 2, '2027-01-15'],
])('%s plus %i months is %s', (date, months, expected) => {
  expect(addMonths(date, months)).toBe(expected);
});

test.each([
  ['waiting', 'months', 5, null],
  ['failed', 'months', 5, null],
  ['passed', 'none', null, 'none'],
  ['passed', 'unknown', null, 'unknown'],
  ['scored', 'months', null, 'unknown'],
  ['scored', 'months', -1, 'expired'],
  // The last valid day itself still counts as valid, so it is "soon" and not "expired".
  ['scored', 'months', 0, 'soon'],
  ['passed', 'months', 90, 'soon'],
  ['passed', 'months', 91, 'valid'],
] as const)('%s with %s validity and %s days left is %s', (outcome, kind, days, expected) => {
  expect(expiryState({ outcome, daysUntilExpiry: days }, kind)).toBe(expected);
});

test('the countdown names the last valid day and counts past it', () => {
  expect(deadlineCountdown(10)).toBe('10일 남음');
  expect(deadlineCountdown(0)).toBe('오늘까지');
  expect(deadlineCountdown(-3)).toBe('3일 지남');
});

test('the goal is reached only when both numbers exist and the score meets the target', () => {
  expect(reachedGoal(900, 900)).toBe(true);
  expect(reachedGoal(899, 900)).toBe(false);
  expect(reachedGoal(900, null)).toBe(false);
  expect(reachedGoal(null, 900)).toBe(false);
  expect(reachedGoal(0, 0)).toBe(true);
});

test('the attempt that counts is the newest one with a result, not a newer failure', () => {
  const list = [
    attempt({ id: 4, outcome: 'waiting' }),
    attempt({ id: 3, outcome: 'failed' }),
    attempt({ id: 2, outcome: 'scored' }),
    attempt({ id: 1, outcome: 'passed' }),
  ];
  expect(currentAttempt(list)?.id).toBe(2);
  expect(currentAttempt([attempt({ outcome: 'failed' })])).toBeUndefined();
});

test('the dashboard keeps expired and expiring goals, the earliest date first', () => {
  const latest = (fields: Partial<LatestAttempt>): LatestAttempt => ({
    ...attempt(),
    name: '',
    validityKind: 'months',
    ...fields,
  });
  const list = [
    latest({ id: 1, daysUntilExpiry: 30 }),
    latest({ id: 2, daysUntilExpiry: -5 }),
    latest({ id: 3, daysUntilExpiry: 91 }),
    latest({ id: 4, daysUntilExpiry: null }),
    latest({ id: 5, daysUntilExpiry: null, validityKind: 'none' }),
    latest({ id: 6, daysUntilExpiry: 90 }),
  ];
  expect(expiringSoon(list).map((item) => item.id)).toEqual([2, 1, 6]);
});

test.each([
  ['9999-12-31', 1],
  ['20266-03-15', 24],
  ['275760-01-01', 24],
])('%s plus %i months has no date the API accepts', (date, months) => {
  expect(addMonths(date, months)).toBe('');
});
