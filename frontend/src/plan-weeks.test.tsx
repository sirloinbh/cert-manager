import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test } from 'vitest';

import type { CertificationPaths } from './certification-data';
import { PlanProgress, Week, Weeks } from './plan-weeks';
import { fakeRoutes, reply } from './test/fake-routes';

const paths: CertificationPaths = {
  list: '/certifications',
  create: '/certifications/new',
  detail: (id) => `/certifications/${id}`,
  edit: (id) => `/certifications/${id}/edit`,
};

const today = '2026-11-26';

const task = (id: number, title: string, dueDate: string, completedAt: string | null) => ({
  id,
  stageId: 1,
  title,
  position: id,
  dueDate,
  daysUntilDue: 0,
  completedAt,
  certificationId: 7,
  certificationName: 'TOEIC',
});

const exam = {
  id: 7,
  name: 'TOEIC',
  category: 'english',
  issuer: 'YBM',
  status: 'registered',
  goalText: '',
  targetScore: null,
  targetExamDate: '2026-11-28',
  validityKind: 'unknown',
  validityMonths: null,
  memo: '',
  gradeScale: 'none',
  targetGrade: null,
  daysUntilExam: 2,
};

const view = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

test('the Week page lists the exams and the tasks of each day', async () => {
  const { sent } = fakeRoutes([
    [
      'GET',
      /\/api\/study-tasks\?from=.*/,
      () =>
        reply(200, {
          today,
          from: '2026-11-22',
          to: '2026-11-28',
          tasks: [
            task(1, 'Read part 5', '2026-11-26', '2026-11-26T01:00:00Z'),
            task(2, 'Mock test', '2026-11-27', null),
          ],
        }),
    ],
    ['GET', '/api/certifications', () => reply(200, { today, certifications: [exam] })],
  ]);
  view(<Week today={today} paths={paths} />);
  const thursday = await screen.findByRole('listitem', { name: 'Thursday 2026-11-26' });
  expect(within(thursday).getByText('Read part 5')).toBeInTheDocument();
  expect(within(thursday).getByLabelText('Done')).toBeInTheDocument();
  expect(within(thursday).getByText(/Today/)).toBeInTheDocument();
  expect(
    within(screen.getByRole('listitem', { name: 'Friday 2026-11-27' })).getByText('Mock test'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('listitem', { name: 'Saturday 2026-11-28' })).getByText('TOEIC'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('listitem', { name: 'Sunday 2026-11-22' })).getByText(
      'Nothing planned',
    ),
  ).toBeInTheDocument();
  expect(sent.some((call) => call.path === '/api/study-tasks?from=2026-11-22&to=2026-11-28')).toBe(
    true,
  );
});

test('the 12 weeks page counts the tasks done and the exams of each week', async () => {
  fakeRoutes([
    [
      'GET',
      /\/api\/study-tasks\?from=.*/,
      () =>
        reply(200, {
          today,
          from: '2026-11-22',
          to: '2027-02-13',
          tasks: [
            task(1, 'A', '2026-11-26', '2026-11-26T01:00:00Z'),
            task(2, 'B', '2026-11-27', null),
          ],
        }),
    ],
    ['GET', '/api/certifications', () => reply(200, { today, certifications: [exam] })],
  ]);
  view(<Weeks today={today} />);
  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(12);
  expect(within(items[0]).getByText('1 of 2 tasks done · 1 exam')).toBeInTheDocument();
  expect(within(items[1]).getByText('No tasks')).toBeInTheDocument();
});

test('the dashboard card shows the progress of each plan, or says there is none', async () => {
  fakeRoutes([
    [
      'GET',
      '/api/study-tasks/progress',
      () =>
        reply(200, {
          goals: [{ certificationId: 7, certificationName: 'TOEIC', total: 4, done: 1 }],
        }),
    ],
  ]);
  view(<PlanProgress paths={paths} />);
  expect(await screen.findByText('1 of 4 tasks done')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'TOEIC' })).toHaveAttribute('href', '/certifications/7');
});

test('the dashboard card explains an empty list', async () => {
  fakeRoutes([['GET', '/api/study-tasks/progress', () => reply(200, { goals: [] })]]);
  view(<PlanProgress paths={paths} />);
  await waitFor(() => expect(screen.getByText(/No study plans yet/)).toBeInTheDocument());
});
