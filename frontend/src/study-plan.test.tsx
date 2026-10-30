import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Certification } from './certification-data';
import type { StudyStage, StudyTask, TodayTask } from './study-plan-data';

const today = '2026-10-30';

const toeic: Certification = {
  id: 1,
  name: '토익',
  category: 'english',
  issuer: 'YBM',
  status: 'studying',
  goalText: '',
  targetScore: null,
  targetExamDate: '2026-12-13',
  daysUntilExam: 44,
  validityKind: 'unknown',
  validityMonths: null,
  memo: '',
};

const task = (fields: Partial<StudyTask> & Pick<StudyTask, 'id' | 'title'>): StudyTask => ({
  stageId: 1,
  position: 1,
  dueDate: null,
  daysUntilDue: null,
  completedAt: null,
  ...fields,
});

const stage = (fields: Partial<StudyStage> & Pick<StudyStage, 'id' | 'title'>): StudyStage => ({
  certificationId: 1,
  position: 1,
  startDate: null,
  endDate: null,
  tasks: [],
  ...fields,
});

type Sent = { method: string; path: string; body?: Record<string, unknown> };

// A stand-in for the API that keeps a plan in memory, in the shape the server answers.
function fakeApi(
  options: {
    goal?: Certification;
    stages?: StudyStage[];
    todayTasks?: TodayTask[];
    completionFails?: boolean;
    createHold?: Promise<unknown>;
    createFails?: string;
    reloadFails?: boolean;
  } = {},
) {
  const goal = options.goal ?? toeic;
  let stages = options.stages ?? [];
  let nextId = 100;
  let planned = 0;
  const sent: Sent[] = [];
  const reply = (status: number, body?: object) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  const updateTasks = (change: (item: StudyTask) => StudyTask | null) => {
    stages = stages.map((row) => ({
      ...row,
      tasks: row.tasks.flatMap((item) => change(item) ?? []),
    }));
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      const body =
        init.body === undefined ? undefined : (JSON.parse(init.body) as Record<string, unknown>);
      sent.push({ method, path, body });
      if (path === '/api/health') return reply(200, { ok: true, today });
      if (path === '/api/exam-attempts/latest') return reply(200, { today, attempts: [] });
      if (path === '/api/study-tasks/today')
        return reply(200, { today, tasks: options.todayTasks ?? [] });
      if (path === '/api/certifications') return reply(200, { today, certifications: [goal] });
      if (path === '/api/certifications/1') return reply(200, { today, certification: goal });
      if (path === '/api/certifications/1/attempts') return reply(200, { today, attempts: [] });
      if (path === '/api/certifications/1/plan') {
        planned += 1;
        if (options.reloadFails && planned > 1)
          return reply(500, { error: '다시 읽지 못했습니다' });
        return reply(200, { today, stages });
      }
      if (path === '/api/certifications/1/stages') {
        await options.createHold;
        if (options.createFails) return reply(400, { error: options.createFails });
        const created = stage({
          ...(body as Partial<StudyStage>),
          id: nextId++,
          title: String(body?.title),
          position: stages.length + 1,
        });
        stages = [...stages, created];
        return reply(201, { stage: created });
      }
      const stageId = Number(/^\/api\/study-stages\/(\d+)/.exec(path)?.[1]);
      if (path.endsWith('/tasks')) {
        const created = task({
          ...(body as Partial<StudyTask>),
          id: nextId++,
          stageId,
          title: String(body?.title),
        });
        stages = stages.map((row) =>
          row.id === stageId ? { ...row, tasks: [...row.tasks, created] } : row,
        );
        return reply(201, { task: created });
      }
      if (path.startsWith('/api/study-stages/')) {
        if (method === 'DELETE') {
          stages = stages.filter((row) => row.id !== stageId);
          return reply(204);
        }
        stages = stages.map((row) =>
          row.id === stageId ? { ...row, ...(body as Partial<StudyStage>) } : row,
        );
        return reply(200, { stage: stages.find((row) => row.id === stageId) });
      }
      const taskId = Number(/^\/api\/study-tasks\/(\d+)/.exec(path)?.[1]);
      if (path.endsWith('/completion')) {
        if (options.completionFails) return reply(500, { error: '완료를 저장하지 못했습니다' });
        let saved: StudyTask | undefined;
        updateTasks((item) => {
          if (item.id !== taskId) return item;
          saved = { ...item, completedAt: body?.completed ? '2026-10-30T01:00:00.000Z' : null };
          return saved;
        });
        return reply(200, { task: saved });
      }
      if (method === 'DELETE') {
        updateTasks((item) => (item.id === taskId ? null : item));
        return reply(204);
      }
      let saved: StudyTask | undefined;
      updateTasks((item) => {
        if (item.id !== taskId) return item;
        saved = { ...item, ...(body as Partial<StudyTask>) };
        return saved;
      });
      return reply(200, { task: saved });
    }),
  );
  return { sent };
}

const openDetail = async (options?: Parameters<typeof fakeApi>[0]) => {
  const api = fakeApi(options);
  window.history.pushState({}, '', '/certifications/1');
  render(<App />);
  await screen.findByRole('heading', { level: 2, name: '공부 계획' });
  return api;
};

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const saveButton = () => screen.getByRole('button', { name: '저장' });

const week = () =>
  stage({
    id: 1,
    title: '1주차',
    tasks: [
      task({ id: 11, title: '단어 외우기', completedAt: '2026-10-29T01:00:00.000Z' }),
      task({ id: 12, title: '기출 풀기', position: 2 }),
    ],
  });

test('a first stage and task can be added, and the task then counts in the progress', async () => {
  const api = await openDetail();
  expect(await screen.findByText('아직 공부 계획이 없습니다')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '단계 추가' }));
  change('단계 이름', '1주차');
  change('시작일', '2026-11-01');
  change('종료일', '2026-11-07');
  fireEvent.click(saveButton());
  expect(await screen.findByRole('heading', { level: 3, name: '1주차' })).toBeInTheDocument();
  expect(screen.getByText('2026-11-01 ~ 2026-11-07')).toBeInTheDocument();
  expect(api.sent.find((item) => item.path.endsWith('/stages'))?.body).toEqual({
    title: '1주차',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
  });
  // No tasks yet, so no progress to show.
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

  fireEvent.click(await screen.findByRole('button', { name: '1주차에 할 일 추가' }));
  change('할 일', '기출 풀기');
  change('마감일', '2026-11-03');
  fireEvent.click(saveButton());
  expect(await screen.findByRole('checkbox', { name: '기출 풀기' })).not.toBeChecked();
  expect(api.sent.find((item) => item.path.endsWith('/tasks'))?.body).toEqual({
    title: '기출 풀기',
    dueDate: '2026-11-03',
  });
  expect(screen.getByRole('progressbar', { name: '전체 진행률' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
});

test('checking a task changes the stage and overall progress right away', async () => {
  const api = await openDetail({
    stages: [
      week(),
      stage({ id: 2, title: '2주차', tasks: [task({ id: 21, title: '모의고사' })] }),
    ],
  });
  const overall = await screen.findByRole('progressbar', { name: '전체 진행률' });
  expect(overall).toHaveAttribute('aria-valuenow', '33');
  expect(screen.getByRole('progressbar', { name: '1주차 진행률' })).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  expect(screen.getByText('전체 진행률 1/3 · 33%')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('checkbox', { name: '기출 풀기' }));
  await waitFor(() =>
    expect(screen.getByRole('progressbar', { name: '1주차 진행률' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    ),
  );
  expect(screen.getByRole('progressbar', { name: '전체 진행률' })).toHaveAttribute(
    'aria-valuenow',
    '67',
  );
  expect(screen.getByRole('progressbar', { name: '2주차 진행률' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  expect(screen.getByRole('checkbox', { name: '기출 풀기' })).toBeChecked();
  expect(api.sent.find((item) => item.path.endsWith('/completion'))).toMatchObject({
    method: 'PATCH',
    path: '/api/study-tasks/12/completion',
    body: { completed: true },
  });

  // Unchecking goes back.
  fireEvent.click(screen.getByRole('checkbox', { name: '단어 외우기' }));
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: '단어 외우기' })).not.toBeChecked(),
  );
  expect(screen.getByText('전체 진행률 1/3 · 33%')).toBeInTheDocument();
});

test('a second click while saving does not send another request', async () => {
  const api = await openDetail({ stages: [week()] });
  const box = await screen.findByRole('checkbox', { name: '기출 풀기' });
  fireEvent.click(box);
  fireEvent.click(box);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '기출 풀기' })).toBeChecked());
  expect(api.sent.filter((item) => item.path.endsWith('/completion'))).toHaveLength(1);
});

test('a failed check says why and leaves the task as it was', async () => {
  await openDetail({ stages: [week()], completionFails: true });
  fireEvent.click(await screen.findByRole('checkbox', { name: '기출 풀기' }));
  expect(await screen.findByText('완료를 저장하지 못했습니다')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '기출 풀기' })).not.toBeChecked();
});

test('the section shows the days left until the target exam', async () => {
  await openDetail({ stages: [week()] });
  expect(await screen.findByText('목표 시험일까지: 44일 남음')).toBeInTheDocument();
});

test('a goal with no exam date leaves the countdown out', async () => {
  await openDetail({
    goal: { ...toeic, targetExamDate: null, daysUntilExam: null },
    stages: [week()],
  });
  await screen.findByRole('checkbox', { name: '기출 풀기' });
  expect(screen.queryByText(/목표 시험일까지/)).not.toBeInTheDocument();
});

test('due dates count down, and only an unfinished late task is marked', async () => {
  await openDetail({
    stages: [
      stage({
        id: 1,
        title: '1주차',
        tasks: [
          task({ id: 1, title: '지난 일', dueDate: '2026-10-27', daysUntilDue: -3 }),
          task({ id: 2, title: '오늘 일', dueDate: '2026-10-30', daysUntilDue: 0 }),
          task({
            id: 3,
            title: '끝낸 일',
            dueDate: '2026-10-20',
            daysUntilDue: -10,
            completedAt: '2026-10-19T01:00:00.000Z',
          }),
        ],
      }),
    ],
  });
  const late = await screen.findByText(/3일 지남/);
  expect(late).toHaveClass('text-destructive');
  expect(screen.getByText(/오늘까지/)).not.toHaveClass('text-destructive');
  expect(screen.queryByText(/10일 지남/)).not.toBeInTheDocument();
});

test('stages and tasks can be edited in place', async () => {
  const api = await openDetail({ stages: [week()] });
  fireEvent.click(await screen.findByRole('button', { name: '1주차 단계 수정' }));
  expect(screen.getByLabelText('단계 이름')).toHaveValue('1주차');
  change('단계 이름', '첫 주');
  fireEvent.click(saveButton());
  expect(await screen.findByRole('heading', { level: 3, name: '첫 주' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '기출 풀기 수정' }));
  change('할 일', '기출 2회');
  change('마감일', '2026-11-02');
  fireEvent.click(saveButton());
  expect(await screen.findByRole('checkbox', { name: '기출 2회' })).toBeInTheDocument();
  expect(
    api.sent.find((item) => item.path === '/api/study-tasks/12' && item.method === 'PUT')?.body,
  ).toEqual({ title: '기출 2회', dueDate: '2026-11-02' });
});

test('a date can be cleared, and an empty date is sent as null', async () => {
  const api = await openDetail({
    stages: [
      stage({
        id: 1,
        title: '1주차',
        tasks: [task({ id: 5, title: '기출', dueDate: '2026-11-02', daysUntilDue: 3 })],
      }),
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: '기출 수정' }));
  change('마감일', '');
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(api.sent.find((item) => item.method === 'PUT')?.body).toEqual({
      title: '기출',
      dueDate: null,
    }),
  );
});

test('deleting a stage names its tasks, and focus goes to the heading', async () => {
  await openDetail({ stages: [week(), stage({ id: 2, title: '2주차' })] });
  fireEvent.click(await screen.findByRole('button', { name: '1주차 단계 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '단계를 지울까요?' });
  expect(dialog).toHaveTextContent('할 일 2개를');
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { level: 3, name: '1주차' })).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('heading', { level: 3, name: '2주차' })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 2, name: '공부 계획' })).toHaveFocus(),
  );
});

test('a deleted task leaves the list even if reloading fails', async () => {
  await openDetail({ stages: [week()], reloadFails: true });
  fireEvent.click(await screen.findByRole('button', { name: '기출 풀기 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '할 일을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(await screen.findByText('다시 읽지 못했습니다')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: '기출 풀기' })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '단어 외우기' })).toBeInTheDocument();
});

test('a save in progress keeps the dialog open, and its error stays in the form', async () => {
  let release = () => {};
  const createHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openDetail({ createHold, createFails: '서버가 거절했습니다' });
  fireEvent.click(await screen.findByRole('button', { name: '단계 추가' }));
  change('단계 이름', '1주차');
  fireEvent.click(saveButton());
  const dialog = screen.getByRole('dialog', { name: '단계 추가' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: '단계 추가' })).toBeInTheDocument();
  release();
  expect(await screen.findByRole('alert')).toHaveTextContent('서버가 거절했습니다');
});

test('closing the form returns focus to the button that opened it', async () => {
  await openDetail({ stages: [week()] });
  const edit = await screen.findByRole('button', { name: '기출 풀기 수정' });
  edit.focus();
  fireEvent.click(edit);
  fireEvent.click(await screen.findByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(edit).toHaveFocus());
});

test('the dashboard card lists overdue and due tasks with their goal', async () => {
  fakeApi({
    todayTasks: [
      {
        ...task({ id: 1, title: '단어 외우기', dueDate: '2026-10-27', daysUntilDue: -3 }),
        certificationId: 1,
        certificationName: '토익',
      },
      {
        ...task({ id: 2, title: '기출 풀기', dueDate: '2026-10-30', daysUntilDue: 0 }),
        certificationId: 1,
        certificationName: '토익',
      },
    ],
  });
  window.history.pushState({}, '', '/');
  render(<App />);
  const heading = await screen.findByRole('heading', { level: 2, name: '오늘 할 일' });
  const card = heading.closest('[data-slot="card"]') as HTMLElement;
  const items = await within(card).findAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('link').textContent)).toEqual([
    '단어 외우기',
    '기출 풀기',
  ]);
  expect(within(items[0]).getByText('3일 지남')).toHaveClass('text-destructive');
  expect(within(items[1]).getByText('오늘까지')).not.toHaveClass('text-destructive');
  expect(within(items[0]).getByText('토익')).toBeInTheDocument();
  expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/certifications/1');
});

test('the dashboard card says so when nothing is due', async () => {
  fakeApi();
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(await screen.findByText(/오늘 할 일이 없습니다/)).toBeInTheDocument();
});
