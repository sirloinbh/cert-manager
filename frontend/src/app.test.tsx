import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';

const json = (body: object, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

// /api/health answers with the given body; the dashboard's goal and attempt lists are empty.
const health = (body: object, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      path === '/api/health'
        ? json(body, status)
        : json({ today: '2026-10-26', certifications: [], attempts: [] }),
    ),
  );

test('shows the server date from /api/health on the overview', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument();
  expect(await screen.findByText('서버 연결됨 · 2026-10-26')).toBeInTheDocument();
});

test('shows the service name in the header link home', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  expect(screen.getByRole('link', { name: '자격증 관리' })).toHaveAttribute('href', '/');
  expect(await screen.findByText('서버 연결됨 · 2026-10-26')).toBeInTheDocument();
});

test('reports a server error as an alert', async () => {
  health({ error: '데이터베이스에 연결할 수 없습니다' }, 503);
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('데이터베이스에 연결할 수 없습니다');
});

test('the main menu lists the five areas in order', () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  expect(
    within(menu)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['대시보드', '자격증', '팝송 가사', '단어장', '설정']);
});

test('each page has its own address and is marked in the main menu', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '설정' }));
  expect(window.location.pathname).toBe('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: '설정' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: '설정' })).toHaveAttribute('aria-current', 'page');
});

test('menu areas without features yet show the empty notice', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  for (const [label, path] of [
    ['팝송 가사', '/songs'],
    ['단어장', '/words'],
  ]) {
    fireEvent.click(within(menu).getByRole('link', { name: label }));
    expect(window.location.pathname).toBe(path);
    expect(await screen.findByRole('heading', { level: 1, name: label })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '아직 기능이 없습니다' })).toBeInTheDocument();
  }
});

test('an unknown address falls back to the overview', async () => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', '/no-such-page');
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});
