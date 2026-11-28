import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';

const json = (body: object, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

// /api/health answers with the given body; every list is empty.
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
            goals: [],
          }),
    ),
  );

test('shows the server date from /api/health on the Today page', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
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

test('the main menu runs Today, the other areas, Dashboard and Settings, with no Week or 12 weeks item', () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  expect(
    within(menu)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Today', 'Certifications', 'Song lyrics', 'Vocabulary', 'Dashboard', 'Settings']);
});

test('each page has its own address and is marked in the main menu', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  for (const [label, path] of [
    ['Dashboard', '/dashboard'],
    ['Settings', '/settings'],
  ]) {
    fireEvent.click(within(menu).getByRole('link', { name: label }));
    expect(window.location.pathname).toBe(path);
    expect(await screen.findByRole('heading', { level: 1, name: label })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
});

test('the Settings page offers the data export', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Settings' }));
  expect(window.location.pathname).toBe('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Export data (JSON)' })).toHaveAttribute(
    'href',
    '/api/data-transfer/export',
  );
});

test('an unknown address falls back to the Today page', async () => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', '/no-such-page');
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});

test.each([
  ['/week', '/dashboard?view=week', 'Week'],
  ['/weeks', '/dashboard?view=12weeks', '12 weeks'],
])('the old address %s opens the Dashboard on that view (#244)', async (from, to, view) => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', from);
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(window.location.pathname + window.location.search).toBe(to);
  expect(screen.getByRole('radio', { name: view })).toBeChecked();
});
