import { requestJson } from './lib/api';

// Certification goals (#30): API calls and display rules. The screens are in certifications.tsx.

export const categories = ['english', 'dev', 'life'] as const;
export const statuses = ['planned', 'studying', 'registered', 'taken', 'passed', 'failed'] as const;
export const validityKinds = ['months', 'none', 'unknown'] as const;

/** Page addresses for the goal screens; the routes themselves live in app.tsx `pages`. */
export type CertificationPaths = {
  list: string;
  create: string;
  detail: (id: number) => string;
  edit: (id: number) => string;
};

export type Category = (typeof categories)[number];
export type Status = (typeof statuses)[number];
export type ValidityKind = (typeof validityKinds)[number];

export type Certification = {
  id: number;
  name: string;
  category: Category;
  issuer: string;
  status: Status;
  goalText: string;
  targetScore: number | null;
  targetExamDate: string | null;
  /** Days from today (Asia/Seoul) to the target exam date; negative once it has passed. */
  daysUntilExam: number | null;
  validityKind: ValidityKind;
  validityMonths: number | null;
  memo: string;
  /** 'none' or a key from the server's list of grade scales. */
  gradeScale: string;
  targetGrade: string | null;
};

export type CertificationInput = Omit<
  Certification,
  'id' | 'daysUntilExam' | 'targetScore' | 'validityMonths'
> & {
  // A value the user typed that is not a number is sent as it is, so the server names the problem.
  targetScore: number | string | null;
  validityMonths: number | string | null;
};

export const categoryLabels: Record<Category, string> = {
  english: 'English',
  dev: 'Development',
  life: 'Life',
};

export const statusLabels: Record<Status, string> = {
  planned: 'Planned',
  studying: 'Studying',
  registered: 'Registered',
  taken: 'Taken',
  passed: 'Passed',
  failed: 'Failed',
};

export const validityLabels: Record<ValidityKind, string> = {
  months: 'Enter months',
  none: 'No expiry',
  unknown: 'Unknown',
};

export function examCountdown(days: number | null) {
  if (days === null) return 'Exam date not set';
  if (days === 0) return 'Exam today';
  return days > 0 ? `${days} days left` : `${-days} days ago`;
}

/** Days left until a last day, such as an expiry or a due date. */
export function deadlineCountdown(days: number) {
  if (days === 0) return 'Due today';
  return days > 0 ? `${days} days left` : `${-days} days overdue`;
}

export function validityText(
  certification: Pick<Certification, 'validityKind' | 'validityMonths'>,
) {
  if (certification.validityKind === 'months') return `${certification.validityMonths} months`;
  return certification.validityKind === 'none' ? 'No expiry' : 'Unknown';
}

/** Categories in menu order with their goals, keeping the server's date order; empty categories are left out. */
export function groupByCategory(list: Certification[]) {
  return categories
    .map((category) => ({ category, items: list.filter((item) => item.category === category) }))
    .filter((group) => group.items.length > 0);
}

// Goals still heading for the exam; taken, passed and failed ones have had theirs.
const preparing: Status[] = ['planned', 'studying', 'registered'];

/** The nearest exams from today on, for the dashboard card. */
export function upcomingExams(list: Certification[], limit = 3) {
  return list
    .filter(
      (item) =>
        preparing.includes(item.status) && item.daysUntilExam !== null && item.daysUntilExam >= 0,
    )
    .sort((a, b) => (a.daysUntilExam ?? 0) - (b.daysUntilExam ?? 0) || a.id - b.id)
    .slice(0, limit);
}

const base = '/api/certifications';

export const certificationApi = {
  list: () => requestJson<{ today: string; certifications: Certification[] }>(base),
  get: (id: number) =>
    requestJson<{ today: string; certification: Certification }>(`${base}/${id}`),
  create: (input: CertificationInput) =>
    requestJson<{ certification: Certification }>(base, { method: 'POST', body: input }),
  update: (id: number, input: CertificationInput) =>
    requestJson<{ certification: Certification }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
