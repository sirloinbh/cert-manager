import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import {
  durationText,
  linesAsText,
  searchAlbums,
  type Song,
  type SongAlbum,
  textLineCount,
  translationProgress,
} from './song-data';

// All lyrics here are made up for the test.

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

afterEach(() => {
  toast.dismiss();
});

const albums: SongAlbum[] = [
  {
    id: 1,
    title: '첫 앨범',
    kind: 'studio',
    releaseDate: '2006-10-24',
    tracks: [
      { songId: 10, trackNumber: 1, title: 'Morning Rain', status: 'translated' },
      { songId: 11, trackNumber: 2, title: 'Paper Boats', status: 'untranslated' },
    ],
  },
  {
    id: 2,
    title: '둘째 앨범',
    kind: 'taylors_version',
    releaseDate: null,
    tracks: [
      { songId: 10, trackNumber: 3, title: 'Morning Rain', status: 'translated' },
      { songId: 12, trackNumber: 4, title: 'Quiet Road', status: 'none' },
    ],
  },
];

const empty: Song = {
  id: 12,
  title: 'Quiet Road',
  artistName: '가수',
  durationSeconds: 185,
  lyricsSource: null,
  lyricsSourceUrl: null,
  note: '',
  status: 'none',
  albums: [{ id: 2, title: '둘째 앨범', trackNumber: 4 }],
  lines: [],
};

const withLyrics: Song = {
  ...empty,
  status: 'untranslated',
  lyricsSource: 'manual',
  lyricsSourceUrl: '',
  lines: [
    { lineNumber: 1, original: 'The road is quiet', translation: null },
    { lineNumber: 2, original: '', translation: null },
    { lineNumber: 3, original: 'I walk alone', translation: null },
  ],
};

const translated: Song = {
  ...withLyrics,
  status: 'translated',
  lines: [
    { lineNumber: 1, original: 'The road is quiet', translation: '길은 조용하다' },
    { lineNumber: 2, original: '', translation: null },
    { lineNumber: 3, original: 'I walk alone', translation: '나는 혼자 걷는다' },
  ],
};

type Sent = { method: string; path: string; body?: Record<string, string> };

function fakeApi(
  options: {
    albums?: SongAlbum[];
    song?: Song;
    listFails?: boolean;
    missing?: boolean;
    saveError?: string;
    saved?: Song;
    // Saving waits for this.
    saveGate?: Promise<void>;
  } = {},
) {
  const sent: Sent[] = [];
  const reply = (status: number, body?: object) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      sent.push({
        method,
        path,
        body:
          init.body === undefined ? undefined : (JSON.parse(init.body) as Record<string, string>),
      });
      if (path === '/api/health') return reply(200, { ok: true, today: '2026-10-31' });
      if (path === '/api/user-actions') return reply(200, { today: '2026-10-31', actions: [] });
      if (path === '/api/songs')
        return options.listFails
          ? reply(500, { error: 'List server error' })
          : reply(200, { albums: options.albums ?? albums });
      if (method === 'PUT')
        return (options.saveGate ?? Promise.resolve()).then(() =>
          options.saveError
            ? reply(400, { error: options.saveError })
            : reply(200, { song: options.saved ?? translated }),
        );
      if (options.missing) return reply(404, { error: 'Song not found' });
      return reply(200, { song: options.song ?? withLyrics });
    }),
  );
  return { sent };
}

const open = (path: string, options?: Parameters<typeof fakeApi>[0]) => {
  const api = fakeApi(options);
  window.history.pushState({}, '', path);
  render(<App />);
  return api;
};

test('search matches titles ignoring case, and drops albums with no match', () => {
  expect(searchAlbums(albums, ' ROAD ').map((album) => album.id)).toEqual([2]);
  expect(searchAlbums(albums, 'morning').flatMap((album) => album.tracks)).toHaveLength(2);
  expect(searchAlbums(albums, '없는 곡')).toEqual([]);
  expect(searchAlbums(albums, '  ')).toBe(albums);
});

test('a typed apostrophe finds a title with a curly one, and the other way round', () => {
  const curly: SongAlbum[] = [
    {
      ...albums[0],
      tracks: [{ songId: 1, trackNumber: 1, title: 'Don’t Wait', status: 'none' }],
    },
  ];
  expect(searchAlbums(curly, "don't")).toHaveLength(1);
  expect(searchAlbums(curly, 'don’t')).toHaveLength(1);
});

test('progress counts a song on two albums once', () => {
  expect(translationProgress(albums)).toEqual({ total: 3, withLyrics: 2, translated: 1 });
});

test('text helpers count lines with text and keep blank lines', () => {
  expect(textLineCount('하나\r\n\r\n둘\n  \n셋')).toBe(3);
  expect(linesAsText(translated.lines, 'translation')).toBe('길은 조용하다\n\n나는 혼자 걷는다');
  expect(linesAsText(withLyrics.lines, 'original')).toBe('The road is quiet\n\nI walk alone');
  expect(durationText(185)).toBe('3:05');
  expect(durationText(null)).toBe('');
});

test('the list shows albums, tracks with status, links and progress', async () => {
  open('/songs');
  const first = await screen.findByRole('region', { name: /첫 앨범/ });
  const rows = within(first).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('Morning Rain');
  expect(rows[0]).toHaveTextContent('Translated');
  expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/songs/10');
  expect(rows[1]).toHaveTextContent('Not translated');
  expect(screen.getByText('3 songs · 2 with lyrics · 1 translated')).toBeInTheDocument();
});

test('searching narrows the list and says when nothing matches', async () => {
  open('/songs');
  const search = await screen.findByLabelText('Search songs');
  fireEvent.change(search, { target: { value: 'quiet' } });
  expect(screen.getByText('Quiet Road')).toBeInTheDocument();
  expect(screen.queryByText('Paper Boats')).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: '없는 곡' } });
  expect(screen.getByText(/No songs match/)).toBeInTheDocument();
});

test('coming back from a song finds the same search', async () => {
  open('/songs');
  fireEvent.change(await screen.findByLabelText('Search songs'), { target: { value: 'quiet' } });
  expect(window.location.search).toBe('?q=quiet');
  fireEvent.click(screen.getByRole('link', { name: /Quiet Road/ }));
  fireEvent.click(await screen.findByRole('link', { name: 'Song list' }));
  expect(await screen.findByLabelText('Search songs')).toHaveValue('quiet');
  expect(screen.queryByText('Paper Boats')).not.toBeInTheDocument();
});

test('an empty list explains itself', async () => {
  open('/songs', { albums: [] });
  expect(await screen.findByText('No song list yet')).toBeInTheDocument();
  expect(screen.queryByLabelText('Search songs')).not.toBeInTheDocument();
});

test('a failed list shows the reason', async () => {
  open('/songs', { listFails: true });
  expect(await screen.findByText('List server error')).toBeInTheDocument();
});

test('a song without lyrics offers to paste them, and not a translation', async () => {
  open('/songs/12', { song: empty });
  expect(await screen.findByText('No lyrics yet')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Quiet Road' })).toBeInTheDocument();
  expect(screen.getByText('가수 · 둘째 앨범 · 3:05')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Paste lyrics' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Paste translation' })).not.toBeInTheDocument();
});

test('lines show the original and translation together, with blank lines between verses', async () => {
  open('/songs/12', { song: translated });
  const line = (await screen.findByText('The road is quiet')).closest('li') as HTMLElement;
  expect(within(line).getByText('길은 조용하다')).toBeInTheDocument();
  const items = within(line.parentElement as HTMLElement).getAllByRole('listitem', {
    hidden: true,
  });
  expect(items).toHaveLength(3);
  expect(items[1]).toHaveAttribute('aria-hidden', 'true');
  expect(items[2]).toHaveTextContent('나는 혼자 걷는다');
});

test('a line not yet translated is marked for screen readers', async () => {
  open('/songs/12');
  const line = (await screen.findByText('I walk alone')).closest('li') as HTMLElement;
  expect(within(line).getByText('No translation')).toHaveClass('sr-only');
});

test('pasting lyrics saves them and shows the lines right away', async () => {
  const api = open('/songs/12', { song: empty, saved: withLyrics });
  fireEvent.click(await screen.findByRole('button', { name: 'Paste lyrics' }));
  fireEvent.change(await screen.findByLabelText('Original lyrics'), {
    target: { value: 'The road is quiet\n\nI walk alone' },
  });
  expect(screen.getByText(/^2 lines\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('The road is quiet')).toBeInTheDocument();
  expect(api.sent.find((item) => item.method === 'PUT')).toEqual({
    method: 'PUT',
    path: '/api/songs/12/lyrics',
    body: { original: 'The road is quiet\n\nI walk alone' },
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Paste translation' })).toBeInTheDocument();
});

test('pasting a translation counts lines against the original and saves it', async () => {
  const api = open('/songs/12', { saved: translated });
  fireEvent.click(await screen.findByRole('button', { name: 'Paste translation' }));
  const field = await screen.findByLabelText('Korean translation');
  fireEvent.change(field, { target: { value: '길은 조용하다\n나는 혼자 걷는다' } });
  expect(
    screen.getByText(/Write one line per original line \(2\).*Currently 2 lines/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('길은 조용하다')).toBeInTheDocument();
  expect(api.sent.find((item) => item.method === 'PUT')).toMatchObject({
    path: '/api/songs/12/translation',
    body: { translation: '길은 조용하다\n나는 혼자 걷는다' },
  });
});

test('a rejected translation stays in the form with the reason', async () => {
  open('/songs/12', { saveError: 'The translation has 1 lines but the original has 2' });
  fireEvent.click(await screen.findByRole('button', { name: 'Paste translation' }));
  fireEvent.change(await screen.findByLabelText('Korean translation'), {
    target: { value: '한 줄' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The translation has 1 lines');
  expect(screen.getByRole('dialog', { name: 'Paste translation' })).toBeInTheDocument();
  expect(screen.getByLabelText('Korean translation')).toHaveValue('한 줄');
  await settle();
});

test('closing the form puts focus back on the button that opened it', async () => {
  open('/songs/12');
  const opener = await screen.findByRole('button', { name: 'Paste translation' });
  fireEvent.click(opener);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(opener).toHaveFocus());
});

test('nothing closes the form while it saves', async () => {
  let finish = () => {};
  const saveGate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  open('/songs/12', { saveGate });
  fireEvent.click(await screen.findByRole('button', { name: 'Paste translation' }));
  fireEvent.change(await screen.findByLabelText('Korean translation'), {
    target: { value: '길은 조용하다\n나는 혼자 걷는다' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled());
  expect(screen.getByLabelText('Korean translation')).toHaveAttribute('readonly');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  finish();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('길은 조용하다')).toBeInTheDocument();
});

test('Esc keeps a form with typed text, and closes an untouched one', async () => {
  open('/songs/12');
  fireEvent.click(await screen.findByRole('button', { name: 'Paste translation' }));
  const field = await screen.findByLabelText('Korean translation');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Paste translation' }));
  fireEvent.change(await screen.findByLabelText('Korean translation'), {
    target: { value: '쓰던 번역' },
  });
  expect(field).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await settle();
  expect(screen.getByLabelText('Korean translation')).toHaveValue('쓰던 번역');
  // The form's own buttons still close it.
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('moving to another song does not carry an open form along', async () => {
  open('/songs/12');
  fireEvent.click(await screen.findByRole('button', { name: 'Paste translation' }));
  await screen.findByLabelText('Korean translation');
  act(() => {
    window.history.pushState({}, '', '/songs/13');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByRole('button', { name: 'Paste translation' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a missing song says so', async () => {
  open('/songs/99', { missing: true });
  expect(await screen.findByText('Song not found.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Song list' })).toHaveAttribute('href', '/songs');
});

test('an LRCLIB song links to its source', async () => {
  open('/songs/12', {
    song: {
      ...withLyrics,
      lyricsSource: 'lrclib',
      lyricsSourceUrl: 'https://lrclib.net/api/get/1',
    },
  });
  expect(await screen.findByRole('link', { name: 'Lyrics source: LRCLIB' })).toHaveAttribute(
    'href',
    'https://lrclib.net/api/get/1',
  );
});
