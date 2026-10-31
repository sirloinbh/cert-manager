import { requestJson } from './lib/api';

// Songs and lyrics (#35): API calls and display rules. The screens are in songs.tsx.

export type LyricsStatus = 'none' | 'untranslated' | 'translated';

type SongTrack = {
  songId: number;
  trackNumber: number;
  title: string;
  status: LyricsStatus;
};

export type SongAlbum = {
  id: number;
  title: string;
  kind: 'studio' | 'taylors_version';
  releaseDate: string | null;
  tracks: SongTrack[];
};

export type LyricLine = {
  lineNumber: number;
  original: string;
  translation: string | null;
};

export type Song = {
  id: number;
  title: string;
  artistName: string;
  durationSeconds: number | null;
  lyricsSource: 'lrclib' | 'manual' | null;
  lyricsSourceUrl: string | null;
  note: string;
  status: LyricsStatus;
  albums: { id: number; title: string; trackNumber: number }[];
  lines: LyricLine[];
};

export type SongPaths = {
  list: string;
  detail: (id: number) => string;
};

export const statusLabels: Record<LyricsStatus, string> = {
  none: '가사 없음',
  untranslated: '번역 전',
  translated: '번역 있음',
};

// Song titles use a curly apostrophe, which a keyboard does not type.
const forSearch = (text: string) => text.replace(/[‘’]/g, "'").toLocaleLowerCase();

/** Albums with the tracks whose title holds the search words, ignoring case and spacing around them. */
export function searchAlbums(albums: SongAlbum[], search: string) {
  const words = forSearch(search.trim());
  if (!words) return albums;
  return albums
    .map((album) => ({
      ...album,
      tracks: album.tracks.filter((track) => forSearch(track.title).includes(words)),
    }))
    .filter((album) => album.tracks.length > 0);
}

/** How far along the list is, counted per song since one song can be on several albums. */
export function translationProgress(albums: SongAlbum[]) {
  const songs = new Map(
    albums.flatMap((album) => album.tracks).map((track) => [track.songId, track]),
  );
  const all = [...songs.values()];
  return {
    total: all.length,
    withLyrics: all.filter((track) => track.status !== 'none').length,
    translated: all.filter((track) => track.status === 'translated').length,
  };
}

/** Lines with text, for counting against a pasted translation. Blank lines do not count. */
export const textLineCount = (text: string) =>
  text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '').length;

/** The lyrics or translation as text for the paste form, keeping blank lines between verses. */
export const linesAsText = (lines: LyricLine[], key: 'original' | 'translation') =>
  lines.map((line) => line[key] ?? '').join('\n');

export function durationText(seconds: number | null) {
  if (seconds === null) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const base = '/api/songs';

export const songApi = {
  list: () => requestJson<{ albums: SongAlbum[] }>(base),
  get: (id: number) => requestJson<{ song: Song }>(`${base}/${id}`),
  saveLyrics: (id: number, original: string) =>
    requestJson<{ song: Song }>(`${base}/${id}/lyrics`, { method: 'PUT', body: { original } }),
  saveTranslation: (id: number, translation: string) =>
    requestJson<{ song: Song }>(`${base}/${id}/translation`, {
      method: 'PUT',
      body: { translation },
    }),
};
