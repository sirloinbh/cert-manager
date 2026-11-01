import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { errorText } from './lib/use-notice';
import { useLoad } from './use-load';
import {
  type DailyWord,
  dailyWordApi,
  type DailyWordsDay,
  isLearned,
  serviceToday,
  type WordPaths,
} from './word-data';
import { SourceNote } from './words';

// The dashboard card for the day's words (#37). The meaning stays folded, so the word can be tried first.

// The key is "<day or today>/<attempt>": moving again, even to the same day, asks again after a failure.
const loadDay = (key: string) => {
  const day = key.slice(0, key.indexOf('/'));
  return dailyWordApi.get(day === 'today' ? undefined : day);
};

// Not the disabled attribute: the arrow just pressed would lose keyboard focus at the first or last day.
const arrowClass = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

function WordMeaning({ word, paths }: { word: DailyWord; paths: WordPaths }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {word.meaningKo === null ? (
        <p className="text-body-sm break-keep text-muted-foreground">
          아직 뜻과 예문을 채우지 않았습니다.
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-body-sm break-keep">
            {word.partOfSpeech ? (
              <span className="text-muted-foreground">{word.partOfSpeech}</span>
            ) : null}
            {word.meaningKo}
            {word.aiGenerated ? <Badge variant="secondary">AI 정리</Badge> : null}
          </p>
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
        </>
      )}
      {word.etymologySource === null ? (
        <p className="text-caption break-keep text-muted-foreground">
          아직 어원을 찾아보지 않았습니다.
        </p>
      ) : word.etymologySource ? (
        <p lang="en" className="line-clamp-4 text-caption wrap-anywhere text-muted-foreground">
          {word.etymologySource}
        </p>
      ) : (
        <p className="text-caption break-keep text-muted-foreground">어원 자료 없음</p>
      )}
      <Link
        to={paths.detail(word.id)}
        className="w-fit text-body-sm text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        단어 자세히 보기
      </Link>
    </div>
  );
}

export function DailyWords({ paths }: { paths: WordPaths }) {
  // No day chosen means today, whatever date that is by the time the card loads.
  const [day, setDay] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const loaded = useLoad(`${day ?? 'today'}/${attempt}`, loadDay);
  // The last answer stays on screen while another day loads, so the arrows keep keyboard focus.
  const [shown, setShown] = useState<DailyWordsDay>();
  if (loaded.state === 'ok' && loaded.data !== shown) setShown(loaded.data);
  const [changed, setChanged] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<number[]>([]);

  // A page left open overnight must not keep showing yesterday's words as today's.
  const shownToday = shown?.today;
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible' || !shownToday) return;
      if (serviceToday() !== shownToday) setAttempt((current) => current + 1);
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [shownToday]);

  const toggle = async (word: DailyWord, learned: boolean) => {
    setSaving((current) => [...current, word.id]);
    try {
      await dailyWordApi.setLearned(word.id, learned);
      setChanged((current) => ({ ...current, [word.id]: learned }));
    } catch (error) {
      toast.error(errorText(error, '외운 단어를 저장하지 못했습니다'));
    } finally {
      setSaving((current) => current.filter((id) => id !== word.id));
    }
  };

  const go = (target: string | null) => {
    if (!target) return;
    setDay(target === shown?.today ? undefined : target);
    setAttempt((current) => current + 1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <CardTitle asHeading="h2" className="text-body">
              오늘의 단어
            </CardTitle>
            {/* Always there, so a screen reader announces the change of day. */}
            <p role="status" className="text-caption text-muted-foreground">
              {shown ? (shown.day === shown.today ? shown.day : `${shown.day}의 단어`) : null}
            </p>
          </div>
          {shown ? (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="이전 날의 단어"
                className={arrowClass}
                aria-disabled={!shown.previousDay}
                onClick={() => go(shown.previousDay)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="다음 날의 단어"
                className={arrowClass}
                aria-disabled={!shown.nextDay}
                onClick={() => go(shown.nextDay)}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!shown && loaded.state === 'loading' ? <SkeletonList rows={3} /> : null}
        {loaded.state === 'error' ? (
          <Notice
            notice={{ kind: 'error', text: errorText(loaded.error, '단어를 불러오지 못했습니다') }}
          />
        ) : null}
        {shown?.words.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            보여 줄 단어가 없습니다. 단어 목록을 아직 받지 않았거나 모두 외운 상태입니다.
          </p>
        ) : null}
        {shown && shown.words.length > 0 ? (
          <>
            <ul className="flex flex-col divide-y">
              {shown.words.map((word) => {
                const learned = isLearned(word, changed);
                return (
                  <li key={word.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <Link
                          to={paths.detail(word.id)}
                          lang="en"
                          className="font-medium wrap-anywhere underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {word.lemma}
                        </Link>
                        <span className="text-caption text-muted-foreground">
                          빈도 {word.rank}위
                        </span>
                      </div>
                      <Button
                        variant={learned ? 'default' : 'outline'}
                        size="sm"
                        className="shrink-0"
                        aria-pressed={learned}
                        aria-label={`${word.lemma} 외웠어요`}
                        disabled={saving.includes(word.id)}
                        onClick={() => void toggle(word, !learned)}
                      >
                        {learned ? <Check aria-hidden /> : null}
                        외웠어요
                      </Button>
                    </div>
                    <details className="group mt-1 text-body-sm">
                      <summary className="flex min-h-9 w-fit cursor-pointer items-center rounded-md text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:min-h-11">
                        <ChevronRight
                          className="size-4 transition-transform group-open:rotate-90"
                          aria-hidden
                        />
                        뜻과 어원<span className="sr-only"> ({word.lemma})</span>
                      </summary>
                      <WordMeaning word={word} paths={paths} />
                    </details>
                  </li>
                );
              })}
            </ul>
            <SourceNote sources={shown.sources} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
