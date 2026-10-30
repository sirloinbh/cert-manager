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
  } = {},
) {
  let goal = options.goal ?? toeic;
  let attempts = options.attempts ?? [];
  let nextId = 100;
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
      if (path === '/api/exam-attempts/latest')
        return reply(200, { today, attempts: options.latest ?? [] });
      if (path === '/api/certifications') return reply(200, { today, certifications: [goal] });
      if (path === '/api/certifications/1') {
        if (method === 'PUT') goal = { ...goal, ...(body as Partial<Certification>) };
        return reply(200, { today, certification: goal });
      }
      if (path === '/api/certifications/1/attempts' && method === 'GET')
        return reply(200, { today, attempts });
      if (path === '/api/certifications/1/attempts' && method === 'POST') {
        if (options.createFails) return reply(400, { error: options.createFails });
        const created = attempt({ ...(body as Partial<ExamAttempt>), id: nextId++ });
        attempts = [created, ...attempts];
        return reply(201, { attempt: created });
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
  await screen.findByRole('heading', { level: 2, name: '응시·취득 기록' });
  return api;
};

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const sentBody = (api: { sent: Sent[] }, method: string) =>
  api.sent.find((item) => item.method === method && item.path.includes('/attempts'))?.body;

test('a new score fills the expiry from the goal, two years after the exam', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('시험일', '2024-02-29');
  // No result yet: nothing to score or expire.
  expect(screen.queryByLabelText('점수')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('만료일')).not.toBeInTheDocument();

  change('결과', 'scored');
  change('점수', '910');
  expect(screen.getByLabelText('만료일')).toHaveValue('2026-02-28');
  change('시험일', '2026-03-15');
  expect(screen.getByLabelText('만료일')).toHaveValue('2028-03-15');

  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByText('2026-03-15')).toBeInTheDocument();
  expect(sentBody(api, 'POST')).toEqual({
    examDate: '2026-03-15',
    outcome: 'scored',
    score: 910,
    grade: '',
    expiresOn: '2028-03-15',
    memo: '',
  });
  expect(screen.getByText('목표 달성')).toBeInTheDocument();
  // A score is not a pass, so nothing asks about the goal's status.
  expect(screen.queryByText('목표 상태를 합격으로 바꿀까요?')).not.toBeInTheDocument();
});

test('the prefilled expiry can be changed or cleared', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('시험일', '2026-03-15');
  change('결과', 'scored');
  change('만료일', '');
  // A cleared date stays cleared when the exam date changes afterwards.
  change('시험일', '2026-03-16');
  expect(screen.getByLabelText('만료일')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('2026-03-16');
  expect(sentBody(api, 'POST')?.expiresOn).toBeNull();
});

test('a goal that never expires asks for no date and shows "만료 없음"', async () => {
  const api = await openDetail({
    goal: { ...toeic, validityKind: 'none', validityMonths: null },
    attempts: [attempt({ id: 1, outcome: 'passed' })],
  });
  // Once as the goal's validity field, once as the attempt's badge.
  await waitFor(() => expect(screen.getAllByText('만료 없음')).toHaveLength(2));
  fireEvent.click(screen.getByRole('button', { name: '2026-03-15 기록 수정' }));
  expect(screen.queryByLabelText('만료일')).not.toBeInTheDocument();
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
  expect(await screen.findByText('만료 임박')).toBeInTheDocument();
  expect(screen.getByText(/32일 남음/)).toBeInTheDocument();
  expect(screen.getByText('새 기록 있음')).toBeInTheDocument();
  expect(screen.queryByText('만료')).not.toBeInTheDocument();
  expect(screen.queryByText('목표 달성')).not.toBeInTheDocument();
});

test('saving a pass asks before changing the goal, and the answer is respected', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('시험일', '2026-03-15');
  change('결과', 'passed');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));

  const dialog = await screen.findByRole('dialog', { name: '목표 상태를 합격으로 바꿀까요?' });
  expect(
    api.sent.some((item) => item.path === '/api/certifications/1' && item.method === 'PUT'),
  ).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }));
  await waitFor(() =>
    expect(
      api.sent.find((item) => item.path === '/api/certifications/1' && item.method === 'PUT')?.body,
    ).toMatchObject({ name: '토익', status: 'passed', validityMonths: 24 }),
  );
  // The page shows the new status without leaving; 합격 also labels the attempt itself.
  await waitFor(() => expect(screen.getAllByText('합격')).toHaveLength(2));
});

test('declining the question leaves the goal alone', async () => {
  const api = await openDetail();
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('시험일', '2026-03-15');
  change('결과', 'passed');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const dialog = await screen.findByRole('dialog', { name: '목표 상태를 합격으로 바꿀까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '그대로 두기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(
    api.sent.some((item) => item.path === '/api/certifications/1' && item.method === 'PUT'),
  ).toBe(false);
});

test('editing an attempt that is already a pass does not ask again', async () => {
  await openDetail({
    attempts: [
      attempt({ id: 1, outcome: 'passed', expiresOn: '2028-03-15', daysUntilExpiry: 867 }),
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: '2026-03-15 기록 수정' }));
  expect(screen.getByLabelText('만료일')).toHaveValue('2028-03-15');
  change('메모', '성적표 받음');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByText('성적표 받음', { selector: 'p' })).toBeInTheDocument();
  expect(screen.queryByText('목표 상태를 합격으로 바꿀까요?')).not.toBeInTheDocument();
});

test('a result entered later fills the expiry that was empty while waiting', async () => {
  await openDetail({ attempts: [attempt({ id: 1, outcome: 'waiting', grade: null })] });
  fireEvent.click(await screen.findByRole('button', { name: '2026-03-15 기록 수정' }));
  change('결과', 'scored');
  expect(screen.getByLabelText('만료일')).toHaveValue('2028-03-15');
});

test('a server error stays in the form with the message', async () => {
  await openDetail({ createFails: '만료일은 시험일 이후여야 합니다' });
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('시험일', '2026-03-15');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('만료일은 시험일 이후여야 합니다');
  expect(screen.getByRole('dialog', { name: '응시 기록 추가' })).toBeInTheDocument();
});

test('deleting an attempt asks first and removes it from the list', async () => {
  const api = await openDetail({ attempts: [attempt({ id: 7, score: 800 })] });
  fireEvent.click(await screen.findByRole('button', { name: '2026-03-15 기록 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '기록을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(await screen.findByText('아직 응시 기록이 없습니다')).toBeInTheDocument();
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
      latest({ id: 3, name: '토익 스피킹', expiresOn: '2026-10-01', daysUntilExpiry: -29 }),
    ],
  });
  window.history.pushState({}, '', '/');
  render(<App />);
  const items = await within(
    (await screen.findByText('만료 임박', { selector: 'h2' })).closest(
      '[data-slot="card"]',
    ) as HTMLElement,
  ).findAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('link').textContent)).toEqual([
    '토익 스피킹',
    'AWS CP',
  ]);
  expect(within(items[0]).getByText('만료')).toBeInTheDocument();
  expect(within(items[1]).getByText('만료 임박')).toBeInTheDocument();
  expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/certifications/1');
});

test('the dashboard card says so when nothing is close to expiry', async () => {
  fakeApi();
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(await screen.findByText(/만료가 가까운 자격증이 없습니다/)).toBeInTheDocument();
});
