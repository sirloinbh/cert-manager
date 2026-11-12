import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Certification } from './certification-data';
import type { ExamAttempt, LatestAttempt } from './exam-attempt-data';

const today = '2026-10-30';

const toeic: Certification = {
  id: 1,
  name: '토익',
  category: 'english',
  issuer: 'YBM',
  status: 'studying',
  goalText: '',
  targetScore: 900,
  targetExamDate: null,
  daysUntilExam: null,
  validityKind: 'months',
  validityMonths: 24,
  memo: '',
  gradeScale: 'none',
  targetGrade: null,
};

const attempt = (fields: Partial<ExamAttempt> & Pick<ExamAttempt, 'id'>): ExamAttempt => ({
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

// A stand-in for the API that answers the attempts in the order and shape the server does.
function fakeApi(
  options: {
    goal?: Certification;
    attempts?: ExamAttempt[];
    latest?: LatestAttempt[];
    createFails?: string;
    /** Answers the create request only once this settles. */
    createHold?: Promise<unknown>;
    goalUpdateFails?: string;
    /** Answers the attempt list once, then fails. */
    reloadFails?: boolean;
  } = {},
) {
  let goal = options.goal ?? toeic;
  let attempts = options.attempts ?? [];
  let nextId = 100;
  let listed = 0;
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
      if (path === '/api/grade-scales') return reply(200, { scales: [] });
      if (path === '/api/user-actions') return reply(200, { today, actions: [] });
      if (path === '/api/exam-attempts/latest')
        return reply(200, { today, attempts: options.latest ?? [] });
      if (path === '/api/study-tasks/today') return reply(200, { today, tasks: [] });
      if (path === '/api/certifications/1/plan') return reply(200, { today, stages: [] });
      if (path === '/api/certifications') return reply(200, { today, certifications: [goal] });
      if (path === '/api/certifications/1') {
        if (method === 'PUT' && options.goalUpdateFails)
          return reply(500, { error: options.goalUpdateFails });
        if (method === 'PUT') goal = { ...goal, ...(body as Partial<Certification>) };
        return reply(200, { today, certification: goal });
      }
      if (path === '/api/certifications/1/attempts' && method === 'GET') {
        listed += 1;
        if (options.reloadFails && listed > 1) return reply(500, { error: 'Could not reload' });
        return reply(200, { today, attempts });
      }
      if (path === '/api/certifications/1/attempts' && method === 'POST') {
        const created = async () => {
          await options.createHold;
          if (options.createFails) return reply(400, { error: options.createFails });
          const saved = attempt({ ...(body as Partial<ExamAttempt>), id: nextId++ });
          attempts = [saved, ...attempts];
          return reply(201, { attempt: saved });
        };
        return created();
      }
      const id = Number(/\/attempts\/(\d+)$/.exec(path)?.[1]);
      if (method === 'PUT') {
        attempts = attempts.map((item) =>
          item.id === id ? { ...item, ...(body as Partial<ExamAttempt>) } : item,
        );
        return reply(200, { attempt: attempts.find((item) => item.id === id) });
      }
      attempts = attempts.filter((item) => item.id !== id);
      return reply(204);
    }),
  );
  return { sent };
}

const openDetail = async (options?: Parameters<typeof fakeApi>[0]) => {
  const api = fakeApi(options);
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  await screen.findByRole('heading', { level: 2, name: 'Exam attempts' });
  return api;
};

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const sentBody = (api: { sent: Sent[] }, method: string) =>
  api.sent.find((item) => item.method === method && item.path.includes('/attempts'))?.body;

test('a new score fills the expiry from the goal, two years after the exam', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2024-02-29');
  // No result yet: nothing to score or expire.
  expect(screen.queryByLabelText('Score')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Expiry date')).not.toBeInTheDocument();

  change('Result', 'scored');
  change('Score', '910');
  expect(screen.getByLabelText('Expiry date')).toHaveValue('2026-02-28');
  change('Exam date', '2026-03-15');
  expect(screen.getByLabelText('Expiry date')).toHaveValue('2028-03-15');

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('March 15, 2026')).toBeInTheDocument();
  expect(sentBody(api, 'POST')).toEqual({
    examDate: '2026-03-15',
    outcome: 'scored',
    score: 910,
    grade: '',
    expiresOn: '2028-03-15',
    memo: '',
  });
  expect(screen.getByText('Goal reached')).toBeInTheDocument();
  // A score is not a pass, so nothing asks about the goal's status.
  expect(screen.queryByText('Change the goal status to Passed?')).not.toBeInTheDocument();
});

test('the prefilled expiry can be changed or cleared', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'scored');
  change('Expiry date', '');
  // A cleared date stays cleared when the exam date changes afterwards.
  change('Exam date', '2026-03-16');
  expect(screen.getByLabelText('Expiry date')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('March 16, 2026');
  expect(sentBody(api, 'POST')?.expiresOn).toBeNull();
});

test('a goal that never expires asks for no date and shows "No expiry"', async () => {
  const api = await openDetail({
    goal: { ...toeic, validityKind: 'none', validityMonths: null },
    attempts: [attempt({ id: 1, outcome: 'passed' })],
  });
  // Once as the goal's validity field, once as the attempt's badge.
  await waitFor(() => expect(screen.getAllByText('No expiry')).toHaveLength(2));
  fireEvent.click(screen.getByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  expect(screen.queryByLabelText('Expiry date')).not.toBeInTheDocument();
  expect(api.sent.some((item) => item.method === 'PUT')).toBe(false);
});

test('expiry states show on the newest result only', async () => {
  await openDetail({
    attempts: [
      attempt({ id: 3, examDate: '2026-09-01', outcome: 'failed' }),
      attempt({
        id: 2,
        examDate: '2026-03-15',
        score: 880,
        expiresOn: '2026-12-01',
        daysUntilExpiry: 32,
      }),
      attempt({
        id: 1,
        examDate: '2024-01-10',
        score: 700,
        expiresOn: '2026-01-10',
        daysUntilExpiry: -293,
      }),
    ],
  });
  expect(await screen.findByText('Expiring soon')).toBeInTheDocument();
  expect(screen.getByText(/32 days left/)).toBeInTheDocument();
  expect(screen.getByText('Newer attempt exists')).toBeInTheDocument();
  expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  expect(screen.queryByText('Goal reached')).not.toBeInTheDocument();
});

test('saving a pass asks before changing the goal, and the answer is respected', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'passed');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  const dialog = await screen.findByRole('dialog', { name: 'Change the goal status to Passed?' });
  expect(
    api.sent.some((item) => item.path === '/api/certifications/1' && item.method === 'PUT'),
  ).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
  await waitFor(() =>
    expect(
      api.sent.find((item) => item.path === '/api/certifications/1' && item.method === 'PUT')?.body,
    ).toMatchObject({ name: '토익', status: 'passed', validityMonths: 24 }),
  );
  // The page shows the new status without leaving; Passed also labels the attempt itself.
  await waitFor(() => expect(screen.getAllByText('Passed')).toHaveLength(2));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Exam attempts' })).toHaveFocus());
});

test('declining the question leaves the goal alone', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'passed');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = await screen.findByRole('dialog', { name: 'Change the goal status to Passed?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep as is' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(
    api.sent.some((item) => item.path === '/api/certifications/1' && item.method === 'PUT'),
  ).toBe(false);
  // With no button that opened it, focus would otherwise fall back to the start of the page.
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Exam attempts' })).toHaveFocus());
});

test('closing the question with Escape leaves the goal alone and returns focus', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'passed');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = await screen.findByRole('dialog', { name: 'Change the goal status to Passed?' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(
    api.sent.some((item) => item.path === '/api/certifications/1' && item.method === 'PUT'),
  ).toBe(false);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Exam attempts' })).toHaveFocus());
});

test('editing an attempt that is already a pass does not ask again', async () => {
  await openDetail({
    attempts: [
      attempt({ id: 1, outcome: 'passed', expiresOn: '2028-03-15', daysUntilExpiry: 867 }),
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  expect(screen.getByLabelText('Expiry date')).toHaveValue('2028-03-15');
  change('Memo', '성적표 받음');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('성적표 받음', { selector: 'p' })).toBeInTheDocument();
  expect(screen.queryByText('Change the goal status to Passed?')).not.toBeInTheDocument();
});

test('a result entered later fills the expiry that was empty while waiting', async () => {
  await openDetail({ attempts: [attempt({ id: 1, outcome: 'waiting', grade: null })] });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  change('Result', 'scored');
  expect(screen.getByLabelText('Expiry date')).toHaveValue('2028-03-15');
});

test('a server error stays in the form with the message', async () => {
  await openDetail({ createFails: 'Expiry date must be after the exam date' });
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Expiry date must be after the exam date',
  );
  expect(screen.getByRole('dialog', { name: 'Add exam attempt' })).toBeInTheDocument();
});

test('deleting an attempt asks first and removes it from the list', async () => {
  const api = await openDetail({ attempts: [attempt({ id: 7, score: 800 })] });
  fireEvent.click(await screen.findByRole('button', { name: 'Delete attempt on March 15, 2026' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this attempt?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('No exam attempts yet')).toBeInTheDocument();
  expect(api.sent.some((item) => item.method === 'DELETE' && item.path.endsWith('/7'))).toBe(true);
});

test('the dashboard card lists goals close to expiry and links to them', async () => {
  const latest = (fields: Partial<LatestAttempt> & Pick<LatestAttempt, 'id' | 'name'>) => ({
    ...attempt({ id: fields.id }),
    validityKind: 'months' as const,
    ...fields,
  });
  fakeApi({
    latest: [
      latest({ id: 1, name: '오래 남은 토익', expiresOn: '2028-01-01', daysUntilExpiry: 428 }),
      latest({ id: 2, name: 'AWS CP', expiresOn: '2026-11-30', daysUntilExpiry: 31 }),
      latest({ id: 3, name: 'TOEIC Speaking', expiresOn: '2026-10-01', daysUntilExpiry: -29 }),
    ],
  });
  window.history.pushState({}, '', '/');
  render(<App />);
  const items = await within(
    (await screen.findByText('Expiring soon', { selector: 'h2' })).closest(
      '[data-slot="card"]',
    ) as HTMLElement,
  ).findAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('link').textContent)).toEqual([
    'TOEIC Speaking',
    'AWS CP',
  ]);
  expect(within(items[0]).getByText('Expired')).toBeInTheDocument();
  expect(within(items[1]).getByText('Expiring soon')).toBeInTheDocument();
  expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/certifications/1');
});

test('the dashboard card says so when nothing is close to expiry', async () => {
  fakeApi();
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(await screen.findByText(/No certifications are close to expiring/)).toBeInTheDocument();
});

test('a save in progress keeps the dialog open, so its error is not lost', async () => {
  let release = () => {};
  const createHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openDetail({ createHold, createFails: 'The server rejected it' });
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = screen.getByRole('dialog', { name: 'Add exam attempt' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('dialog', { name: 'Add exam attempt' })).toBeInTheDocument();

  release();
  expect(await screen.findByRole('alert')).toHaveTextContent('The server rejected it');
  // Once the save has finished, the dialog closes normally again.
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Add exam attempt' }), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('closing the form returns focus to the button that opened it', async () => {
  await openDetail({ attempts: [attempt({ id: 1, score: 800 })] });
  const edit = await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' });
  edit.focus();
  fireEvent.click(edit);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(edit).toHaveFocus());
});

test('focus moves to the heading when the opening button is gone after the first record', async () => {
  await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('March 15, 2026');
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 2, name: 'Exam attempts' })).toHaveFocus(),
  );
});

test('the list stays on screen with the reason when reloading it fails', async () => {
  await openDetail({ attempts: [attempt({ id: 1, score: 800 })], reloadFails: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-05-05');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Could not reload')).toBeInTheDocument();
  // The saved record shows anyway, newest first.
  expect(
    screen
      .getAllByRole('button', { name: /^Edit attempt on / })
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(['Edit attempt on May 5, 2026', 'Edit attempt on March 15, 2026']);
});

test('a failed status change keeps the question open and says why', async () => {
  await openDetail({ goalUpdateFails: 'Could not update the goal' });
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'passed');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const dialog = await screen.findByRole('dialog', { name: 'Change the goal status to Passed?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
  expect(await screen.findByText('Could not update the goal')).toBeInTheDocument();
  expect(
    screen.getByRole('dialog', { name: 'Change the goal status to Passed?' }),
  ).toBeInTheDocument();
});

test('a saved pass with no date stays empty until the offered date is chosen', async () => {
  const api = await openDetail({ attempts: [attempt({ id: 1, outcome: 'passed' })] });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit attempt on March 15, 2026' }));
  expect(screen.getByLabelText('Expiry date')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: /Fill in.*March 15, 2028/ }));
  expect(screen.getByLabelText('Expiry date')).toHaveValue('2028-03-15');
  expect(screen.getByLabelText('Expiry date')).toHaveFocus();
  expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sentBody(api, 'PUT')?.expiresOn).toBe('2028-03-15'));
});

test('a goal with no known validity saves what was typed, or nothing', async () => {
  const api = await openDetail({
    goal: { ...toeic, validityKind: 'unknown', validityMonths: null },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Add attempt' }));
  change('Exam date', '2026-03-15');
  change('Result', 'scored');
  expect(screen.getByLabelText('Expiry date')).toHaveValue('');
  expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
  change('Expiry date', '2027-01-01');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sentBody(api, 'POST')?.expiresOn).toBe('2027-01-01'));
});

test('a deleted attempt leaves the list even if reloading fails, and focus goes to the heading', async () => {
  await openDetail({
    attempts: [
      attempt({ id: 2, examDate: '2026-05-05', score: 850 }),
      attempt({ id: 1, examDate: '2026-03-15', score: 800 }),
    ],
    reloadFails: true,
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Delete attempt on May 5, 2026' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this attempt?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Could not reload')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(
    screen.queryByRole('button', { name: 'Edit attempt on May 5, 2026' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Edit attempt on March 15, 2026' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 2, name: 'Exam attempts' })).toHaveFocus(),
  );
});

test('deleting the only attempt still offers adding one when reloading fails', async () => {
  await openDetail({ attempts: [attempt({ id: 1, score: 800 })], reloadFails: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Delete attempt on March 15, 2026' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this attempt?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Could not reload')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add attempt' })).toBeInTheDocument();
});
