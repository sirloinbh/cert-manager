import type { ValidityKind } from './certification-data';
import { requestJson } from './lib/api';

// Exam attempts (#32): API calls and display rules. The screens are in exam-attempts.tsx.
// Rules: docs/design/scope-and-data-model.md section 5.

export const outcomes = ['waiting', 'passed', 'failed', 'scored'] as const;

export type Outcome = (typeof outcomes)[number];

export type ExamAttempt = {
  id: number;
  certificationId: number;
  examDate: string;
  outcome: Outcome;
  score: number | null;
  grade: string | null;
  /** Last valid day; null when it is not known or does not apply. */
  expiresOn: string | null;
  /** Days from today (Asia/Seoul) to the last valid day; negative once it has passed. */
  daysUntilExpiry: number | null;
  memo: string;
};

export type LatestAttempt = ExamAttempt & { name: string; validityKind: ValidityKind };

export type ExamAttemptInput = Omit<
  ExamAttempt,
  'id' | 'certificationId' | 'score' | 'daysUntilExpiry'
> & {
  // A value the user typed that is not a number is sent as it is, so the server names the problem.
  score: number | string | null;
};

export const outcomeLabels: Record<Outcome, string> = {
  waiting: '결과 전',
  passed: '합격',
  failed: '불합격',
  scored: '점수·등급',
};

/** Only these outcomes earn something that can expire. */
export const hasExpiry = (outcome: Outcome) => outcome === 'passed' || outcome === 'scored';

export type ExpiryState = 'none' | 'unknown' | 'expired' | 'soon' | 'valid';

export const expiryLabels: Record<ExpiryState, string> = {
  none: '만료 없음',
  unknown: '만료일 모름',
  expired: '만료',
  soon: '만료 임박',
  valid: '유효',
};

const soonDays = 90;

/** The expiry shown for an attempt; null when the attempt has nothing that can expire. */
export function expiryState(
  attempt: Pick<ExamAttempt, 'outcome' | 'daysUntilExpiry'>,
  validityKind: ValidityKind,
): ExpiryState | null {
  if (!hasExpiry(attempt.outcome)) return null;
  if (validityKind === 'none') return 'none';
  if (attempt.daysUntilExpiry === null) return 'unknown';
  if (attempt.daysUntilExpiry < 0) return 'expired';
  return attempt.daysUntilExpiry <= soonDays ? 'soon' : 'valid';
}

export function expiryCountdown(days: number) {
  if (days === 0) return '오늘까지';
  return days > 0 ? `${days}일 남음` : `${-days}일 지남`;
}

/** Whether the score meets the goal; never true without both numbers. The app does not judge pass or fail. */
export const reachedGoal = (score: number | null, targetScore: number | null) =>
  score !== null && targetScore !== null && score >= targetScore;

/**
 * The exam date plus some months, clamped to the month's last day like PostgreSQL's date + interval
 * (2024-02-29 + 24 months = 2026-02-28). The last valid day is that same date, not the day before.
 * Empty when the result is past what the API accepts; a date input can hold a year beyond 9999 while typing.
 */
export function addMonths(date: string, months: number) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  if (Number.isNaN(target.getTime()) || target.getUTCFullYear() > 9999) return '';
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The attempt whose expiry counts: the newest passed or scored one. The list comes newest first. */
export const currentAttempt = (attempts: ExamAttempt[]) =>
  attempts.find((attempt) => hasExpiry(attempt.outcome));

/** For the dashboard card: expired or expiring goals, the earliest date first. */
export function expiringSoon(attempts: LatestAttempt[]) {
  return attempts
    .filter((attempt) => {
      const state = expiryState(attempt, attempt.validityKind);
      return state === 'expired' || state === 'soon';
    })
    .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0) || a.id - b.id);
}

const attemptsPath = (certificationId: number) => `/api/certifications/${certificationId}/attempts`;

export const examAttemptApi = {
  list: (certificationId: number) =>
    requestJson<{ today: string; attempts: ExamAttempt[] }>(attemptsPath(certificationId)),
  latest: () =>
    requestJson<{ today: string; attempts: LatestAttempt[] }>('/api/exam-attempts/latest'),
  create: (certificationId: number, input: ExamAttemptInput) =>
    requestJson<{ attempt: ExamAttempt }>(attemptsPath(certificationId), {
      method: 'POST',
      body: input,
    }),
  update: (certificationId: number, id: number, input: ExamAttemptInput) =>
    requestJson<{ attempt: ExamAttempt }>(`${attemptsPath(certificationId)}/${id}`, {
      method: 'PUT',
      body: input,
    }),
  remove: (certificationId: number, id: number) =>
    requestJson<undefined>(`${attemptsPath(certificationId)}/${id}`, { method: 'DELETE' }),
};
