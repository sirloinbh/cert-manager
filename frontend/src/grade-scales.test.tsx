import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Certification } from './certification-data';
import type { ExamAttempt } from './exam-attempt-data';
import type { GradeScale } from './grade-scale-data';

const today = '2026-10-31';

const scales: GradeScale[] = [
  {
    key: 'toeic',
    label: 'TOEIC (CEFR mapping)',
    note: 'CEFR 안내',
    sourceUrl: 'https://example.com/toeic',
    ranked: true,
    levels: [
      { value: 'B1', minScore: 550, maxScore: 784 },
      { value: 'B2', minScore: 785, maxScore: 944 },
    ],
  },
  {
    key: 'toeic_speaking',
    label: 'TOEIC Speaking',
    note: 'IM 안내',
    sourceUrl: 'https://example.com/speaking',
    ranked: true,
    levels: [
      { value: 'IM1', minScore: 110, maxScore: 130 },
      { value: 'IM2', minScore: 110, maxScore: 130 },
      { value: 'IM3', minScore: 110, maxScore: 130 },
      { value: 'IH', minScore: 140, maxScore: 150 },
    ],
  },
];

const goal = (fields: Partial<Certification> = {}): Certification => ({
  id: 1,
  name: '토익',
  category: 'english',
  issuer: '',
  status: 'planned',
  goalText: '',
  targetScore: null,
  targetExamDate: null,
  daysUntilExam: null,
  validityKind: 'none',
  validityMonths: null,
  memo: '',
  gradeScale: 'toeic',
  targetGrade: 'B2',
  ...fields,
});

const attempt = (fields: Partial<ExamAttempt>): ExamAttempt => ({
  id: 5,
  certificationId: 1,
  examDate: '2026-03-15',
  outcome: 'scored',
  score: null,
  grade: '',
  expiresOn: null,
  daysUntilExpiry: null,
  memo: '',
  ...fields,
});

type Sent = { method: string; path: string; body?: Record<string, unknown> };

function fakeApi(
  options: {
    goal?: Certification;
    attempts?: ExamAttempt[];
    scalesFail?: boolean;
    /** Answers the list only once this settles. */
    scalesHold?: Promise<unknown>;
  } = {},
) {
  let current = options.goal ?? goal();
  let attempts = options.attempts ?? [];
  const sent: Sent[] = [];
  const reply = (status: number, body?: object) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      const body =
        init.body === undefined ? undefined : (JSON.parse(init.body) as Record<string, unknown>);
      sent.push({ method, path, body });
      if (path === '/api/health') return reply(200, { ok: true, today });
      if (path === '/api/user-actions') return reply(200, { today, actions: [] });
      if (path === '/api/grade-scales')
        return Promise.resolve(options.scalesHold).then(() =>
          options.scalesFail
            ? reply(500, { error: 'A server error occurred' })
            : reply(200, { scales }),
        );
      if (path === '/api/certifications' && method === 'POST') {
        current = goal({ ...(body as Partial<Certification>), id: 1 });
        return reply(201, { certification: current });
      }
      if (path === '/api/certifications') return reply(200, { today, certifications: [current] });
      if (path === '/api/certifications/1') {
        if (method === 'PUT') current = goal({ ...(body as Partial<Certification>), id: 1 });
        return reply(200, { today, certification: current });
      }
      if (path.endsWith('/plan')) return reply(200, { today, stages: [] });
      if (path.endsWith('/attempts') && method === 'POST') {
        const saved = attempt({ ...(body as Partial<ExamAttempt>), id: 9 });
        attempts = [saved, ...attempts];
        return reply(201, { attempt: saved });
      }
      if (path.endsWith('/attempts')) return reply(200, { today, attempts });
      const saved = attempt({ ...(body as Partial<ExamAttempt>), id: 5 });
      attempts = [saved];
      return reply(200, { attempt: saved });
    }),
  );
  return { sent };
}

const openDetail = async (options?: Parameters<typeof fakeApi>[0]) => {
  const api = fakeApi(options);
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  await screen.findByRole('heading', { level: 3, name: /grades$/ });
  return api;
};

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const addRecord = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'scored');
};

const sentAttempt = (api: { sent: Sent[] }) =>
  api.sent.find((item) => item.method === 'POST' && item.path.endsWith('/attempts'))?.body;

test('the detail page shows the scale from the top with the target and its source', async () => {
  await openDetail();
  const ladder = screen.getByRole('heading', { level: 3, name: 'TOEIC (CEFR mapping) grades' })
    .parentElement as HTMLElement;
  const rows = within(ladder).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('B2');
  expect(rows[0]).toHaveTextContent('Target');
  expect(rows[0]).toHaveTextContent('785-944');
  expect(rows[1]).toHaveTextContent('B1');
  expect(within(ladder).getByRole('link', { name: 'View source' })).toHaveAttribute(
    'href',
    'https://example.com/toeic',
  );
  expect(screen.getByText('Target grade')).toBeInTheDocument();
});

test('a score fills its grade, and the saved record reaches the target', async () => {
  const api = await openDetail();
  await addRecord();
  change('Score', '800');
  expect(screen.getByLabelText('Grade')).toHaveValue('B2');
  expect(screen.getByText('The standard grade for a score of 800 is B2.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Goal reached')).toBeInTheDocument();
  expect(sentAttempt(api)).toMatchObject({ score: 800, grade: 'B2' });
  expect(await screen.findByText('Latest result')).toBeInTheDocument();
});

test('a score below the target does not reach it', async () => {
  await openDetail();
  await addRecord();
  change('Score', '600');
  expect(screen.getByLabelText('Grade')).toHaveValue('B1');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('600 · B1')).toBeInTheDocument();
  expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
});

test('a score shared by several levels asks the user to choose', async () => {
  const api = await openDetail({
    goal: goal({ gradeScale: 'toeic_speaking', targetGrade: 'IM2' }),
  });
  await addRecord();
  change('Score', '120');
  expect(screen.getByLabelText('Grade')).toHaveValue('');
  expect(screen.getByText(/is one of IM1, IM2, IM3/)).toBeInTheDocument();
  change('Grade', 'IM3');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Goal reached')).toBeInTheDocument();
  expect(sentAttempt(api)).toMatchObject({ grade: 'IM3' });
});

test('a chosen grade stays when the score changes afterwards', async () => {
  await openDetail();
  await addRecord();
  change('Score', '800');
  change('Grade', 'B1');
  change('Score', '900');
  expect(screen.getByLabelText('Grade')).toHaveValue('B1');
});

test('a saved grade from an older format stays selectable', async () => {
  await openDetail({ attempts: [attempt({ score: 170, grade: 'Level 7' })] });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  expect(screen.getByLabelText('Grade')).toHaveValue('Level 7');
});

test('a failed attempt names a level but does not reach it', async () => {
  await openDetail({
    attempts: [attempt({ outcome: 'failed', score: 800, grade: 'B2' })],
  });
  expect(await screen.findByText('800 · B2')).toBeInTheDocument();
  expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
});

test('a goal with both targets needs both', async () => {
  await openDetail({
    goal: goal({ targetScore: 900 }),
    attempts: [attempt({ score: 800, grade: 'B2' })],
  });
  expect(await screen.findByText('800 · B2')).toBeInTheDocument();
  expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
});

test('a waiting attempt fills its grade once the result and score are in', async () => {
  await openDetail({ attempts: [attempt({ outcome: 'waiting', grade: null })] });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  change('Result', 'scored');
  change('Score', '800');
  expect(screen.getByLabelText('Grade')).toHaveValue('B2');
  change('Score', '');
  expect(screen.getByLabelText('Grade')).toHaveValue('');
});

test('a saved grade stays when the score changes, and an empty one follows the score', async () => {
  await openDetail({
    attempts: [
      attempt({ id: 5, score: 800, grade: 'B1' }),
      attempt({ id: 6, examDate: '2026-01-10', score: 800, grade: '' }),
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  change('Score', '900');
  expect(screen.getByLabelText('Grade')).toHaveValue('B1');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Edit attempt on January 10, 2026' }));
  expect(screen.getByLabelText('Grade')).toHaveValue('B2');
});

test('a grade typed before the list arrives stays afterwards', async () => {
  let release = () => {};
  const scalesHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  fakeApi({ scalesHold });
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Result', 'scored');
  change('Grade', 'B1');
  release();
  await waitFor(() => expect(screen.getByLabelText('Grade').tagName).toBe('SELECT'));
  expect(screen.getByLabelText('Grade')).toHaveValue('B1');
});

test('marking the goal passed keeps its scale and target', async () => {
  const api = await openDetail();
  await addRecord();
  change('Result', 'passed');
  change('Grade', 'B2');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = await screen.findByRole('dialog', { name: 'Change the goal status to Passed?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
  await waitFor(() =>
    expect(
      api.sent.find((item) => item.path === '/api/certifications/1' && item.method === 'PUT')?.body,
    ).toMatchObject({ status: 'passed', gradeScale: 'toeic', targetGrade: 'B2' }),
  );
});

test('the detail page says so when the list cannot load', async () => {
  fakeApi({ scalesFail: true });
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  expect(await screen.findByText(/grade table cannot be shown/)).toBeInTheDocument();
  expect(screen.getByText('Target grade')).toBeInTheDocument();
});

test('a goal without a scale keeps the free text field and no ladder', async () => {
  fakeApi({ goal: goal({ gradeScale: 'none', targetGrade: null }) });
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Result', 'scored');
  expect(screen.getByLabelText('Grade').tagName).toBe('INPUT');
  expect(screen.queryByText(/ grades$/, { selector: 'h3' })).not.toBeInTheDocument();
});

test('the goal form picks a scale and target, and a new scale clears the target', async () => {
  const api = fakeApi({ goal: goal({ gradeScale: 'none', targetGrade: null }) });
  window.history.pushState({}, '', '/certifications/new');
  render(<App />);
  fireEvent.change(await screen.findByLabelText('Certification name'), {
    target: { value: '토익' },
  });
  await waitFor(() => expect(screen.getByLabelText('Grade scale')).toBeEnabled());
  expect(screen.queryByLabelText('Target grade')).not.toBeInTheDocument();

  change('Grade scale', 'toeic');
  change('Target grade', 'B2');
  change('Grade scale', 'toeic_speaking');
  expect(screen.getByLabelText('Target grade')).toHaveValue('');
  change('Target grade', 'IH');

  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(
      api.sent.find((item) => item.method === 'POST' && item.path === '/api/certifications')?.body,
    ).toMatchObject({ gradeScale: 'toeic_speaking', targetGrade: 'IH' }),
  );
});

test('the goal form keeps the saved scale when the list cannot load', async () => {
  const api = fakeApi({ scalesFail: true });
  window.history.pushState({}, '', '/certifications/1/edit');
  render(<App />);
  expect(await screen.findByText(/already chosen is saved as it is/)).toBeInTheDocument();
  expect(screen.getByLabelText('Grade scale')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(
      api.sent.find((item) => item.method === 'PUT' && item.path === '/api/certifications/1')?.body,
    ).toMatchObject({ gradeScale: 'toeic', targetGrade: 'B2' }),
  );
});

test('the goal list shows the target grade', async () => {
  fakeApi();
  window.history.pushState({}, '', '/certifications');
  render(<App />);
  expect(await screen.findByText('Target grade B2')).toBeInTheDocument();
});
