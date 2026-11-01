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
  fireEvent.click(within(details as HTMLElement).getByText('뜻과 어원'));
  expect(details).toHaveAttribute('open');
  expect(within(details as HTMLElement).getByText('수출하다')).toBeInTheDocument();
  expect(within(details as HTMLElement).getByText('From a made-up source.')).toBeInTheDocument();
});

test('a word not filled in yet says so', async () => {
  serve();
  const link = await screen.findByRole('link', { name: 'transport' });
  const item = within(link.closest('li') as HTMLElement);
  expect(item.getByText('아직 뜻과 예문을 채우지 않았습니다.')).toBeInTheDocument();
  expect(item.getByText('어원 자료 없음')).toBeInTheDocument();
});

test('marking a word learned saves it, and it can be undone', async () => {
  const fetcher = serve();
  const button = await screen.findByRole('button', { name: 'export 외웠어요' });
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
  serve(() => json({ error: '데이터베이스 오류' }, 500));
  const button = await screen.findByRole('button', { name: 'export 외웠어요' });
  fireEvent.click(button);
  expect(await screen.findByText('데이터베이스 오류')).toBeInTheDocument();
  expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('the arrows move through the earlier days and back to today', async () => {
  const fetcher = serve();
  await screen.findByRole('link', { name: 'export' });
  expect(screen.getByRole('button', { name: '다음 날의 단어' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '이전 날의 단어' }));
  expect(await screen.findByRole('link', { name: 'carry' })).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledWith('/api/daily-words?day=2026-11-01', expect.anything());
  expect(screen.getByRole('status')).toHaveTextContent('2026-11-01의 단어');
  expect(screen.getByRole('button', { name: 'carry 외웠어요' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: '이전 날의 단어' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '다음 날의 단어' }));
  expect(await screen.findByRole('link', { name: 'export' })).toBeInTheDocument();
  expect(fetcher).toHaveBeenLastCalledWith('/api/daily-words', expect.anything());
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
  expect(await screen.findByText(/보여 줄 단어가 없습니다/)).toBeInTheDocument();
});

test('a failed load says so', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ error: '데이터베이스에 연결할 수 없습니다' }, 503)),
  );
  render(
    <MemoryRouter>
      <DailyWords paths={paths} />
    </MemoryRouter>,
  );
  expect(await screen.findByText('데이터베이스에 연결할 수 없습니다')).toBeInTheDocument();
});
