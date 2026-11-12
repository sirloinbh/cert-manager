import { ArrowLeft, ClipboardPaste, Music, Search } from 'lucide-react';
import { type FormEvent, type MouseEvent, useId, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { Spinner } from './components/ui/spinner';
import { controlClass } from './form-fields';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
import { cn } from './lib/utils';
import {
  durationText,
  linesAsText,
  type LyricsStatus,
  searchAlbums,
  type Song,
  songApi,
  type SongPaths,
  statusLabels,
  textLineCount,
  translationProgress,
} from './song-data';
import { useLoad } from './use-load';
import { useSectionFocus } from './use-section-focus';

// Screens for songs and lyrics (#35): the album list with search and the line-by-line lyrics page.

const statusVariant: Record<LyricsStatus, 'outline' | 'secondary' | 'success'> = {
  none: 'outline',
  untranslated: 'secondary',
  translated: 'success',
};

function StatusBadge({ status }: { status: LyricsStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabels[status]}</Badge>;
}

const loadSongs = () => songApi.list();

export function SongList({ paths }: { paths: SongPaths }) {
  const loaded = useLoad('all', loadSongs);
  // In the URL, so coming back from a song finds the same search.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const searchId = useId();
  const albums = useMemo(() => (loaded.state === 'ok' ? loaded.data.albums : []), [loaded]);
  const shown = useMemo(() => searchAlbums(albums, search), [albums, search]);
  const progress = useMemo(() => translationProgress(albums), [albums]);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">Song lyrics</h1>
        <p className="text-body break-keep text-muted-foreground">
          Read song lyrics and their translations line by line.
        </p>
        {progress.total > 0 ? (
          <p role="status" className="text-caption text-muted-foreground">
            {progress.total} songs · {progress.withLyrics} with lyrics · {progress.translated}{' '}
            translated
          </p>
        ) : null}
      </header>
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: errorText(loaded.error, 'Could not load the song list') }}
        />
      ) : null}
      {loaded.state === 'ok' && albums.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Music />}
          title="No song list yet"
          description="Run the script that downloads the song list and it shows up by album."
        />
      ) : null}
      {albums.length > 0 ? (
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor={searchId}>Search songs</Label>
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              className="pl-9"
              value={search}
              onChange={(event) =>
                setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })
              }
              placeholder="Song title"
            />
          </div>
        </div>
      ) : null}
      {albums.length > 0 && shown.length === 0 ? (
        <p role="status" className="text-body-sm break-keep text-muted-foreground">
          No songs match &apos;{search.trim()}&apos;.
        </p>
      ) : null}
      {shown.map((album) => (
        <section
          key={album.id}
          aria-labelledby={`album-${album.id}`}
          className="flex flex-col gap-3"
        >
          <h2 id={`album-${album.id}`} className="flex flex-wrap items-baseline gap-x-2 break-keep">
            {album.title}
            {album.releaseDate ? (
              <span className="text-body-sm font-normal text-muted-foreground">
                {album.releaseDate.slice(0, 4)}
              </span>
            ) : null}
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm">
            {album.tracks.map((track) => (
              <li key={`${album.id}-${track.trackNumber}`}>
                <Link
                  to={paths.detail(track.songId)}
                  state={{ listSearch: params.toString() }}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="w-6 shrink-0 text-right text-caption text-muted-foreground">
                    {track.trackNumber}
                  </span>
                  <span className="min-w-0 flex-1 text-body-sm font-medium wrap-anywhere">
                    {track.title}
                  </span>
                  <StatusBadge status={track.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

const loadSong = (id: string) => songApi.get(Number(id));

type PasteKind = 'lyrics' | 'translation';

function PasteForm({
  kind,
  song,
  pending,
  setPending,
  onEdit,
  onSaved,
}: {
  kind: PasteKind;
  song: Song;
  pending: boolean;
  setPending: (pending: boolean) => void;
  onEdit: () => void;
  onSaved: (song: Song) => void;
}) {
  const key = kind === 'lyrics' ? 'original' : 'translation';
  const [text, setText] = useState(() => linesAsText(song.lines, key));
  const notice = useNotice();
  const id = useId();
  const originals = song.lines.filter((line) => line.original !== '').length;
  const typed = textLineCount(text);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    notice.clear();
    const request =
      kind === 'lyrics'
        ? songApi.saveLyrics(song.id, text)
        : songApi.saveTranslation(song.id, text);
    request.then(
      ({ song: saved }) => {
        toast.success(kind === 'lyrics' ? 'Saved the lyrics' : 'Saved the translation');
        onSaved(saved);
      },
      (error: unknown) => {
        notice.error(error, 'Could not save');
        setPending(false);
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="flex min-h-0 flex-col gap-4"
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-text`}>
          {kind === 'lyrics' ? 'Original lyrics' : 'Korean translation'}
        </Label>
        <textarea
          id={`${id}-text`}
          rows={12}
          required
          readOnly={pending}
          className={cn(controlClass, 'max-h-[50dvh] min-h-48 py-2')}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onEdit();
          }}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="text-caption break-keep text-muted-foreground">
          {kind === 'lyrics'
            ? `${typed} lines. Translations of lines whose text changed are cleared.`
            : `Write one line per original line (${originals}). Currently ${typed} lines. Blank lines are not counted.`}
        </p>
      </div>
      <Notice notice={notice.notice} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="Saving" /> : null}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

// A new key per song, so an open form or a save in progress does not carry over to another song.
export function SongDetail({ paths }: { paths: SongPaths }) {
  const { id = '' } = useParams();
  return <SongPage key={id} id={id} paths={paths} />;
}

function SongPage({ id, paths }: { id: string; paths: SongPaths }) {
  const loaded = useLoad(id, loadSong);
  // The song as last saved from this page.
  const [saved, setSaved] = useState<Song>();
  const [paste, setPaste] = useState<{ open: boolean; kind: PasteKind }>({
    open: false,
    kind: 'lyrics',
  });
  // While saving nothing closes the form. Once edited, only its buttons do, so typed text is not lost by accident.
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const focus = useSectionFocus();
  const titleId = useId();
  const { state } = useLocation() as { state: { listSearch?: string } | null };
  const listSearch = state?.listSearch;

  const back = (
    <Link
      to={listSearch ? `${paths.list}?${listSearch}` : paths.list}
      className="inline-flex min-h-9 w-fit items-center gap-1 rounded-md text-body-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Song list
    </Link>
  );

  if (loaded.state !== 'ok') {
    return (
      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        {back}
        <h1 id="page-title">Song</h1>
        {loaded.state === 'loading' ? (
          <SkeletonList rows={4} />
        ) : (
          <Notice
            notice={{
              kind: 'error',
              text:
                loaded.error instanceof RequestError && loaded.error.status === 404
                  ? 'Song not found.'
                  : errorText(loaded.error, 'Could not load the song'),
            }}
          />
        )}
      </section>
    );
  }

  const song = saved?.id === loaded.data.song.id ? saved : loaded.data.song;
  const hasLyrics = song.status !== 'none';
  const openPaste = (event: MouseEvent<HTMLElement>, kind: PasteKind) => {
    focus.remember(event);
    setEdited(false);
    setPaste({ open: true, kind });
  };
  const holdOpen = (event: Event) => {
    if (saving || edited) event.preventDefault();
  };
  const duration = durationText(song.durationSeconds);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      {back}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            id="page-title"
            ref={focus.heading}
            tabIndex={-1}
            className="wrap-anywhere outline-none"
          >
            {song.title}
          </h1>
          <StatusBadge status={song.status} />
        </div>
        <p className="text-body-sm break-keep text-muted-foreground">
          {[song.artistName, ...song.albums.map((album) => album.title), duration]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {song.note ? (
          <p className="text-body-sm break-keep whitespace-pre-wrap text-muted-foreground">
            {song.note}
          </p>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={(event) => openPaste(event, 'lyrics')}>
          <ClipboardPaste aria-hidden />
          Paste lyrics
        </Button>
        {hasLyrics ? (
          <Button variant="outline" onClick={(event) => openPaste(event, 'translation')}>
            <ClipboardPaste aria-hidden />
            Paste translation
          </Button>
        ) : null}
      </div>
      {!hasLyrics ? (
        <EmptyState
          className="break-keep"
          icon={<Music />}
          title="No lyrics yet"
          description="Paste the lyrics and they show line by line. Lyrics are stored only in the app on this PC."
        />
      ) : (
        <section aria-labelledby={titleId} className="flex flex-col gap-3">
          <h2 id={titleId} className="sr-only">
            Lyrics
          </h2>
          <ol className="flex flex-col rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            {song.lines.map((line) =>
              line.original === '' ? (
                <li key={line.lineNumber} aria-hidden className="h-4" />
              ) : (
                <li
                  key={line.lineNumber}
                  className="grid gap-x-6 gap-y-0.5 py-1.5 md:grid-cols-2 md:items-baseline"
                >
                  <p lang="en" className="text-body wrap-anywhere">
                    {line.original}
                  </p>
                  <p className="text-body-sm wrap-anywhere text-muted-foreground">
                    {line.translation ?? <span className="sr-only">No translation</span>}
                  </p>
                </li>
              ),
            )}
          </ol>
          {song.lyricsSource === 'lrclib' && song.lyricsSourceUrl ? (
            <a
              href={song.lyricsSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-caption text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Lyrics source: LRCLIB
            </a>
          ) : null}
        </section>
      )}
      <Dialog
        open={paste.open}
        onOpenChange={(open) => {
          if (!saving) setPaste((current) => ({ ...current, open }));
        }}
      >
        <DialogContent
          onCloseAutoFocus={focus.restore}
          onEscapeKeyDown={holdOpen}
          onInteractOutside={holdOpen}
        >
          <DialogHeader>
            <DialogTitle>
              {paste.kind === 'lyrics' ? 'Paste lyrics' : 'Paste translation'}
            </DialogTitle>
            <DialogDescription className="break-keep">
              {song.title}. Stored only in the app on this PC.
            </DialogDescription>
          </DialogHeader>
          {paste.open ? (
            <PasteForm
              key={paste.kind}
              kind={paste.kind}
              song={song}
              pending={saving}
              setPending={setSaving}
              onEdit={() => setEdited(true)}
              onSaved={(next) => {
                setSaving(false);
                setSaved(next);
                setPaste((current) => ({ ...current, open: false }));
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
