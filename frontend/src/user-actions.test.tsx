import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import { alertCount, type UserAction } from './user-action-data';

const today = '2027-03-08';

// Toasts live outside the component tree, so they would carry over into the next test.
afterEach(() => {
  toast.dismiss();
});

const action = (fields: Partial<UserAction> & Pick<UserAction, 'id' | 'title'>): UserAction => ({
  note: '',
  linkUrl: '',
  remindFrom: '2027-03-01',
  dueDate: null,
  daysUntilDue: null,
  completedAt: null,
  ...fields,
});

const register = action({
  id: 1,
  title: '실기 1회 접수',
  note: '응시일은 4월 안의 날로 고릅니다',
  linkUrl: 'https://www.q-net.or.kr/',
  dueDate: '2027-03-22',
  daysUntilDue: 14,
});
const late = action({ id: 2, title: '서류 제출 확인', dueDate: '2027-03-01', daysUntilDue: -7 });
const open = action({ id: 3, title: '기한 확인' });

type Sent = { method: string; path: string; body?: unknown };

function fakeApi(
  options: {
    actions?: UserAction[];
    listFails?: boolean;
    completeFails?: boolean;
    /** Answers the list once, then fails. */
    reloadFails?: boolean;
    /** Answers the completion only once this settles. */
    completeHold?: Promise<unknown>;
  } = {},
) {
  let actions = options.actions ?? [];
  let listed = 0;
  const sent: Sent[] = [];
  const reply = (status: number, body?: object) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      sent.push({
        method,
        path,
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      });
      if (path === '/api/health') return reply(200, { ok: true, today });
      if (path === '/api/user-actions') {
        listed += 1;
        if (options.listFails || (options.reloadFails && listed > 1))
          return reply(500, { error: '알림 서버 오류' });
        return reply(200, { today, actions });
      }
      const id = Number(/\/user-actions\/(\d+)\/completion$/.exec(path)?.[1]);
      if (id) {
        await options.completeHold;
        if (options.completeFails) return reply(500, { error: '저장 서버 오류' });
        const done = actions.find((item) => item.id === id);
        actions = actions.filter((item) => item.id !== id);
        return reply(200, { action: { ...done, completedAt: '2027-03-08T00:00:00Z' } });
      }
      return reply(200, { today, certifications: [], attempts: [], tasks: [] });
    }),
  );
  return { sent };
}

const openApp = (options?: Parameters<typeof fakeApi>[0]) => {
  const api = fakeApi(options);
  window.history.pushState({}, '', '/');
  render(<App />);
  return api;
};

const openPanel = async (name: RegExp | string) => {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog', { name: '직접 할 일' });
};

test('the bell counts what is waiting, and the panel shows the details', async () => {
  openApp({ actions: [register, open] });
  const panel = await openPanel('직접 할 일 알림 2건');
  const items = within(panel).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('실기 1회 접수');
  expect(items[0]).toHaveTextContent('응시일은 4월 안의 날로 고릅니다');
  expect(items[0]).toHaveTextContent('2027-03-22 · 14일 남음');
  expect(within(items[0]).getByRole('link', { name: '바로가기' })).toHaveAttribute(
    'href',
    'https://www.q-net.or.kr/',
  );
  // No deadline and no page: only the title and the button.
  expect(within(items[1]).queryByRole('link')).not.toBeInTheDocument();
  expect(items[1]).not.toHaveTextContent('남음');
});

test('a passed deadline says so', async () => {
  openApp({ actions: [late] });
  const panel = await openPanel('직접 할 일 알림 1건');
  expect(within(panel).getByText(/7일 지남/)).toBeInTheDocument();
});

test('waiting alerts are announced once when the app opens', async () => {
  openApp({ actions: [register, open] });
  expect(await screen.findByText('직접 할 일이 2건 있습니다')).toBeInTheDocument();
});

test('with nothing waiting there is no count and no announcement', async () => {
  openApp();
  const panel = await openPanel('직접 할 일 알림');
  expect(within(panel).getByText('지금 직접 할 일이 없습니다.')).toBeInTheDocument();
  expect(screen.queryByText(/건 있습니다/)).not.toBeInTheDocument();
});

test('completing an alert lowers the count right away and moves focus to the title', async () => {
  const api = openApp({ actions: [register, open] });
  const panel = await openPanel('직접 할 일 알림 2건');
  fireEvent.click(within(panel).getByRole('button', { name: "'실기 1회 접수' 완료" }));
  await waitFor(() => expect(within(panel).queryByText('실기 1회 접수')).not.toBeInTheDocument());
  expect(api.sent.find((item) => item.path === '/api/user-actions/1/completion')).toMatchObject({
    method: 'PUT',
    body: { completed: true },
  });
  expect(within(panel).getByText('기한 확인')).toBeInTheDocument();
  await waitFor(() =>
    expect(within(panel).getByRole('heading', { name: '직접 할 일' })).toHaveFocus(),
  );
  fireEvent.keyDown(panel, { key: 'Escape' });
  expect(await screen.findByRole('button', { name: '직접 할 일 알림 1건' })).toBeInTheDocument();
});

test('the last alert leaves the empty notice', async () => {
  openApp({ actions: [open] });
  const panel = await openPanel('직접 할 일 알림 1건');
  fireEvent.click(within(panel).getByRole('button', { name: "'기한 확인' 완료" }));
  expect(await within(panel).findByText('지금 직접 할 일이 없습니다.')).toBeInTheDocument();
});

test('a completion in progress cannot be sent twice', async () => {
  let release = () => {};
  const completeHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = openApp({ actions: [open], completeHold });
  const panel = await openPanel('직접 할 일 알림 1건');
  const button = within(panel).getByRole('button', { name: "'기한 확인' 완료" });
  fireEvent.click(button);
  await waitFor(() => expect(button).toBeDisabled());
  fireEvent.click(button);
  release();
  await within(panel).findByText('지금 직접 할 일이 없습니다.');
  expect(api.sent.filter((item) => item.path.endsWith('/completion'))).toHaveLength(1);
});

test('a failed completion keeps the alert and says why', async () => {
  openApp({ actions: [open], completeFails: true });
  const panel = await openPanel('직접 할 일 알림 1건');
  const button = within(panel).getByRole('button', { name: "'기한 확인' 완료" });
  fireEvent.click(button);
  expect(await screen.findByText('저장 서버 오류')).toBeInTheDocument();
  expect(within(panel).getByText('기한 확인')).toBeInTheDocument();
  await waitFor(() => expect(button).toBeEnabled());
});

test('a completed alert stays gone even if reloading the list fails', async () => {
  openApp({ actions: [register, open], reloadFails: true });
  const panel = await openPanel('직접 할 일 알림 2건');
  fireEvent.click(within(panel).getByRole('button', { name: "'기한 확인' 완료" }));
  expect(await within(panel).findByText('알림 서버 오류')).toBeInTheDocument();
  expect(within(panel).queryByText('기한 확인')).not.toBeInTheDocument();
  expect(within(panel).getByText('실기 1회 접수')).toBeInTheDocument();
});

test('a failed list says so in the panel, and the rest of the app still works', async () => {
  openApp({ listFails: true });
  expect(await screen.findByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument();
  const panel = await openPanel('직접 할 일 알림');
  expect(await within(panel).findByText('알림 서버 오류')).toBeInTheDocument();
});

test('large counts stay short on the badge', () => {
  expect(alertCount(1)).toBe('1');
  expect(alertCount(99)).toBe('99');
  expect(alertCount(100)).toBe('99+');
});
