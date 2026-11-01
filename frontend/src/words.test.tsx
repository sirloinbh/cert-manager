import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { morphemeForm, searchWords, type Word, type WordRow, type WordSource } from './word-data';

const rows: WordRow[] = [
  { id: 1, lemma: 'the', rank: 1, partOfSpeech: '관사', meaningKo: '그' },
  { id: 2, lemma: 'export', rank: 2, partOfSpeech: '동사', meaningKo: '수출하다' },
  { id: 3, lemma: 'transport', rank: 3, partOfSpeech: null, meaningKo: null },
];

const manyRows: WordRow[] = Array.from({ length: 250 }, (_, index) => ({
  id: index + 1,
  lemma: `word${index + 1}`,
  rank: index + 1,
  partOfSpeech: null,
  meaningKo: null,
}));

const sources: WordSource[] = [
  { kind: 'ngsl', url: 'https://x', license: 'CC BY-SA 4.0', fetchedAt: '2026-11-01T00:00:00Z' },
  {
    kind: 'wiktionary',
    url: 'https://x',
    license: 'CC BY-SA 4.0',
    fetchedAt: '2026-11-01T00:00:00Z',
  },
];

const word: Word = {
  ...rows[1],
  exampleEn: 'They export tea.',
  exampleKo: '그들은 차를 수출한다.',
  aiGenerated: true,
  etymologySource: 'From a made-up source.',
  etymologyUrl: 'https://en.wiktionary.org/wiki/export',
  morphemes: [
    {
      id: 7,
      key: 'prefix:ex',
      form: 'ex',
      kind: 'prefix',
      meaningKo: '밖으로',
      origin: null,
      words: [],
    },
    {
      id: 8,
      key: 'root:port',
      form: 'port',
      kind: 'root',
      meaningKo: '나르다',
      origin: '라틴어',
      words: [{ id: 3, lemma: 'transport', meaningKo: '수송하다' }],
    },
  ],
};

function open(
  path: string,
  options: { words?: WordRow[]; word?: Word; failed?: boolean; missing?: boolean } = {},
) {
  const reply = (status: number, body: object) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/health') return reply(200, { ok: true, today: '2026-11-01' });
      if (url === '/api/user-actions') return reply(200, { today: '2026-11-01', actions: [] });
      if (url === '/api/words') {
        return options.failed
          ? reply(500, { error: '단어 서버 오류' })
          : reply(200, { words: options.words ?? rows, sources });
      }
      if (options.missing) return reply(404, { error: '단어를 찾을 수 없습니다' });
      const id = Number(url.split('/').pop());
      return reply(200, { word: { ...(options.word ?? word), id }, sources });
    }),
  );
  window.history.pushState({}, '', path);
  render(<App />);
}

const wordItems = () =>
  within(screen.getByRole('region', { name: '단어장' })).getAllByRole('listitem');

test('search matches spelling and Korean meaning', () => {
  expect(searchWords(rows, ' EXPORT ').map((row) => row.id)).toEqual([2]);
  expect(searchWords(rows, '수출').map((row) => row.id)).toEqual([2]);
  expect(searchWords(rows, '없는 단어')).toEqual([]);
  expect(searchWords(rows, ' ')).toBe(rows);
});

test('a word part is written with its hyphen', () => {
  expect(morphemeForm({ form: 'ex', kind: 'prefix' })).toBe('ex-');
  expect(morphemeForm({ form: 'port', kind: 'root' })).toBe('port');
  expect(morphemeForm({ form: 'tion', kind: 'suffix' })).toBe('-tion');
});

test('the list shows words by frequency with their sources', async () => {
  open('/words');
  await screen.findByLabelText('단어 검색');
  const items = wordItems();
  expect(items[0]).toHaveTextContent('the');
  expect(items[1]).toHaveTextContent('수출하다');
  expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/words/2');
  expect(items[2]).toHaveTextContent('뜻 아직 없음');
  expect(screen.getByText('3단어 · 뜻 2단어')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'NGSL 1.2' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wiktionary' })).toBeInTheDocument();
  expect(screen.getByText(/Browne, Culligan, Phillips/)).toHaveTextContent('CC BY-SA 4.0');
});

test('long lists come in pages, and a search starts over', async () => {
  open('/words', { words: manyRows });
  const more = await screen.findByRole('button', { name: /더 보기 \(150단어 남음\)/ });
  expect(wordItems()).toHaveLength(100);
  fireEvent.click(more);
  expect(wordItems()).toHaveLength(200);
  fireEvent.change(screen.getByLabelText('단어 검색'), { target: { value: 'word1' } });
  expect(wordItems()).toHaveLength(100);
  expect(screen.getByRole('button', { name: /더 보기 \(11단어 남음\)/ })).toBeInTheDocument();
});

test('coming back from a word finds the same search, and no match says so', async () => {
  open('/words');
  const search = await screen.findByLabelText('단어 검색');
  fireEvent.change(search, { target: { value: '없는 단어' } });
  expect(screen.getByText(/없는 단어.*들어간 단어가 없습니다/)).toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'export' } });
  expect(window.location.search).toBe('?q=export');
  fireEvent.click(screen.getByRole('link', { name: /export/ }));
  fireEvent.click(await screen.findByRole('link', { name: '단어 목록' }));
  expect(await screen.findByLabelText('단어 검색')).toHaveValue('export');
  expect(screen.queryByText('the')).not.toBeInTheDocument();
});

test('an empty list explains itself, and a failed one says why', async () => {
  open('/words', { words: [] });
  expect(await screen.findByText('아직 단어가 없습니다')).toBeInTheDocument();
  expect(screen.queryByLabelText('단어 검색')).not.toBeInTheDocument();
});

test('a failed list shows the reason', async () => {
  open('/words', { failed: true });
  expect(await screen.findByText('단어 서버 오류')).toBeInTheDocument();
});

test('a word shows meaning, example, AI mark and sources', async () => {
  open('/words/2');
  expect(await screen.findByRole('heading', { level: 1, name: 'export' })).toBeInTheDocument();
  expect(screen.getByText('AI 정리')).toBeInTheDocument();
  expect(screen.getByText('빈도 2위 · 동사')).toBeInTheDocument();
  expect(screen.getByText('수출하다')).toBeInTheDocument();
  expect(screen.getByText('They export tea.')).toBeInTheDocument();
  expect(screen.getByText('그들은 차를 수출한다.')).toBeInTheDocument();
  expect(screen.getByText('From a made-up source.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wiktionary 항목 보기' })).toHaveAttribute(
    'href',
    'https://en.wiktionary.org/wiki/export',
  );
  expect(screen.getByRole('link', { name: 'NGSL 1.2' })).toBeInTheDocument();
});

test('pressing a word part shows the other words that have it', async () => {
  open('/words/2');
  const root = await screen.findByRole('button', { name: /port 나르다/ });
  expect(screen.queryByRole('link', { name: 'transport' })).not.toBeInTheDocument();
  fireEvent.click(root);
  expect(root).toHaveAttribute('aria-pressed', 'true');
  const shown = screen.getByRole('region', { name: 'port이(가) 들어간 단어' });
  expect(within(shown).getByRole('link', { name: 'transport' })).toHaveAttribute(
    'href',
    '/words/3',
  );
  expect(shown).toHaveTextContent('어근');
  expect(shown).toHaveTextContent('라틴어');
  fireEvent.click(screen.getByRole('button', { name: /ex- 밖으로/ }));
  expect(screen.getByText('아직 이 요소가 들어간 다른 단어가 없습니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /ex- 밖으로/ }));
  expect(
    screen.getByText('요소를 누르면 그 요소가 들어간 다른 단어가 보입니다.'),
  ).toBeInTheDocument();
});

test('moving to another word forgets the pressed part', async () => {
  open('/words/2');
  fireEvent.click(await screen.findByRole('button', { name: /port 나르다/ }));
  fireEvent.click(screen.getByRole('link', { name: 'transport' }));
  const next = await screen.findByRole('button', { name: /port 나르다/ });
  expect(next).toHaveAttribute('aria-pressed', 'false');
  expect(window.location.pathname).toBe('/words/3');
});

test('a word without anything filled in says so, and makes nothing up', async () => {
  open('/words/3', {
    word: {
      ...word,
      meaningKo: null,
      partOfSpeech: null,
      exampleEn: null,
      exampleKo: null,
      aiGenerated: false,
      etymologySource: null,
      etymologyUrl: null,
      morphemes: [],
    },
  });
  expect(await screen.findByText('아직 뜻과 예문을 채우지 않았습니다.')).toBeInTheDocument();
  expect(screen.getByText('아직 어원을 찾아보지 않았습니다.')).toBeInTheDocument();
  expect(screen.queryByText('AI 정리')).not.toBeInTheDocument();
});

test('a word with no etymology found says so', async () => {
  open('/words/3', { word: { ...word, etymologySource: '', etymologyUrl: '', morphemes: [] } });
  expect(await screen.findByText('어원 자료 없음')).toBeInTheDocument();
  expect(screen.queryByText('Wiktionary 어원 원문')).not.toBeInTheDocument();
});

test('a missing word says so', async () => {
  open('/words/99', { missing: true });
  expect(await screen.findByText('단어를 찾을 수 없습니다.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '단어 목록' })).toHaveAttribute('href', '/words');
});
