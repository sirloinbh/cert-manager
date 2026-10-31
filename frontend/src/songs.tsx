import { ArrowLeft, ClipboardPaste, Music, Search } from 'lucide-react';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

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
  const [search, setSearch] = useState('');
  const searchId = useId();
  const albums = useMemo(() => (loaded.state === 'ok' ? loaded.data.albums : []), [loaded]);
  const shown = useMemo(() => searchAlbums(albums, search), [albums, search]);
  const progress = useMemo(() => translationProgress(albums), [albums]);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">팝송 가사</h1>
        <p className="text-body break-keep text-muted-foreground">
          팝송 가사 원문과 번역을 줄 단위로 봅니다.
        </p>
        {progress.total > 0 ? (
          <p role="status" className="text-caption text-muted-foreground">
            {progress.total}곡 · 가사 {progress.withLyrics}곡 · 번역 {progress.translated}곡
          </p>
        ) : null}
      </header>
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: errorText(loaded.error, '곡 목록을 불러오지 못했습니다') }}
        />
      ) : null}
      {loaded.state === 'ok' && albums.length === 0 ? (
        <EmptyState
          icon={<Music />}
          title="아직 곡 목록이 없습니다"
          description="곡 목록을 받는 스크립트를 실행하면 앨범별로 보입니다."
        />
      ) : null}
      {albums.length > 0 ? (
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor={searchId}>곡 검색</Label>
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="곡 제목"
            />
          </div>
        </div>
      ) : null}
      {albums.length > 0 && shown.length === 0 ? (
        <p role="status" className="text-body-sm break-keep text-muted-foreground">
          &apos;{search.trim()}&apos;이(가) 들어간 곡이 없습니다.
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
  onSaved,
}: {
  kind: PasteKind;
  song: Song;
  onSaved: (song: Song) => void;
}) {
  const key = kind === 'lyrics' ? 'original' : 'translation';
  const [text, setText] = useState(() => linesAsText(song.lines, key));
  const [pending, setPending] = useState(false);
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
        toast.success(kind === 'lyrics' ? '가사를 저장했습니다' : '번역을 저장했습니다');
        onSaved(saved);
      },
      (error: unknown) => {
        notice.error(error, '저장하지 못했습니다');
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
        <Label htmlFor={`${id}-text`}>{kind === 'lyrics' ? '가사 원문' : '한국어 번역'}</Label>
        <textarea
          id={`${id}-text`}
          rows={12}
          required
          className={cn(controlClass, 'max-h-[50dvh] min-h-48 py-2')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="text-caption break-keep text-muted-foreground">
          {kind === 'lyrics'
            ? `${typed}줄입니다. 내용이 바뀐 줄의 번역은 지워집니다.`
            : `원문 ${originals}줄과 같은 수로 한 줄씩 씁니다. 지금 ${typed}줄입니다. 빈 줄은 세지 않습니다.`}
        </p>
      </div>
      <Notice notice={notice.notice} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            취소
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SongDetail({ paths }: { paths: SongPaths }) {
  const { id = '' } = useParams();
  const loaded = useLoad(id, loadSong);
  // The song as last saved from this page.
  const [saved, setSaved] = useState<Song>();
  const [paste, setPaste] = useState<{ open: boolean; kind: PasteKind }>({
    open: false,
    kind: 'lyrics',
  });
  const titleId = useId();

  const back = (
    <Link
      to={paths.list}
      className="inline-flex min-h-9 w-fit items-center gap-1 rounded-md text-body-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden />곡 목록
    </Link>
  );

  if (loaded.state !== 'ok') {
    return (
      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        {back}
        <h1 id="page-title">곡</h1>
        {loaded.state === 'loading' ? (
          <SkeletonList rows={4} />
        ) : (
          <Notice
            notice={{
              kind: 'error',
              text:
                loaded.error instanceof RequestError && loaded.error.status === 404
                  ? '곡을 찾을 수 없습니다.'
                  : errorText(loaded.error, '곡을 불러오지 못했습니다'),
            }}
          />
        )}
      </section>
    );
  }

  const song = saved?.id === loaded.data.song.id ? saved : loaded.data.song;
  const hasLyrics = song.status !== 'none';
  const openPaste = (kind: PasteKind) => setPaste({ open: true, kind });
  const duration = durationText(song.durationSeconds);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      {back}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 id="page-title" className="wrap-anywhere">
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
        <Button variant="outline" onClick={() => openPaste('lyrics')}>
          <ClipboardPaste aria-hidden />
          가사 붙여 넣기
        </Button>
        {hasLyrics ? (
          <Button variant="outline" onClick={() => openPaste('translation')}>
            <ClipboardPaste aria-hidden />
            번역 붙여 넣기
          </Button>
        ) : null}
      </div>
      {!hasLyrics ? (
        <EmptyState
          icon={<Music />}
          title="아직 가사가 없습니다"
          description="가사를 붙여 넣으면 줄 단위로 보입니다. 가사는 이 PC의 앱에만 저장됩니다."
        />
      ) : (
        <section aria-labelledby={titleId} className="flex flex-col gap-3">
          <h2 id={titleId} className="sr-only">
            가사
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
                    {line.translation ?? <span className="sr-only">번역 없음</span>}
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
              가사 출처 LRCLIB
            </a>
          ) : null}
        </section>
      )}
      <Dialog
        open={paste.open}
        onOpenChange={(open) => setPaste((current) => ({ ...current, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paste.kind === 'lyrics' ? '가사 붙여 넣기' : '번역 붙여 넣기'}
            </DialogTitle>
            <DialogDescription className="break-keep">
              {song.title}. 이 PC의 앱에만 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          {paste.open ? (
            <PasteForm
              key={paste.kind}
              kind={paste.kind}
              song={song}
              onSaved={(next) => {
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
