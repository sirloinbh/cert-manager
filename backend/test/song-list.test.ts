import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  albumTracks,
  countDifferences,
  listAlbums,
  type MbRelease,
  pickBaseRelease,
  pickVaultRelease,
  songTitle,
} from '../src/song-list.js';

const track = (title: string, id = title, length: number | null = 200_000) => ({
  title,
  length,
  recording: { id },
});

const release = (id: string, count: number, date?: string): MbRelease => ({
  id,
  date,
  media: [{ tracks: Array.from({ length: count }, (_, index) => track(`Song ${index + 1}`)) }],
});

const studio = { releaseGroupId: 'g', title: 'A', kind: 'studio' as const };
const taylors = { releaseGroupId: 'g', title: 'A TV', kind: 'taylors_version' as const };

test("the list covers twelve studio albums and four Taylor's Version albums", () => {
  assert.equal(listAlbums.filter((album) => album.kind === 'studio').length, 12);
  assert.equal(listAlbums.filter((album) => album.kind === 'taylors_version').length, 4);
  assert.equal(new Set(listAlbums.map((album) => album.releaseGroupId)).size, 16);
});

test('the base edition is the smallest full release, then the earliest', () => {
  const picked = pickBaseRelease([
    release('deluxe', 19, '2010-01-01'),
    release('single', 2, '2009-01-01'),
    release('later', 13, '2012-01-01'),
    release('first', 13, '2008-11-11'),
  ]);
  assert.equal(picked?.id, 'first');
  assert.equal(pickBaseRelease([release('single', 2)]), undefined);
});

test('a release without a date loses to one with a date', () => {
  assert.equal(pickBaseRelease([release('b', 13), release('a', 13, '2020-01-01')])?.id, 'a');
});

test('tracks across discs are numbered in order', () => {
  const twoDiscs: MbRelease = {
    id: 'r',
    media: [{ tracks: [track('One')] }, { tracks: [track('Two')] }],
  };
  assert.deepEqual(
    albumTracks(studio, twoDiscs).map((item) => [item.trackNumber, item.title]),
    [
      [1, 'One'],
      [2, 'Two'],
    ],
  );
});

test("Taylor's Version albums add only their vault songs, keeping the album's numbering", () => {
  const edition: MbRelease = {
    id: 'r',
    media: [
      {
        tracks: [
          track('Old Song (Taylor’s Version)'),
          track('New Song (Taylor’s Version) (From the Vault)'),
        ],
      },
    ],
  };
  assert.deepEqual(albumTracks(taylors, edition), [
    {
      trackNumber: 2,
      title: 'New Song',
      durationSeconds: 200,
      recordingId: 'New Song (Taylor’s Version) (From the Vault)',
    },
  ]);
});

test('the edition with the most vault songs wins', () => {
  const edition = (id: string, vaults: number): MbRelease => ({
    id,
    media: [
      {
        tracks: [
          track('Old'),
          ...Array.from({ length: vaults }, (_, index) => track(`V${index} (From the Vault)`)),
        ],
      },
    ],
  });
  assert.equal(
    pickVaultRelease([edition('few', 1), edition('more', 6), edition('none', 0)])?.id,
    'more',
  );
  assert.equal(pickVaultRelease([edition('none', 0)]), undefined);
});

test('lyric videos and repeated titles are not extra vault songs', () => {
  const withVideos: MbRelease = {
    id: 'videos',
    media: [
      {
        tracks: [
          track('Song A (Taylor’s Version) (From the Vault)', 'a'),
          track('Song B (Taylor’s Version) (From the Vault)', 'b'),
          track('Song A (Taylor’s Version) (From the Vault) (lyric video)', 'a-video'),
          track('Song B (Taylor’s Version) (From the Vault)', 'b-again'),
        ],
      },
    ],
  };
  assert.deepEqual(
    albumTracks(taylors, withVideos).map((item) => [
      item.trackNumber,
      item.title,
      item.recordingId,
    ]),
    [
      [1, 'Song A', 'a'],
      [2, 'Song B', 'b'],
    ],
  );
  // Videos do not make an edition look bigger than one with more real songs.
  const fuller: MbRelease = {
    id: 'fuller',
    date: '2022-01-01',
    media: [
      {
        tracks: [
          track('Song A (From the Vault)', 'a'),
          track('Song B (From the Vault)', 'b'),
          track('Song C (From the Vault)', 'c'),
        ],
      },
    ],
  };
  assert.equal(pickVaultRelease([withVideos, fuller])?.id, 'fuller');
});

test('one recording under two titles is one song', () => {
  const edition: MbRelease = {
    id: 'r',
    media: [{ tracks: [track('Song', 'same'), track('Song (Alternate Title)', 'same')] }],
  };
  assert.deepEqual(
    albumTracks(studio, edition).map((item) => item.title),
    ['Song'],
  );
});

test('song counts that differ from the checked ones are named', () => {
  const album = { ...studio, songs: 2 };
  const tracks = albumTracks(studio, release('r', 3));
  assert.deepEqual(countDifferences([{ album, tracks }]), ['A: expected 2, got 3']);
  assert.deepEqual(countDifferences([{ album, tracks: tracks.slice(0, 2) }]), []);
});

test('the checked song counts add up', () => {
  assert.equal(
    listAlbums.reduce((sum, album) => sum + album.songs, 0),
    198,
  );
});

test('version labels leave the title, in either quote mark and bracket', () => {
  assert.equal(songTitle('A (Taylor’s Version) (From the Vault)'), 'A');
  assert.equal(
    songTitle("A (10 Minute Version) (Taylor's Version) (From the Vault)"),
    'A (10 Minute Version)',
  );
  assert.equal(songTitle('A [From the Vault]'), 'A');
  assert.equal(songTitle('Plain (Remix)'), 'Plain (Remix)');
});

test('a missing or zero length has no duration, and the recording length is the fallback', () => {
  const edition: MbRelease = {
    id: 'r',
    media: [
      {
        tracks: [
          track('None', 'a', null),
          track('Zero', 'b', 0),
          { title: 'Fallback', recording: { id: 'c', length: 61_400 } },
        ],
      },
    ],
  };
  assert.deepEqual(
    albumTracks(studio, edition).map((item) => item.durationSeconds),
    [null, null, 61],
  );
});
