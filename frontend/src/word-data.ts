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

export type WordPaths = {
  list: string;
  detail: (id: number) => string;
};

export const kindLabels: Record<Morpheme['kind'], string> = {
  prefix: '접두사',
  root: '어근',
  suffix: '접미사',
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

const base = '/api/words';

export const wordApi = {
  list: () => requestJson<{ words: WordRow[]; sources: WordSource[] }>(base),
  get: (id: number) => requestJson<{ word: Word; sources: WordSource[] }>(`${base}/${id}`),
};
