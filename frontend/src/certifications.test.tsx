import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test } from 'vitest';

import { App } from './app';
import type { Certification } from './certification-data';
import { emptyDailyWords, fakeRoutes, reply } from './test/fake-routes';

const today = '2026-10-30';

function days(date: string | null) {
  if (date === null) return null;
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
}

const goal = (
  fields: Partial<Certification> & Pick<Certification, 'id' | 'name' | 'category'>,
) => ({
  issuer: '',
  status: 'planned' as const,
  goalText: '',
  targetScore: null,
  targetExamDate: null,
  validityKind: 'unknown' as const,
  validityMonths: null,
  memo: '',
  gradeScale: 'none',
  targetGrade: null,
  ...fields,
  daysUntilExam: days(fields.targetExamDate ?? null),
});

// An in-memory stand-in for the API. The list is served in the order the test gives it, which is the server's order
// (category, then nearest exam, then id), so the screen is what is tested, not a copy of the server's sort.
function fakeApi(initial: Certification[] = [], options: { deleteFails?: boolean } = {}) {
  let store = [...initial];
  let nextId = Math.max(0, ...store.map((item) => item.id)) + 1;
  const save = (id: number, body: Record<string, unknown>) =>
    goal({
      ...(body as Partial<Certification>),
      id,
      name: String(body.name).trim(),
      category: body.category as Certification['category'],
    });
  const one = (path: string) => {
    const id = Number(/^\/api\/certifications\/(\d+)$/.exec(path)?.[1]);
    return { id, found: store.find((item) => item.id === id) };
  };
  const notFound = () => reply(404, { error: 'Certification goal not found' });

  return fakeRoutes([
    ['GET', '/api/health', () => reply(200, { ok: true, today })],
    // The attempt and plan screens have their own tests.
    ['GET', '/api/exam-attempts/latest', () => reply(200, { today, attempts: [] })],
    ['GET', /\/api\/certifications\/\d+\/attempts/, () => reply(200, { today, attempts: [] })],
    ['GET', '/api/study-tasks/today', () => reply(200, { today, tasks: [] })],
    ['GET', '/api/study-tasks/progress', () => reply(200, { goals: [] })],
    ['GET', /\/api\/certifications\/\d+\/plan/, () => reply(200, { today, stages: [] })],
    ...emptyDailyWords(today),
    ['GET', '/api/grade-scales', () => reply(200, { scales: [] })],
    ['GET', '/api/user-actions', () => reply(200, { today, actions: [] })],
    ['GET', '/api/certifications', () => reply(200, { today, certifications: store })],
    [
      'POST',
      '/api/certifications',
      ({ body }) => {
        if (!String(body?.name ?? '').trim())
          return reply(400, { error: 'Certification name is required' });
        const created = save(nextId++, body ?? {});
        store.push(created);
        return reply(201, { certification: created });
      },
    ],
    [
      'GET',
      /\/api\/certifications\/\d+/,
      ({ path }) => {
        const { found } = one(path);
        return found ? reply(200, { today, certification: found }) : notFound();
      },
    ],
    [
      'PUT',
      /\/api\/certifications\/\d+/,
      ({ path, body }) => {
        const { id, found } = one(path);
        if (!found) return notFound();
        const updated = save(id, body ?? {});
        store = store.map((item) => (item.id === id ? updated : item));
        return reply(200, { certification: updated });
      },
    ],
    [
      'DELETE',
      /\/api\/certifications\/\d+/,
      ({ path }) => {
        const { id, found } = one(path);
        if (!found) return notFound();
        if (options.deleteFails) return reply(500, { error: 'A server error occurred' });
        store = store.filter((item) => item.id !== id);
        return reply(204);
      },
    ],
  ]);
}

const toeic = goal({
  id: 1,
  name: '토익',
  category: 'english',
  issuer: 'YBM',
  goalText: '900점 이상',
  targetScore: 900,
  targetExamDate: '2026-12-13',
  validityKind: 'months',
  validityMonths: 24,
});
const awsCp = goal({
  id: 2,
  name: 'AWS Cloud Practitioner',
  category: 'dev',
  targetExamDate: '2026-11-20',
  status: 'studying',
});
const engineer = goal({ id: 3, name: '정보처리기사', category: 'dev' });
const license = goal({
  id: 4,
  name: '운전면허',
  category: 'life',
  targetExamDate: '2026-10-25',
  status: 'passed',
});

const open = (path: string) => {
  window.history.replaceState(null, '', path);
  render(<App />);
};

test('the list groups goals by category with counts, nearest exam first and days left', async () => {
  fakeApi([toeic, awsCp, engineer, license]);
  open('/certifications');
  const groups = await screen.findAllByRole('heading', { level: 2 });
  expect(groups.map((heading) => heading.textContent)).toEqual([
    'English1',
    'Development2',
    'Life1',
  ]);
  const dev = screen.getByRole('heading', { level: 2, name: /Development/ }).closest('section')!;
  const items = within(dev).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
    'AWS Cloud Practitioner',
    '정보처리기사',
  ]);
  expect(items[0]).toHaveTextContent('November 20, 2026 · 21 days left');
  expect(items[0]).toHaveTextContent('Studying');
  expect(items[1]).toHaveTextContent('Exam date not set');
  expect(screen.getByRole('link', { name: '운전면허' }).closest('li')).toHaveTextContent(
    '5 days ago',
  );
  expect(screen.getByRole('link', { name: '토익' }).closest('li')).toHaveTextContent(
    'YBM · 900점 이상',
  );
});

test('with no goals the list offers to add the first one', async () => {
  fakeApi();
  open('/certifications');
  expect(
    await screen.findByRole('heading', { name: 'No certification goals yet' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('link', { name: 'Add goal' })[0]);
  expect(window.location.pathname).toBe('/certifications/new');
});

test('a new goal is saved with typed values, opens its detail and appears in the list', async () => {
  const { sent } = fakeApi([toeic]);
  open('/certifications/new');
  fireEvent.change(await screen.findByLabelText('Certification name'), {
    target: { value: 'AWS Solutions Architect – Associate' },
  });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'dev' } });
  fireEvent.change(screen.getByLabelText('Issuer'), { target: { value: 'AWS' } });
  fireEvent.change(screen.getByLabelText('Target score'), { target: { value: '720' } });
  fireEvent.change(screen.getByLabelText('Target exam date'), { target: { value: '2027-03-01' } });
  expect(screen.queryByLabelText('Validity months')).toBeNull();
  fireEvent.change(screen.getByLabelText('Validity'), { target: { value: 'months' } });
  fireEvent.change(screen.getByLabelText('Validity months'), { target: { value: '36' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'AWS Solutions Architect – Associate' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications/2');
  expect(sent.find((call) => call.method === 'POST')?.body).toEqual({
    name: 'AWS Solutions Architect – Associate',
    category: 'dev',
    issuer: 'AWS',
    status: 'planned',
    goalText: '',
    targetScore: 720,
    targetExamDate: '2027-03-01',
    validityKind: 'months',
    validityMonths: 36,
    memo: '',
    gradeScale: 'none',
    targetGrade: null,
  });
  expect(screen.getByText('36 months')).toBeInTheDocument();
  expect(screen.getByText('122 days left')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: 'Certification list' }));
  expect(
    await screen.findByRole('link', { name: 'AWS Solutions Architect – Associate' }),
  ).toBeInTheDocument();
});

test('empty optional fields are sent as not decided, and a server error keeps the form open', async () => {
  const { sent } = fakeApi();
  open('/certifications/new');
  // The browser blocks an empty required name; whitespace reaches the server, which answers 400.
  fireEvent.change(await screen.findByLabelText('Certification name'), {
    target: { value: '   ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Certification name is required');
  expect(window.location.pathname).toBe('/certifications/new');
  expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  expect(sent.find((call) => call.method === 'POST')?.body).toMatchObject({
    targetScore: null,
    targetExamDate: null,
    validityKind: 'unknown',
    validityMonths: null,
  });
});

test('an empty grade list says so instead of loading forever', async () => {
  fakeApi([]);
  open('/certifications/new');
  expect(await screen.findByText('No grade scales are available.')).toBeInTheDocument();
  expect(screen.queryByText('Loading the grade list.')).toBeNull();
  expect(screen.getByLabelText('Grade scale')).toBeDisabled();
});

test('editing replaces the goal and the detail shows the new values', async () => {
  const { sent } = fakeApi([toeic]);
  open('/certifications/1');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Edit goal' })).toBeInTheDocument();
  expect(screen.getByLabelText('Certification name')).toHaveValue('토익');
  expect(screen.getByLabelText('Validity months')).toHaveValue(24);
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'registered' } });
  fireEvent.change(screen.getByLabelText('Validity'), { target: { value: 'none' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('heading', { level: 1, name: '토익' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications/1');
  expect(sent.find((call) => call.method === 'PUT')).toMatchObject({
    path: '/api/certifications/1',
    body: { status: 'registered', validityKind: 'none', validityMonths: null, targetScore: 900 },
  });
  const details = screen.getByText('No expiry').closest('dl')!;
  expect(details).toHaveTextContent('Registered');
});

test('deleting asks first, says what goes with it, and the goal leaves the list', async () => {
  const { sent } = fakeApi([toeic, awsCp]);
  open('/certifications/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete this goal?' });
  expect(dialog).toHaveTextContent('Its exam attempts and study plan are deleted too');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(sent.some((call) => call.method === 'DELETE')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(window.location.pathname).toBe('/certifications'));
  expect(await screen.findByRole('link', { name: 'AWS Cloud Practitioner' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '토익' })).toBeNull();
  expect(sent.find((call) => call.method === 'DELETE')?.path).toBe('/api/certifications/1');
});

test('a failed delete keeps the dialog open and says why above it', async () => {
  fakeApi([toeic], { deleteFails: true });
  open('/certifications/1');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('A server error occurred')).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this goal?' })).toBeInTheDocument();
  await waitFor(() =>
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    ).toBeEnabled(),
  );
  expect(window.location.pathname).toBe('/certifications/1');
});

test('a goal that no longer exists says so instead of an empty page', async () => {
  fakeApi();
  open('/certifications/9');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Certification goal not found. It may have been deleted already.',
  );
});

test('the dashboard card lists the nearest exams still ahead and links to each goal', async () => {
  fakeApi([toeic, awsCp, engineer, license]);
  open('/dashboard');
  const card = (await screen.findByRole('heading', { level: 2, name: 'Upcoming exams' })).closest(
    '[data-slot="card"]',
  )!;
  const rows = await within(card as HTMLElement).findAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    'AWS Cloud PractitionerNovember 20, 202621 days left',
    '토익December 13, 202644 days left',
  ]);
  fireEvent.click(within(card as HTMLElement).getByRole('link', { name: '토익' }));
  expect(window.location.pathname).toBe('/certifications/1');
});

test('the issuer field offers the issuers already used and still takes a new one', async () => {
  fakeApi([toeic]);
  open('/certifications/new');
  const field = await screen.findByLabelText('Issuer');
  fireEvent.focus(field);
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'YBM' }));
  expect(field).toHaveValue('YBM');
  fireEvent.change(field, { target: { value: 'Pearson' } });
  expect(field).toHaveValue('Pearson');
});
