import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { Toaster } from './components/ui/sonner';
import { DailyWords } from './daily-words';
import type { DailyWord, DailyWordsDay } from './word-data';

const paths = { list: '/words', detail: (id: number) => `/words/${id}` };

const filled: DailyWord = {
  id: 1,
  lemma: 'export',
  rank: 10,
  partOfSpeech: '동사',
  meaningKo: '수출하다',
  exampleEn: 'They export tea.',
  exampleKo: '그들은 차를 수출한다.',
  aiGenerated: true,
  etymologySource: 'From a made-up source.',
  etymologyUrl: 'https://en.wiktionary.org/wiki/export',
  learnedAt: null,
};

const unfilled: DailyWord = {
  ...filled,
  id: 2,
  lemma: 'transport',
  rank: 11,
  partOfSpeech: null,
  meaningKo: null,
  exampleEn: null,
  exampleKo: null,
  aiGenerated: false,
  etymologySource: '',
  etymologyUrl: '',
};

const todayAnswer: DailyWordsDay = {
  today: '2026-11-02',
  day: '2026-11-02',
  previousDay: '2026-11-01',
  nextDay: null,
  words: [filled, unfilled],
  sources: [],
};

const yesterday: DailyWordsDay = {
  ...todayAnswer,
  day: '2026-11-01',
  previousDay: null,
  nextDay: '2026-11-02',
  words: [{ ...unfilled, id: 3, lemma: 'carry', learnedAt: '2026-11-01T01:00:00Z' }],
};

const json = (body: object, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function serve(save: () => Promise<Response> = () => json({ word: {} })) {
  const fetcher = vi.fn((path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return save();
    return json(path.includes('2026-11-01') ? yesterday : todayAnswer);
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
      <Toaster />
    </MemoryRouter>,
  );
  return fetcher;
}

test('the words show with the meaning folded, and each links to the word', async () => {
  serve();
  const link = await screen.findByRole('link', { name: 'export' });
  expect(link).toHaveAttribute('href', '/words/1');
  const details = link.closest('li')?.querySelector('details');
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(within(details as HTMLElement).getByText('Meaning and etymology'));
  expect(details).toHaveAttribute('open');
  expect(within(details as HTMLElement).getByText('수출하다')).toBeInTheDocument();
  expect(within(details as HTMLElement).getByText('From a made-up source.')).toBeInTheDocument();
});

test('a word not filled in yet says so', async () => {
  serve();
  const link = await screen.findByRole('link', { name: 'transport' });
  const item = within(link.closest('li') as HTMLElement);
  expect(item.getByText('The meaning and example are not filled in yet.')).toBeInTheDocument();
  expect(item.getByText('No etymology data')).toBeInTheDocument();
});

test('marking a word learned saves it, and it can be undone', async () => {
  const fetcher = serve();
  const button = await screen.findByRole('button', { name: 'Mark export as learned' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
  expect(fetcher).toHaveBeenLastCalledWith('/api/words/1/learned', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ learned: true }),
  });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
});

test('a failed save says so and leaves the word as it was', async () => {
  serve(() => json({ error: 'Database error' }, 500));
  const button = await screen.findByRole('button', { name: 'Mark export as learned' });
  fireEvent.click(button);
  expect(await screen.findByText('Database error')).toBeInTheDocument();
  expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('the arrows move through the earlier days and back to today', async () => {
  const fetcher = serve();
  await screen.findByRole('link', { name: 'export' });
  expect(screen.getByRole('button', { name: 'Next day’s words' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Previous day’s words' }));
  expect(await screen.findByRole('link', { name: 'carry' })).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledWith('/api/daily-words?day=2026-11-01', expect.anything());
  expect(screen.getByRole('status')).toHaveTextContent('Words for November 1, 2026');
  expect(screen.getByRole('button', { name: 'Mark carry as learned' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Previous day’s words' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next day’s words' }));
  expect(await screen.findByRole('link', { name: 'export' })).toBeInTheDocument();
  expect(fetcher).toHaveBeenLastCalledWith('/api/daily-words', expect.anything());
  expect(screen.getByRole('status')).toHaveTextContent('November 2, 2026');
});

test('no words gets a notice instead of an empty card', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ ...todayAnswer, previousDay: null, words: [] })),
  );
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
    </MemoryRouter>,
  );
  expect(await screen.findByText(/No words to show/)).toBeInTheDocument();
});

test('a failed load says so', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ error: 'Could not connect to the database' }, 503)),
  );
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Could not connect to the database')).toBeInTheDocument();
});

test('a word not looked up yet is not called one without a source', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ ...todayAnswer, words: [{ ...unfilled, etymologySource: null }] })),
  );
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
    </MemoryRouter>,
  );
  expect(await screen.findByText('The etymology has not been looked up yet.')).toBeInTheDocument();
  expect(screen.queryByText('No etymology data')).not.toBeInTheDocument();
});

test('a failed move says so, keeps the words, and the same arrow tries again', async () => {
  let fail = true;
  const fetcher = vi.fn((path: string) => {
    if (!path.includes('2026-11-01')) return json(todayAnswer);
    return fail ? json({ error: 'Temporarily unavailable' }, 503) : json(yesterday);
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: 'export' });
  const previous = screen.getByRole('button', { name: 'Previous day’s words' });
  fireEvent.click(previous);
  expect(await screen.findByText('Temporarily unavailable')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'export' })).toBeInTheDocument();
  fail = false;
  fireEvent.click(previous);
  expect(await screen.findByRole('link', { name: 'carry' })).toBeInTheDocument();
  expect(screen.queryByText('Temporarily unavailable')).not.toBeInTheDocument();
});

test('coming back after midnight in Seoul asks for the new day; the same day does not', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-11-02T14:59:00Z'));
    const fetcher = serve();
    await screen.findByRole('link', { name: 'export' });
    const asked = fetcher.mock.calls.length;
    fireEvent.focus(window);
    expect(fetcher).toHaveBeenCalledTimes(asked);
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z'));
    fireEvent.focus(window);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(asked + 1));
    expect(fetcher).toHaveBeenLastCalledWith('/api/daily-words', expect.anything());
  } finally {
    vi.useRealTimers();
  }
});

test('the arrow at the first day keeps its focus and does nothing', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ ...todayAnswer, previousDay: null })),
  );
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: 'export' });
  const previous = screen.getByRole('button', { name: 'Previous day’s words' });
  previous.focus();
  fireEvent.click(previous);
  expect(previous).toHaveFocus();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('after a failed move, the new day still brings today and not the day that failed', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-11-02T14:59:00Z'));
    const fetcher = vi.fn((path: string) =>
      path.includes('2026-11-01')
        ? json({ error: 'Temporarily unavailable' }, 503)
        : json(todayAnswer),
    );
    vi.stubGlobal('fetch', fetcher);
    render(
      <MemoryRouter>
        <DailyWords paths={paths} />
      </MemoryRouter>,
    );
    await screen.findByRole('link', { name: 'export' });
    fireEvent.click(screen.getByRole('button', { name: 'Previous day’s words' }));
    await screen.findByText('Temporarily unavailable');
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z'));
    fireEvent.focus(window);
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith('/api/daily-words', expect.anything()),
    );
  } finally {
    vi.useRealTimers();
  }
});
