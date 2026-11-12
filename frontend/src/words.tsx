import { ArrowLeft, BookOpenText, Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { RequestError } from './lib/api';
import { errorText } from './lib/use-notice';
import { useLoad } from './use-load';
import {
  kindLabels,
  type Morpheme,
  morphemeForm,
  searchWords,
  type Word,
  wordApi,
  type WordPaths,
  type WordSource,
} from './word-data';

// Screens for the word list (#36): most frequent first with search, and one word with its word parts.

const pageSize = 100;

const linkClass =
  'text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

// The license of both sources asks for this wherever their material is shown.
export function SourceNote({ sources }: { sources: WordSource[] }) {
  const license = (kind: WordSource['kind']) =>
    sources.find((source) => source.kind === kind)?.license ?? 'CC BY-SA 4.0';
  return (
    <footer className="flex flex-col gap-1 border-t pt-4 text-caption break-keep text-muted-foreground">
      <p>
        Word list:{' '}
        <a
          href="https://www.newgeneralservicelist.com/new-general-service-list"
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          NGSL 1.2
        </a>{' '}
        (Browne, Culligan, Phillips), {license('ngsl')}
      </p>
      <p>
        Etymology data:{' '}
        <a href="https://en.wiktionary.org/" target="_blank" rel="noreferrer" className={linkClass}>
          Wiktionary
        </a>{' '}
        (
        <a href="https://kaikki.org/" target="_blank" rel="noreferrer" className={linkClass}>
          kaikki.org
        </a>{' '}
        extract), {license('wiktionary')}
      </p>
    </footer>
  );
}

const loadWords = () => wordApi.list();

export function WordList({ paths }: { paths: WordPaths }) {
  const loaded = useLoad('all', loadWords);
  // In the URL, so coming back from a word finds the same search.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  // Pages opened belong to the search they were opened for; while another search shows, it starts at one.
  const [paging, setPaging] = useState({ search, pages: 1 });
  const pages = paging.search === search ? paging.pages : 1;
  const searchId = useId();
  const words = useMemo(() => (loaded.state === 'ok' ? loaded.data.words : []), [loaded]);
  const matching = useMemo(() => searchWords(words, search), [words, search]);
  const filled = useMemo(() => words.filter((word) => word.meaningKo !== null).length, [words]);
  const shown = matching.slice(0, pages * pageSize);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">Vocabulary</h1>
        <p className="text-body break-keep text-muted-foreground">
          Browse common English words by frequency and analyze their etymology.
        </p>
        {words.length > 0 ? (
          <p role="status" className="text-caption text-muted-foreground">
            {words.length} words · {filled} with meanings
          </p>
        ) : null}
      </header>
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: errorText(loaded.error, 'Could not load the words') }}
        />
      ) : null}
      {loaded.state === 'ok' && words.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<BookOpenText />}
          title="No words yet"
          description="Run the script that downloads the word list and it shows up by frequency."
        />
      ) : null}
      {words.length > 0 ? (
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor={searchId}>Search words</Label>
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
              placeholder="English spelling or Korean meaning"
            />
          </div>
        </div>
      ) : null}
      {words.length > 0 && matching.length === 0 ? (
        <p role="status" className="text-body-sm break-keep text-muted-foreground">
          No words match &apos;{search.trim()}&apos;.
        </p>
      ) : null}
      {shown.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm">
          {shown.map((word) => (
            <li key={word.id}>
              <Link
                to={paths.detail(word.id)}
                state={{ listSearch: params.toString() }}
                className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="w-10 shrink-0 text-right text-caption text-muted-foreground">
                  {word.rank}
                </span>
                <span lang="en" className="w-28 shrink-0 text-body-sm font-medium wrap-anywhere">
                  {word.lemma}
                </span>
                <span className="min-w-0 flex-1 text-body-sm break-keep text-muted-foreground">
                  {word.meaningKo ?? 'No meaning yet'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {shown.length < matching.length ? (
        <Button
          variant="outline"
          className="w-fit self-center"
          onClick={() => setPaging({ search, pages: pages + 1 })}
        >
          Show more ({matching.length - shown.length} words left)
        </Button>
      ) : null}
      {loaded.state === 'ok' && words.length > 0 ? (
        <SourceNote sources={loaded.data.sources} />
      ) : null}
    </section>
  );
}

type ListSearch = { listSearch?: string };

function MorphemeWords({
  morpheme,
  paths,
  state,
}: {
  morpheme: Morpheme;
  paths: WordPaths;
  state: ListSearch;
}) {
  return (
    <section
      aria-label={`Words containing ${morphemeForm(morpheme)}`}
      className="flex flex-col gap-2"
    >
      <p className="text-body-sm break-keep">
        <span lang="en" className="font-medium">
          {morphemeForm(morpheme)}
        </span>{' '}
        ({kindLabels[morpheme.kind]}): {morpheme.meaningKo}
        {morpheme.origin ? ` · ${morpheme.origin}` : ''}
      </p>
      {morpheme.words.length === 0 ? (
        <p className="text-body-sm break-keep text-muted-foreground">
          No other words contain this part yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {morpheme.words.map((word) => (
            <li key={word.id} className="text-body-sm break-keep">
              <Link to={paths.detail(word.id)} state={state} lang="en" className={linkClass}>
                {word.lemma}
              </Link>
              {word.meaningKo ? (
                <span className="text-muted-foreground"> {word.meaningKo}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Etymology({ word, paths, state }: { word: Word; paths: WordPaths; state: ListSearch }) {
  const [selectedId, setSelectedId] = useState<number>();
  const selected = word.morphemes.find((morpheme) => morpheme.id === selectedId);
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId}>Etymology</h2>
      {word.morphemes.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            {word.morphemes.map((morpheme) => (
              <Button
                key={morpheme.id}
                variant={morpheme.id === selectedId ? 'default' : 'outline'}
                aria-pressed={morpheme.id === selectedId}
                onClick={() =>
                  setSelectedId((current) => (current === morpheme.id ? undefined : morpheme.id))
                }
              >
                <span lang="en">{morphemeForm(morpheme)}</span>{' '}
                <span className="font-normal">{morpheme.meaningKo}</span>
              </Button>
            ))}
          </div>
          {selected ? (
            <MorphemeWords morpheme={selected} paths={paths} state={state} />
          ) : (
            <p className="text-caption break-keep text-muted-foreground">
              Select a part to see other words that contain it.
            </p>
          )}
        </>
      ) : null}
      {word.etymologySource === null ? (
        <p className="text-body-sm break-keep text-muted-foreground">
          The etymology has not been looked up yet.
        </p>
      ) : null}
      {word.etymologySource === '' ? (
        <p className="text-body-sm break-keep text-muted-foreground">No etymology data</p>
      ) : null}
      {word.etymologySource ? (
        <details className="text-body-sm">
          <summary className="w-fit cursor-pointer rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Wiktionary etymology text
          </summary>
          <p lang="en" className="mt-2 wrap-anywhere whitespace-pre-wrap text-muted-foreground">
            {word.etymologySource}
          </p>
          {word.etymologyUrl ? (
            <a href={word.etymologyUrl} target="_blank" rel="noreferrer" className={linkClass}>
              View Wiktionary entry
            </a>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}

const loadWord = (id: string) => wordApi.get(Number(id));

// A new key per word, so the selected word part does not carry over to another word.
export function WordDetail({ paths }: { paths: WordPaths }) {
  const { id = '' } = useParams();
  return <WordPage key={id} id={id} paths={paths} />;
}

function WordPage({ id, paths }: { id: string; paths: WordPaths }) {
  const loaded = useLoad(id, loadWord);
  const { state } = useLocation() as { state: ListSearch | null };
  const listSearch = state?.listSearch;

  const back = (
    <Link
      to={listSearch ? `${paths.list}?${listSearch}` : paths.list}
      className="inline-flex min-h-9 w-fit items-center gap-1 rounded-md text-body-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Word list
    </Link>
  );

  if (loaded.state !== 'ok') {
    return (
      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        {back}
        <h1 id="page-title">Word</h1>
        {loaded.state === 'loading' ? (
          <SkeletonList rows={4} />
        ) : (
          <Notice
            notice={{
              kind: 'error',
              text:
                loaded.error instanceof RequestError && loaded.error.status === 404
                  ? 'Word not found.'
                  : errorText(loaded.error, 'Could not load the words'),
            }}
          />
        )}
      </section>
    );
  }

  const { word, sources } = loaded.data;
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      {back}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 id="page-title" lang="en" className="wrap-anywhere">
            {word.lemma}
          </h1>
          {word.aiGenerated ? <Badge variant="secondary">AI summary</Badge> : null}
        </div>
        <p className="text-body-sm break-keep text-muted-foreground">
          {[`Rank ${word.rank}`, word.partOfSpeech].filter(Boolean).join(' · ')}
        </p>
      </header>
      {word.meaningKo === null ? (
        <p className="text-body-sm break-keep text-muted-foreground">
          The meaning and example are not filled in yet.
        </p>
      ) : (
        <section aria-label="Meaning and examples" className="flex flex-col gap-2">
          <p className="text-body break-keep">{word.meaningKo}</p>
          {word.exampleEn ? (
            <blockquote className="flex flex-col gap-0.5 border-l-2 pl-3">
              <p lang="en" className="text-body-sm wrap-anywhere">
                {word.exampleEn}
              </p>
              {word.exampleKo ? (
                <p className="text-body-sm break-keep text-muted-foreground">{word.exampleKo}</p>
              ) : null}
            </blockquote>
          ) : null}
        </section>
      )}
      <Etymology word={word} paths={paths} state={{ listSearch }} />
      <SourceNote sources={sources} />
    </section>
  );
}
