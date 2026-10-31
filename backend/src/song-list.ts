// Which albums and tracks make up the song list (#35). Scope: docs/research/english-content-sources.md section 3.

export type ListAlbum = {
  releaseGroupId: string;
  title: string;
  kind: 'studio' | 'taylors_version';
};

// MusicBrainz release groups, checked on 2026-10-31. Taylor's Version albums only add their vault songs.
export const listAlbums: ListAlbum[] = [
  { releaseGroupId: 'ba1d0c2a-bb07-38bc-835c-a880f76f1309', title: 'Taylor Swift', kind: 'studio' },
  { releaseGroupId: '63eba062-847c-3b73-8b0f-6baf27bba6fa', title: 'Fearless', kind: 'studio' },
  { releaseGroupId: 'ba1259eb-d41e-41c5-a70c-0e6fa73e6708', title: 'Speak Now', kind: 'studio' },
  { releaseGroupId: 'a73cecde-0923-40ad-aad1-e8c24ba6c3d2', title: 'Red', kind: 'studio' },
  { releaseGroupId: '4d9ec1c2-58ec-48a4-aa0a-916718adead0', title: '1989', kind: 'studio' },
  { releaseGroupId: 'f060c8fd-bec9-426e-800e-8efc040a71e6', title: 'reputation', kind: 'studio' },
  { releaseGroupId: '30e9785b-7b50-4d29-b3d1-96fb55e3397f', title: 'Lover', kind: 'studio' },
  { releaseGroupId: 'f1d08326-c23b-4b43-be3b-20b33ab10bf6', title: 'folklore', kind: 'studio' },
  { releaseGroupId: 'e86d6219-f5a2-4edd-bf2b-3f9eab190ae0', title: 'evermore', kind: 'studio' },
  { releaseGroupId: '0dcc84fb-c592-46e9-ba92-a52bb44dd553', title: 'Midnights', kind: 'studio' },
  {
    releaseGroupId: '71c3eed6-466c-4aef-ad12-65a36d19467a',
    title: 'The Tortured Poets Department',
    kind: 'studio',
  },
  {
    releaseGroupId: '9ae7e7e9-ac40-4874-bd43-d77a9bb9b617',
    title: 'The Life of a Showgirl',
    kind: 'studio',
  },
  {
    releaseGroupId: 'd2e4838d-90e1-471c-bda0-fd816dabb2d4',
    title: "Fearless (Taylor's Version)",
    kind: 'taylors_version',
  },
  {
    releaseGroupId: '67727253-f1c0-4243-9270-f9f1401c3b8c',
    title: "Red (Taylor's Version)",
    kind: 'taylors_version',
  },
  {
    releaseGroupId: '0441b1b2-de57-4a9a-b007-1f6e159921d5',
    title: "Speak Now (Taylor's Version)",
    kind: 'taylors_version',
  },
  {
    releaseGroupId: '1c4770b3-b7a3-4d44-a7a9-8e2dbb74b85a',
    title: "1989 (Taylor's Version)",
    kind: 'taylors_version',
  },
];

type MbTrack = {
  number?: string;
  position?: number;
  title: string;
  length?: number | null;
  recording: { id: string; length?: number | null };
};

export type MbRelease = {
  id: string;
  date?: string;
  media?: { tracks?: MbTrack[] }[];
};

export type ListTrack = {
  trackNumber: number;
  title: string;
  durationSeconds: number | null;
  recordingId: string;
};

// A release with fewer tracks than this is a single or a sampler, not the album.
const smallestAlbum = 8;

const releaseTracks = (release: MbRelease) => release.media?.flatMap((m) => m.tracks ?? []) ?? [];

// Some editions also list lyric videos of the same songs; those are not songs of their own.
const isVault = (title: string) => /from the vault/i.test(title) && !/\bvideo\b/i.test(title);

/** The base edition is the smallest full release; among equals the earliest, then the lowest id so runs agree. */
export function pickBaseRelease(releases: MbRelease[]) {
  return [...releases]
    .filter((release) => releaseTracks(release).length >= smallestAlbum)
    .sort(
      (a, b) =>
        releaseTracks(a).length - releaseTracks(b).length ||
        (a.date || '9999').localeCompare(b.date || '9999') ||
        a.id.localeCompare(b.id),
    )[0];
}

/** The release with the most vault songs, since some editions leave them out. */
export function pickVaultRelease(releases: MbRelease[]) {
  const vaultCount = (release: MbRelease) =>
    new Set(
      releaseTracks(release)
        .filter((track) => isVault(track.title))
        .map((track) => songTitle(track.title)),
    ).size;
  return [...releases]
    .filter((release) => vaultCount(release) > 0)
    .sort(
      (a, b) =>
        vaultCount(b) - vaultCount(a) ||
        (a.date || '9999').localeCompare(b.date || '9999') ||
        a.id.localeCompare(b.id),
    )[0];
}

/** "Mr. Perfectly Fine (Taylor’s Version) (From the Vault)" is listed as "Mr. Perfectly Fine". */
export const songTitle = (title: string) =>
  title
    .replace(/\s*[([]\s*taylor[’']s version\s*[)\]]/gi, '')
    .replace(/\s*[([]\s*from the vault\s*[)\]]/gi, '')
    .trim();

/** The tracks one album adds to the list, numbered as on that release. A title repeated on it counts once. */
export function albumTracks(album: ListAlbum, release: MbRelease): ListTrack[] {
  const seen = new Set<string>();
  return releaseTracks(release)
    .map((track, index) => ({ track, trackNumber: index + 1 }))
    .filter(({ track }) => album.kind === 'studio' || isVault(track.title))
    .filter(({ track }) => {
      const title = songTitle(track.title);
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    })
    .map(({ track, trackNumber }) => {
      const length = track.length ?? track.recording.length ?? null;
      return {
        trackNumber,
        title: songTitle(track.title),
        durationSeconds: length === null || length <= 0 ? null : Math.round(length / 1000),
        recordingId: track.recording.id,
      };
    });
}
