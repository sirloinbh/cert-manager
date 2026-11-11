import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';

const json = (body: object, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

// /api/health answers with the given body; the dashboard's lists are empty.
const health = (body: object, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      path === '/api/health'
        ? json(body, status)
        : json({
            today: '2026-10-26',
            certifications: [],
            attempts: [],
            tasks: [],
            actions: [],
            words: [],
          }),
    ),
  );

test('shows the server date from /api/health on the overview', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(await screen.findByText('Server connected · 2026-10-26')).toBeInTheDocument();
});

test('shows the service name in the header link home', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  expect(screen.getByRole('link', { name: 'Cert Manager' })).toHaveAttribute('href', '/');
  expect(await screen.findByText('Server connected · 2026-10-26')).toBeInTheDocument();
});

test('reports a server error as an alert', async () => {
  health({ error: 'Could not connect to the database' }, 503);
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect to the database');
});

test('the main menu lists the five areas in order', () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  expect(
    within(menu)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Dashboard', 'Certifications', 'Song lyrics', 'Vocabulary', 'Settings']);
});

test('each page has its own address and is marked in the main menu', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Settings' }));
  expect(window.location.pathname).toBe('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('menu areas without features yet show the empty notice', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Settings' }));
  expect(window.location.pathname).toBe('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  const notice = screen.getByRole('heading', { name: 'No features yet' });
  // Korean words stay whole when the notice wraps on a phone.
  expect(notice.closest('[data-slot="empty-state"]')).toHaveClass('break-keep');
});

test('an unknown address falls back to the overview', async () => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', '/no-such-page');
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});
