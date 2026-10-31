import { Pool } from 'pg';

import {
  albumTracks,
  countDifferences,
  listAlbums,
  type MbRelease,
  pickBaseRelease,
  pickVaultRelease,
} from './song-list.js';
import { saveSongList, type SongListInput } from './song-list-save.js';

// Loads the song list from MusicBrainz into the database named by DATABASE_URL (#35). Safe to run again.
// Only titles, dates and lengths are stored (CC0); this script never touches lyrics.

const api = 'https://musicbrainz.org/ws/2';
const artist = { id: '20244d07-534f-4eff-b4d4-930878889970', name: 'Taylor Swift' };
const userAgent = 'cert-manager/0.1 (https://github.com/sirloinbh/cert-manager)';
// MusicBrainz allows one request a second on average.
const requestGap = 1100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const maxAttempts = 6;

// A busy MusicBrainz answers 503; it asks to slow down, so each retry waits longer.
async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${api}${path}`, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    });
    await sleep(requestGap);
    if (response.ok) return (await response.json()) as T;
    if (response.status !== 503 || attempt === maxAttempts) {
      throw new Error(`MusicBrainz ${response.status}: ${path}`);
    }
    const asked = Number(response.headers.get('retry-after'));
    await sleep(Math.max(asked * 1000 || 0, attempt * 5000));
  }
}

async function allReleases(releaseGroupId: string) {
  const releases: MbRelease[] = [];
  for (;;) {
    const page = await get<{ releases: MbRelease[]; 'release-count': number }>(
      `/release?release-group=${releaseGroupId}&status=official&inc=recordings&limit=100&offset=${releases.length}&fmt=json`,
    );
    releases.push(...page.releases);
    if (page.releases.length === 0 || releases.length >= page['release-count']) return releases;
  }
}

type ReleaseGroup = { 'first-release-date'?: string };

// A full date is required by the column; a bare year or month is not known precisely enough.
const fullDate = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Says where the list goes before the minute of downloading; the password stays out.
  const target = new URL(url);
  console.log(`Target database: ${target.hostname}${target.pathname}`);

  const albums: SongListInput['albums'] = [];
  for (const album of listAlbums) {
    const group = await get<ReleaseGroup>(`/release-group/${album.releaseGroupId}?fmt=json`);
    const releases = await allReleases(album.releaseGroupId);
    const release =
      album.kind === 'studio' ? pickBaseRelease(releases) : pickVaultRelease(releases);
    if (!release) throw new Error(`No release found for ${album.title}`);
    const tracks = albumTracks(album, release);
    albums.push({ album, date: fullDate(group['first-release-date']), tracks });
    console.log(`${album.title}: ${tracks.length} songs`);
  }

  // MusicBrainz data changes. Another edition may now be picked, so nothing is saved until someone looks.
  const differences = countDifferences(albums);
  if (differences.length > 0) {
    throw new Error(
      `Song counts changed, nothing saved. Check them and update listAlbums in song-list.ts:\n${differences.join('\n')}`,
    );
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { keptSongs } = await saveSongList(pool, { artist, albums, sourceUrl: api });
    console.log(
      `Saved ${albums.reduce((sum, { tracks }) => sum + tracks.length, 0)} album tracks.`,
    );
    if (keptSongs > 0) {
      console.warn(
        `${keptSongs} songs hold lyrics but are no longer on any album, so the list hides them.`,
      );
    }
  } finally {
    await pool.end();
  }
}

await main();
