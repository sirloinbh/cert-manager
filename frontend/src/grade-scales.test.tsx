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
    label: '토익 (CEFR 기준)',
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
    label: '토익 스피킹',
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
            ? reply(500, { error: '서버 오류가 발생했습니다' })
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
  await screen.findByRole('heading', { level: 3, name: /등급$/ });
  return api;
};

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const addRecord = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('시험일', '2026-03-15');
  change('결과', 'scored');
};

const sentAttempt = (api: { sent: Sent[] }) =>
  api.sent.find((item) => item.method === 'POST' && item.path.endsWith('/attempts'))?.body;

test('the detail page shows the scale from the top with the target and its source', async () => {
  await openDetail();
  const ladder = screen.getByRole('heading', { level: 3, name: '토익 (CEFR 기준) 등급' })
    .parentElement as HTMLElement;
  const rows = within(ladder).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('B2');
  expect(rows[0]).toHaveTextContent('목표');
  expect(rows[0]).toHaveTextContent('785~944점');
  expect(rows[1]).toHaveTextContent('B1');
  expect(within(ladder).getByRole('link', { name: '출처 보기' })).toHaveAttribute(
    'href',
    'https://example.com/toeic',
  );
  expect(screen.getByText('목표 등급')).toBeInTheDocument();
});

test('a score fills its grade, and the saved record reaches the target', async () => {
  const api = await openDetail();
  await addRecord();
  change('점수', '800');
  expect(screen.getByLabelText('등급')).toHaveValue('B2');
  expect(screen.getByText('800점의 기준 등급은 B2입니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByText('목표 달성')).toBeInTheDocument();
  expect(sentAttempt(api)).toMatchObject({ score: 800, grade: 'B2' });
  expect(await screen.findByText('최근 결과')).toBeInTheDocument();
});

test('a score below the target does not reach it', async () => {
  await openDetail();
  await addRecord();
  change('점수', '600');
  expect(screen.getByLabelText('등급')).toHaveValue('B1');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByText('600점 · B1')).toBeInTheDocument();
  expect(screen.queryByText('목표 달성')).not.toBeInTheDocument();
});

test('a score shared by several levels asks the user to choose', async () => {
  const api = await openDetail({
    goal: goal({ gradeScale: 'toeic_speaking', targetGrade: 'IM2' }),
  });
  await addRecord();
  change('점수', '120');
  expect(screen.getByLabelText('등급')).toHaveValue('');
  expect(screen.getByText(/IM1, IM2, IM3 중 하나입니다/)).toBeInTheDocument();
  change('등급', 'IM3');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByText('목표 달성')).toBeInTheDocument();
  expect(sentAttempt(api)).toMatchObject({ grade: 'IM3' });
});

test('a chosen grade stays when the score changes afterwards', async () => {
  await openDetail();
  await addRecord();
  change('점수', '800');
  change('등급', 'B1');
  change('점수', '900');
  expect(screen.getByLabelText('등급')).toHaveValue('B1');
});

test('a saved grade from an older format stays selectable', async () => {
  await openDetail({ attempts: [attempt({ score: 170, grade: 'Level 7' })] });
  fireEvent.click(await screen.findByRole('button', { name: '2026-03-15 기록 수정' }));
  expect(screen.getByLabelText('등급')).toHaveValue('Level 7');
});

test('a failed attempt names a level but does not reach it', async () => {
  await openDetail({
    attempts: [attempt({ outcome: 'failed', score: 800, grade: 'B2' })],
  });
  expect(await screen.findByText('800점 · B2')).toBeInTheDocument();
  expect(screen.queryByText('목표 달성')).not.toBeInTheDocument();
});

test('a goal with both targets needs both', async () => {
  await openDetail({
    goal: goal({ targetScore: 900 }),
    attempts: [attempt({ score: 800, grade: 'B2' })],
  });
  expect(await screen.findByText('800점 · B2')).toBeInTheDocument();
  expect(screen.queryByText('목표 달성')).not.toBeInTheDocument();
});

test('a waiting attempt fills its grade once the result and score are in', async () => {
  await openDetail({ attempts: [attempt({ outcome: 'waiting', grade: null })] });
  fireEvent.click(await screen.findByRole('button', { name: '2026-03-15 기록 수정' }));
  change('결과', 'scored');
  change('점수', '800');
  expect(screen.getByLabelText('등급')).toHaveValue('B2');
  change('점수', '');
  expect(screen.getByLabelText('등급')).toHaveValue('');
});

test('a saved grade stays when the score changes, and an empty one follows the score', async () => {
  await openDetail({
    attempts: [
      attempt({ id: 5, score: 800, grade: 'B1' }),
      attempt({ id: 6, examDate: '2026-01-10', score: 800, grade: '' }),
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: '2026-03-15 기록 수정' }));
  change('점수', '900');
  expect(screen.getByLabelText('등급')).toHaveValue('B1');
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: '2026-01-10 기록 수정' }));
  expect(screen.getByLabelText('등급')).toHaveValue('B2');
});

test('a grade typed before the list arrives stays afterwards', async () => {
  let release = () => {};
  const scalesHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  fakeApi({ scalesHold });
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('결과', 'scored');
  change('등급', 'B1');
  release();
  await waitFor(() => expect(screen.getByLabelText('등급').tagName).toBe('SELECT'));
  expect(screen.getByLabelText('등급')).toHaveValue('B1');
});

test('marking the goal passed keeps its scale and target', async () => {
  const api = await openDetail();
  await addRecord();
  change('결과', 'passed');
  change('등급', 'B2');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const dialog = await screen.findByRole('dialog', { name: '목표 상태를 합격으로 바꿀까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }));
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
  expect(await screen.findByText(/등급표를 보여 줄 수 없습니다/)).toBeInTheDocument();
  expect(screen.getByText('목표 등급')).toBeInTheDocument();
});

test('a goal without a scale keeps the free text field and no ladder', async () => {
  fakeApi({ goal: goal({ gradeScale: 'none', targetGrade: null }) });
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '기록 추가' }));
  change('결과', 'scored');
  expect(screen.getByLabelText('등급').tagName).toBe('INPUT');
  expect(screen.queryByText(/ 등급$/, { selector: 'h3' })).not.toBeInTheDocument();
});

test('the goal form picks a scale and target, and a new scale clears the target', async () => {
  const api = fakeApi({ goal: goal({ gradeScale: 'none', targetGrade: null }) });
  window.history.pushState({}, '', '/certifications/new');
  render(<App />);
  fireEvent.change(await screen.findByLabelText('자격증 이름'), { target: { value: '토익' } });
  await waitFor(() => expect(screen.getByLabelText('등급 체계')).toBeEnabled());
  expect(screen.queryByLabelText('목표 등급')).not.toBeInTheDocument();

  change('등급 체계', 'toeic');
  change('목표 등급', 'B2');
  change('등급 체계', 'toeic_speaking');
  expect(screen.getByLabelText('목표 등급')).toHaveValue('');
  change('목표 등급', 'IH');

  fireEvent.click(screen.getByRole('button', { name: '추가' }));
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
  expect(await screen.findByText(/이미 고른 값은 그대로 저장됩니다/)).toBeInTheDocument();
  expect(screen.getByLabelText('등급 체계')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
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
  expect(await screen.findByText('목표 등급 B2')).toBeInTheDocument();
});
