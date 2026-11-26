import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { Toaster } from './components/ui/sonner';
import type { DueWords } from './word-data';
import { DueWordsCard, ReviewButtons } from './word-review';

const paths = { list: '/words', detail: (id: number) => `/words/${id}` };

const due: DueWords = {
  today: '2026-11-27',
  day: '2026-11-27',
  count: 2,
  words: [
    {
      id: 1,
      lemma: 'export',
      rank: 10,
      partOfSpeech: null,
      meaningKo: '수출하다',
      step: 1,
      nextReviewOn: '2026-11-26',
      lastAnswer: 'know',
    },
    {
      id: 2,
      lemma: 'carry',
      rank: 11,
      partOfSpeech: null,
      meaningKo: null,
      step: 0,
      nextReviewOn: '2026-11-27',
      lastAnswer: 'dontKnow',
    },
  ],
};

const json = (body: object, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

test('the dashboard card shows how many words are due and removes an answered word', async () => {
  let answered = false;
  const fetcher = vi.fn((_path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      answered = true;
      return json({ review: {} });
    }
    // Once answered, the word is no longer due.
    return json(answered ? { ...due, count: 1, words: due.words.slice(1) } : due);
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter>
      <DueWordsCard paths={paths} />
    </MemoryRouter>,
  );
  expect(await screen.findByText('2 words to review')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Don’t know: export' }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      '/api/words/1/review',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ answer: 'dontKnow' }) }),
    ),
  );
  await waitFor(() => expect(screen.queryByRole('link', { name: 'export' })).toBeNull());
  expect(screen.getByText('1 word to review')).toBeTruthy();
});

test('an empty list says nothing is due', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ ...due, count: 0, words: [] })),
  );
  render(
    <MemoryRouter>
      <DueWordsCard paths={paths} />
    </MemoryRouter>,
  );
  expect(await screen.findByText('0 words to review')).toBeTruthy();
  expect(screen.getByText(/Nothing to review today/)).toBeTruthy();
});

test('each button sends its own answer and a failure is shown', async () => {
  const fetcher = vi.fn(() => json({ error: 'Word not found' }, 404));
  vi.stubGlobal('fetch', fetcher);
  render(
    <>
      <ReviewButtons id={5} lemma="port" />
      <Toaster />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Unsure: port' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(String((fetcher.mock.calls[0] as unknown[])[0])).toBe('/api/words/5/review');
  expect(await screen.findByText('Word not found')).toBeTruthy();
});
