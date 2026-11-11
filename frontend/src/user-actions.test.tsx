import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import { alertCount, type UserAction } from './user-action-data';

const today = '2027-03-08';

// Long enough for pending requests to answer and for sonner, which draws after a timeout, to show a toast.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

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
    /** Fails this many list requests, then answers. */
    listFailures?: number;
    /** Answers the list once, then fails. */
    reloadFails?: boolean;
    /** Answers the completion only once this settles. */
    completeHold?: Promise<unknown>;
    /** The alert was removed elsewhere: completing it is a 404 and it is gone from the list. */
    completeGone?: boolean;
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
        if (
          options.listFails ||
          (options.reloadFails && listed > 1) ||
          listed <= (options.listFailures ?? 0)
        )
          return reply(500, { error: 'Alert server error' });
        return reply(200, { today, actions });
      }
      const id = Number(/\/user-actions\/(\d+)\/completion$/.exec(path)?.[1]);
      if (id) {
        await options.completeHold;
        if (options.completeGone) {
          actions = actions.filter((item) => item.id !== id);
          return reply(404, { error: 'Custom task not found' });
        }
        if (options.completeFails) return reply(500, { error: 'Save server error' });
        const done = actions.find((item) => item.id === id);
        actions = actions.filter((item) => item.id !== id);
        return reply(200, { action: { ...done, completedAt: '2027-03-08T00:00:00Z' } });
      }
      return reply(200, { today, certifications: [], attempts: [], tasks: [], words: [] });
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
  return screen.findByRole('dialog', { name: 'Manual tasks' });
};

test('the bell counts what is waiting, and the panel shows the details', async () => {
  openApp({ actions: [register, open] });
  const panel = await openPanel('2 manual task alerts');
  const items = within(panel).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('실기 1회 접수');
  expect(items[0]).toHaveTextContent('응시일은 4월 안의 날로 고릅니다');
  expect(items[0]).toHaveTextContent('March 22, 2027 · 14 days left');
  expect(
    within(items[0]).getByRole('link', { name: "Open the link for '실기 1회 접수' (new tab)" }),
  ).toHaveAttribute('href', 'https://www.q-net.or.kr/');
  // No deadline and no page: only the title and the button.
  expect(within(items[1]).queryByRole('link')).not.toBeInTheDocument();
  expect(items[1]).not.toHaveTextContent('days left');
});

test('a passed deadline says so', async () => {
  openApp({ actions: [late] });
  const panel = await openPanel('1 manual task alerts');
  expect(within(panel).getByText(/7 days overdue/)).toBeInTheDocument();
});

test('waiting alerts are announced once when the app opens', async () => {
  openApp({ actions: [register, open] });
  expect(await screen.findByText('You have 2 manual tasks')).toBeInTheDocument();
});

test('with nothing waiting there is no count and no announcement', async () => {
  openApp();
  const panel = await openPanel('Manual task alerts');
  expect(within(panel).getByText('No manual tasks right now.')).toBeInTheDocument();
  await settle();
  expect(screen.queryByText(/You have \d+ manual tasks/)).not.toBeInTheDocument();
});

test('completing an alert lowers the count right away and moves focus to the title', async () => {
  const api = openApp({ actions: [register, open] });
  const panel = await openPanel('2 manual task alerts');
  fireEvent.click(within(panel).getByRole('button', { name: "Complete '실기 1회 접수'" }));
  await waitFor(() => expect(within(panel).queryByText('실기 1회 접수')).not.toBeInTheDocument());
  expect(api.sent.find((item) => item.path === '/api/user-actions/1/completion')).toMatchObject({
    method: 'PUT',
    body: { completed: true },
  });
  expect(within(panel).getByText('기한 확인')).toBeInTheDocument();
  await waitFor(() =>
    expect(within(panel).getByRole('heading', { name: 'Manual tasks' })).toHaveFocus(),
  );
  fireEvent.keyDown(panel, { key: 'Escape' });
  expect(await screen.findByRole('button', { name: '1 manual task alerts' })).toBeInTheDocument();
});

test('the last alert leaves the empty notice', async () => {
  openApp({ actions: [open] });
  const panel = await openPanel('1 manual task alerts');
  fireEvent.click(within(panel).getByRole('button', { name: "Complete '기한 확인'" }));
  expect(await within(panel).findByText('No manual tasks right now.')).toBeInTheDocument();
});

test('a completion in progress cannot be sent twice', async () => {
  let release = () => {};
  const completeHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = openApp({ actions: [open], completeHold });
  const panel = await openPanel('1 manual task alerts');
  const button = within(panel).getByRole('button', { name: "Complete '기한 확인'" });
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
  fireEvent.click(button);
  release();
  await within(panel).findByText('No manual tasks right now.');
  expect(api.sent.filter((item) => item.path.endsWith('/completion'))).toHaveLength(1);
});

test('a failed completion keeps the alert and says why', async () => {
  openApp({ actions: [open], completeFails: true });
  const panel = await openPanel('1 manual task alerts');
  const button = within(panel).getByRole('button', { name: "Complete '기한 확인'" });
  fireEvent.click(button);
  expect(await screen.findByText('Save server error')).toBeInTheDocument();
  expect(within(panel).getByText('기한 확인')).toBeInTheDocument();
  await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled'));
});

test('a completed alert stays gone even if reloading the list fails', async () => {
  openApp({ actions: [register, open], reloadFails: true });
  const panel = await openPanel('2 manual task alerts');
  fireEvent.click(within(panel).getByRole('button', { name: "Complete '기한 확인'" }));
  await waitFor(() => expect(within(panel).queryByText('기한 확인')).not.toBeInTheDocument());
  await within(panel).findByText('Alert server error');
  expect(within(panel).queryByText('기한 확인')).not.toBeInTheDocument();
  expect(within(panel).getByText('실기 1회 접수')).toBeInTheDocument();
});

test('a failed list says so in the panel, and the rest of the app still works', async () => {
  openApp({ listFails: true });
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  const panel = await openPanel('Could not load the manual task alerts');
  await within(panel).findByText('Alert server error');
});

test('large counts stay short on the badge', async () => {
  expect(alertCount(1)).toBe('1');
  expect(alertCount(99)).toBe('99');
  expect(alertCount(100)).toBe('99+');
  const many = Array.from({ length: 100 }, (_, index) =>
    action({ id: index + 1, title: `일 ${index}` }),
  );
  openApp({ actions: many });
  const bell = await screen.findByRole('button', { name: '100 manual task alerts' });
  expect(within(bell).getByText('99+')).toBeInTheDocument();
});

test('opening the panel and completing an alert do not announce again', async () => {
  openApp({ actions: [register, open] });
  await screen.findByText('You have 2 manual tasks');
  const panel = await openPanel('2 manual task alerts');
  await settle();
  fireEvent.click(within(panel).getByRole('button', { name: "Complete '기한 확인'" }));
  await screen.findByText('Marked as done');
  await settle();
  expect(screen.getAllByText(/You have \d+ manual tasks/)).toHaveLength(1);
});

test('a failed first load looks different from nothing to do, and a retry recovers', async () => {
  // The first load and the read when the panel opens both fail.
  openApp({ actions: [open], listFailures: 2 });
  const panel = await openPanel('Could not load the manual task alerts');
  await within(panel).findByText('Alert server error');
  expect(within(panel).queryByText('No manual tasks right now.')).not.toBeInTheDocument();
  await settle();
  const retry = within(panel).getByRole('button', { name: 'Reload' });
  retry.focus();
  fireEvent.click(retry);
  expect(await within(panel).findByText('기한 확인')).toBeInTheDocument();
  expect(within(panel).queryByText('Alert server error')).not.toBeInTheDocument();
  expect(within(panel).queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: '1 manual task alerts', hidden: true }),
  ).toBeInTheDocument();
});

test('the failure stays visible while reading again, and the retry button keeps its place', async () => {
  openApp({ listFails: true });
  const panel = await openPanel('Could not load the manual task alerts');
  await within(panel).findByText('Alert server error');
  await settle();
  const retry = within(panel).getByRole('button', { name: 'Reload' });
  retry.focus();
  fireEvent.click(retry);
  // Right after the click, before the answer.
  expect(within(panel).getByText('Alert server error')).toBeInTheDocument();
  expect(retry).toBeInTheDocument();
  expect(retry).toHaveFocus();
  await settle();
  expect(
    screen.getByRole('button', { name: 'Could not load the manual task alerts', hidden: true }),
  ).toBeInTheDocument();
});

test('a failed read after an empty list does not say there is nothing to do', async () => {
  openApp({ reloadFails: true });
  const panel = await openPanel('Manual task alerts');
  await within(panel).findByText('Alert server error');
  expect(within(panel).queryByText('No manual tasks right now.')).not.toBeInTheDocument();
});

test('opening the panel reads the list again', async () => {
  const api = openApp({ actions: [open] });
  await screen.findByRole('button', { name: '1 manual task alerts' });
  const before = api.sent.filter((item) => item.path === '/api/user-actions').length;
  await openPanel('1 manual task alerts');
  await waitFor(() =>
    expect(api.sent.filter((item) => item.path === '/api/user-actions').length).toBe(before + 1),
  );
});

test('coming back to the tab reads the list again', async () => {
  const api = openApp({ actions: [open] });
  await screen.findByRole('button', { name: '1 manual task alerts' });
  const before = api.sent.filter((item) => item.path === '/api/user-actions').length;
  document.dispatchEvent(new Event('visibilitychange'));
  await waitFor(() =>
    expect(api.sent.filter((item) => item.path === '/api/user-actions').length).toBe(before + 1),
  );
});

test('leaving the tab does not read the list', async () => {
  const api = openApp({ actions: [open] });
  await screen.findByRole('button', { name: '1 manual task alerts' });
  const before = api.sent.filter((item) => item.path === '/api/user-actions').length;
  const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  await settle();
  hidden.mockRestore();
  expect(api.sent.filter((item) => item.path === '/api/user-actions')).toHaveLength(before);
});

test('an alert removed elsewhere goes away after its completion fails', async () => {
  openApp({ actions: [open, register], completeGone: true });
  const panel = await openPanel('2 manual task alerts');
  await settle();
  fireEvent.click(within(panel).getByRole('button', { name: "Complete '기한 확인'" }));
  await screen.findByText('Custom task not found');
  await waitFor(() => expect(within(panel).queryByText('기한 확인')).not.toBeInTheDocument());
  expect(within(panel).getByText('실기 1회 접수')).toBeInTheDocument();
});

test('one completion at a time: other rows wait too', async () => {
  let release = () => {};
  const completeHold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = openApp({ actions: [register, open], completeHold });
  const panel = await openPanel('2 manual task alerts');
  fireEvent.click(within(panel).getByRole('button', { name: "Complete '기한 확인'" }));
  const other = within(panel).getByRole('button', { name: "Complete '실기 1회 접수'" });
  await waitFor(() => expect(other).toHaveAttribute('aria-disabled', 'true'));
  fireEvent.click(other);
  release();
  await waitFor(() => expect(within(panel).queryByText('기한 확인')).not.toBeInTheDocument());
  expect(api.sent.filter((item) => item.path.endsWith('/completion'))).toHaveLength(1);
});
