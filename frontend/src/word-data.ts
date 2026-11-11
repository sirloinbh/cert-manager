import { requestJson } from './lib/api';

// Words and word parts (#36): API calls and display rules. The screens are in words.tsx.

export type WordRow = {
  id: number;
  lemma: string;
  rank: number;
  partOfSpeech: string | null;
  meaningKo: string | null;
};

export type WordSource = {
  kind: 'ngsl' | 'wiktionary';
  url: string;
  license: string | null;
  fetchedAt: string;
};

export type Morpheme = {
  id: number;
  key: string;
  form: string;
  kind: 'prefix' | 'root' | 'suffix';
  meaningKo: string;
  origin: string | null;
  words: { id: number; lemma: string; meaningKo: string | null }[];
};

export type Word = WordRow & {
  exampleEn: string | null;
  exampleKo: string | null;
  aiGenerated: boolean;
  etymologySource: string | null;
  etymologyUrl: string | null;
  morphemes: Morpheme[];
};

/** One of a day's words on the dashboard (#37). */
export type DailyWord = Omit<Word, 'morphemes'> & { learnedAt: string | null };

export type DailyWordsDay = {
  today: string;
  day: string;
  previousDay: string | null;
  nextDay: string | null;
  words: DailyWord[];
  sources: WordSource[];
};

export type WordPaths = {
  list: string;
  detail: (id: number) => string;
};

export const kindLabels: Record<Morpheme['kind'], string> = {
  prefix: 'Prefix',
  root: 'Root',
  suffix: 'Suffix',
};

/** How a word part is written: a prefix ends in a hyphen and a suffix starts with one. */
export function morphemeForm({ form, kind }: Pick<Morpheme, 'form' | 'kind'>) {
  if (kind === 'prefix') return `${form}-`;
  return kind === 'suffix' ? `-${form}` : form;
}

/** Words whose spelling or Korean meaning holds the search words. */
export function searchWords(words: WordRow[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return words;
  return words.filter(
    (word) => word.lemma.toLocaleLowerCase().includes(query) || word.meaningKo?.includes(query),
  );
}

/** Whether a word is learned, with what was changed on the screen since it loaded. */
export function isLearned(
  word: Pick<DailyWord, 'id' | 'learnedAt'>,
  changed: Record<number, boolean>,
) {
  return changed[word.id] ?? word.learnedAt !== null;
}

/** Today in the service's time zone, to notice that the day on screen has ended. */
export function serviceToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const base = '/api/words';

export const wordApi = {
  list: () => requestJson<{ words: WordRow[]; sources: WordSource[] }>(base),
  get: (id: number) => requestJson<{ word: Word; sources: WordSource[] }>(`${base}/${id}`),
};

export const dailyWordApi = {
  get: (day?: string) =>
    requestJson<DailyWordsDay>(day ? `/api/daily-words?day=${day}` : '/api/daily-words'),
  setLearned: (id: number, learned: boolean) =>
    requestJson(`${base}/${id}/learned`, { method: 'PUT', body: { learned } }),
};
