import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Certification } from './certification-data';

const today = '2026-10-30';
const order = ['english', 'dev', 'life'];

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
  ...fields,
  daysUntilExam: days(fields.targetExamDate ?? null),
});

type Sent = { method: string; path: string; body?: Record<string, unknown> };

// An in-memory stand-in for the API that keeps the server's list order and status codes.
function fakeApi(initial: Certification[] = [], options: { deleteFails?: boolean } = {}) {
  let store = [...initial];
  let nextId = Math.max(0, ...store.map((item) => item.id)) + 1;
  const sent: Sent[] = [];
  const reply = (status: number, body?: object) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  const save = (id: number, body: Record<string, unknown>) =>
    goal({
      ...(body as Partial<Certification>),
      id,
      name: String(body.name).trim(),
      category: body.category as Certification['category'],
    });

  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      const body =
        init.body === undefined ? undefined : (JSON.parse(init.body) as Record<string, unknown>);
      sent.push({ method, path, body });
      if (path === '/api/health') return reply(200, { ok: true, today });
      if (path === '/api/certifications' && method === 'GET') {
        const list = [...store].sort(
          (a, b) =>
            order.indexOf(a.category) - order.indexOf(b.category) ||
            (a.targetExamDate ?? '9999').localeCompare(b.targetExamDate ?? '9999') ||
            a.id - b.id,
        );
        return reply(200, { today, certifications: list });
      }
      if (path === '/api/certifications' && method === 'POST') {
        if (!String(body?.name ?? '').trim())
          return reply(400, { error: '자격증 이름을 입력해 주세요' });
        const created = save(nextId++, body ?? {});
        store.push(created);
        return reply(201, { certification: created });
      }
      const id = Number(/^\/api\/certifications\/(\d+)$/.exec(path)?.[1]);
      const found = store.find((item) => item.id === id);
      if (!found) return reply(404, { error: '자격증 목표를 찾을 수 없습니다' });
      if (method === 'GET') return reply(200, { today, certification: found });
      if (method === 'PUT') {
        const updated = save(id, body ?? {});
        store = store.map((item) => (item.id === id ? updated : item));
        return reply(200, { certification: updated });
      }
      if (options.deleteFails) return reply(500, { error: '서버 오류가 발생했습니다' });
      store = store.filter((item) => item.id !== id);
      return reply(204);
    }),
  );
  return { sent };
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
  fakeApi([license, engineer, awsCp, toeic]);
  open('/certifications');
  const groups = await screen.findAllByRole('heading', { level: 2 });
  expect(groups.map((heading) => heading.textContent)).toEqual(['영어1개', '개발2개', '생활1개']);
  const dev = screen.getByRole('heading', { level: 2, name: /개발/ }).closest('section')!;
  const items = within(dev).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
    'AWS Cloud Practitioner',
    '정보처리기사',
  ]);
  expect(items[0]).toHaveTextContent('2026-11-20 · 21일 남음');
  expect(items[0]).toHaveTextContent('공부 중');
  expect(items[1]).toHaveTextContent('시험일 미정');
  expect(screen.getByRole('link', { name: '운전면허' }).closest('li')).toHaveTextContent(
    '5일 지남',
  );
  expect(screen.getByRole('link', { name: '토익' }).closest('li')).toHaveTextContent(
    'YBM · 900점 이상',
  );
});

test('with no goals the list offers to add the first one', async () => {
  fakeApi();
  open('/certifications');
  expect(
    await screen.findByRole('heading', { name: '아직 목표 자격증이 없습니다' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('link', { name: '목표 추가' })[0]);
  expect(window.location.pathname).toBe('/certifications/new');
});

test('a new goal is saved with typed values, opens its detail and appears in the list', async () => {
  const { sent } = fakeApi([toeic]);
  open('/certifications/new');
  fireEvent.change(await screen.findByLabelText('자격증 이름'), {
    target: { value: 'AWS Solutions Architect – Associate' },
  });
  fireEvent.change(screen.getByLabelText('분류'), { target: { value: 'dev' } });
  fireEvent.change(screen.getByLabelText('주관 기관'), { target: { value: 'AWS' } });
  fireEvent.change(screen.getByLabelText('목표 점수'), { target: { value: '720' } });
  fireEvent.change(screen.getByLabelText('목표 시험일'), { target: { value: '2027-03-01' } });
  expect(screen.queryByLabelText('유효기간 개월 수')).toBeNull();
  fireEvent.change(screen.getByLabelText('유효기간'), { target: { value: 'months' } });
  fireEvent.change(screen.getByLabelText('유효기간 개월 수'), { target: { value: '36' } });
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

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
  });
  expect(screen.getByText('36개월')).toBeInTheDocument();
  expect(screen.getByText('122일 남음')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: '자격증 목록' }));
  expect(
    await screen.findByRole('link', { name: 'AWS Solutions Architect – Associate' }),
  ).toBeInTheDocument();
});

test('empty optional fields are sent as not decided, and a server error keeps the form open', async () => {
  const { sent } = fakeApi();
  open('/certifications/new');
  // The browser blocks an empty required name; whitespace reaches the server, which answers 400.
  fireEvent.change(await screen.findByLabelText('자격증 이름'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('자격증 이름을 입력해 주세요');
  expect(window.location.pathname).toBe('/certifications/new');
  expect(screen.getByRole('button', { name: '추가' })).toBeEnabled();
  expect(sent.find((call) => call.method === 'POST')?.body).toMatchObject({
    targetScore: null,
    targetExamDate: null,
    validityKind: 'unknown',
    validityMonths: null,
  });
});

test('editing replaces the goal and the detail shows the new values', async () => {
  const { sent } = fakeApi([toeic]);
  open('/certifications/1');
  fireEvent.click(await screen.findByRole('link', { name: '수정' }));
  expect(await screen.findByRole('heading', { level: 1, name: '목표 수정' })).toBeInTheDocument();
  expect(screen.getByLabelText('자격증 이름')).toHaveValue('토익');
  expect(screen.getByLabelText('유효기간 개월 수')).toHaveValue(24);
  fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'registered' } });
  fireEvent.change(screen.getByLabelText('유효기간'), { target: { value: 'none' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));

  expect(await screen.findByRole('heading', { level: 1, name: '토익' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications/1');
  expect(sent.find((call) => call.method === 'PUT')).toMatchObject({
    path: '/api/certifications/1',
    body: { status: 'registered', validityKind: 'none', validityMonths: null, targetScore: 900 },
  });
  const details = screen.getByText('만료 없음').closest('dl')!;
  expect(details).toHaveTextContent('접수');
});

test('deleting asks first, says what goes with it, and the goal leaves the list', async () => {
  const { sent } = fakeApi([toeic, awsCp]);
  open('/certifications/1');
  fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
  const dialog = screen.getByRole('dialog', { name: '목표를 지울까요?' });
  expect(dialog).toHaveTextContent('응시 기록과 공부 계획도 함께 지워지고 되돌릴 수 없습니다');
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
  expect(sent.some((call) => call.method === 'DELETE')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(window.location.pathname).toBe('/certifications'));
  expect(await screen.findByRole('link', { name: 'AWS Cloud Practitioner' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '토익' })).toBeNull();
  expect(sent.find((call) => call.method === 'DELETE')?.path).toBe('/api/certifications/1');
});

test('a failed delete keeps the dialog open and says why above it', async () => {
  fakeApi([toeic], { deleteFails: true });
  open('/certifications/1');
  fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
  expect(await screen.findByText('서버 오류가 발생했습니다')).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '목표를 지울까요?' })).toBeInTheDocument();
  await waitFor(() =>
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' })).toBeEnabled(),
  );
  expect(window.location.pathname).toBe('/certifications/1');
});

test('a goal that no longer exists says so instead of an empty page', async () => {
  fakeApi();
  open('/certifications/9');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '자격증 목표를 찾을 수 없습니다. 이미 지웠을 수 있습니다.',
  );
});

test('the dashboard card lists the nearest exams still ahead and links to each goal', async () => {
  fakeApi([license, engineer, awsCp, toeic]);
  open('/');
  const card = (await screen.findByRole('heading', { level: 2, name: '가까운 시험' })).closest(
    '[data-slot="card"]',
  )!;
  const rows = await within(card as HTMLElement).findAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    'AWS Cloud Practitioner2026-11-2021일 남음',
    '토익2026-12-1344일 남음',
  ]);
  fireEvent.click(within(card as HTMLElement).getByRole('link', { name: '토익' }));
  expect(window.location.pathname).toBe('/certifications/1');
});
